import { RealmTypes, type RealmType } from '#data/realms.js';
import { isUuid } from '#helpers/clientInfo.js';
import { IncidentKinds, stripUrlDetails } from '#helpers/perfIncidents.js';
import type {
	DeviceInfo,
	InAppBrowser,
	InputBreakdown,
	LoafBreakdown,
	LoafScript,
	PerfIncident,
	PerfSourceStat,
	PerfTotals,
	PerfWindow,
	SessionGame,
	SessionPerf,
	SessionStartPayload,
	SessionUpdatePayload,
} from '#lib/types/session.js';

/** Everything below is rebuilt from an allow-list: a client sends whatever it likes, and only these keys at these ranges get stored. */

const APP_VERSION_PATTERN = /^[\w.-]{1,64}$/;
const IN_APP_BROWSERS: readonly string[] = ['facebook', 'instagram', 'line', 'linkedin', 'other-webview', 'snapchat', 'tiktok', 'twitter', 'wechat'];
const MAX_AT_MS = 1e9;
const MAX_COUNT = 1e6;
const MAX_EVIDENCE = 12;
const MAX_INCIDENT_MS = 60_000;
const MAX_INCIDENTS = 6;
const MAX_MS = 600_000;
const MAX_REALMS = 8;
const MAX_SCRIPTS = 3;
const MAX_SOURCES = 12;
const MAX_SPANS = 3;
/** Session-long sums (tracked time, canvas bytes) outgrow a single window. */
const MAX_TOTAL = 1e10;
const REALMS: readonly string[] = Object.values(RealmTypes);
const SOURCE_PATTERN = /^[a-z0-9:_-]{1,40}$/;

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Non-finite values fall to the minimum, the rest is clamped and rounded to 0.1. */
function ranged(value: unknown, min: number, max: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return min;
	return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10;
}

/** Ratios sit between 0 and 1 and a jank ratio of 0.04 matters, so they keep three decimals. */
function share(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
	return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}

function rangedOrNull(value: unknown, min: number, max: number): number | null {
	return typeof value === 'number' ? ranged(value, min, max) : null;
}

/** Control characters go: `\u0000` is refused by a `jsonb` column. */
function text(value: unknown, maxLength: number): string | null {
	return typeof value === 'string' ? value.replace(/\p{Cc}/gu, '').slice(0, maxLength) : null;
}

/** Script files and invokers are URLs, their query strings can carry tokens. */
const withoutQuery = (value: unknown, maxLength: number) => text(typeof value === 'string' ? stripUrlDetails(value) : null, maxLength);

function sourceName(value: unknown): string | null {
	return typeof value === 'string' && SOURCE_PATTERN.test(value) ? value : null;
}

function items<T>(value: unknown, max: number, parse: (item: unknown) => T | null): T[] {
	if (!Array.isArray(value)) return [];
	return value.slice(0, max).flatMap(item => parse(item) ?? []);
}

const realm = (value: unknown): RealmType | null => (typeof value === 'string' && REALMS.includes(value) ? (value as RealmType) : null);

function parseDevice(value: unknown): DeviceInfo | null {
	if (!isRecord(value)) return null;

	const { appVersion, sessionId } = value;
	if (typeof appVersion !== 'string' || !APP_VERSION_PATTERN.test(appVersion) || !isUuid(sessionId)) return null;

	return {
		appVersion,
		cores: rangedOrNull(value.cores, 1, 512),
		inAppBrowser: typeof value.inAppBrowser === 'string' && IN_APP_BROWSERS.includes(value.inAppBrowser) ? (value.inAppBrowser as InAppBrowser) : null,
		language: text(value.language, 35) ?? '',
		maxTouchPoints: ranged(value.maxTouchPoints, 0, MAX_COUNT),
		memoryGb: rangedOrNull(value.memoryGb, 0, 1024),
		pixelRatio: ranged(value.pixelRatio, 0.1, 8),
		reducedMotion: value.reducedMotion === true,
		screenHeight: ranged(value.screenHeight, 0, 20_000),
		screenWidth: ranged(value.screenWidth, 0, 20_000),
		sessionId,
		standalone: value.standalone === true,
		userAgent: text(value.userAgent, 400) ?? '',
		viewportHeight: ranged(value.viewportHeight, 0, 20_000),
		viewportWidth: ranged(value.viewportWidth, 0, 20_000),
	};
}

function parseGame(value: unknown): SessionGame | null {
	if (!isRecord(value)) return null;

	const selected = realm(value.realm);
	if (!selected) return null;

	return {
		animations: rangedOrNull(value.animations, 0, MAX_COUNT),
		autoClicksPerSecond: ranged(value.autoClicksPerSecond, 0, MAX_COUNT),
		backdrops: ranged(value.backdrops, 0, MAX_COUNT),
		canvasBytes: ranged(value.canvasBytes, 0, MAX_TOTAL),
		canvases: ranged(value.canvases, 0, MAX_COUNT),
		covered: value.covered === true,
		electronizes: ranged(value.electronizes, 0, MAX_COUNT),
		glows: ranged(value.glows, 0, MAX_COUNT),
		ionizes: ranged(value.ionizes, 0, MAX_COUNT),
		level: rangedOrNull(value.level, 0, MAX_COUNT),
		modal: text(value.modal, 40),
		protonises: ranged(value.protonises, 0, MAX_COUNT),
		realm: selected,
		realms: items(value.realms, MAX_REALMS, realm),
		reducedMotion: value.reducedMotion === true,
	};
}

function parseWindow(value: unknown): PerfWindow | null {
	if (!isRecord(value)) return null;

	return {
		blockedMs: ranged(value.blockedMs, 0, MAX_MS),
		commitLagP95Ms: ranged(value.commitLagP95Ms, 0, MAX_MS),
		frameCount: ranged(value.frameCount, 0, MAX_COUNT),
		frameJankCount: ranged(value.frameJankCount, 0, MAX_COUNT),
		freezeCount: ranged(value.freezeCount, 0, MAX_COUNT),
		observedMs: ranged(value.observedMs, 0, MAX_MS),
		slowInputCount: ranged(value.slowInputCount, 0, MAX_COUNT),
	};
}

function parseInput(value: unknown): InputBreakdown | null {
	if (!isRecord(value)) return null;

	return {
		delayMs: ranged(value.delayMs, 0, MAX_INCIDENT_MS),
		presentationMs: ranged(value.presentationMs, 0, MAX_INCIDENT_MS),
		processingMs: ranged(value.processingMs, 0, MAX_INCIDENT_MS),
		target: text(value.target, 60),
	};
}

function parseScript(value: unknown): LoafScript | null {
	if (!isRecord(value)) return null;

	return {
		durationMs: ranged(value.durationMs, 0, MAX_INCIDENT_MS),
		file: withoutQuery(value.file, 60) || null,
		fn: text(value.fn, 60) || null,
		invoker: withoutQuery(value.invoker, 80) ?? '',
	};
}

function parseLoaf(value: unknown): LoafBreakdown | null {
	if (!isRecord(value)) return null;

	return {
		otherMs: ranged(value.otherMs, 0, MAX_INCIDENT_MS),
		scriptMs: ranged(value.scriptMs, 0, MAX_INCIDENT_MS),
		scripts: items(value.scripts, MAX_SCRIPTS, parseScript),
		styleLayoutMs: ranged(value.styleLayoutMs, 0, MAX_INCIDENT_MS),
	};
}

/** The incident kind is never read from the client, the server derives it from the parts. */
function parseIncident(value: unknown): PerfIncident | null {
	if (!isRecord(value)) return null;

	const selected = realm(value.realm);
	if (!selected) return null;

	return {
		action: text(value.action, 80) || null,
		actionAgoMs: rangedOrNull(value.actionAgoMs, 0, MAX_INCIDENT_MS),
		atMs: ranged(value.atMs, 0, MAX_AT_MS),
		durationMs: ranged(value.durationMs, 0, MAX_INCIDENT_MS),
		input: parseInput(value.input),
		loaf: parseLoaf(value.loaf),
		modal: text(value.modal, 40) || null,
		realm: selected,
		sources: items(value.sources, MAX_SPANS, parseSpan),
		timerLate: value.timerLate === true,
	};
}

function parseSpan(value: unknown): PerfIncident['sources'][number] | null {
	if (!isRecord(value)) return null;

	const name = sourceName(value.name);
	return name ? { ms: ranged(value.ms, 0, MAX_INCIDENT_MS), name } : null;
}

function parseSource(value: unknown): PerfSourceStat | null {
	if (!isRecord(value)) return null;

	const name = sourceName(value.name);
	return name ? { calls: ranged(value.calls, 0, MAX_TOTAL), maxMs: ranged(value.maxMs, 0, MAX_MS), name, totalMs: ranged(value.totalMs, 0, MAX_TOTAL) } : null;
}

const blocked = (value: unknown) => ({ count: isRecord(value) ? ranged(value.count, 0, MAX_TOTAL) : 0, ms: isRecord(value) ? ranged(value.ms, 0, MAX_TOTAL) : 0 });

/** Totals of the older report shape have no `blocked` and are refused, a tab on an old build gets a 400 until it reloads. */
function parseTotals(value: unknown): PerfTotals | null {
	if (!isRecord(value) || !isRecord(value.blocked)) return null;

	return {
		blocked: {
			[IncidentKinds.FRAME]: blocked(value.blocked[IncidentKinds.FRAME]),
			[IncidentKinds.FREEZE]: blocked(value.blocked[IncidentKinds.FREEZE]),
			[IncidentKinds.INPUT]: blocked(value.blocked[IncidentKinds.INPUT]),
			[IncidentKinds.STALL]: blocked(value.blocked[IncidentKinds.STALL]),
		},
		commitLagP95Ms: ranged(value.commitLagP95Ms, 0, MAX_MS),
		eventTiming: value.eventTiming === true,
		inputP95Ms: ranged(value.inputP95Ms, 0, MAX_MS),
		jankRatio: share(value.jankRatio),
		loaf: value.loaf === true,
		visibleMs: ranged(value.visibleMs, 0, MAX_TOTAL),
	};
}

function parsePerf(value: unknown): SessionPerf | null {
	if (!isRecord(value)) return null;

	const totals = parseTotals(value.totals);
	if (!totals) return null;

	return {
		evidence: items(value.evidence, MAX_EVIDENCE, parseWindow),
		incidents: items(value.incidents, MAX_INCIDENTS, parseIncident),
		sources: items(value.sources, MAX_SOURCES, parseSource),
		totals,
	};
}

/** Reads a request body as JSON, or the 413 or 400 response to send back when it is too big (in bytes) or not JSON. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<{ body: unknown } | { error: Response }> {
	const tooLarge = { error: Response.json({ error: 'Payload too large' }, { status: 413 }) };
	if (Number(request.headers.get('content-length')) > maxBytes) return tooLarge;

	const raw = await request.text();
	if (raw.length > maxBytes || new TextEncoder().encode(raw).length > maxBytes) return tooLarge;

	try {
		return { body: JSON.parse(raw) };
	} catch {
		return { error: Response.json({ error: 'Invalid JSON' }, { status: 400 }) };
	}
}

/** Groups the sessions of one device without storing an IP: a hash of the user agent, screen and language. */
export async function deviceKey({ language, pixelRatio, screenHeight, screenWidth, userAgent }: DeviceInfo): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${userAgent}|${screenWidth}x${screenHeight}@${pixelRatio}|${language}`));
	return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** The device and game of a session start, `null` when anything the row hangs on (root, session id, build, realm) is unusable. */
export function parseSessionStart(body: unknown): SessionStartPayload | null {
	if (!isRecord(body)) return null;

	const device = parseDevice(body.device);
	const game = parseGame(body.game);
	return device && game ? { device, game } : null;
}

/** The session id and write key must be UUIDs, the degraded flag, problem and cause are never read from the client. */
export function parseSessionUpdate(body: unknown): SessionUpdatePayload | null {
	if (!isRecord(body) || !isUuid(body.sessionId) || !isUuid(body.writeKey)) return null;

	const game = parseGame(body.game);
	const perf = parsePerf(body.perf);
	return game && perf ? { game, perf, sessionId: body.sessionId, writeKey: body.writeKey } : null;
}
