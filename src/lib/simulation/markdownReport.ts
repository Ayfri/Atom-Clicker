/** Turns a simulation result into a compact markdown balance report meant to be pasted into a chat for analysis. */
import { ACHIEVEMENTS } from '#data/achievements.js';
import { GENERATORS, GENERATOR_TYPES, type GeneratorType } from '#data/generators.js';
import { ALL_PHOTON_UPGRADES } from '#data/photonUpgrades.js';
import { SKILL_UPGRADES } from '#data/skillTree.js';
import { UPGRADES } from '#data/upgrades.js';
import { formatDuration, formatNumber } from '#lib/utils.js';
import { MILESTONES } from './milestones';
import { DEFAULT_SEED } from './random';
import {
	PRESTIGE_LAYERS,
	totalActionCount,
	type PrestigeEvent,
	type RunInsights,
	type SimulationAction,
	type SimulationResult,
	type SimulationSnapshot,
} from './types';

const ACHIEVEMENT_TOTAL = Object.keys(ACHIEVEMENTS).length;
/** A tier whose next unit pays back within this factor of the best tier's is a correct purchase. */
const BEST_VALUE_SLACK = 2;
const CURVE_ROWS = 16;
/** Below this median share and best-buy share at once, a tier has no visible role. */
const DEAD_SHARE = 0.01;
const DOMINANCE_MIN_TIERS = 3;
const GROWTH_MAX = 4;
const GROWTH_MIN = 0.5;
const HOUR_MS = 3_600_000;
const IDLE_BUCKETS_MS = [60_000, 300_000, 900_000];
const MAX_GAPS = 6;
const MAX_PRESTIGE_ROWS = 30;
const MAX_SPIKES = 8;
const MAX_STALLS = 6;
const MILESTONE_WINDOW_MS = 600_000;
const SKILL_TOTAL = Object.keys(SKILL_UPGRADES).length;
const STALL_GROWTH = 1.05;
const SYSTEM_GAP_TARGET_MS = 4 * HOUR_MS;

function simTime(ms: number): string {
	const h = Math.floor(ms / 3_600_000);
	const m = Math.floor((ms % 3_600_000) / 60_000);
	return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`;
}

/** Paybacks run from seconds to millennia, so past two days they read in days. */
function span(ms: number): string {
	if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
	if (ms < 2 * 86_400_000) return simTime(ms);
	return `${formatNumber(ms / 86_400_000)}d`;
}

function mult(value: number): string {
	if (!Number.isFinite(value)) return '∞';
	if (value >= 1000) return `${formatNumber(value)}×`;
	return `${value.toFixed(value < 10 ? 2 : 0)}×`;
}

function pct(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

/** Evenly spaced rows, the last one always kept, so a 72h run reads as short as a 2h one. */
function sample<T>(rows: T[], count = CURVE_ROWS): T[] {
	const step = Math.max(1, Math.ceil(rows.length / count));
	return rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = values.toSorted((a, b) => a - b);
	const middle = sorted.length >> 1;
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function table(headers: string[], rows: string[][]): string {
	return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
}

/** Family key of an upgrade id: `global_boost_12` -> `global_boost`. */
function familyOf(id: string): string {
	const match = id.match(/^(.*)_(\d+)$/);
	return match ? match[1] : id;
}

function indexOf(id: string): number {
	const match = id.match(/_(\d+)$/);
	return match ? Number(match[1]) : 0;
}

interface FamilyStats {
	bought: Set<string>;
	family: string;
	firstTime: number;
	lastTime: number;
	maxIndex: number;
	total: number;
}

function buildFamilies(actions: SimulationAction[], catalog: Record<string, unknown>, type: SimulationAction['type']): FamilyStats[] {
	const families = new Map<string, FamilyStats>();
	for (const id of Object.keys(catalog)) {
		const key = familyOf(id);
		const entry = families.get(key) ?? { bought: new Set<string>(), family: key, firstTime: Infinity, lastTime: 0, maxIndex: 0, total: 0 };
		entry.total++;
		families.set(key, entry);
	}

	for (const action of actions) {
		if (action.type !== type || !action.details) continue;
		const entry = families.get(familyOf(action.details));
		if (!entry) continue;
		entry.bought.add(action.details);
		entry.firstTime = Math.min(entry.firstTime, action.timestamp);
		entry.lastTime = Math.max(entry.lastTime, action.timestamp);
		entry.maxIndex = Math.max(entry.maxIndex, indexOf(action.details));
	}

	return [...families.values()]
		.sort((a, b) => a.bought.size / a.total - b.bought.size / b.total || a.family.localeCompare(b.family));
}

/** Families with several entries get a table; one-off upgrades are folded into two inline lists to keep the report short. */
function familySection(families: FamilyStats[]): string {
	const multi = families.filter(f => f.total > 1);
	const singleNever = families.filter(f => f.total === 1 && f.bought.size === 0);
	const singleBought = families.filter(f => f.total === 1 && f.bought.size === 1);

	const parts: string[] = [];
	if (multi.length > 0) {
		parts.push(
			table(
				['family', 'bought', 'highest', 'first', 'last'],
				multi.map(f => [
					`\`${f.family}\``,
					`${f.bought.size}/${f.total}`,
					f.maxIndex > 0 ? `#${f.maxIndex}` : '-',
					Number.isFinite(f.firstTime) ? simTime(f.firstTime) : 'never',
					f.bought.size > 0 ? simTime(f.lastTime) : '-',
				]),
			),
		);
	}
	if (singleNever.length > 0) {
		parts.push(`Never bought (${singleNever.length}): ${singleNever.map(f => `\`${f.family}\``).join(', ')}`);
	}
	if (singleBought.length > 0) {
		parts.push(`Bought (${singleBought.length}): ${singleBought.map(f => `\`${f.family}\` ${simTime(f.firstTime)}`).join(', ')}`);
	}
	return parts.join('\n\n');
}

/** A power-up live at sample time reads as a 5x jump, so every curve measurement uses APS with the bonus divided out. */
function rawAps(snapshot: SimulationSnapshot): number {
	return snapshot.atomsPerSecondRaw ?? snapshot.atomsPerSecond / (snapshot.bonusMultiplier || 1);
}

/** Monotonic all-time peak, so a stall reads as a flat line instead of as a prestige-shaped sawtooth. */
function peakAps(snapshot: SimulationSnapshot): number {
	return snapshot.peakAtomsPerSecond ?? rawAps(snapshot);
}

/** Longest stretches where APS barely moved: the clearest signal of a progression wall. */
function findStalls(snapshots: SimulationSnapshot[]): { end: number; growth: number; start: number }[] {
	const stalls: { end: number; growth: number; start: number }[] = [];
	let anchor = 0;
	for (let i = 1; i < snapshots.length; i++) {
		const anchorAps = peakAps(snapshots[anchor]);
		const growth = anchorAps > 0 ? peakAps(snapshots[i]) / anchorAps : Infinity;
		if (growth >= STALL_GROWTH) {
			if (i - anchor > 1) {
				stalls.push({
					end: snapshots[i - 1].timestamp,
					growth: anchorAps > 0 ? peakAps(snapshots[i - 1]) / anchorAps : 1,
					start: snapshots[anchor].timestamp,
				});
			}
			anchor = i;
		}
	}
	if (snapshots.length - anchor > 2) {
		const last = snapshots[snapshots.length - 1];
		const anchorAps = peakAps(snapshots[anchor]);
		stalls.push({
			end: last.timestamp,
			growth: anchorAps > 0 ? peakAps(last) / anchorAps : 1,
			start: snapshots[anchor].timestamp,
		});
	}
	return stalls.sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, MAX_STALLS);
}

interface HourlyGrowth {
	decades: number;
	hour: number;
	peak: number;
}

/**
 * The balance target is a rate, not a size. Measured on peak APS rather than on the atom counter: a protonise wipes
 * atoms, so an atom-based rate reports minus thirty decades an hour every time the run resets and says nothing.
 * The band is stated per hour, so the window is an hour: a two-minute slice of a ratchet reads zero almost everywhere.
 */
function hourlyGrowth(snapshots: SimulationSnapshot[]): { hourly: HourlyGrowth[]; inBandShare: number; measured: number } {
	const last = snapshots[snapshots.length - 1];
	const totalHours = Math.max(1, Math.ceil(last.timestamp / HOUR_MS));
	const atHour: SimulationSnapshot[] = [];
	let cursor = 0;
	for (let hour = 0; hour <= totalHours; hour++) {
		const target = hour * HOUR_MS;
		while (cursor + 1 < snapshots.length && snapshots[cursor + 1].timestamp <= target) cursor++;
		atHour[hour] = snapshots[cursor];
	}

	const hourly: HourlyGrowth[] = [];
	for (let hour = 1; hour <= totalHours; hour++) {
		const previous = peakAps(atHour[hour - 1]);
		const current = peakAps(atHour[hour]);
		if (current <= 0) continue;
		hourly.push({ decades: previous > 0 ? Math.log10(current) - Math.log10(previous) : Infinity, hour, peak: current });
	}

	const measured = hourly.filter(entry => Number.isFinite(entry.decades));
	const inBand = measured.filter(entry => entry.decades >= GROWTH_MIN && entry.decades <= GROWTH_MAX).length;
	return { hourly, inBandShare: measured.length > 0 ? inBand / measured.length : 0, measured: measured.length };
}

function growthSection(snapshots: SimulationSnapshot[]): string {
	const { hourly, inBandShare, measured } = hourlyGrowth(snapshots);
	return [
		`Target band: ${GROWTH_MIN} to ${GROWTH_MAX} decades of peak APS per hour. In band for **${pct(inBandShare)}** of the ${measured} measured hours.`,
		'',
		table(
			['hour', 'decades', 'band', 'peak APS'],
			sample(hourly).map(entry => [
					`${entry.hour}h`,
					Number.isFinite(entry.decades) ? entry.decades.toFixed(2) : '-',
					entry.decades < GROWTH_MIN ? 'slow' : entry.decades > GROWTH_MAX ? 'fast' : 'ok',
					formatNumber(entry.peak),
				]),
		),
	].join('\n');
}

/** Bunched unlocks read as a dogpile: how many milestones land inside any 10-minute window. */
function milestoneDensity(milestones: { timeReached: number }[]): { count: number; start: number } {
	let best = { count: 0, start: 0 };
	const times = milestones.map(m => m.timeReached).sort((a, b) => a - b);
	let start = 0;
	for (let end = 0; end < times.length; end++) {
		while (times[end] - times[start] > MILESTONE_WINDOW_MS) start++;
		const count = end - start + 1;
		if (count > best.count) best = { count, start: times[start] };
	}
	return best;
}

function multiplierBreakdown(s: SimulationSnapshot): string {
	const parts: { label: string; value: number }[] = [
		{ label: 'Skills', value: s.globalSkillsMultiplier },
		{ label: 'Flat upgrades (global_boost)', value: s.globalFlatMultiplier },
		{ label: 'Level upgrades (level_boost)', value: s.globalLevelMultiplier },
		{ label: 'Achievement upgrades', value: s.globalAchievementMultiplier },
		{ label: 'Proton boosts', value: s.globalProtonBoostMultiplier },
		{ label: 'Protonise boosts', value: s.globalProtoniseMultiplier },
		{ label: 'Radiation', value: s.radiationMultiplier },
		{ label: 'Stability', value: s.stabilityMultiplier },
		{ label: 'Power-up bonus', value: s.bonusMultiplier },
		{ label: 'Atoms currency boost', value: s.atomsCurrencyBoost },
	];
	const totalLog = parts.reduce((sum, p) => sum + (p.value > 1 ? Math.log(p.value) : 0), 0);
	return table(
		['source', 'value', 'log share'],
		parts
			.sort((a, b) => b.value - a.value)
			.map(p => [p.label, mult(p.value), totalLog > 0 && p.value > 1 ? pct(Math.log(p.value) / totalLog) : '-']),
	);
}

function totalProduction(s: SimulationSnapshot): number {
	return GENERATOR_TYPES.reduce((sum, t) => sum + (s.generatorProductions[t] ?? 0), 0);
}

function bestPayback(s: SimulationSnapshot): number {
	return Math.min(...Object.values(s.generatorPaybacks ?? {}));
}

function generatorTable(s: SimulationSnapshot): string {
	const total = totalProduction(s);
	const best = bestPayback(s);
	return table(
		['generator', 'count', 'APS', 'share', 'upgrade ×', 'level ×', 'payback', 'vs best'],
		GENERATOR_TYPES.map(type => {
			const production = s.generatorProductions[type] ?? 0;
			const payback = s.generatorPaybacks?.[type];
			return [
				GENERATORS[type].name,
				`${s.generators[type] ?? 0}`,
				formatNumber(production),
				total > 0 ? pct(production / total) : '-',
				mult(s.generatorUpgradeFactors[type] ?? 1),
				mult(s.generatorLevelFactors[type] ?? 1),
				payback !== undefined ? span(payback * 1000) : '-',
				payback !== undefined && best > 0 ? mult(payback / best) : '-',
			];
		}),
	);
}

interface GeneratorRole {
	/** Share of snapshots where the next unit pays back within BEST_VALUE_SLACK of the best tier. */
	bestValueShare: number;
	firstOwned: number;
	medianShare: number;
	peakShare: number;
	type: GeneratorType;
}

/** A tier has a role if it either produces a visible share or is, at some point, one of the right things to buy. */
function generatorRoles(snapshots: SimulationSnapshot[]): GeneratorRole[] {
	const shares = GENERATOR_TYPES.map((): number[] => []);
	const bestValue = GENERATOR_TYPES.map(() => 0);
	const firstOwned = GENERATOR_TYPES.map(() => Infinity);
	let valued = 0;
	for (const s of snapshots) {
		const total = totalProduction(s);
		const best = bestPayback(s);
		if (Number.isFinite(best)) valued++;
		GENERATOR_TYPES.forEach((type, i) => {
			const payback = s.generatorPaybacks?.[type];
			if (payback !== undefined && payback <= best * BEST_VALUE_SLACK) bestValue[i]++;
			if ((s.generators[type] ?? 0) === 0 || total <= 0) return;
			firstOwned[i] = Math.min(firstOwned[i], s.timestamp);
			shares[i].push((s.generatorProductions[type] ?? 0) / total);
		});
	}
	return GENERATOR_TYPES.map((type, i) => ({
		bestValueShare: valued > 0 ? bestValue[i] / valued : 0,
		firstOwned: firstOwned[i],
		medianShare: median(shares[i]),
		peakShare: shares[i].length > 0 ? Math.max(...shares[i]) : 0,
		type,
	}));
}

const isDeadTier = (role: GeneratorRole) => role.medianShare < DEAD_SHARE && role.bestValueShare < DEAD_SHARE;

function generatorRolesSection(snapshots: SimulationSnapshot[], roles: GeneratorRole[]): string {
	return [
		`Share is the tier's slice of generator production while owned. Best buy counts the snapshots where its next unit pays back within ${BEST_VALUE_SLACK}× of the best tier, the wait to afford it included. A tier low on both has no role.`,
		'',
		table(
			['generator', 'first owned', 'median share', 'peak share', 'best buy'],
			roles.map(role => [
				`${GENERATORS[role.type].name}${isDeadTier(role) ? ' ⚠' : ''}`,
				Number.isFinite(role.firstOwned) ? simTime(role.firstOwned) : 'never',
				pct(role.medianShare),
				pct(role.peakShare),
				pct(role.bestValueShare),
			]),
		),
		'',
		'Production share over time (%), with the best buy of each row:',
		'',
		table(
			['t', ...GENERATOR_TYPES.map(type => GENERATORS[type].name), 'best buy'],
			sample(snapshots.filter(s => totalProduction(s) > 0)).map(s => {
				const total = totalProduction(s);
				const best = bestPayback(s);
				const bestType = GENERATOR_TYPES.find(type => s.generatorPaybacks?.[type] === best);
				return [
					simTime(s.timestamp),
					...GENERATOR_TYPES.map(type => ((100 * (s.generatorProductions[type] ?? 0)) / total).toFixed(0)),
					bestType ? GENERATORS[bestType].name : '-',
				];
			}),
		),
	].join('\n');
}

/**
 * Share of the single biggest tier, skipping the first hour and the minutes after a reset, where one or two tiers owning
 * everything is expected. The late mean covers the last quarter of the run, the endgame the balance goal is about.
 */
function dominance(snapshots: SimulationSnapshot[]): { late: number; peak: number; type: GeneratorType | null } {
	const counts = new Map<GeneratorType, number>();
	const tops: number[] = [];
	const lateFrom = (snapshots.at(-1)?.timestamp ?? 0) * 0.75;
	const late: number[] = [];
	for (const s of snapshots) {
		const total = totalProduction(s);
		const owned = GENERATOR_TYPES.filter(type => (s.generators[type] ?? 0) > 0).length;
		if (s.timestamp < HOUR_MS || total <= 0 || owned < DOMINANCE_MIN_TIERS) continue;
		let top: GeneratorType = GENERATOR_TYPES[0];
		for (const type of GENERATOR_TYPES) if ((s.generatorProductions[type] ?? 0) > (s.generatorProductions[top] ?? 0)) top = type;
		const share = (s.generatorProductions[top] ?? 0) / total;
		tops.push(share);
		if (s.timestamp >= lateFrom) late.push(share);
		counts.set(top, (counts.get(top) ?? 0) + 1);
	}
	return {
		late: late.length > 0 ? late.reduce((a, b) => a + b, 0) / late.length : 0,
		peak: tops.length > 0 ? Math.max(...tops) : 0,
		type: [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
	};
}

function realmTable(snapshots: SimulationSnapshot[]): string {
	return table(
		['t', 'protons', 'electrons', 'photons earned', 'excited earned', 'photon lvls', 'skills', 'P/E', 'radiation ×', 'stability ×'],
		sample(snapshots).map(s => [
			simTime(s.timestamp),
			formatNumber(s.protons),
			formatNumber(s.electrons),
			formatNumber(s.photonsEarned ?? 0),
			formatNumber(s.excitedPhotonsEarned ?? 0),
			`${s.photonUpgradeLevels}`,
			`${s.skills}`,
			`${s.protonises}/${s.electronizes}`,
			mult(s.radiationMultiplier),
			mult(s.stabilityMultiplier),
		]),
	);
}

interface SystemStep {
	gap: number;
	name: string;
	time: number;
}

/** Each new gameplay system with the wait since the previous one, the run's start counting as the first rung. */
function systemLadder(result: SimulationResult): { open: number; reached: SystemStep[]; missing: string[] } {
	const reached: SystemStep[] = [];
	let previous = 0;
	for (const hit of result.milestones) {
		if (!hit.milestone.system) continue;
		reached.push({ gap: hit.timeReached - previous, name: hit.milestone.name, time: hit.timeReached });
		previous = hit.timeReached;
	}
	const reachedIds = new Set(result.milestones.map(hit => hit.milestone.id));
	const end = result.snapshots.at(-1)?.timestamp ?? 0;
	return { missing: MILESTONES.filter(m => m.system && !reachedIds.has(m.id)).map(m => m.name), open: end - previous, reached };
}

function ladderSection(ladder: ReturnType<typeof systemLadder>): string {
	return [
		`Target: a new system roughly every ${SYSTEM_GAP_TARGET_MS / HOUR_MS}h. ${simTime(ladder.open)} since the last one at the end of the run.`,
		'',
		table(
			['system', 'at', 'wait'],
			ladder.reached.map(step => [step.name, simTime(step.time), simTime(step.gap)]),
		),
		...(ladder.missing.length > 0 ? ['', `Never reached: ${ladder.missing.join(', ')}`] : []),
	].join('\n');
}

function prestigeSection(prestiges: PrestigeEvent[]): string {
	const lastGain = new Map<PrestigeEvent['type'], number>();
	const rows = prestiges.map((event, i) => {
		const previous = lastGain.get(event.type);
		lastGain.set(event.type, event.gain);
		// A deeper reset wipes the shallower currency, so the next gain starts a new series instead of reading as a 0.00× drop.
		for (const layer of PRESTIGE_LAYERS.slice(0, PRESTIGE_LAYERS.indexOf(event.type))) lastGain.delete(layer);
		return [
			`${i + 1}`,
			event.type,
			simTime(event.timestamp),
			simTime(event.runMs),
			event.type === 'ionize' ? '-' : formatNumber(event.gain),
			previous && event.type !== 'ionize' ? mult(event.gain / previous) : '-',
			formatNumber(event.rawAps),
			`${event.skills}`,
		];
	});
	const summary = PRESTIGE_LAYERS
		.map(type => {
			const runs = prestiges.filter(event => event.type === type);
			return runs.length > 0 ? `${type} ×${runs.length}, first ${simTime(runs[0].timestamp)}, median run ${simTime(median(runs.map(e => e.runMs)))}` : null;
		})
		.filter(line => line !== null);
	return [
		summary.length > 0 ? summary.join(' · ') : 'No reset in this run.',
		'',
		'Run is the time since the previous reset of the same or a deeper layer. Gain × compares with the previous reset of the same layer.',
		'',
		table(['#', 'layer', 'at', 'run', 'gain', 'gain ×', 'raw APS', 'skills'], sample(rows, MAX_PRESTIGE_ROWS)),
	].join('\n');
}

function idleShare(insights: RunInsights, minMs: number): number {
	if (insights.activeMs <= 0) return 0;
	return insights.idleGaps.reduce((sum, gap) => sum + (gap.activeMs >= minMs ? gap.activeMs : 0), 0) / insights.activeMs;
}

function idleSection(insights: RunInsights): string {
	const longest = insights.idleGaps.toSorted((a, b) => b.activeMs - a.activeMs).slice(0, MAX_GAPS);
	return [
		`Active play time where the bot found nothing to buy, reset or assign. ${simTime(insights.activeMs)} of active time: ` +
			IDLE_BUCKETS_MS.map(ms => `${pct(idleShare(insights, ms))} in waits ≥ ${simTime(ms)}`).join(', ') + '.',
		...(longest.length > 0
			? ['', table(['from', 'to', 'active wait'], longest.map(gap => [simTime(gap.start), simTime(gap.end), simTime(gap.activeMs)]))]
			: []),
	].join('\n');
}

type Verdict = 'bad' | 'ok' | 'watch';

interface Check {
	label: string;
	measured: string;
	target: string;
	verdict: Verdict;
}

/** Lower is better: `ok` up to the first bound, `watch` up to the second. */
function grade(value: number, ok: number, watch: number): Verdict {
	return value <= ok ? 'ok' : value <= watch ? 'watch' : 'bad';
}

/** One graded line per balance goal, so a run reads at a glance and a matrix of runs compares line by line. */
export function buildScorecard(result: SimulationResult): Check[] {
	const { insights, milestones, snapshots } = result;
	const checks: Check[] = [];
	if (snapshots.length === 0) return checks;
	const reached = new Map(milestones.map(hit => [hit.milestone.id, hit.timeReached]));

	const { inBandShare, measured } = hourlyGrowth(snapshots);
	checks.push({
		label: 'Growth pacing',
		measured: `${pct(inBandShare)} of ${measured}h in band`,
		target: `≥ 70% of hours at ${GROWTH_MIN}-${GROWTH_MAX} decades/h`,
		verdict: grade(-inBandShare, -0.7, -0.4),
	});

	const stalls = findStalls(snapshots);
	const longestStall = stalls[0] ? stalls[0].end - stalls[0].start : 0;
	checks.push({
		label: 'Longest APS stall',
		measured: stalls[0] ? `${simTime(longestStall)} from ${simTime(stalls[0].start)}` : 'none',
		target: '≤ 1h',
		verdict: grade(longestStall, HOUR_MS, 2 * HOUR_MS),
	});

	const top = dominance(snapshots);
	checks.push({
		label: 'Top tier dominance',
		measured: `last quarter ${pct(top.late)}, peak ${pct(top.peak)}${top.type ? `, mostly ${GENERATORS[top.type].name}` : ''}`,
		target: 'last quarter < 70%, never ~90%',
		verdict: grade(top.late, 0.7, 0.85),
	});

	const dead = generatorRoles(snapshots).filter(isDeadTier);
	checks.push({
		label: 'Tiers without a role',
		measured: dead.length > 0 ? dead.map(role => GENERATORS[role.type].name).join(', ') : 'none',
		target: `every tier > ${pct(DEAD_SHARE)} share or best buy`,
		verdict: grade(dead.length, 0, 2),
	});

	if (insights) {
		const longest = insights.idleGaps.reduce((max, gap) => Math.max(max, gap.activeMs), 0);
		const share = idleShare(insights, IDLE_BUCKETS_MS[1]);
		checks.push({
			label: 'Nothing to do',
			measured: `longest wait ${simTime(longest)}, ${pct(share)} of active time in waits ≥ 5m`,
			target: 'longest ≤ 15m, ≤ 10% in long waits',
			verdict: grade(Math.max(longest / (15 * 60_000), share / 0.1), 1, 2),
		});
	}

	const ladder = systemLadder(result);
	const widest = Math.max(ladder.open, ...ladder.reached.map(step => step.gap));
	const bunched = ladder.reached.filter((step, i) => i > 0 && step.gap < 30 * 60_000).length;
	checks.push({
		label: 'System ladder',
		measured: `${ladder.reached.length}/${ladder.reached.length + ladder.missing.length} systems, widest gap ${simTime(widest)}, ${bunched} within 30m of the previous`,
		target: `a system every ~${SYSTEM_GAP_TARGET_MS / HOUR_MS}h`,
		verdict: grade(widest, 1.5 * SYSTEM_GAP_TARGET_MS, 2.5 * SYSTEM_GAP_TARGET_MS),
	});

	const firstProtonise = insights?.prestiges.find(event => event.type === 'protonise');
	checks.push({
		label: 'First Protonise',
		measured: firstProtonise
			? `${simTime(firstProtonise.timestamp)}, ${firstProtonise.skills}/${SKILL_TOTAL} skills owned`
			: reached.has('first_protonise') ? simTime(reached.get('first_protonise') ?? 0) : 'never',
		target: 'well before the skill tree is bought',
		verdict: firstProtonise ? grade(firstProtonise.skills / SKILL_TOTAL, 0.3, 0.6) : reached.has('first_protonise') ? 'ok' : 'bad',
	});

	for (const [id, label] of [['feature_purple_realm', 'Photons reachable'], ['first_electronize', 'Electrons reachable']] as const) {
		const time = reached.get(id);
		checks.push({ label, measured: time !== undefined ? simTime(time) : 'never', target: 'reached', verdict: time !== undefined ? 'ok' : 'bad' });
	}

	const densest = milestoneDensity(milestones);
	checks.push({
		label: 'Unlock dogpile',
		measured: `${densest.count} milestones in 10m from ${simTime(densest.start)}`,
		target: '≤ 6',
		verdict: grade(densest.count, 6, 9),
	});

	return checks;
}

const VERDICT_MARK: Record<Verdict, string> = { bad: '✗', ok: '✓', watch: '~' };

export function formatScorecard(checks: Check[]): string[] {
	const width = Math.max(...checks.map(check => check.label.length));
	return checks.map(check => `  ${VERDICT_MARK[check.verdict]} ${check.label.padEnd(width)}  ${check.measured}`);
}

function curveTable(snapshots: SimulationSnapshot[]): string {
	return table(
		['t', 'atoms', 'APS', 'peak APS', 'APC', 'global ×', 'bldgs', 'upg', 'ach', 'lvl', 'protons', 'electrons'],
		sample(snapshots).map(s => [
			simTime(s.timestamp),
			formatNumber(s.atoms),
			formatNumber(rawAps(s)),
			formatNumber(peakAps(s)),
			formatNumber(s.atomsPerClick),
			mult(s.globalMultiplier),
			`${s.totalGenerators}`,
			`${s.upgrades}`,
			`${s.achievements}`,
			`${s.playerLevel}`,
			formatNumber(s.protons),
			formatNumber(s.electrons),
		]),
	);
}

export function buildMarkdownReport(result: SimulationResult): string {
	const { config, snapshots } = result;
	const final = snapshots.at(-1);
	if (!final) return '# Atom Clicker Benchmark\n\nNo snapshot recorded.';

	const actions = snapshots.flatMap(s => s.actions);
	const reachedIds = new Set(result.milestones.map(m => m.milestone.id));
	const missing = MILESTONES.filter(m => !reachedIds.has(m.id));
	const stalls = findStalls(snapshots);
	// Snapshots keep counts for every action type but detail only the ones looked up by id, so totals come from the counters.
	let totalActions = 0;
	const actionsByType = new Map<string, number>();
	for (const { actionCounts } of snapshots) {
		totalActions += totalActionCount(actionCounts);
		for (const [type, count] of Object.entries(actionCounts)) actionsByType.set(type, (actionsByType.get(type) ?? 0) + (count ?? 0));
	}

	const lines: string[] = [];

	lines.push('# Atom Clicker Benchmark');
	lines.push('');
	lines.push(`Run: **${config.name}** · ${config.targetHours}h simulated${result.cancelled ? ' (cancelled early)' : ''}`);
	lines.push('');
	lines.push(
		table(
			['setting', 'value'],
			[
				['seed', `${config.seed ?? DEFAULT_SEED}`],
				['tick rate', `${config.tickRate} ms`],
				['snapshot interval', `${config.snapshotInterval} s`],
				['clicks/s', `${config.botBehavior.clicksPerSecond}`],
				['buy strategy', config.botBehavior.buyStrategy],
				['game knowledge', `${config.botBehavior.gameKnowledge}`],
				['activity', config.botBehavior.activityPattern
					? `${config.botBehavior.activityPattern.activeMinutes}m on / ${config.botBehavior.activityPattern.inactiveMinutes}m off`
					: 'always active'],
				['max actions/tick', `${config.botBehavior.maxActionsPerTick ?? 'unlimited'}`],
				['max prestiges/window', `${config.botBehavior.maxPrestigesPerActiveWindow ?? 'unlimited'}`],
				['quests', config.botBehavior.questBehavior],
				['protonise threshold', `${config.prestigeStrategy.protoniseThreshold}`],
				['electronize threshold', `${config.prestigeStrategy.electronizeThreshold}`],
				['wall clock', formatDuration(result.durationMs)],
			],
		),
	);

	lines.push('');
	lines.push('## Balance scorecard');
	lines.push('');
	lines.push('One line per balance goal: ✓ on target, ~ worth a look, ✗ off target. The sections below hold the detail.');
	lines.push('');
	lines.push(
		table(
			['', 'check', 'measured', 'target'],
			buildScorecard(result).map(check => [VERDICT_MARK[check.verdict], check.label, check.measured, check.target]),
		),
	);

	lines.push('');
	lines.push('## Final state');
	lines.push('');
	lines.push(
		table(
			['stat', 'value', 'stat', 'value'],
			[
				['atoms', formatNumber(final.atoms), 'APS', `${formatNumber(rawAps(final))}/s`],
				['atoms all-time', formatNumber(final.atomsEarnedAllTime ?? 0), 'peak APS', `${formatNumber(peakAps(final))}/s`],
				['APC', formatNumber(final.atomsPerClick), 'global ×', mult(final.globalMultiplier)],
				['protons', formatNumber(final.protons), 'electrons', formatNumber(final.electrons)],
				['photons held', formatNumber(final.photons), 'photons earned', formatNumber(final.photonsEarned ?? 0)],
				['excited held', formatNumber(final.excitedPhotons ?? 0), 'excited earned', formatNumber(final.excitedPhotonsEarned ?? 0)],
				['circles expired', formatNumber(final.photonsExpired ?? 0), 'quarks', formatNumber(final.quarks ?? 0)],
				['protonises', `${final.protonises}`, 'electronizes', `${final.electronizes}`],
				['player level', `${final.playerLevel}`, 'total XP', formatNumber(final.totalXP)],
				['generators', `${final.totalGenerators}`, 'generator levels', `${final.generatorLevels}`],
				['upgrades owned', `${final.upgrades}`, 'upgrades all-time', `${final.totalUpgrades}`],
				['skills', `${final.skills}`, 'boost points spent', `${final.boostPointsUsed}`],
				['achievements', `${final.achievements}/${ACHIEVEMENT_TOTAL}`, 'photon upgrade levels', `${final.photonUpgradeLevels}`],
				['clicks', formatNumber(final.clicks), 'actions', `${totalActions}`],
			],
		),
	);

	lines.push('');
	lines.push('## Growth curve');
	lines.push('');
	lines.push('APS is reported with the power-up bonus divided out, so a live power-up cannot read as growth.');
	lines.push('');
	lines.push(curveTable(snapshots));

	lines.push('');
	lines.push('## Growth rate');
	lines.push('');
	lines.push(growthSection(snapshots));

	lines.push('');
	lines.push('## Realm progress');
	lines.push('');
	lines.push('Earned columns are all-time, P/E counts Protonises and Electronizes.');
	lines.push('');
	lines.push(realmTable(snapshots));

	lines.push('');
	lines.push('## System ladder');
	lines.push('');
	lines.push(ladderSection(systemLadder(result)));

	if (result.insights) {
		lines.push('');
		lines.push('## Prestige runs');
		lines.push('');
		lines.push(prestigeSection(result.insights.prestiges));

		lines.push('');
		lines.push('## Idle time');
		lines.push('');
		lines.push(idleSection(result.insights));
	}

	lines.push('');
	lines.push('## Milestones');
	lines.push('');
	lines.push(
		`Reached ${result.milestones.length}/${MILESTONES.length}: ` +
			(result.milestones.length > 0
				? result.milestones.map(m => `${m.milestone.name} \`${simTime(m.timeReached)}\``).join(', ')
				: 'none'),
	);
	lines.push('');
	lines.push(`Never reached (${missing.length}): ${missing.length > 0 ? missing.map(m => m.name).join(', ') : 'none'}`);

	if (result.milestones.length > 0) {
		const densest = milestoneDensity(result.milestones);
		lines.push('');
		lines.push(`Densest 10-minute window: **${densest.count} milestones** starting ${simTime(densest.start)} (target: 6 or fewer).`);
	}

	if (stalls.length > 0) {
		lines.push('');
		lines.push('## APS stalls & regressions');
		lines.push('');
		lines.push(`Stretches where peak APS grew less than ${mult(STALL_GROWTH)}.`);
		lines.push('');
		lines.push(
			table(
				['from', 'to', 'duration', 'APS growth'],
				stalls.map(s => [simTime(s.start), simTime(s.end), simTime(s.end - s.start), mult(s.growth)]),
			),
		);
	}

	lines.push('');
	lines.push('## Multiplier sources (final)');
	lines.push('');
	lines.push(multiplierBreakdown(final));

	lines.push('');
	lines.push('## Generator roles');
	lines.push('');
	lines.push(generatorRolesSection(snapshots, generatorRoles(snapshots)));

	lines.push('');
	lines.push('## Generators (final)');
	lines.push('');
	lines.push(generatorTable(final));

	lines.push('');
	lines.push('## Upgrade families');
	lines.push('');
	lines.push('Sorted by completion, least bought first. A family at 0 is content the run never touched.');
	lines.push('');
	lines.push('### Atom upgrades');
	lines.push('');
	lines.push(familySection(buildFamilies(actions, UPGRADES, 'upgrade')));
	lines.push('');
	lines.push('### Skills');
	lines.push('');
	lines.push(familySection(buildFamilies(actions, SKILL_UPGRADES, 'skill')));
	lines.push('');
	lines.push('### Photon upgrades');
	lines.push('');
	lines.push(familySection(buildFamilies(actions, ALL_PHOTON_UPGRADES, 'photon_upgrade')));

	lines.push('');
	lines.push('## Upgrade group contributions (final)');
	lines.push('');
	lines.push(
		table(
			['group', 'per-entry values'],
			[
				['global_boost tiers (10 each)', final.groupContributions.globalBoostTiers.map(mult).join(' ')],
				['level_boost_1..10', final.groupContributions.levelBoost.map(mult).join(' ')],
				['achievement_mul_1..11', final.groupContributions.achievementMul.map(mult).join(' ')],
				['proton_boost_1..10', final.groupContributions.protonBoost.map(mult).join(' ')],
				['protonise_boost_1..5', final.groupContributions.protoniseBoost.map(mult).join(' ')],
			],
		),
	);

	lines.push('');
	lines.push('## Actions');
	lines.push('');
	lines.push(
		[...actionsByType.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([type, count]) => `${type}: ${count}`)
			.join(' · '),
	);

	if (result.spikes.length > 0) {
		lines.push('');
		lines.push('## Action spikes');
		lines.push('');
		lines.push(
			table(
				['t', 'peak/min', 'avg/min', 'APS jump', 'top actions'],
				result.spikes.slice(0, MAX_SPIKES).map(spike => {
					const counts = new Map<string, number>();
					for (const action of spike.actions) {
						const key = `${action.type}:${action.details?.split(' ')[0] ?? ''}`;
						counts.set(key, (counts.get(key) ?? 0) + 1);
					}
					const top = [...counts.entries()]
						.sort((a, b) => b[1] - a[1])
						.slice(0, 5)
						.map(([key, count]) => `${key}×${count}`)
						.join(', ');
					return [
						simTime(spike.timestamp),
						spike.peakRatePerMin.toFixed(0),
						spike.avgRatePerMin.toFixed(1),
						`${formatNumber(spike.apsStart)} → ${formatNumber(spike.apsEnd)}`,
						top,
					];
				}),
			),
		);
	}

	lines.push('');
	lines.push('## Quests & quarks');
	lines.push('');
	lines.push(
		table(
			['stat', 'value'],
			[
				['quests offered', `${final.questsOfferedTotal ?? 0}`],
				['quests completed', `${final.questsCompletedTotal ?? 0}`],
				['completion rate', (final.questsOfferedTotal ?? 0) > 0 ? pct((final.questsCompletedTotal ?? 0) / (final.questsOfferedTotal ?? 1)) : '-'],
				['quarks from quests', formatNumber(final.quarksFromQuests ?? 0)],
				['quarks from achievements', formatNumber(final.quarksFromAchievements ?? 0)],
			],
		),
	);
	const questRows = Object.entries(final.questBreakdown ?? {}).sort(([a], [b]) => a.localeCompare(b));
	if (questRows.length > 0) {
		lines.push('');
		lines.push(
			table(
				['quest', 'completed', 'last progress / target'],
				questRows.map(([id, outcome]) => [
					id,
					`${outcome.completed}/${outcome.offered}`,
					`${formatNumber(outcome.lastProgress)} / ${formatNumber(outcome.lastTarget)}`,
				]),
			),
		);
	}

	lines.push('');
	return lines.join('\n');
}
