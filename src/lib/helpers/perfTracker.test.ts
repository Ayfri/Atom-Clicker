import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { IncidentKinds } from '#helpers/perfIncidents.js';
import { MAX_SOURCE_NAMES } from '#helpers/perfStats.js';
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
	tracker.resume();
});

afterEach(() => {
	performance.now = realNow;
});

describe('track', () => {
	test('accumulates calls, total and maximum per source', () => {
		tracker.track('loop:commit', performance.now() - 5);
		tracker.track('loop:commit', performance.now() - 20);
		const [stat] = tracker.sessionSources();
		expect(stat).toEqual({ calls: 2, maxMs: 20, name: 'loop:commit', totalMs: 25 });
	});

	test('the names past the 32nd share the other slot', () => {
		for (let i = 0; i < MAX_SOURCE_NAMES + 1; i++) tracker.track(`source:${i}`, performance.now());
		tracker.track('source:extra', performance.now());
		const sources = tracker.sessionSources();
		expect(sources).toHaveLength(MAX_SOURCE_NAMES + 1);
		expect(sources.find(({ name }) => name === 'other')?.calls).toBe(2);
	});

	test('a call of 10 ms or more is remembered for the incident it falls in, a shorter one is not', () => {
		elapse(100);
		tracker.track('canvas:atom', performance.now() - 30);
		tracker.track('loop:commit', performance.now() - 9);
		tracker.commit(300);
		expect(tracker.incidents.worst(1)[0].sources).toEqual([{ ms: 30, name: 'canvas:atom' }]);
	});

	test('a paused tracker ignores every call', () => {
		tracker.pause();
		tracker.track('loop:commit', performance.now() - 10);
		tracker.commit(500);
		tracker.frame(900, 100);
		tracker.input(900);
		tracker.action('tap:');
		expect(tracker.sessionSources()).toEqual([]);
		expect(tracker.incidents.worst(1)).toEqual([]);
		expect(tracker.totals()).toMatchObject({ commitLagP95Ms: 0, inputP95Ms: 0, jankRatio: 0 });
	});
});

describe('visibleMs', () => {
	test('adds up unpaused time only, live while running', () => {
		elapse(500);
		expect(tracker.totals().visibleMs).toBe(500);
		tracker.pause();
		elapse(700);
		expect(tracker.totals().visibleMs).toBe(500);
		tracker.resume();
		elapse(200);
		expect(tracker.totals().visibleMs).toBe(700);
	});

	test('pausing twice or resuming twice counts nothing twice', () => {
		elapse(100);
		tracker.pause();
		tracker.pause();
		elapse(100);
		tracker.resume();
		elapse(50);
		tracker.resume();
		elapse(50);
		expect(tracker.totals().visibleMs).toBe(200);
	});
});

describe('frame', () => {
	test('counts gaps and flags the ones past 50 ms as janks', () => {
		tracker.frame(116, 100);
		tracker.frame(200, 116);
		expect(tracker.totals().jankRatio).toBe(0.5);
	});

	test('two loops sharing one rAF timestamp count one frame', () => {
		tracker.frame(116, 100);
		tracker.frame(116, 100);
		tracker.frame(300, 116);
		expect(tracker.totals().jankRatio).toBe(0.5);
	});

	test('a loop that just started has no previous frame to measure from', () => {
		tracker.frame(116, 0);
		tracker.frame(300, 0);
		expect(tracker.totals().jankRatio).toBe(0);
		expect(tracker.incidents.worst(1)).toEqual([]);
	});

	test('a 200 ms gap with an on-time timer is a frame incident', () => {
		tracker.commit(5);
		tracker.frame(1_300, 1_100);
		const [incident] = tracker.incidents.worst(1);
		expect(incident).toMatchObject({ atMs: 1_100, durationMs: 200, timerLate: false });
		expect(tracker.incidents.blocked[IncidentKinds.FRAME]).toEqual({ count: 1, ms: 200 });
	});

	test('a gap under 150 ms is only a jank, one over a second is an incident but no frame, past 10 s it is ignored', () => {
		tracker.frame(1_149, 1_000);
		expect(tracker.incidents.worst(1)).toEqual([]);
		tracker.frame(3_000, 1_149);
		expect(tracker.incidents.blocked[IncidentKinds.FREEZE].count).toBe(1);
		expect(tracker.totals().jankRatio).toBe(1);
		tracker.frame(20_000, 3_000);
		expect(tracker.incidents.blocked[IncidentKinds.FREEZE].count).toBe(1);
	});
});

describe('commit', () => {
	test('a lag of 150 ms is a stall incident with a late timer, 149 ms is not', () => {
		tracker.commit(149);
		expect(tracker.incidents.worst(1)).toEqual([]);

		elapse(400);
		tracker.commit(150);
		expect(tracker.incidents.worst(1)[0]).toMatchObject({ atMs: 1_250, durationMs: 150, timerLate: true });
		expect(tracker.incidents.blocked[IncidentKinds.STALL]).toEqual({ count: 1, ms: 150 });
	});

	test('a lag past 10 s is a suspended device and counts as nothing', () => {
		tracker.commit(10_001);
		tracker.commit(600_000);
		expect(tracker.incidents.worst(1)).toEqual([]);
		expect(tracker.totals().commitLagP95Ms).toBe(0);
	});

	test('only a lag up to a second feeds the lag percentile', () => {
		for (let i = 0; i < 10; i++) tracker.commit(10);
		tracker.commit(1_001);
		tracker.commit(4_000);
		expect(tracker.totals().commitLagP95Ms).toBe(10);
	});

	test('the window closes once 10 s elapsed and reports what happened inside it', () => {
		tracker.commit(80);
		tracker.commit(90);
		elapse(2_000);
		tracker.commit(1_200);
		tracker.frame(2_000, 1_900);
		elapse(8_001);
		tracker.commit(10);
		tracker.commit(1);

		expect(windows).toHaveLength(1);
		expect(windows[0]).toMatchObject({ blockedMs: 1_200, frameCount: 1, frameJankCount: 1, freezeCount: 1, slowInputCount: 0 });
		expect(windows[0].observedMs).toBeGreaterThanOrEqual(10_000);
	});

	test('a closed window leaves the next one empty', () => {
		tracker.commit(300);
		closeWindow();
		closeWindow();
		expect(windows).toHaveLength(2);
		expect(windows[0].blockedMs).toBe(300);
		expect(windows[1]).toMatchObject({ blockedMs: 0, freezeCount: 0, slowInputCount: 0 });
	});

	test('a slow input of the window counts in its slowInputCount', () => {
		tracker.incidents.observe({ end: 1_300, input: { delayMs: 10, presentationMs: 100, processingMs: 190, target: null }, start: 1_000 });
		closeWindow();
		expect(windows[0]).toMatchObject({ blockedMs: 300, slowInputCount: 1 });
	});

	test('the partial window a hidden tab drops never reaches the next one', () => {
		tracker.commit(90);
		tracker.commit(400);
		tracker.frame(300, 200);
		tracker.pause();
		tracker.resume();
		closeWindow();
		expect(windows[0]).toMatchObject({ blockedMs: 0, commitLagP95Ms: 0, frameCount: 0 });
	});
});

describe('action', () => {
	test('the latest action names the incident that follows', () => {
		tracker.incidents.environment = { describe: () => 'Atom', modal: () => null, realm: () => 'atoms' };
		tracker.action('tap:', {} as Element);
		elapse(300);
		tracker.commit(200);
		expect(tracker.incidents.worst(1)[0]).toMatchObject({ action: 'tap:Atom', actionAgoMs: 100 });
	});

	test('an action made while paused is dropped', () => {
		tracker.pause();
		tracker.action('modal:settings');
		tracker.resume();
		tracker.commit(300);
		expect(tracker.incidents.worst(1)[0].action).toBeNull();
	});
});

describe('input', () => {
	test('feeds the p95 only, slow interactions come through the incident log', () => {
		for (let i = 0; i < 20; i++) tracker.input(100);
		tracker.input(900);
		expect(tracker.totals().inputP95Ms).toBe(100);
		expect(tracker.incidents.worst(1)).toEqual([]);
	});
});

describe('flushAfter', () => {
	test('measures the Svelte flush once per pending microtask', async () => {
		tracker.flushAfter();
		tracker.flushAfter();
		await Promise.resolve();
		tracker.flushAfter();
		await Promise.resolve();
		expect(tracker.sessionSources().find(({ name }) => name === 'svelte:flush')?.calls).toBe(2);
	});
});
