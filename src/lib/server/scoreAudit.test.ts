import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { auditScore, type PreviousScore, type ScoreAudit } from '#lib/server/scoreAudit.server.js';
import type { GameState } from '#lib/types.js';
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

/** The bot signs up as it starts playing. */
const context = (now: number, previous: PreviousScore | null = null) => ({ accountCreatedAt: OFFSET, colliderTotal: 0, now, previous });
const audit = ({ now, state }: Capture, previous: PreviousScore | null = null) => auditScore(state, context(now, previous)) as ScoreAudit;
const atomsOf = (state: GameState) => state.currencies[CurrenciesTypes.ATOMS];
const runId = ({ state }: Capture) => `${state.totalProtonisesAllTime}:${state.totalElectronizesAllTime}:${state.totalIonizesAllTime}`;
/** A late state with a known run start, past the first Protonize. */
const lateRun = () => captures.findLast(({ state }) => state.runStartedAt > 0 && atomsOf(state).earnedRun > 1e12)!;

beforeAll(() => {
	playHonestRun('balanced', 6, () => captures.push(capture()));
	captures = captures.filter((_, i) => i % 6 === 0);
});

beforeEach(() => gameManager.resetAll());

describe('honest states', () => {
	test('pass on their own', () => {
		for (const entry of captures) expect(audit(entry).issues, `at ${entry.now - OFFSET} ms`).toEqual([]);
	});

	test('pass against the previous submission of the same run', () => {
		let pairs = 0;
		for (let i = 1; i < captures.length; i++) {
			if (runId(captures[i]) !== runId(captures[i - 1])) continue;
			const previous = { receivedAt: captures[i - 1].now, snapshot: audit(captures[i - 1]).snapshot };
			const result = audit(captures[i], previous);
			expect(result.issues).toEqual([]);
			expect(result.warnings).toEqual([]);
			pairs++;
		}
		expect(pairs).toBeGreaterThan(5);
	});

	test('read the score from the state, never from the client', () => {
		const entry = lateRun();
		const result = audit(entry);
		gameManager.loadSaveData(entry.state);
		expect(result.atoms).toBe(gameManager.atoms);
		expect(result.level).toBe(gameManager.playerLevel);
	});

	test('leave the shared game singleton empty', () => {
		audit(lateRun());
		expect(gameManager.atoms).toBe(0);
		expect(gameManager.upgrades).toEqual([]);
		expect(Object.hasOwn(gameManager, 'effects')).toBe(false);
	});
});

describe('edited states', () => {
	test('atoms far past what the generators make are rejected', () => {
		const entry = structuredClone(lateRun());
		const atoms = atomsOf(entry.state);
		atoms.amount *= 1e30;
		atoms.earnedRun *= 1e30;
		atoms.earnedAllTime *= 1e30;
		expect(audit(entry).issues).toContain('production');
	});

	test('generators the run never paid for are rejected', () => {
		const entry = structuredClone(lateRun());
		const count = (entry.state.generators.blackHole?.count ?? 0) + 400;
		entry.state.generators.blackHole = { count, level: Math.floor(count / 100), unlocked: true };
		expect(audit(entry).issues).toContain('spending');
	});

	test('a jump since the previous submission is rejected', () => {
		const entry = lateRun();
		const previous = { receivedAt: entry.now - 30_000, snapshot: audit(entry).snapshot };
		const jumped = structuredClone(entry);
		const atoms = atomsOf(jumped.state);
		atoms.amount *= 1e6;
		atoms.earnedRun *= 1e6;
		atoms.earnedAllTime *= 1e6;
		expect(audit(jumped, previous).issues).toContain('growth');
	});

	test('duplicated ids, broken generators and missing stats are rejected, inert legacy ids are not', () => {
		const legacy = structuredClone(lateRun());
		legacy.state.upgrades = [...legacy.state.upgrades, 'xpBoost0'];
		legacy.state.achievements = [...legacy.state.achievements, 'first_atom'];
		expect(audit(legacy).issues).toEqual([]);

		const entry = structuredClone(lateRun());
		entry.state.upgrades = [...entry.state.upgrades, entry.state.upgrades[0]];
		entry.state.generators.molecule = { count: 500, level: 99, unlocked: true };
		expect(audit(entry).issues).toEqual(expect.arrayContaining(['upgrades', 'generator:molecule']));

		const missing = structuredClone(lateRun());
		delete (missing.state as Partial<GameState>).generators;
		expect(audit(missing).issues).toEqual(['malformed:generators']);
	});

	describe('client-set counters and dates', () => {
		/** Atoms multiplied by `factor`, after `edit` changed what the client claims about the run. */
		function inflated(entry: Capture, factor: number, edit: (state: GameState) => void = () => {}): Capture {
			const copy = structuredClone(entry);
			edit(copy.state);
			const atoms = atomsOf(copy.state);
			atoms.amount *= factor;
			atoms.earnedRun *= factor;
			atoms.earnedAllTime *= factor;
			return copy;
		}
		/** Smallest power of two the audit refuses as more atoms than the run could make. */
		function rejectedFrom(run: (factor: number) => ScoreAudit): number {
			for (let factor = 2; factor < 1e30; factor *= 2) if (run(factor).issues.includes('production')) return factor;
			return Infinity;
		}
		const inflateClicks = (times: number) => (state: GameState) => {
			state.totalClicksAllTime += state.totalClicksRun * (times - 1);
			state.totalClicksRun *= times;
		};
		const backdate = (state: GameState) => {
			state.startDate = Date.UTC(2024, 9, 31);
			state.runStartedAt = 0;
		};

		test('clicks past human speed raise the bound no further', () => {
			const entry = lateRun();
			/** Both stay safe integers, which the counter check needs, and both are past what a human clicks in the run. */
			const humanCap = rejectedFrom(factor => audit(inflated(entry, factor, inflateClicks(1e4))));
			expect(humanCap).toBeLessThan(Infinity);
			expect(rejectedFrom(factor => audit(inflated(entry, factor, inflateClicks(1e8))))).toBe(humanCap);
		});

		test('a save start moved back before the account buys no run time', () => {
			const entry = lateRun();
			const limit = rejectedFrom(factor => audit(inflated(entry, factor)));
			expect(rejectedFrom(factor => audit(inflated(entry, factor, backdate)))).toBeLessThanOrEqual(limit);
		});

		test('the credited run start never predates what the server saw', () => {
			const entry = lateRun();
			const tolerance = 10 * 60_000;
			const firstAfterSignUp = auditScore(entry.state, { ...context(entry.now), accountCreatedAt: entry.now - 60_000 }) as ScoreAudit;
			expect(firstAfterSignUp.snapshot.runStartedAt).toBeCloseTo(entry.now - 60_000 - tolerance, -2);

			const otherSave = { receivedAt: entry.now - 120_000, snapshot: { ...audit(entry).snapshot, startDate: entry.state.startDate + 1 } };
			expect(audit(entry, otherSave).snapshot.runStartedAt).toBeCloseTo(entry.now - 120_000 - tolerance, -2);

			const credited = audit(entry).snapshot;
			expect(credited.runStartedAt).toBeCloseTo(entry.state.runStartedAt - tolerance, -2);
			const movedBack = structuredClone(entry);
			movedBack.state.runStartedAt -= 24 * 3_600_000;
			expect(audit(movedBack, { receivedAt: entry.now - 60_000, snapshot: credited }).snapshot.runStartedAt).toBe(credited.runStartedAt);
		});
	});

	test('superhuman clicking is only a warning', () => {
		const entry = lateRun();
		const { snapshot } = audit(entry);
		const previous = { receivedAt: entry.now - 600_000, snapshot: { ...snapshot, clicksAllTime: snapshot.clicksAllTime - 1e7, clicksRun: snapshot.clicksRun } };
		const result = audit(entry, previous);
		expect(result.warnings).toContain('clicks');
		expect(result.issues).toEqual([]);
	});
});

describe('payloads', () => {
	test('an older client is told to reload, junk is refused', () => {
		const { now, state } = lateRun();
		expect(auditScore({ ...state, version: state.version - 1 }, context(now))).toBe('outdated');
		expect(auditScore({ ...state, balanceVersion: 0 }, context(now))).toBe('outdated');
		expect(auditScore('atoms', context(now))).toBe('malformed');
		expect(auditScore(null, context(now))).toBe('malformed');
	});
});
