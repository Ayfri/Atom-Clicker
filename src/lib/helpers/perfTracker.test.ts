import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { MAX_SOURCES } from '#helpers/perfStats.js';
import { PerfTracker } from '#helpers/perfTracker.js';
import type { PerfWindow } from '#lib/types/session.js';

const realNow = performance.now.bind(performance);
let clock = 0;
let tracker = new PerfTracker();
let windows: PerfWindow[] = [];

/** Moves the clock forward without waiting, the tracker only ever reads `performance.now()`. */
const elapse = (ms: number) => (clock += ms);

/** Closes the window in progress the way the 20 ms commit loop would. */
function closeWindow() {
	elapse(10_001);
	tracker.commit(0);
}

beforeEach(() => {
	clock = 1_000;
	performance.now = () => clock;
	tracker = new PerfTracker();
	windows = [];
	tracker.onWindow = closed => windows.push(closed);
	tracker.paused = false;
	tracker.resetWindow();
});

afterEach(() => {
	performance.now = realNow;
});

describe('track', () => {
	test('accumulates calls, total and maximum per source once the window closes', () => {
		tracker.track('loop:commit', performance.now() - 5);
		tracker.track('loop:commit', performance.now() - 20);
		closeWindow();
		const [stat] = tracker.sessionSources();
		expect(stat.name).toBe('loop:commit');
		expect(stat.calls).toBe(2);
		expect(stat.totalMs).toBe(25);
		expect(stat.maxMs).toBe(20);
		expect(windows[0].attributedMs).toBe(25);
		expect(windows[0].topSource).toBe('loop:commit');
	});

	test('the names past the 32nd share the other slot', () => {
		for (let i = 0; i < MAX_SOURCES + 1; i++) tracker.track(`source:${i}`, performance.now());
		tracker.track('source:extra', performance.now());
		closeWindow();
		const sources = tracker.sessionSources();
		expect(sources).toHaveLength(MAX_SOURCES + 1);
		expect(sources.find(({ name }) => name === 'other')?.calls).toBe(2);
	});

	test('a paused tracker ignores every call', () => {
		tracker.paused = true;
		tracker.track('loop:commit', performance.now() - 10);
		tracker.commit(500);
		tracker.frame(200, 100);
		tracker.input(900, 100, 'button');
		expect(tracker.sessionSources()).toEqual([]);
		expect(tracker.counters()).toEqual({ frames: 0, janks: 0, lostMs: 0, ticks: 0 });
		expect(tracker.totals().inputMaxMs).toBe(0);
	});

	test('the partial window a hidden tab drops never reaches the session totals', () => {
		tracker.track('loop:commit', performance.now() - 40);
		tracker.commit(90);
		tracker.frame(300, 200);
		tracker.resetWindow();
		closeWindow();
		expect(tracker.sessionSources()).toEqual([]);
		expect(tracker.totals()).toMatchObject({ commitLagMaxMs: 0, commitLagP95Ms: 0, frameP95GapMs: 0, jankRatio: 0, windows: 1 });
		expect(windows[0]).toMatchObject({ attributedMs: 0, frameCount: 0, lostMs: 0 });
	});
});

describe('frame', () => {
	test('counts gaps and flags the ones past 50 ms as janks', () => {
		tracker.frame(116, 100);
		tracker.frame(200, 116);
		expect(tracker.counters().frames).toBe(2);
		expect(tracker.counters().janks).toBe(1);
		closeWindow();
		expect(windows[0]).toMatchObject({ frameCount: 2, frameJankCount: 1 });
		expect(tracker.totals().jankRatio).toBe(0.5);
	});

	test('two loops sharing one rAF timestamp count one frame', () => {
		tracker.frame(116, 100);
		tracker.frame(116, 100);
		expect(tracker.counters().frames).toBe(1);
	});

	test('a loop that just started has no previous frame to measure from', () => {
		tracker.frame(116, 0);
		expect(tracker.counters().frames).toBe(0);
	});

	test('a gap over a second is not a frame hitch', () => {
		tracker.frame(2_000, 100);
		expect(tracker.counters()).toEqual({ frames: 0, janks: 0, lostMs: 0, ticks: 0 });
	});
});

describe('commit', () => {
	test('late ticks add up to lost time and only the part past 50 ms stalls', () => {
		tracker.commit(10);
		tracker.commit(-3);
		tracker.commit(80);
		expect(tracker.counters().lostMs).toBe(90);
		expect(tracker.counters().ticks).toBe(3);
		expect(windows).toHaveLength(0);
	});

	test('gaps from one second to ten are freezes, longer ones a suspended device', () => {
		tracker.commit(1_000);
		tracker.commit(1_001);
		tracker.commit(4_000);
		tracker.commit(10_000);
		tracker.commit(10_001);
		tracker.commit(600_000);
		closeWindow();
		expect(windows[0]).toMatchObject({ freezeCount: 3, freezeMs: 15_001, lostMs: 1_000 });
		expect(tracker.totals()).toMatchObject({ freezeCount: 3, freezeMs: 15_001 });
	});

	test('the window closes once 10 s elapsed and starts over', () => {
		tracker.commit(80);
		tracker.track('loop:commit', performance.now() - 5);
		elapse(10_001);
		tracker.commit(10);
		tracker.commit(1);

		expect(windows).toHaveLength(1);
		expect(windows[0].lostMs).toBe(90);
		expect(windows[0].commitStallMs).toBe(30);
		expect(windows[0].topSource).toBe('loop:commit');
		expect(windows[0].observedMs).toBeGreaterThanOrEqual(10_000);
		expect(tracker.totals().windows).toBe(1);
	});

	test('a closed window leaves the next one empty', () => {
		tracker.commit(80);
		closeWindow();
		closeWindow();
		expect(windows).toHaveLength(2);
		expect(windows[0].lostMs).toBe(80);
		expect(windows[1].lostMs).toBe(0);
	});
});

describe('input', () => {
	test('keeps the maximum and the slow count of a window', () => {
		tracker.input(120, 20, null);
		tracker.input(350, 300, 'button');
		tracker.input(250, 100, null);
		closeWindow();
		expect(windows[0].inputMaxMs).toBe(350);
		expect(windows[0].inputSlowCount).toBe(2);
		expect(tracker.totals().worstTarget).toBe('button');
		expect(tracker.totals().inputPresentationShare).toBeCloseTo(400 / 600);
	});
});

describe('flushAfter', () => {
	test('measures the Svelte flush once per pending microtask', async () => {
		tracker.flushAfter();
		tracker.flushAfter();
		await Promise.resolve();
		tracker.flushAfter();
		await Promise.resolve();
		closeWindow();
		expect(tracker.sessionSources().find(({ name }) => name === 'svelte:flush')?.calls).toBe(2);
	});
});
