import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { patchFor } from '#helpers/stateFixes.js';
import { planAuditFixes } from '#lib/server/auditFixes.server.js';
import { auditScore, inspectScore, type ScoreAudit, type ScoreInspection } from '#lib/server/scoreAudit.server.js';
import type { GameState } from '#lib/types.js';
import type { DevAuditReport, StateFix } from '#lib/types/audit.js';
import { playHonestRun } from '../../../tests/simulatedRun.js';

/** The bot plays on a clock starting at 0, its states are moved to a real date so the date checks see a plausible save. */
const OFFSET = Date.UTC(2026, 0, 1);

interface Capture {
	now: number;
	state: GameState;
}

let captures: Capture[] = [];

/** What the client sends: its current state without the settings, tutorial and daily stats. */
function capture(): Capture {
	const clock = gameManager.clock();
	const { dailyStats, settings, tutorial, ...state } = JSON.parse(JSON.stringify(gameManager.getCurrentState())) as GameState;
	state.startDate += OFFSET;
	state.lastSave = OFFSET + clock;
	state.lastInteractionTime += OFFSET;
	if (state.runStartedAt > 0) state.runStartedAt += OFFSET;
	return { now: OFFSET + clock, state: state as GameState };
}

const context = (now: number) => ({ accountCreatedAt: OFFSET, colliderTotal: 0, now, previous: null, totalUsers: 0 });
const atomsOf = (state: GameState) => state.currencies[CurrenciesTypes.ATOMS];
/** The richest state of a run past its first Protonize, where the run start is known. */
const lateRun = () => captures.filter(({ state }) => state.runStartedAt > 0).reduce((best, entry) => (atomsOf(entry.state).earnedRun > atomsOf(best.state).earnedRun ? entry : best));
const edited = (edit: (state: GameState) => void): Capture => {
	const entry = structuredClone(lateRun());
	edit(entry.state);
	return entry;
};
const inflate = (state: GameState) => {
	const atoms = atomsOf(state);
	atoms.amount *= 1e30;
	atoms.earnedAllTime *= 1e30;
	atoms.earnedRun *= 1e30;
};
const breakPlausibility = (state: GameState) => {
	state.totalClicksRun = state.totalClicksAllTime + 5;
	atomsOf(state).earnedAllTime = atomsOf(state).earnedRun / 2;
	state.inGameTime = state.lastSave - state.startDate + 10 * 3_600_000;
};
const addGenerators = (state: GameState) => {
	const count = (state.generators.blackHole?.count ?? 0) + 400;
	state.generators.blackHole = { count, level: Math.floor(count / 100), unlocked: true };
};

const plan = ({ now, state }: Capture) => planAuditFixes(state, context(now)) as DevAuditReport;
const issuesOf = ({ now, state }: Capture) => (auditScore(state, context(now)) as ScoreAudit).issues;
/** The audit of the state once the plan's fixes are applied the way the game applies them. */
const patchedIssues = (entry: Capture, report: DevAuditReport) => issuesOf({ now: entry.now, state: { ...entry.state, ...patchFor(entry.state, report.fixes) } });
const fixOf = (report: DevAuditReport, target: string) => report.fixes.find(fix => ('currency' in fix ? `${fix.currency}.${fix.field}` : fix.key) === target);

/** Playing three hours takes several seconds, past the default hook timeout on a busy machine. */
beforeAll(() => {
	playHonestRun('balanced', 3, () => captures.push(capture()));
	captures = captures.filter((_, i) => i % 6 === 0);
}, 60_000);

beforeEach(() => gameManager.resetAll());

describe('planAuditFixes', () => {
	test('an honest state needs nothing', () => {
		const report = plan(lateRun());
		expect(report.checks).toEqual([]);
		expect(report.fixes).toEqual([]);
		expect(report.remaining).toEqual([]);
	});

	test('atoms far past what the generators make are cut to the bound', () => {
		const entry = edited(inflate);
		const report = plan(entry);
		const production = report.checks.find(check => check.id === 'production')!;
		expect(production.value!).toBeGreaterThan(production.limit!);
		expect(fixOf(report, `${CurrenciesTypes.ATOMS}.earnedRun`)).toBeDefined();
		expect(fixOf(report, 'runStartedAt')).toBeUndefined();
		expect(patchedIssues(entry, report)).toEqual([]);
	});

	test('atoms held above what the run earned raise the earned total when the run could have made them', () => {
		const entry = edited(state => (atomsOf(state).amount = atomsOf(state).earnedRun * 2));
		const report = plan(entry);
		expect(fixOf(report, `${CurrenciesTypes.ATOMS}.earnedRun`)).toBeDefined();
		expect(fixOf(report, `${CurrenciesTypes.ATOMS}.amount`)).toBeUndefined();
		expect(fixOf(report, 'runStartedAt')).toBeUndefined();
		expect(patchedIssues(entry, report)).toEqual([]);
	});

	test('atoms held beyond anything the run could make are lowered', () => {
		const entry = edited(state => (atomsOf(state).amount = 1e300));
		const report = plan(entry);
		const amount = fixOf(report, `${CurrenciesTypes.ATOMS}.amount`)!;
		expect(amount.to).toBeLessThan(amount.from);
		expect(patchedIssues(entry, report)).toEqual([]);
	});

	test('XP past what the atoms pay for is lowered', () => {
		const entry = edited(state => (state.totalXP *= 1e12));
		const report = plan(entry);
		const xp = fixOf(report, 'totalXP')!;
		expect(xp.to).toBeLessThan(xp.from);
		expect(patchedIssues(entry, report)).toEqual([]);
	});

	test('inconsistent counters, earned totals and play time are brought back', () => {
		const entry = edited(breakPlausibility);
		const report = plan(entry);
		expect(fixOf(report, 'totalClicksAllTime')).toBeDefined();
		expect(fixOf(report, `${CurrenciesTypes.ATOMS}.earnedAllTime`)).toBeDefined();
		expect(fixOf(report, 'startDate')).toBeDefined();
		expect(patchedIssues(entry, report)).toEqual([]);
	});

	test('a plausibility breach hiding a production one is fixed too', () => {
		const entry = edited(state => {
			breakPlausibility(state);
			inflate(state);
		});
		const report = plan(entry);
		expect(report.checks.length).toBeGreaterThan(0);
		expect(report.checks.every(check => check.id === 'plausibility')).toBe(true);
		expect(fixOf(report, `${CurrenciesTypes.ATOMS}.earnedRun`)).toBeDefined();
		expect(patchedIssues(entry, report)).toEqual([]);
	});

	test('a null currency entry has no rule and does not throw', () => {
		const entry = edited(state => {
			(state.currencies as Record<string, unknown>)[CurrenciesTypes.PROTONS] = null;
			breakPlausibility(state);
		});
		const report = plan(entry);
		expect(report.remaining).toContain(`currency:${CurrenciesTypes.PROTONS}`);
		expect(fixOf(report, 'startDate')).toBeDefined();

		const noAtoms = edited(state => ((state.currencies as Record<string, unknown>)[CurrenciesTypes.ATOMS] = null));
		expect(plan(noAtoms).remaining).toContain(`currency:${CurrenciesTypes.ATOMS}`);
	});

	test('generators the run never paid for reset the run start', () => {
		const entry = edited(addGenerators);
		const report = plan(entry);
		expect(fixOf(report, 'runStartedAt')?.to).toBe(0);
		expect(patchedIssues(entry, report)).toEqual([]);
	});

	test('a duplicated id has no rule', () => {
		const entry = edited(state => (state.upgrades = [...state.upgrades, state.upgrades[0]]));
		const report = plan(entry);
		expect(report.remaining).toContain('upgrades');
		expect(report.fixes).toEqual([]);
	});

	test('auditScore is the inspection without its extras', () => {
		for (const { now, state } of [lateRun(), edited(inflate), edited(breakPlausibility), edited(addGenerators)]) {
			const { checks, maxEarnedRun, ...audit } = inspectScore(state, context(now)) as ScoreInspection;
			expect(auditScore(state, context(now))).toEqual(audit);
		}
	});

	test('the client path through the game singleton ends on a state that passes', () => {
		const entry = edited(inflate);
		gameManager.loadSaveData(entry.state);
		const snapshot = JSON.parse(JSON.stringify(gameManager.getCurrentState())) as GameState;
		const strip = ({ dailyStats, settings, tutorial, ...state }: GameState) => state as GameState;
		const report = planAuditFixes(strip(snapshot), context(entry.now)) as DevAuditReport;

		gameManager.loadSaveData(snapshot);
		gameManager.loadSaveData(patchFor(gameManager.getCurrentState(), report.fixes));
		const earnedRun = fixOf(report, `${CurrenciesTypes.ATOMS}.earnedRun`)!.to;
		expect(currenciesManager.currencies[CurrenciesTypes.ATOMS].earnedRun).toBe(earnedRun);
		const next = strip(JSON.parse(JSON.stringify(gameManager.getCurrentState())) as GameState);
		expect(issuesOf({ now: entry.now, state: next })).toEqual([]);
	});
});

describe('patchFor', () => {
	const atoms = CurrenciesTypes.ATOMS;
	const fix = (field: 'amount' | 'earnedRun', from: number, to: number): StateFix => ({ currency: atoms, field, from, issue: 'test', to });

	test('a live value equal to `from` lands on `to`, one that moved keeps its gain', () => {
		const { state } = lateRun();
		const from = atomsOf(state).earnedRun;
		expect(patchFor(state, [fix('earnedRun', from, 5)]).currencies![atoms].earnedRun).toBe(5);

		const moved = structuredClone(state);
		atomsOf(moved).earnedRun = from + 20;
		expect(patchFor(moved, [fix('earnedRun', from, 5)]).currencies![atoms].earnedRun).toBe(25);
	});

	test('two fields of one currency both land, and the input stays as it was', () => {
		const { state } = lateRun();
		const before = JSON.stringify(state);
		const patch = patchFor(state, [fix('earnedRun', atomsOf(state).earnedRun, 7), fix('amount', atomsOf(state).amount, 3), { from: state.totalXP, issue: 'test', key: 'totalXP', to: 0 }]);
		expect(patch.currencies![atoms]).toMatchObject({ amount: 3, earnedRun: 7 });
		expect(patch.totalXP).toBe(0);
		expect(JSON.stringify(state)).toBe(before);
	});

	test('a timestamp or a target of 0 lands as is even when the live value moved', () => {
		const { state } = lateRun();
		const moved = { ...structuredClone(state), runStartedAt: state.runStartedAt + 5_000, startDate: state.startDate + 5_000 };
		atomsOf(moved).amount += 20;
		const patch = patchFor(moved, [
			{ from: state.runStartedAt, issue: 'test', key: 'runStartedAt', to: 0 },
			{ from: state.startDate, issue: 'test', key: 'startDate', to: state.startDate - 1_000 },
			fix('amount', atomsOf(state).amount, 0),
		]);
		expect(patch.runStartedAt).toBe(0);
		expect(patch.startDate).toBe(state.startDate - 1_000);
		expect(patch.currencies![atoms].amount).toBe(0);
	});
});
