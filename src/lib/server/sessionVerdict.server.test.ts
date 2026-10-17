import { describe, expect, test } from 'bun:test';
import { IncidentLog } from '#helpers/perfIncidents.js';
import { judgeSession } from '#lib/server/sessionVerdict.server.js';
import type { PerfIncident, PerfTotals, PerfWindow, SessionGame, SessionPerf } from '#lib/types/session.js';

const game: SessionGame = {
	animations: 14,
	autoClicksPerSecond: 0,
	backdrops: 0,
	canvasBytes: 4_400_000,
	canvases: 3,
	covered: false,
	electronizes: 0,
	glows: 2,
	ionizes: 0,
	level: null,
	modal: 'skill-tree',
	protonises: 1,
	realm: 'atoms',
	realms: ['atoms'],
	reducedMotion: false,
};

const none = { count: 0, ms: 0 };

const totals = (overrides: Partial<PerfTotals> = {}): PerfTotals => ({
	blocked: { frame: none, freeze: none, input: none, stall: none },
	commitLagP95Ms: 16,
	eventTiming: true,
	inputP95Ms: 200,
	jankRatio: 0.035,
	loaf: true,
	visibleMs: 51_000,
	...overrides,
});

const incident = (overrides: Partial<PerfIncident> = {}): PerfIncident => ({
	action: null,
	actionAgoMs: null,
	atMs: 34_000,
	durationMs: 400,
	input: null,
	loaf: null,
	modal: null,
	realm: 'atoms',
	sources: [],
	timerLate: true,
	...overrides,
});

const evidenceWindow = (overrides: Partial<PerfWindow> = {}): PerfWindow => ({ blockedMs: 0, commitLagP95Ms: 16, frameCount: 600, frameJankCount: 0, freezeCount: 0, observedMs: 10_000, slowInputCount: 0, ...overrides });

const perf = (overrides: Partial<SessionPerf> = {}): SessionPerf => ({
	evidence: [],
	incidents: [],
	sources: [
		{ calls: 2_000, maxMs: 40, name: 'svelte:flush', totalMs: 2_090 },
		{ calls: 3_000, maxMs: 20, name: 'canvas:atom', totalMs: 612 },
		{ calls: 2_500, maxMs: 9, name: 'loop:commit', totalMs: 510 },
		{ calls: 1_000, maxMs: 6, name: 'canvas:ambient-atoms', totalMs: 408 },
	],
	totals: totals(),
	...overrides,
});

const stalls = (count: number, ms: number) => totals({ blocked: { frame: none, freeze: none, input: none, stall: { count, ms } } });

/**
 * The 2-core Chromebook of the first real alert, fed through the incident log the way the observers deliver it: 19 slow atom taps,
 * one of 992 ms, a protonize freeze, a long frame, and the Skill Tree opening whose 1.2 s block merges with its click.
 */
function chromebook(): SessionPerf {
	const log = new IncidentLog();
	let modal: string | null = null;
	log.environment = { describe: target => (target as unknown as { name: string }).name, modal: () => modal, realm: () => 'atoms' };
	const element = (name: string) => ({ name }) as unknown as Element;
	const atom = element('Atom');

	for (let tap = 0; tap < 19; tap++) {
		const at = 2_000 + tap * 1_600;
		log.action('tap:', atom, at);
		log.observe({ end: at + 400, input: { delayMs: 5, presentationMs: 145, processingMs: 250, target: 'Atom' }, start: at });
	}

	log.action('tap:', atom, 34_000);
	log.span('svelte:flush', 34_900, 34_938);
	log.observe({ end: 34_992, start: 34_020, timerLate: true });
	log.observe({ end: 34_990, loaf: { otherMs: 20, scriptMs: 512, scripts: [{ durationMs: 512, file: 'Atom.js', fn: 'Gr', invoker: 'event-listener:DIV.onclick' }], styleLayoutMs: 40 }, start: 34_010 });
	log.observe({ end: 34_992, input: { delayMs: 6, presentationMs: 446, processingMs: 540, target: 'Atom' }, start: 34_000 });

	log.action('prestige:protonise', null, 40_000);
	log.observe({ end: 41_500, start: 40_010 });
	log.observe({ end: 41_500, start: 40_020, timerLate: true });

	log.observe({ end: 45_200, start: 45_000 });

	modal = 'skill-tree';
	log.action('tap:', element('Skill Tree'), 50_000);
	log.action('modal:skill-tree', null, 50_030);
	log.observe({ end: 51_240, loaf: { otherMs: 40, scriptMs: 1_020, scripts: [{ durationMs: 610, file: 'app.js', fn: null, invoker: 'event-listener:#document.onclick' }], styleLayoutMs: 140 }, start: 50_040 });
	log.observe({ end: 51_240, start: 50_060, timerLate: true });
	log.observe({ end: 51_240, input: { delayMs: 10, presentationMs: 140, processingMs: 1_090, target: 'Skill Tree' }, start: 50_000 });

	return perf({ incidents: log.worst(6), totals: totals({ blocked: structuredClone(log.blocked) }) });
}

describe('incident based problems', () => {
	test('the Chromebook is slow interactions, caused by the atom tap and its click handler', () => {
		const verdict = judgeSession(chromebook(), game);
		expect(verdict.problem).toBe('slow-interactions');
		expect(verdict.cause).toBe('tap:Atom > DIV.onclick (Gr)');
		expect(verdict.summary).toContain('**Slow interactions**: `tap:Atom > DIV.onclick (Gr)`');
		expect(verdict.summary).toContain('23 incidents blocked 12 s of 51 s visible: 21 slow interactions, 1 freeze, 1 long frame');
		expect(verdict.summary).toContain('1. **1.5 s** at 0:40 after `prestige:protonise`, atoms realm');
		expect(verdict.summary).toContain('2. **1.2 s** at 0:50 after `modal:skill-tree`, atoms realm, modal `skill-tree`');
		expect(verdict.summary).toContain('3. **992 ms** at 0:34 after `tap:Atom`, atoms realm');
		expect(verdict.summary).toContain('delay 10 ms, handlers 1.1 s, presentation 140 ms');
		expect(verdict.summary).toContain('`#document.onclick` (`app.js`) 610 ms');
		expect(verdict.summary).toContain('delay 6 ms, handlers 540 ms, presentation 446 ms');
		expect(verdict.summary).toContain('`DIV.onclick` `Gr` (`Atom.js`) 512 ms, named `svelte:flush` 38 ms');
		expect(verdict.summary).toContain('Steady load: timer lag p95 16 ms, 3.5% janky frames, main thread `svelte:flush` 4.1%');
		expect(verdict.summary).toContain('Context: atoms realm, `skill-tree` open, 1 Protonize, levels locked, 3 canvases (4.2 MB), 14 animations, 2 glows, 0 blurs');
	});

	test('freezes dominated by the Skill Tree opening are freezes', () => {
		const freeze = incident({
			action: 'modal:skill-tree',
			durationMs: 1_800,
			loaf: { otherMs: 0, scriptMs: 300, scripts: [], styleLayoutMs: 1_500 },
			sources: [{ ms: 900, name: 'skilltree:grid' }],
		});
		const verdict = judgeSession(perf({ incidents: [freeze, freeze], totals: totals({ blocked: { frame: none, freeze: { count: 2, ms: 3_600 }, input: { count: 3, ms: 600 }, stall: none } }) }), game);
		expect(verdict.problem).toBe('freezes');
		expect(verdict.cause).toBe('modal:skill-tree > skilltree:grid');
	});

	test('a quick tap inside a 5 s freeze leaves it a freeze, not a render bound slow interaction', () => {
		const log = new IncidentLog();
		for (const at of [10_000, 20_000]) {
			log.observe({ end: at + 5_000, start: at, timerLate: true });
			log.observe({ end: at + 5_050, start: at + 20 });
			log.observe({ end: at + 2_210, input: { delayMs: 13, presentationMs: 195, processingMs: 0, target: 'Atom' }, start: at + 2_000 });
		}
		const verdict = judgeSession(perf({ incidents: log.worst(6), totals: totals({ blocked: structuredClone(log.blocked) }) }), game);
		expect(log.blocked.input).toEqual(none);
		expect(verdict.problem).toBe('freezes');
		expect(verdict.cause).toBe('no action > unattributed');
		expect(verdict.summary).toContain('delay 13 ms, handlers 0 ms, presentation 195 ms, rest');
	});

	test('a breakdown that leaves a quarter of the incident and 100 ms unexplained shows the rest', () => {
		const tap = incident({ durationMs: 5_163, input: { delayMs: 13, presentationMs: 195, processingMs: 0, target: 'Atom' } });
		expect(judgeSession(perf({ incidents: [tap] }), game).summary).toContain('delay 13 ms, handlers 0 ms, presentation 195 ms, rest 5.0 s');

		const loaf = incident({ durationMs: 900, loaf: { otherMs: 20, scriptMs: 300, scripts: [], styleLayoutMs: 100 } });
		expect(judgeSession(perf({ incidents: [loaf] }), game).summary).toContain('script 300 ms, style/layout 100 ms, other 20 ms, rest 480 ms');

		const covered = incident({ durationMs: 900, loaf: { otherMs: 20, scriptMs: 700, scripts: [], styleLayoutMs: 100 } });
		expect(judgeSession(perf({ incidents: [covered] }), game).summary).not.toContain('rest');

		const quarter = incident({ durationMs: 2_000, loaf: { otherMs: 100, scriptMs: 1_000, scripts: [], styleLayoutMs: 600 } });
		expect(judgeSession(perf({ incidents: [quarter] }), game).summary).not.toContain('rest');

		const small = incident({ durationMs: 300, input: { delayMs: 5, presentationMs: 100, processingMs: 100, target: 'Atom' } });
		expect(judgeSession(perf({ incidents: [small] }), game).summary).not.toContain('rest');
	});

	test('frame-only incidents are render bound, and the cause carries no per-session counts', () => {
		const frame = incident({ durationMs: 300, timerLate: false });
		const verdict = judgeSession(perf({ incidents: [frame], totals: totals({ blocked: { frame: { count: 5, ms: 1_500 }, freeze: none, input: none, stall: none } }) }), game);
		expect(verdict.problem).toBe('render-bound');
		expect(verdict.cause).toBe('no action > render');
		expect(verdict.summary).toContain('2 glows, 0 blurs');
	});

	test('style and layout time of twice the script time makes a stall render bound', () => {
		const stall = incident({ action: 'realm:photons', loaf: { otherMs: 0, scriptMs: 100, scripts: [], styleLayoutMs: 250 } });
		const verdict = judgeSession(perf({ incidents: [stall], totals: stalls(4, 1_600) }), game);
		expect(verdict.problem).toBe('render-bound');
		expect(verdict.cause).toBe('realm:photons > render');
	});

	test('a stall dominated by script stays low frame rate and names its script', () => {
		const stall = incident({ action: 'tap:Buy #', loaf: { otherMs: 0, scriptMs: 300, scripts: [{ durationMs: 300, file: null, fn: 'buy', invoker: 'user-callback:setInterval' }], styleLayoutMs: 50 } });
		const verdict = judgeSession(perf({ incidents: [stall], totals: stalls(4, 1_600) }), game);
		expect(verdict.problem).toBe('low-frame-rate');
		expect(verdict.cause).toBe('tap:Buy # > user-callback:setInterval (buy)');
	});

	test('a browser without Event Timing or Long Animation Frames still names the action', () => {
		const stall = incident({ action: 'tap:Atom', durationMs: 700 });
		const verdict = judgeSession(perf({ incidents: [stall, stall], totals: { ...stalls(2, 1_400), eventTiming: false, loaf: false } }), game);
		expect(verdict.problem).toBe('low-frame-rate');
		expect(verdict.cause).toBe('tap:Atom > unattributed');
		expect(verdict.summary).toContain('`tap:Atom > unattributed`');
	});

	test('a winning kind with no sent incident takes its cause from the others', () => {
		const stall = incident({ action: 'tap:Atom', durationMs: 700 });
		const verdict = judgeSession(perf({ incidents: [stall], totals: totals({ blocked: { frame: none, freeze: none, input: { count: 4, ms: 1_600 }, stall: none } }) }), game);
		expect(verdict.problem).toBe('slow-interactions');
		expect(verdict.cause).toBe('tap:Atom > unattributed');
	});
});

describe('steady problems', () => {
	test('jank with an on-time timer is render bound', () => {
		const verdict = judgeSession(perf({ totals: totals({ commitLagP95Ms: 8, jankRatio: 0.4 }) }), game);
		expect(verdict.problem).toBe('render-bound');
		expect(verdict.cause).toBe('render');
	});

	test('a late timer is low frame rate, caused by the top source', () => {
		const verdict = judgeSession(perf({ totals: totals({ commitLagP95Ms: 150, jankRatio: 0.4 }) }), game);
		expect(verdict.problem).toBe('low-frame-rate');
		expect(verdict.cause).toBe('svelte:flush');
	});

	test('jank with a timer p95 between 51 and 100 ms is low frame rate', () => {
		const verdict = judgeSession(perf({ totals: totals({ commitLagP95Ms: 75, jankRatio: 0.4 }) }), game);
		expect(verdict.problem).toBe('low-frame-rate');
	});

	test('the evidence windows judge before the session totals that a late slow stretch dilutes', () => {
		const evidence = [evidenceWindow({ commitLagP95Ms: 90, frameJankCount: 200 }), evidenceWindow({ commitLagP95Ms: 90, frameJankCount: 200 }), evidenceWindow({ commitLagP95Ms: 90, frameJankCount: 200 })];
		const verdict = judgeSession(perf({ evidence, totals: totals({ commitLagP95Ms: 8, jankRatio: 0.02 }) }), game);
		expect(verdict.problem).toBe('low-frame-rate');
		expect(verdict.cause).toBe('svelte:flush');
	});

	test('a calm session is unclassified but still gets its steady load and context', () => {
		const verdict = judgeSession(perf(), game);
		expect(verdict).toMatchObject({ cause: null, problem: null });
		expect(verdict.summary).toMatch(/^\*\*Unclassified\*\*\n\nSteady load: timer lag p95 16 ms/);
		expect(verdict.summary).toContain('Context: atoms realm');
		expect(judgeSession(perf({ totals: stalls(3, 900) }), game).problem).toBeNull();
	});
});

describe('client text', () => {
	const hostile = '`@everyone` <@123> https://evil.test ``` \n @here `​‮';

	test('stays inside one code span with no backtick, mention, link or invisible character outside it', () => {
		const attack = incident({
			action: hostile,
			input: { delayMs: 1, presentationMs: 1, processingMs: 300, target: hostile },
			loaf: { otherMs: 0, scriptMs: 300, scripts: [{ durationMs: 300, file: hostile, fn: hostile, invoker: hostile }], styleLayoutMs: 0 },
			modal: hostile,
			sources: [{ ms: 5, name: 'canvas:atom' }],
		});
		const verdict = judgeSession(perf({ incidents: [attack], totals: totals({ blocked: { frame: none, freeze: none, input: { count: 2, ms: 1_600 }, stall: none } }) }), { ...game, modal: hostile });
		const outside = (verdict.summary ?? '').replace(/`[^`\n]*`/g, '');
		expect(outside).not.toMatch(/[`@<]|https?:/);
		expect(verdict.summary).not.toMatch(/[\p{Cf}]/u);
		expect(verdict.summary).toContain('`@everyone <@123> https://evil.test @here`');
		expect(verdict.cause).toMatch(/^[\w :@.#>()-]+$/);
		expect(verdict.cause).not.toContain('/');
	});

	test('six incidents at every maximum length stay under 3500 characters', () => {
		const long = (length: number) => 'x'.repeat(length);
		const script = { durationMs: 59_999, file: long(60), fn: long(60), invoker: long(80) };
		const heavy = incident({
			action: long(80),
			atMs: 999_999_999,
			durationMs: 59_999,
			input: { delayMs: 59_999, presentationMs: 59_999, processingMs: 59_999, target: long(60) },
			loaf: { otherMs: 59_999, scriptMs: 59_999, scripts: [script, script, script], styleLayoutMs: 59_999 },
			modal: long(40),
			sources: Array.from({ length: 3 }, () => ({ ms: 59_999, name: long(40) })),
		});
		const verdict = judgeSession(
			perf({
				incidents: Array.from({ length: 6 }, () => heavy),
				sources: Array.from({ length: 12 }, () => ({ calls: 1, maxMs: 1, name: long(40), totalMs: 5 })),
				totals: totals({ blocked: { frame: none, freeze: none, input: { count: 6, ms: 360_000 }, stall: none } }),
			}),
			{ ...game, modal: long(40) },
		);
		expect(verdict.summary?.length).toBeLessThanOrEqual(3_500);
		expect(verdict.summary).toContain('Context:');
		expect(verdict.summary).toContain('Steady load:');
		expect((verdict.summary?.match(/`/g) ?? []).length % 2).toBe(0);
		expect(verdict.cause?.length).toBeLessThanOrEqual(80);
	});
});
