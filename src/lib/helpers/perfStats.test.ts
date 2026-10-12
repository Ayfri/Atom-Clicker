import { describe, expect, test } from 'bun:test';
import { isBadWindow, isDegraded, LatencyHistogram, pickTopSource, probeVerdict, rankSources, shouldProbe, WINDOW_MS } from '#helpers/perfStats.js';
import type { PerfSourceStat, PerfWindow, ProbeLayerResult } from '#lib/types/session.js';

const calm = (overrides: Partial<PerfWindow> = {}): PerfWindow => ({
	attributedMs: 0,
	commitLagP95Ms: 4,
	commitStallMs: 0,
	frameCount: 600,
	frameJankCount: 0,
	freezeCount: 0,
	freezeMs: 0,
	inputMaxMs: 0,
	inputSlowCount: 0,
	lostMs: 0,
	observedMs: WINDOW_MS,
	topSource: null,
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
		expect([histogram.count, histogram.max, histogram.sum, histogram.percentile(0.95)]).toEqual([0, 0, 0, 0]);
	});
});

describe('isBadWindow', () => {
	test('each trigger flags a window on its own', () => {
		expect(isBadWindow(calm({ commitLagP95Ms: 150 }))).toBe(true);
		expect(isBadWindow(calm({ commitStallMs: 1_500 }))).toBe(true);
		expect(isBadWindow(calm({ freezeCount: 1, freezeMs: 2_500 }))).toBe(true);
		expect(isBadWindow(calm({ inputMaxMs: 500, inputSlowCount: 2 }))).toBe(true);
		expect(isBadWindow(calm({ frameJankCount: 150 }))).toBe(true);
	});

	test('a p95 in the 100 ms bucket (75 to 100 ms) is not bad, the next bucket is', () => {
		expect(isBadWindow(calm({ commitLagP95Ms: 100 }))).toBe(false);
		expect(isBadWindow(calm({ commitLagP95Ms: 101 }))).toBe(true);
	});

	test('one slow input is not enough', () => {
		expect(isBadWindow(calm({ inputMaxMs: 900, inputSlowCount: 1 }))).toBe(false);
		expect(isBadWindow(calm({ inputMaxMs: 300, inputSlowCount: 5 }))).toBe(false);
	});

	test('Low Power Mode (late timer, 33 ms frames) is not bad', () => {
		expect(isBadWindow(calm({ commitLagP95Ms: 8, commitStallMs: 0, frameCount: 300, frameJankCount: 0 }))).toBe(false);
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

	test('only the last 6 windows count', () => {
		expect(isDegraded([bad(), bad(), bad(), calm(), calm(), calm(), calm(), calm(), calm()])).toBe(false);
		expect(isDegraded([calm(), calm(), calm(), bad(), bad(), bad()])).toBe(true);
	});
});

describe('rankSources and pickTopSource', () => {
	test('sources rank by total time, then by worst call', () => {
		const ranked = rankSources([source('a', 5, 1), source('b', 9, 1), source('c', 5, 7)]);
		expect(ranked.map(({ name }) => name)).toEqual(['b', 'c', 'a']);
		expect(rankSources([source('a', 1), source('b', 2)], 1)).toHaveLength(1);
	});

	const tracked = (topSource: string | null) => calm({ attributedMs: 800, lostMs: 1_000, topSource });

	test('the source that topped most evidence windows is named', () => {
		const evidence = [tracked('loop:commit'), tracked('game:tick'), tracked('loop:commit'), tracked('loop:commit')];
		expect(pickTopSource({ evidence, probe: null })).toBe('loop:commit');
	});

	test('a late spike in an otherwise quiet source does not beat the usual one', () => {
		const evidence = [tracked('photon:field'), tracked('photon:field'), tracked('photon:field'), tracked('loop:save')];
		expect(pickTopSource({ evidence, probe: null })).toBe('photon:field');
	});

	test('time no source accounts for is unaccounted', () => {
		const evidence = [calm({ attributedMs: 100, lostMs: 1_000, topSource: 'loop:commit' })];
		expect(pickTopSource({ evidence, probe: null })).toBe('unaccounted');
	});

	test('an even spread is mixed', () => {
		const evidence = ['a', 'b', 'c', 'd', 'e'].map(tracked);
		expect(pickTopSource({ evidence, probe: null })).toBe('mixed');
	});

	test('windows hitching on screen with nothing tracked are mixed, no evidence at all is null', () => {
		expect(pickTopSource({ evidence: [calm({ frameJankCount: 300 })], probe: null })).toBe('mixed');
		expect(pickTopSource({ evidence: [], probe: null })).toBeNull();
	});

	test('the probe culprit wins over everything', () => {
		const probe = { aborted: null, baselineLostMsPerS: 80, culprit: 'glows', layers: [] };
		expect(pickTopSource({ evidence: [tracked('loop:commit')], probe })).toBe('probe:glows');
	});

	test('a tie keeps the source of the newest window', () => {
		expect(pickTopSource({ evidence: [tracked('a'), tracked('b')], probe: null })).toBe('b');
	});
});

describe('shouldProbe', () => {
	test('mostly unaccounted lost time runs the probe', () => {
		expect(shouldProbe([bad({ attributedMs: 100, lostMs: 1_000 })])).toBe(true);
		expect(shouldProbe([bad({ attributedMs: 900, lostMs: 1_000 })])).toBe(false);
	});

	test('mostly render-bound bad windows run it even when the timer is on time', () => {
		const jank = calm({ frameJankCount: 300 });
		const freeze = calm({ freezeCount: 1, freezeMs: 3_000 });
		expect(shouldProbe([jank, freeze, bad({ attributedMs: 900, lostMs: 1_000 })])).toBe(true);
	});

	test('mostly commit-lag bad windows with their time tracked do not', () => {
		const lag = bad({ attributedMs: 900, lostMs: 1_000 });
		expect(shouldProbe([lag, lag, calm({ frameJankCount: 300 })])).toBe(false);
	});

	test('a calm session never probes', () => {
		expect(shouldProbe([calm(), calm()])).toBe(false);
	});
});

describe('probeVerdict', () => {
	const layer = (name: string, lostMsPerS: number, jankRatio: number | null = 0): ProbeLayerResult => ({ jankRatio, lostMsPerS, name });

	test('a layer whose removal drops the lost time by 40% is the culprit', () => {
		expect(probeVerdict([100, 100], [layer('glows', 40), layer('backdrop', 95)], 0)).toBe('glows');
	});

	test('the largest drop wins', () => {
		expect(probeVerdict([100, 100], [layer('glows', 50), layer('backdrop', 20)], 0)).toBe('backdrop');
	});

	test('a baseline drift between both ends does not blame a layer', () => {
		expect(probeVerdict([140, 60], [layer('glows', 90)], 0)).toBeNull();
	});

	test('a 35% drop is not enough', () => {
		expect(probeVerdict([100, 100], [layer('glows', 65)], 0)).toBeNull();
	});

	test('a drop under 30 ms/s is noise even when it is a big share', () => {
		expect(probeVerdict([40, 40], [layer('glows', 15)], 0)).toBeNull();
	});

	test('halving the jank of a janky baseline names the layer', () => {
		expect(probeVerdict([20, 20], [layer('panels', 18, 0.1)], 0.4)).toBe('panels');
		expect(probeVerdict([20, 20], [layer('panels', 18, 0.1)], 0.1)).toBeNull();
	});

	test('a phase with too few frames has no jank value, which skips the jank path', () => {
		expect(probeVerdict([20, 20], [layer('panels', 18, null)], 0.4)).toBeNull();
		expect(probeVerdict([20, 20], [layer('panels', 18, 0.1)], null)).toBeNull();
	});

	test('the lost-time path still works without any jank value', () => {
		expect(probeVerdict([100, 100], [layer('glows', 40, null)], null)).toBe('glows');
	});
});
