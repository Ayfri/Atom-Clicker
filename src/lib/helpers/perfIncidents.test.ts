import { beforeEach, describe, expect, test } from 'bun:test';
import { RealmTypes } from '#data/realms.js';
import { incidentKind, IncidentKinds, IncidentLog, type IncidentObservation } from '#helpers/perfIncidents.js';
import type { InputBreakdown, LoafBreakdown } from '#lib/types/session.js';

const input = (overrides: Partial<InputBreakdown> = {}): InputBreakdown => ({ delayMs: 10, presentationMs: 100, processingMs: 190, target: 'Atom', ...overrides });
const loaf = (overrides: Partial<LoafBreakdown> = {}): LoafBreakdown => ({ otherMs: 10, scriptMs: 200, scripts: [{ durationMs: 200, file: 'app.js', fn: 'Gr', invoker: 'event-listener:DIV.onclick' }], styleLayoutMs: 40, ...overrides });

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
		expect(incidentKind({ durationMs: 1_500, input: input({ processingMs: 1_300 }), loaf: null, timerLate: true })).toBe(IncidentKinds.INPUT);
		expect(incidentKind({ durationMs: 1_500, input: null, loaf: null, timerLate: true })).toBe(IncidentKinds.FREEZE);
		expect(incidentKind({ durationMs: 400, input: null, loaf: null, timerLate: true })).toBe(IncidentKinds.STALL);
		expect(incidentKind({ durationMs: 400, input: null, loaf: loaf(), timerLate: false })).toBe(IncidentKinds.STALL);
		expect(incidentKind({ durationMs: 400, input: null, loaf: null, timerLate: false })).toBe(IncidentKinds.FRAME);
	});

	test('an interaction under 200 ms is not an input incident', () => {
		expect(incidentKind({ durationMs: 180, input: input({ presentationMs: 50, processingMs: 100 }), loaf: null, timerLate: true })).toBe(IncidentKinds.STALL);
	});

	test('an interaction covering less than half of its block leaves the kind to the block', () => {
		const click = input({ delayMs: 13, presentationMs: 195, processingMs: 0 });
		expect(incidentKind({ durationMs: 5_163, input: click, loaf: null, timerLate: true })).toBe(IncidentKinds.FREEZE);
		expect(incidentKind({ durationMs: 600, input: click, loaf: null, timerLate: true })).toBe(IncidentKinds.STALL);
		expect(incidentKind({ durationMs: 400, input: click, loaf: null, timerLate: true })).toBe(IncidentKinds.INPUT);
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
	log.reset();
	log.observe({ end: 2_300, start: 1_000, timerLate: true });
	expect(log.worst(10)).toHaveLength(1);
	expect(log.worst(1)[0]).toMatchObject({ action: null, sources: [] });
	expect(log.blocked[IncidentKinds.FREEZE].count).toBe(1);
	expect(log.longBlocks).toBe(1);
});
