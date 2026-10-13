import { IncidentKinds, incidentKind } from '#helpers/perfIncidents.js';
import { rankSources } from '#helpers/perfStats.js';
import type { IncidentKind, PerfIncident, SessionGame, SessionPerf, SessionProblem } from '#lib/types/session.js';

export interface SessionVerdict {
	cause: string | null;
	problem: SessionProblem | null;
	summary: string | null;
}

/** Below this much blocked time the session is judged on its steady timer lag and frame jank instead. */
const MIN_BLOCKED_MS = 1_000;
const MAX_CAUSE = 80;
const MAX_MOMENTS = 5;
/** Discord embed descriptions stop at 4096 characters. */
const MAX_SUMMARY = 3_500;
const MOMENTS_HEADER = '\n\nWorst moments';
/** The counts behind a render problem stay in the Context line, a cause that changes per session would defeat the per-cause throttle. */
const RENDER_CAUSE = 'render';
const SCRIPTS_SHOWN = 2;
const SOURCES_SHOWN = 4;
const SPANS_SHOWN = 2;

/** The order breaks ties between kinds that blocked the same time. */
const KINDS = [IncidentKinds.INPUT, IncidentKinds.FREEZE, IncidentKinds.STALL, IncidentKinds.FRAME] as const;

const KIND_NOUNS: Record<IncidentKind, readonly [string, string]> = {
	[IncidentKinds.FRAME]: ['long frame', 'long frames'],
	[IncidentKinds.FREEZE]: ['freeze', 'freezes'],
	[IncidentKinds.INPUT]: ['slow interaction', 'slow interactions'],
	[IncidentKinds.STALL]: ['stall', 'stalls'],
};

const KIND_PROBLEMS: Record<IncidentKind, SessionProblem> = {
	[IncidentKinds.FRAME]: 'render-bound',
	[IncidentKinds.FREEZE]: 'freezes',
	[IncidentKinds.INPUT]: 'slow-interactions',
	[IncidentKinds.STALL]: 'low-frame-rate',
};

const PROBLEM_LABELS: Record<SessionProblem, string> = {
	freezes: 'Freezes',
	'low-frame-rate': 'Low frame rate',
	'render-bound': 'Render bound',
	'slow-interactions': 'Slow interactions',
};

/**
 * Client text goes into one backtick span with no backtick, control character or line break inside: Discord parses neither
 * mentions nor links there, so a name like `@everyone` or `https://evil` stays inert.
 */
const code = (text: string, max: number) => `\`${text.replace(/[\p{Cc}\p{Cf}`]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || '?'}\``;

const duration = (ms: number) => (ms < 1_000 ? `${Math.round(ms)} ms` : `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)} s`);

const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1_000) % 60).padStart(2, '0')}`;

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

const plural = (count: number, [one, many]: readonly [string, string]) => `${count} ${count === 1 ? one : many}`;

const invokerName = (invoker: string) => invoker.replace(/^event-listener:/, '');

/** Render time against JavaScript time over a set of incidents, taken from the best breakdown each one has. */
function renderDominates(incidents: readonly PerfIncident[]): boolean {
	let js = 0;
	let render = 0;
	for (const incident of incidents) {
		if (incident.loaf) {
			js += incident.loaf.scriptMs;
			render += incident.loaf.styleLayoutMs;
		} else if (incident.input) {
			js += incident.input.processingMs;
			render += incident.input.presentationMs;
		} else if (incidentKind(incident) === IncidentKinds.FRAME) {
			render += incident.durationMs;
		}
	}
	return render > 0 && render >= 2 * js;
}

/** Steady jank with a late timer is JavaScript, with an on-time timer it is rendering. */
function steadyProblem(lagMs: number, jank: number): SessionProblem | null {
	if (jank >= 0.25) return lagMs <= 50 ? 'render-bound' : 'low-frame-rate';
	return lagMs > 100 ? 'low-frame-rate' : null;
}

/** The action that blocked the most time, then `detail` or what ran inside it: the longest script, else the longest named call. */
function incidentCause(incidents: readonly PerfIncident[], detail: string | null): string | null {
	const groups = new Map<string, { incidents: PerfIncident[]; ms: number }>();
	for (const incident of incidents) {
		const group = groups.get(incident.action ?? 'no action') ?? { incidents: [], ms: 0 };
		group.incidents.push(incident);
		group.ms += incident.durationMs;
		groups.set(incident.action ?? 'no action', group);
	}

	let top: [string, { incidents: PerfIncident[]; ms: number }] | null = null;
	for (const entry of groups) if (!top || entry[1].ms > top[1].ms) top = entry;
	if (!top) return null;

	const [action, group] = top;
	const script = group.incidents.flatMap(({ loaf }) => loaf?.scripts ?? []).sort((a, b) => b.durationMs - a.durationMs)[0];
	const span = group.incidents.flatMap(({ sources }) => sources).sort((a, b) => b.ms - a.ms)[0];
	const inside = detail ?? (script ? `${invokerName(script.invoker)}${script.fn ? ` (${script.fn})` : ''}` : span?.name);
	return inside ? `${action} > ${inside}` : action;
}

/** The cause is stored and compared by the throttle, so it keeps plain characters only. */
const cleanCause = (cause: string | null) => cause?.replace(/[^\w :@.#>()-]/g, '').slice(0, MAX_CAUSE) || null;

function momentText(incident: PerfIncident, index: number): string {
	const lines = [
		`${index + 1}. **${duration(incident.durationMs)}** at ${clock(incident.atMs)}${incident.action ? ` after ${code(incident.action, 80)}` : ''}, ${incident.realm} realm${incident.modal ? `, modal ${code(incident.modal, 40)}` : ''}`,
	];

	if (incident.input) {
		lines.push(`   delay ${duration(incident.input.delayMs)}, handlers ${duration(incident.input.processingMs)}, presentation ${duration(incident.input.presentationMs)}`);
	} else if (incident.loaf) {
		lines.push(`   script ${duration(incident.loaf.scriptMs)}, style/layout ${duration(incident.loaf.styleLayoutMs)}, other ${duration(incident.loaf.otherMs)}`);
	}

	const scripts = (incident.loaf?.scripts ?? []).slice(0, SCRIPTS_SHOWN).map(({ durationMs, file, fn, invoker }) =>
		[code(invokerName(invoker), 80), fn && code(fn, 60), file && `(${code(file, 60)})`, duration(durationMs)].filter(Boolean).join(' '),
	);
	const spans = incident.sources.slice(0, SPANS_SHOWN).map(({ ms, name }) => `named ${code(name, 40)} ${duration(ms)}`);
	if (scripts.length + spans.length > 0) lines.push(`   ${[...scripts, ...spans].join(', ')}`);

	return lines.join('\n');
}

function buildSummary(perf: SessionPerf, game: SessionGame, problem: SessionProblem | null, cause: string | null): string {
	const { blocked, commitLagP95Ms, jankRatio, visibleMs } = perf.totals;
	const count = KINDS.reduce((sum, kind) => sum + blocked[kind].count, 0);
	const blockedMs = KINDS.reduce((sum, kind) => sum + blocked[kind].ms, 0);
	const parts = KINDS.filter(kind => blocked[kind].count > 0).map(kind => plural(blocked[kind].count, KIND_NOUNS[kind]));

	const head = [`**${problem ? PROBLEM_LABELS[problem] : 'Unclassified'}**${cause ? `: ${code(cause, MAX_CAUSE)}` : ''}`];
	if (count > 0) head.push(`${plural(count, ['incident', 'incidents'])} blocked ${duration(blockedMs)} of ${duration(visibleMs)} visible: ${parts.join(', ')}`);

	const share = (totalMs: number) => percent(visibleMs > 0 ? totalMs / visibleMs : 0);
	const sources = rankSources(perf.sources, SOURCES_SHOWN).map(({ name, totalMs }) => `${code(name, 40)} ${share(totalMs)}`);
	const steady = `Steady load: timer lag p95 ${Math.round(commitLagP95Ms)} ms, ${percent(jankRatio)} janky frames${sources.length ? `, main thread ${sources.join(', ')}` : ''}`;

	const context = [
		`${game.realm} realm`,
		...(game.modal ? [`${code(game.modal, 40)} open`] : []),
		plural(game.protonises, ['Protonize', 'Protonizes']),
		game.level === null ? 'levels locked' : `level ${Math.round(game.level)}`,
		`${plural(game.canvases, ['canvas', 'canvases'])} (${(game.canvasBytes / 1_048_576).toFixed(1)} MB)`,
		game.animations === null ? '? animations' : plural(game.animations, ['animation', 'animations']),
		plural(game.glows, ['glow', 'glows']),
		plural(game.backdrops, ['blur', 'blurs']),
	];

	const tail = `\n\n${steady}\nContext: ${context.join(', ')}`;
	const summary = head.join('\n');
	let moments = '';
	const worst = perf.incidents.toSorted((a, b) => b.durationMs - a.durationMs).slice(0, MAX_MOMENTS);
	for (const [index, incident] of worst.entries()) {
		const next = `${moments}\n${momentText(incident, index)}`;
		if (summary.length + MOMENTS_HEADER.length + next.length + tail.length > MAX_SUMMARY) break;
		moments = next;
	}
	return summary + (moments && MOMENTS_HEADER + moments) + tail;
}

/**
 * The problem, its cause and a readable summary of a session, written here so the SQL trigger only has to throttle and post them.
 * The problem is the kind of block that took the most time once a second of it was seen, otherwise the steady lag or frame jank.
 */
export function judgeSession(perf: SessionPerf, game: SessionGame): SessionVerdict {
	const { blocked, commitLagP95Ms, jankRatio } = perf.totals;
	const blockedMs = KINDS.reduce((sum, kind) => sum + blocked[kind].ms, 0);

	let problem: SessionProblem | null = null;
	let cause: string | null = null;
	if (blockedMs >= MIN_BLOCKED_MS) {
		const kind = KINDS.reduce((best, next) => (blocked[next].ms > blocked[best].ms ? next : best));
		const ofKind = perf.incidents.filter(incident => incidentKind(incident) === kind);
		const incidents = ofKind.length > 0 ? ofKind : perf.incidents;
		problem = kind !== IncidentKinds.FREEZE && renderDominates(ofKind) ? 'render-bound' : KIND_PROBLEMS[kind];
		cause = incidentCause(incidents, problem === 'render-bound' ? RENDER_CAUSE : null);
	} else {
		// The evidence windows are the ones that made the session degraded, the session totals dilute a late slow stretch.
		const judged = perf.evidence.filter(window => window.frameCount >= 60);
		problem =
			steadyProblem(
				Math.max(0, ...perf.evidence.map(window => window.commitLagP95Ms)),
				Math.max(0, ...judged.map(window => window.frameJankCount / window.frameCount)),
			) ?? steadyProblem(commitLagP95Ms, jankRatio);
		cause = problem === 'low-frame-rate' ? (rankSources(perf.sources, 1)[0]?.name ?? null) : problem === 'render-bound' ? RENDER_CAUSE : null;
	}

	const cleaned = cleanCause(cause);
	return { cause: cleaned, problem, summary: buildSummary(perf, game, problem, cleaned) };
}
