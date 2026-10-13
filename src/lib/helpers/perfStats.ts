import type { PerfSourceStat, PerfWindow } from '#lib/types/session.js';

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
/** Low Power Mode caps rAF at 30 fps (33 ms gaps) and a 120 Hz screen gives 8 ms. */
export const JANK_GAP_MS = 50;
/** INP "needs improvement" threshold. */
export const SLOW_INPUT_MS = 200;
/** 30 s of bad play within a minute, a single hitch never flags. */
const BAD_WINDOWS = 3;
const DEGRADED_SPAN = 6;
/** The Event Timing default. */
export const EVENT_DURATION_THRESHOLD = 104;
/** Source names past this share the `other` slot. */
export const MAX_SOURCES = 32;

const BUCKET_BOUNDS = [4, 8, 12, 16, 20, 25, 33, 50, 75, 100, 150, 250, 500, 1000] as const;

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

/** Percentiles are bucket bounds, so a lag p95 of 100 only says the lag was within 75 to 100 ms. */
export function isBadWindow(window: PerfWindow): boolean {
	return (
		window.commitLagP95Ms > 100 ||
		window.freezeCount >= 1 ||
		(window.frameCount >= 60 && window.frameJankCount / window.frameCount >= 0.25) ||
		window.blockedMs >= 1_500 ||
		(window.slowInputCount >= 2 && window.blockedMs >= 500)
	);
}

export function isDegraded(windows: readonly PerfWindow[]): boolean {
	const judged = windows.filter(window => window.observedMs >= WINDOW_MS * MIN_WINDOW_COVERAGE).slice(-DEGRADED_SPAN);
	return judged.filter(isBadWindow).length >= BAD_WINDOWS;
}

export function rankSources(stats: readonly PerfSourceStat[], limit = 8): PerfSourceStat[] {
	return stats.toSorted((a, b) => b.totalMs - a.totalMs || b.maxMs - a.maxMs).slice(0, limit);
}
