import { beforeEach, describe, expect, test } from 'bun:test';
import { RealmTypes } from '#data/realms.js';
import { incidentKind, IncidentKinds, IncidentLog, type IncidentObservation } from '#helpers/perfIncidents.js';
import type { InputBreakdown, LoafBreakdown, PerfIncident } from '#lib/types/session.js';

const input = (overrides: Partial<InputBreakdown> = {}): InputBreakdown => ({ delayMs: 10, presentationMs: 100, processingMs: 190, target: 'Atom', ...overrides });
const loaf = (overrides: Partial<LoafBreakdown> = {}): LoafBreakdown => ({
	blockingMs: 150,
	otherMs: 10,
	scriptMs: 200,
	scripts: [{ durationMs: 200, file: 'app.js', fn: 'Gr', invoker: 'event-listener:DIV.onclick' }],
	styleLayoutMs: 40,
	...overrides,
});

/** A 400 ms block no observer explains, the fields a test changes are passed in. */
const kind = (overrides: Partial<PerfIncident> = {}) => incidentKind({ durationMs: 400, input: null, loaf: null, timerLate: false, ...overrides });

/** Total blocked time over every kind, ignored blocks not included. */
const counted = (log: IncidentLog) => Object.values(log.blocked).reduce((sum, { ms }) => sum + ms, 0);

/** One block of 300 ms as the commit timer, a Long Animation Frame and Event Timing each report it, with their own rounding. */
const views: IncidentObservation[] = [
	{ end: 1_300, start: 1_000, timerLate: true },
	{ end: 1_290, loaf: loaf(), start: 1_010 },
	{ end: 1_300, input: input(), start: 1_000 },
];

const element = {} as Element;
let log = new IncidentLog();

beforeEach(() => {
	log = new IncidentLog();
	log.environment = { describe: () => 'Atom', modal: () => 'skill-tree', realm: () => RealmTypes.PHOTONS };
});

describe('merging', () => {
	test('the views of one block are one incident with the union span, counted once', () => {
		for (const view of views) log.observe(view);
		const [incident, ...rest] = log.worst(10);
		expect(rest).toHaveLength(0);
		expect(incident).toMatchObject({ atMs: 1_000, durationMs: 300, modal: 'skill-tree', realm: 'photons', timerLate: true });
		expect(incident.input?.target).toBe('Atom');
		expect(incident.loaf?.scriptMs).toBe(200);
		expect(log.blocked[IncidentKinds.INPUT]).toEqual({ count: 1, ms: 300 });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 0, ms: 0 });
	});

	test('the order the observers deliver in does not matter', () => {
		const orders = [[0, 1, 2], [2, 1, 0], [1, 2, 0], [2, 0, 1]];
		for (const order of orders) {
			const other = new IncidentLog();
			for (const index of order) other.observe(views[index]);
			expect(other.worst(10)).toHaveLength(1);
			expect(other.worst(1)[0]).toMatchObject({ atMs: 1_000, durationMs: 300, timerLate: true });
			expect(other.blocked[IncidentKinds.INPUT]).toEqual({ count: 1, ms: 300 });
		}
	});

	test('blocks further apart than the slack stay separate', () => {
		log.observe({ end: 1_200, start: 1_000, timerLate: true });
		log.observe({ end: 1_500, start: 1_300, timerLate: true });
		expect(log.worst(10)).toHaveLength(2);
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 2, ms: 400 });

		log.observe({ end: 1_650, start: 1_540, timerLate: true });
		expect(log.worst(10)).toHaveLength(3);
	});

	test('gaps that only touch never chain into one growing freeze', () => {
		for (let tick = 0; tick < 150; tick++) {
			log.observe({ end: 200 * (tick + 1), start: 200 * tick });
			log.observe({ end: 200 * (tick + 1), start: 200 * tick + 20, timerLate: true });
		}
		expect(log.blocked[IncidentKinds.FREEZE]).toEqual({ count: 0, ms: 0 });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 150, ms: 30_000 });
		expect(log.longBlocks).toBe(0);
		expect(Math.max(...log.worst(12).map(({ durationMs }) => durationMs))).toBe(200);
	});

	test('two views of the same observer never merge, and a block never widens past ten seconds', () => {
		log.observe({ end: 1_300, start: 1_000, timerLate: true });
		log.observe({ end: 1_320, start: 1_020, timerLate: true });
		expect(log.worst(10)).toHaveLength(2);

		log.observe({ end: 9_000, loaf: loaf(), start: 1_100 });
		log.observe({ end: 12_000, input: input({ delayMs: 10, presentationMs: 100, processingMs: 2_890 }), start: 9_000 });
		expect(log.worst(10).every(({ durationMs }) => durationMs <= 10_000)).toBe(true);
	});

	test('a view that bridges two blocks folds them into one counted once', () => {
		log.observe({ end: 1_200, start: 1_000, timerLate: true });
		log.observe({ end: 1_450, loaf: loaf(), start: 1_250 });
		expect(log.worst(10)).toHaveLength(2);
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 2, ms: 400 });

		log.observe({ end: 1_350, start: 1_100 });
		const [incident, ...rest] = log.worst(10);
		expect(rest).toHaveLength(0);
		expect(incident).toMatchObject({ atMs: 1_000, durationMs: 450, timerLate: true });
		expect(incident.loaf).not.toBeNull();
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 1, ms: 450 });
	});

	test('a small block seen by every observer late in a session is counted once, though the worst list is full', () => {
		for (let index = 0; index < 12; index++) log.observe({ end: 10_000 * index + 400, start: 10_000 * index, timerLate: true });
		const total = () => Object.values(log.blocked).reduce((sum, { count }) => sum + count, 0);
		const before = total();
		const beforeMs = Object.values(log.blocked).reduce((sum, { ms }) => sum + ms, 0);

		log.observe({ end: 500_300, start: 500_000, timerLate: true });
		log.observe({ end: 500_300, start: 500_020 });
		log.observe({ end: 500_290, loaf: loaf(), start: 500_010 });
		for (const end of [500_300, 500_296, 500_300]) log.observe({ end, input: input(), start: 500_000 });

		expect(total()).toBe(before + 1);
		expect(Object.values(log.blocked).reduce((sum, { ms }) => sum + ms, 0)).toBe(beforeMs + 300);
		expect(log.blocked[IncidentKinds.INPUT]).toEqual({ count: 1, ms: 300 });
		expect(log.worst(20)).toHaveLength(12);
	});

	test('a stall that an Event Timing entry turns into an input moves its time between kinds', () => {
		log.observe({ end: 1_300, start: 1_000, timerLate: true });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 1, ms: 300 });

		log.observe({ end: 1_300, input: input(), start: 1_000 });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 0, ms: 0 });
		expect(log.blocked[IncidentKinds.INPUT]).toEqual({ count: 1, ms: 300 });
	});

	test('the Event Timing entries of one interaction merge and the longest keeps its breakdown', () => {
		log.observe({ end: 1_300, input: input({ target: 'short' }), start: 1_000 });
		log.observe({ end: 1_400, input: input({ presentationMs: 400, target: 'long' }), start: 1_050 });
		log.observe({ end: 1_300, loaf: loaf(), start: 1_000 });
		expect(log.worst(10)).toHaveLength(1);
		expect(log.worst(1)[0].input?.target).toBe('long');
		expect(log.worst(1)[0].loaf?.scriptMs).toBe(200);
	});

	test('a full list evicts its smallest incident and drops a smaller newcomer, both still count as blocked', () => {
		for (let index = 0; index < 12; index++) log.observe({ end: 10_000 * index + 150 + index, start: 10_000 * index, timerLate: true });
		log.observe({ end: 200_400, start: 200_000, timerLate: true });
		const kept = log.worst(20).map(({ durationMs }) => durationMs);
		expect(kept).toHaveLength(12);
		expect(kept[0]).toBe(400);
		expect(kept).not.toContain(150);

		log.observe({ end: 300_150, start: 300_000, timerLate: true });
		expect(log.worst(20).map(({ durationMs }) => durationMs)).not.toContain(150);
		expect(log.blocked[IncidentKinds.STALL].count).toBe(14);
	});
});

describe('kinds', () => {
	test('input beats freeze beats stall beats frame', () => {
		expect(kind({ durationMs: 1_500, input: input({ processingMs: 1_300 }), timerLate: true })).toBe(IncidentKinds.INPUT);
		expect(kind({ durationMs: 1_500, timerLate: true })).toBe(IncidentKinds.FREEZE);
		expect(kind({ timerLate: true })).toBe(IncidentKinds.STALL);
		expect(kind({ loaf: loaf() })).toBe(IncidentKinds.STALL);
		expect(kind()).toBe(IncidentKinds.FRAME);
	});

	test('a late timer proves a busy main thread whatever the Long Animation Frame says', () => {
		expect(kind({ durationMs: 1_800, loaf: loaf({ blockingMs: 0 }), timerLate: true })).toBe(IncidentKinds.FREEZE);
		expect(kind({ durationMs: 340, loaf: loaf({ blockingMs: 0 }), timerLate: true })).toBe(IncidentKinds.STALL);
	});

	test('a Long Animation Frame with an on-time timer is a stall only when its tasks blocked', () => {
		expect(kind({ durationMs: 340, loaf: loaf({ blockingMs: 0 }) })).toBe(IncidentKinds.FRAME);
		expect(kind({ durationMs: 340, loaf: loaf({ blockingMs: 99 }) })).toBe(IncidentKinds.FRAME);
		expect(kind({ durationMs: 340, loaf: loaf({ blockingMs: 300 }) })).toBe(IncidentKinds.STALL);
	});

	test('with a free main thread a gap of a second or more counts as nothing', () => {
		expect(kind({ durationMs: 999 })).toBe(IncidentKinds.FRAME);
		expect(kind({ durationMs: 1_500 })).toBeNull();
		expect(kind({ durationMs: 10_000, input: input({ presentationMs: 10_000, processingMs: 0 }) })).toBeNull();
		expect(kind({ durationMs: 1_500, loaf: loaf({ blockingMs: 0 }) })).toBeNull();
		expect(kind({ durationMs: 1_500, loaf: loaf({ blockingMs: 1_200 }) })).toBe(IncidentKinds.FREEZE);
	});

	test('an interaction under 200 ms is not an input incident', () => {
		expect(kind({ durationMs: 180, input: input({ presentationMs: 50, processingMs: 100 }), timerLate: true })).toBe(IncidentKinds.STALL);
	});

	test('an interaction covering less than half of its block leaves the kind to the block', () => {
		const click = input({ delayMs: 13, presentationMs: 195, processingMs: 0 });
		expect(kind({ durationMs: 5_163, input: click, timerLate: true })).toBe(IncidentKinds.FREEZE);
		expect(kind({ durationMs: 600, input: click, timerLate: true })).toBe(IncidentKinds.STALL);
		expect(kind({ durationMs: 400, input: click, timerLate: true })).toBe(IncidentKinds.INPUT);
	});

	test('only a rAF gap with an on-time timer is a frame incident', () => {
		log.observe({ end: 1_300, start: 1_000 });
		expect(log.blocked[IncidentKinds.FRAME]).toEqual({ count: 1, ms: 300 });
	});

	test('longBlocks counts an incident once when it first crosses a second', () => {
		log.observe({ end: 900, start: 0, timerLate: true });
		expect(log.longBlocks).toBe(0);
		log.observe({ end: 1_100, start: 800 });
		log.observe({ end: 1_500, loaf: loaf(), start: 600 });
		expect(log.longBlocks).toBe(1);
		expect(log.blocked[IncidentKinds.FREEZE]).toEqual({ count: 1, ms: 1_500 });
	});
});

describe('blocks that count as nothing', () => {
	test('three Event Timing entries of one 10 s gap, 1 ms apart, make one ignored block', () => {
		for (const start of [173_261, 173_262, 173_263]) log.observe({ end: start + 10_000, input: input({ delayMs: 0, presentationMs: 10_000, processingMs: 0 }), start });
		expect(log.ignored).toEqual({ count: 1, ms: 10_000 });
		expect(counted(log)).toBe(0);
		expect(Object.values(log.blocked).every(({ count }) => count === 0)).toBe(true);
		expect(log.worst(10)).toEqual([]);
		expect(log.longBlocks).toBe(0);
	});

	test('a rAF gap of 1.5 s with the timer on time is ignored, one of 400 ms is a frame', () => {
		log.observe({ end: 2_500, start: 1_000 });
		expect(log.ignored).toEqual({ count: 1, ms: 1_500 });
		expect(log.blocked[IncidentKinds.FRAME]).toEqual({ count: 0, ms: 0 });

		log.observe({ end: 5_400, start: 5_000 });
		expect(log.blocked[IncidentKinds.FRAME]).toEqual({ count: 1, ms: 400 });
		expect(log.worst(10)).toHaveLength(1);
	});

	test('a late timer is a stall at 400 ms and a freeze at 1.5 s, with or without a Long Animation Frame', () => {
		log.observe({ end: 1_400, start: 1_000, timerLate: true });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 1, ms: 400 });

		log.observe({ end: 1_390, loaf: loaf({ blockingMs: 0 }), start: 1_010 });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 1, ms: 400 });
		expect(log.ignored).toEqual({ count: 0, ms: 0 });

		log.observe({ end: 12_500, start: 11_000, timerLate: true });
		expect(log.blocked[IncidentKinds.FREEZE]).toEqual({ count: 1, ms: 1_500 });
	});

	test('a Long Animation Frame of 340 ms with the timer on time is a frame, a blocking one a stall', () => {
		log.observe({ end: 1_340, loaf: loaf({ blockingMs: 0 }), start: 1_000 });
		expect(log.blocked[IncidentKinds.FRAME]).toEqual({ count: 1, ms: 340 });

		log.observe({ end: 5_340, loaf: loaf({ blockingMs: 300 }), start: 5_000 });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 1, ms: 340 });
		expect(log.blocked[IncidentKinds.FRAME]).toEqual({ count: 1, ms: 340 });
	});

	test('a longer input without handlers never replaces the one that proved them', () => {
		log.observe({ end: 1_200, input: input({ delayMs: 0, presentationMs: 1_050, processingMs: 150 }), start: 0 });
		expect(log.blocked[IncidentKinds.INPUT]).toEqual({ count: 1, ms: 1_200 });
		expect(log.longBlocks).toBe(1);

		log.observe({ end: 1_200, input: input({ delayMs: 0, presentationMs: 1_300, processingMs: 0 }), start: 0 });
		expect(log.blocked[IncidentKinds.INPUT]).toEqual({ count: 1, ms: 1_200 });
		expect(log.ignored).toEqual({ count: 0, ms: 0 });
		expect(log.longBlocks).toBe(1);
		expect(log.worst(1)[0].input?.processingMs).toBe(150);
	});

	test('a counted frame that an Event Timing view widens past a second becomes ignored and leaves the worst list', () => {
		log.observe({ end: 900, start: 0 });
		expect(log.blocked[IncidentKinds.FRAME]).toEqual({ count: 1, ms: 900 });
		expect(log.worst(10)).toHaveLength(1);

		log.observe({ end: 1_100, input: input({ delayMs: 0, presentationMs: 1_100, processingMs: 0 }), start: 0 });
		expect(log.blocked[IncidentKinds.FRAME]).toEqual({ count: 0, ms: 0 });
		expect(log.ignored).toEqual({ count: 1, ms: 1_100 });
		expect(log.worst(10)).toEqual([]);
	});

	test('a few hundred ms of proof inside a 10 s idle gap stay apart from it, in either arrival order', () => {
		const idle: IncidentObservation = { end: 10_000, input: input({ delayMs: 0, presentationMs: 10_000, processingMs: 0 }), start: 0 };
		const late: IncidentObservation = { end: 2_300, start: 2_000, timerLate: true };
		for (const order of [[idle, late], [late, idle]]) {
			const other = new IncidentLog();
			for (const view of order) other.observe(view);
			expect(other.blocked[IncidentKinds.STALL]).toEqual({ count: 1, ms: 300 });
			expect(other.ignored).toEqual({ count: 1, ms: 10_000 });
			expect(other.longBlocks).toBe(0);
			expect(other.blocked[IncidentKinds.INPUT]).toEqual({ count: 0, ms: 0 });
		}
	});

	test('a 1.2 s late timer stays apart from an idle 10 s input, a 6 s one inside a 7 s input joins it', () => {
		const idle = (end: number, start = 0): IncidentObservation => ({ end, input: input({ delayMs: 0, presentationMs: end - start, processingMs: 0 }), start });
		log.observe({ end: 1_200, start: 0, timerLate: true });
		log.observe(idle(10_000));
		expect(log.blocked[IncidentKinds.FREEZE]).toEqual({ count: 1, ms: 1_200 });
		expect(log.ignored).toEqual({ count: 1, ms: 10_000 });

		const joined = new IncidentLog();
		joined.observe(idle(7_000));
		joined.observe({ end: 7_000, start: 1_000, timerLate: true });
		expect(joined.ignored).toEqual({ count: 0, ms: 0 });
		expect(joined.blocked[IncidentKinds.INPUT]).toEqual({ count: 1, ms: 7_000 });
	});

	test('a late timer next to an idle input block that it cannot join is counted as its own stall', () => {
		log.observe({ end: 9_900, input: input({ delayMs: 0, presentationMs: 9_900, processingMs: 0 }), start: 0 });
		log.observe({ end: 10_100, start: 9_800, timerLate: true });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 1, ms: 300 });
		expect(log.ignored).toEqual({ count: 1, ms: 9_900 });
	});

	test('a view joins the first block it can reach within ten seconds, not only the first one that overlaps', () => {
		log.observe({ end: 9_600, start: 0, timerLate: true });
		log.observe({ end: 10_100, start: 9_800, timerLate: true });

		log.observe({ end: 10_100, input: input({ delayMs: 10, presentationMs: 940, processingMs: 150 }), start: 9_000 });
		expect(log.blocked[IncidentKinds.FREEZE]).toEqual({ count: 1, ms: 9_600 });
		expect(log.blocked[IncidentKinds.INPUT]).toEqual({ count: 1, ms: 1_100 });
		expect(log.blocked[IncidentKinds.STALL]).toEqual({ count: 0, ms: 0 });
	});

	test('longBlocks counts a bridged pair of second-long blocks once', () => {
		log.observe({ end: 1_100, start: 0, timerLate: true });
		log.observe({ end: 2_250, loaf: loaf(), start: 1_150 });
		expect(log.longBlocks).toBe(2);

		log.observe({ end: 1_900, start: 500 });
		expect(log.worst(10)).toHaveLength(1);
		expect(log.blocked[IncidentKinds.FREEZE]).toEqual({ count: 1, ms: 2_250 });
		expect(log.longBlocks).toBe(1);
	});

	test('a view that would push a block past ten seconds is dropped instead of counted twice', () => {
		log.observe({ end: 9_000, loaf: loaf(), start: 1_000 });
		expect(log.blocked[IncidentKinds.FREEZE]).toEqual({ count: 1, ms: 8_000 });

		log.observe({ end: 11_000, input: input({ processingMs: 2_000 }), start: 900 });
		expect(log.blocked[IncidentKinds.FREEZE]).toEqual({ count: 1, ms: 8_000 });
		expect(Object.values(log.blocked).reduce((sum, { count }) => sum + count, 0)).toBe(1);
		expect(log.worst(10)).toHaveLength(1);
	});

	test('Long Animation Frames that arrive 12 blocks late never count a block twice', () => {
		const spacing = 6_100;
		const lateLoaf = (index: number) => log.observe({ end: index * spacing + 5_990, loaf: loaf({ blockingMs: 5_900 }), start: index * spacing + 10 });
		for (let index = 0; index < 40; index++) {
			log.observe({ end: index * spacing + 6_000, start: index * spacing, timerLate: true });
			if (index >= 12) lateLoaf(index - 12);
		}
		for (let index = 28; index < 40; index++) lateLoaf(index);

		expect(log.blocked[IncidentKinds.FREEZE].count).toBe(40);
		expect(counted(log)).toBe(40 * 6_000);
	});

	test('the worst list only holds counted blocks', () => {
		log.observe({ end: 2_500, start: 1_000 });
		log.observe({ end: 5_400, start: 5_000 });
		log.observe({ end: 9_300, start: 9_000, timerLate: true });
		expect(log.worst(10).map(({ atMs }) => atMs).sort()).toEqual([5_000, 9_000]);
	});
});

describe('named spans', () => {
	test('overlapping spans are summed by name and the top three kept, outside spans are left out', () => {
		log.span('canvas:atom', 1_000, 1_100);
		log.span('canvas:atom', 1_150, 1_200);
		log.span('svelte:flush', 1_100, 1_130);
		log.span('a', 1_200, 1_220);
		log.span('b', 1_220, 1_230);
		log.span('before', 500, 800);
		log.span('after', 1_500, 1_600);
		log.observe({ end: 1_300, start: 1_000, timerLate: true });
		expect(log.worst(1)[0].sources).toEqual([
			{ ms: 150, name: 'canvas:atom' },
			{ ms: 30, name: 'svelte:flush' },
			{ ms: 20, name: 'a' },
		]);
	});

	test('the ring forgets its oldest spans past 32 entries', () => {
		log.span('old', 1_000, 1_100);
		for (let index = 0; index < 32; index++) log.span('new', 1_100 + index, 1_110 + index);
		log.observe({ end: 1_300, start: 1_000, timerLate: true });
		expect(log.worst(1)[0].sources.map(({ name }) => name)).toEqual(['new']);
	});

	test('a merge collects the spans of the widened block again', () => {
		log.span('late', 1_350, 1_400);
		log.observe({ end: 1_300, start: 1_000, timerLate: true });
		expect(log.worst(1)[0].sources).toEqual([]);
		log.observe({ end: 1_420, loaf: loaf(), start: 1_100 });
		expect(log.worst(1)[0].sources).toEqual([{ ms: 50, name: 'late' }]);
	});
});

describe('actions', () => {
	test('an action within a second before the block names it with its description', () => {
		log.action('tap:', element, 1_000);
		log.observe({ end: 2_100, start: 1_900, timerLate: true });
		expect(log.worst(1)[0]).toMatchObject({ action: 'tap:Atom', actionAgoMs: 900 });
	});

	test('an action 1.2 s before the block does not count', () => {
		log.action('tap:', element, 1_000);
		log.observe({ end: 2_400, start: 2_200, timerLate: true });
		expect(log.worst(1)[0]).toMatchObject({ action: null, actionAgoMs: null });
	});

	test('an action after the block ended does not explain it', () => {
		log.action('tap:', element, 1_500);
		log.observe({ end: 1_300, start: 1_000, timerLate: true });
		expect(log.worst(1)[0].action).toBeNull();
	});

	test('a tap queued behind a block does not rename it', () => {
		log.action('modal:skill-tree', null, 1_000);
		log.action('tap:', element, 1_300);
		log.observe({ end: 1_300, start: 1_100, timerLate: true });
		expect(log.worst(1)[0]).toMatchObject({ action: 'modal:skill-tree', actionAgoMs: 100 });
	});

	test('the latest of the recent actions up to the block start wins', () => {
		log.action('modal:a', null, 100);
		log.action('modal:b', null, 600);
		log.action('modal:c', null, 900);
		log.observe({ end: 1_300, start: 1_000, timerLate: true });
		expect(log.worst(1)[0].action).toBe('modal:c');
	});

	test('an explicit label stands alone and a view that starts earlier finds the action', () => {
		log.action('modal:skill-tree', null, 1_000);
		log.observe({ end: 2_300, start: 2_100, timerLate: true });
		expect(log.worst(1)[0].action).toBeNull();

		log.observe({ end: 2_300, input: input({ delayMs: 600, presentationMs: 400, processingMs: 200 }), start: 1_100 });
		expect(log.worst(1)[0]).toMatchObject({ action: 'modal:skill-tree', actionAgoMs: 100 });
	});

	test('a merge into a block without an action reads the actions again', () => {
		log.observe({ end: 1_300, start: 1_000, timerLate: true });
		expect(log.worst(1)[0].action).toBeNull();

		log.action('tap:', element, 1_030);
		log.observe({ end: 1_290, loaf: loaf(), start: 1_000 });
		expect(log.worst(10)).toHaveLength(1);
		expect(log.worst(1)[0]).toMatchObject({ action: 'tap:Atom', actionAgoMs: 0 });
	});

	test('without an environment the realm falls back to the atoms realm and a target stays undescribed', () => {
		const bare = new IncidentLog();
		bare.action('tap:', element, 1_000);
		bare.observe({ end: 1_300, start: 1_100, timerLate: true });
		expect(bare.worst(1)[0]).toMatchObject({ action: null, modal: null, realm: 'atoms' });
	});
});

test('reset forgets everything', () => {
	log.action('tap:', element, 1_000);
	log.span('x', 1_000, 1_100);
	log.observe({ end: 2_300, start: 1_000, timerLate: true });
	log.observe({ end: 6_500, start: 5_000 });
	expect(log.ignored.count).toBe(1);
	log.reset();
	expect(log.ignored).toEqual({ count: 0, ms: 0 });
	log.observe({ end: 2_300, start: 1_000, timerLate: true });
	expect(log.worst(10)).toHaveLength(1);
	expect(log.worst(1)[0]).toMatchObject({ action: null, sources: [] });
	expect(log.blocked[IncidentKinds.FREEZE].count).toBe(1);
	expect(log.longBlocks).toBe(1);
});
