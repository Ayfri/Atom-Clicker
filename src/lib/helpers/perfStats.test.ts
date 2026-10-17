import { describe, expect, test } from 'bun:test';
import { isBadWindow, isDegraded, LatencyHistogram, rankSources, WINDOW_MS } from '#helpers/perfStats.js';
import type { PerfSourceStat, PerfWindow } from '#lib/types/session.js';

const calm = (overrides: Partial<PerfWindow> = {}): PerfWindow => ({
	blockedMs: 0,
	commitLagP95Ms: 4,
	frameCount: 600,
	frameJankCount: 0,
	freezeCount: 0,
	observedMs: WINDOW_MS,
	slowInputCount: 0,
	...overrides,
});

const bad = (overrides: Partial<PerfWindow> = {}) => calm({ commitLagP95Ms: 150, ...overrides });

const source = (name: string, totalMs: number, maxMs = 1): PerfSourceStat => ({ calls: 1, maxMs, name, totalMs });

describe('LatencyHistogram', () => {
	test('an empty histogram reports 0', () => {
		expect(new LatencyHistogram().percentile(0.95)).toBe(0);
	});

	test('a sample lands in its bucket and the percentile is the bucket bound', () => {
		const histogram = new LatencyHistogram();
		for (let i = 0; i < 10; i++) histogram.add(10);
		histogram.add(30);
		expect(histogram.percentile(0.5)).toBe(12);
		expect(histogram.percentile(1)).toBe(30);
	});

	test('a sample past the last bucket reports the maximum', () => {
		const histogram = new LatencyHistogram();
		histogram.add(5_000);
		expect(histogram.percentile(0.95)).toBe(5_000);
		expect(histogram.max).toBe(5_000);
	});

	test('p95 ignores the top 5% of samples', () => {
		const histogram = new LatencyHistogram();
		for (let i = 0; i < 95; i++) histogram.add(3);
		for (let i = 0; i < 5; i++) histogram.add(400);
		expect(histogram.percentile(0.95)).toBe(4);
		expect(histogram.percentile(0.99)).toBe(400);
	});

	test('reset empties it', () => {
		const histogram = new LatencyHistogram();
		histogram.add(80);
		histogram.reset();
		expect([histogram.count, histogram.max, histogram.percentile(0.95)]).toEqual([0, 0, 0]);
	});
});

describe('isBadWindow', () => {
	test('each trigger flags a window on its own', () => {
		expect(isBadWindow(calm({ commitLagP95Ms: 150 }))).toBe(true);
		expect(isBadWindow(calm({ freezeCount: 1 }))).toBe(true);
		expect(isBadWindow(calm({ frameJankCount: 150 }))).toBe(true);
		expect(isBadWindow(calm({ blockedMs: 1_500 }))).toBe(true);
		expect(isBadWindow(calm({ blockedMs: 500, slowInputCount: 2 }))).toBe(true);
	});

	test('a p95 in the 100 ms bucket (75 to 100 ms) is not bad, the next bucket is', () => {
		expect(isBadWindow(calm({ commitLagP95Ms: 100 }))).toBe(false);
		expect(isBadWindow(calm({ commitLagP95Ms: 101 }))).toBe(true);
	});

	test('blocked time and slow inputs only flag together, or past 1.5 s alone', () => {
		expect(isBadWindow(calm({ blockedMs: 1_499 }))).toBe(false);
		expect(isBadWindow(calm({ blockedMs: 900, slowInputCount: 1 }))).toBe(false);
		expect(isBadWindow(calm({ blockedMs: 499, slowInputCount: 5 }))).toBe(false);
	});

	test('Low Power Mode (late timer, 33 ms frames) is not bad', () => {
		expect(isBadWindow(calm({ commitLagP95Ms: 8, frameCount: 300, frameJankCount: 0 }))).toBe(false);
	});

	test('a 120 Hz screen is not bad', () => {
		expect(isBadWindow(calm({ frameCount: 1_200, frameJankCount: 0 }))).toBe(false);
	});

	test('jank needs 60 frames to count', () => {
		expect(isBadWindow(calm({ frameCount: 59, frameJankCount: 59 }))).toBe(false);
		expect(isBadWindow(calm({ frameCount: 60, frameJankCount: 15 }))).toBe(true);
	});
});

describe('isDegraded', () => {
	test('3 bad windows of 6 degrade, 2 do not', () => {
		const windows = [bad(), calm(), calm(), bad(), calm(), calm()];
		expect(isDegraded(windows)).toBe(false);
		expect(isDegraded([bad(), calm(), bad(), calm(), bad(), calm()])).toBe(true);
	});

	test('fewer than 3 windows never degrade', () => {
		expect(isDegraded([bad(), bad()])).toBe(false);
	});

	test('windows cut short by a hidden tab are ignored', () => {
		expect(isDegraded([bad(), bad(), bad({ observedMs: 2_000 })])).toBe(false);
	});

	test('the 2-core Chromebook windows (steady timer, slow interactions and a freeze) degrade', () => {
		const chromebook = calm({ blockedMs: 2_100, commitLagP95Ms: 16, frameCount: 300, frameJankCount: 10, freezeCount: 1, slowInputCount: 8 });
		expect(isBadWindow(chromebook)).toBe(true);
		expect(isDegraded([chromebook, chromebook, chromebook])).toBe(true);
		expect(isDegraded([calm({ blockedMs: 900, commitLagP95Ms: 16, slowInputCount: 1 }), chromebook, chromebook])).toBe(false);
	});

	test('only the last 6 windows count', () => {
		expect(isDegraded([bad(), bad(), bad(), calm(), calm(), calm(), calm(), calm(), calm()])).toBe(false);
		expect(isDegraded([calm(), calm(), calm(), bad(), bad(), bad()])).toBe(true);
	});
});

describe('rankSources', () => {
	test('sources rank by total time, then by worst call', () => {
		const ranked = rankSources([source('a', 5, 1), source('b', 9, 1), source('c', 5, 7)], 8);
		expect(ranked.map(({ name }) => name)).toEqual(['b', 'c', 'a']);
		expect(rankSources([source('a', 1), source('b', 2)], 1)).toHaveLength(1);
	});
});
