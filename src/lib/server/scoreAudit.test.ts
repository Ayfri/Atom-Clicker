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

const audit = ({ now, state }: Capture, previous: PreviousScore | null = null) => auditScore(state, { colliderTotal: 0, now, previous }) as ScoreAudit;
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
		const context = { colliderTotal: 0, now, previous: null };
		expect(auditScore({ ...state, version: state.version - 1 }, context)).toBe('outdated');
		expect(auditScore({ ...state, balanceVersion: 0 }, context)).toBe('outdated');
		expect(auditScore('atoms', context)).toBe('malformed');
		expect(auditScore(null, context)).toBe('malformed');
	});
});
