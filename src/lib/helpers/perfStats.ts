import type { PerfSourceStat, PerfWindow, ProbeLayerResult, SessionPerf } from '#lib/types/session.js';

export const WINDOW_MS = 10_000;
/** A window cut short by a hidden tab is dropped instead of judged. */
const MIN_WINDOW_COVERAGE = 0.8;
/** Load, hydration and the offline catch-up modal. */
export const WARMUP_MS = 15_000;
/** After the tab comes back to the foreground. */
export const RESUME_WARMUP_MS = 3_000;
/** A longer gap is not lag: up to `MAX_FREEZE_MS` it is a visible freeze, past it a suspended device. */
export const IGNORE_GAP_MS = 1_000;
export const MAX_FREEZE_MS = 10_000;
/** A probe phase with fewer frames than this has no jank value, a handful of frames says nothing. */
export const MIN_PROBE_FRAMES = 30;
/** Low Power Mode makes the 20 ms timer about 30% late, far below this. */
export const STALL_LAG_MS = 50;
/** Low Power Mode caps rAF at 30 fps (33 ms gaps) and a 120 Hz screen gives 8 ms. */
export const JANK_GAP_MS = 50;
/** INP "needs improvement" and "poor" thresholds. */
export const SLOW_INPUT_MS = 200;
const BAD_INPUT_MS = 500;
/** 30 s of bad play within a minute, a single hitch never flags. */
const BAD_WINDOWS = 3;
const DEGRADED_SPAN = 6;
/** The Event Timing default. */
export const EVENT_DURATION_THRESHOLD = 104;
/** Source names past this share the `other` slot. */
export const MAX_SOURCES = 32;

const BUCKET_BOUNDS = [4, 8, 12, 16, 20, 25, 33, 50, 75, 100, 150, 250, 500, 1000] as const;
const PROBE_MIN_DROP_MS = 30;
const PROBE_MIN_DROP_SHARE = 0.4;
const PROBE_MIN_SHARE = 0.5;
const UNACCOUNTED_MAX_ATTRIBUTED_SHARE = 0.3;
const TOP_SOURCE_MIN_SHARE = 0.25;

/** Fixed-size latency buckets, so recording a sample never allocates. */
export class LatencyHistogram {
	count = 0;
	max = 0;
	sum = 0;
	private readonly buckets = new Uint32Array(BUCKET_BOUNDS.length + 1);

	add(ms: number) {
		let index = 0;
		while (index < BUCKET_BOUNDS.length && ms > BUCKET_BOUNDS[index]) index++;
		this.buckets[index]++;
		this.count++;
		this.sum += ms;
		if (ms > this.max) this.max = ms;
	}

	/** Folds another histogram in, how a closed window joins the session. */
	merge(other: LatencyHistogram) {
		for (let index = 0; index < this.buckets.length; index++) this.buckets[index] += other.buckets[index];
		this.count += other.count;
		this.sum += other.sum;
		if (other.max > this.max) this.max = other.max;
	}

	/** Upper bound of the bucket holding the percentile, capped by the largest sample, 0 when empty. */
	percentile(p: number): number {
		if (this.count === 0) return 0;

		const target = Math.ceil(this.count * p);
		let seen = 0;
		for (let index = 0; index < BUCKET_BOUNDS.length; index++) {
			seen += this.buckets[index];
			if (seen >= target) return Math.min(BUCKET_BOUNDS[index], this.max);
		}
		return this.max;
	}

	reset() {
		this.buckets.fill(0);
		this.count = 0;
		this.max = 0;
		this.sum = 0;
	}
}

type WindowSignals = Pick<PerfWindow, 'commitLagP95Ms' | 'commitStallMs' | 'frameCount' | 'frameJankCount' | 'freezeCount' | 'inputMaxMs' | 'inputSlowCount'>;

/** The timer is late: percentiles are bucket bounds, so a p95 of 100 only says the lag was within 75 to 100 ms. */
const isLagBad = (window: WindowSignals) => window.commitLagP95Ms > 100 || window.commitStallMs >= 1_500;

/** The screen hitches or the page freezes, which the commit timer alone does not show as lost time. */
const isRenderBad = (window: WindowSignals) => window.freezeCount >= 1 || (window.frameCount >= 60 && window.frameJankCount / window.frameCount >= 0.25);

export function isBadWindow(window: WindowSignals): boolean {
	return isLagBad(window) || isRenderBad(window) || (window.inputSlowCount >= 2 && window.inputMaxMs >= BAD_INPUT_MS);
}

export function isDegraded(windows: readonly PerfWindow[]): boolean {
	const judged = windows.filter(window => window.observedMs >= WINDOW_MS * MIN_WINDOW_COVERAGE).slice(-DEGRADED_SPAN);
	return judged.filter(isBadWindow).length >= BAD_WINDOWS;
}

export function rankSources(stats: readonly PerfSourceStat[], limit = 8): PerfSourceStat[] {
	return stats.toSorted((a, b) => b.totalMs - a.totalMs || b.maxMs - a.maxMs).slice(0, limit);
}

/** Share of the lost time that no tracked source accounts for. */
function unaccountedShare(windows: readonly PerfWindow[]): number {
	let attributed = 0;
	let lost = 0;
	for (const window of windows) {
		attributed += window.attributedMs;
		lost += window.lostMs;
	}
	return lost === 0 ? 0 : Math.max(0, lost - attributed) / lost;
}

/** Whether the probe is worth running: most of the lost time is untracked, or most bad windows hitch on screen without a late timer. */
export function shouldProbe(evidence: readonly PerfWindow[]): boolean {
	const bad = evidence.filter(isBadWindow);
	const renderBound = bad.filter(window => !isLagBad(window) && isRenderBad(window));
	return unaccountedShare(evidence) >= PROBE_MIN_SHARE || (bad.length > 0 && renderBound.length / bad.length >= PROBE_MIN_SHARE);
}

/**
 * The probe culprit wins, then time nobody tracked, then the source that topped the most evidence windows (the newest on a tie)
 * when it topped a quarter of them, otherwise `mixed`.
 */
export function pickTopSource(perf: Pick<SessionPerf, 'evidence' | 'probe'>): string | null {
	if (perf.probe?.culprit) return `probe:${perf.probe.culprit}`;
	if (perf.evidence.length === 0) return null;

	let attributed = 0;
	let lost = 0;
	const wins = new Map<string, number>();
	for (const window of perf.evidence.toReversed()) {
		attributed += window.attributedMs;
		lost += window.lostMs;
		if (window.topSource) wins.set(window.topSource, (wins.get(window.topSource) ?? 0) + 1);
	}
	if (attributed < lost * UNACCOUNTED_MAX_ATTRIBUTED_SHARE) return 'unaccounted';

	const [top] = [...wins].sort((a, b) => b[1] - a[1]);
	return top && top[1] >= perf.evidence.length * TOP_SOURCE_MIN_SHARE ? top[0] : 'mixed';
}

/**
 * The layer whose removal drops the lost time the most is the culprit: by 40% and 30 ms/s of the baseline, or by halving the jank
 * of a janky baseline. The baseline is the mean of the phases before and after, which cancels a drift over the probe.
 * `baselineJank` and a layer's jank are null when too few frames ran, which skips the jank path for that layer.
 */
export function probeVerdict(baselines: [number, number], layers: readonly ProbeLayerResult[], baselineJank: number | null): string | null {
	const baseline = (baselines[0] + baselines[1]) / 2;
	let best: { drop: number; name: string } | null = null;

	for (const layer of layers) {
		const drop = baseline - layer.lostMsPerS;
		const lostCulprit = drop >= baseline * PROBE_MIN_DROP_SHARE && drop >= PROBE_MIN_DROP_MS;
		const jankCulprit = baselineJank !== null && layer.jankRatio !== null && baselineJank >= 0.25 && layer.jankRatio <= baselineJank / 2;
		if ((lostCulprit || jankCulprit) && (!best || drop > best.drop)) best = { drop, name: layer.name };
	}
	return best?.name ?? null;
}
