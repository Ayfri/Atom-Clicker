import { beforeEach, describe, expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { BALANCE_VERSION, maxRunAtoms, measureRunBounds, runSeconds } from '#helpers/runBounds.js';
import { validateAndRepairGameState } from '#helpers/saves.js';
import { PROTONS_ATOMS_REQUIRED } from '#lib/constants.js';
import type { BotProfileId } from '#lib/simulation/presets.js';
import { playHonestRun } from '../../../tests/simulatedRun.js';

const { ATOMS } = CurrenciesTypes;

beforeEach(() => gameManager.resetAll());

describe('honest play stays under the bound', () => {
	/**
	 * The server refuses any run past this bound, so a new atom source or multiplier that measureRunBounds misses fails here
	 * before it rejects real players. Hours are per profile so the suite stays a few seconds long.
	 */
	const runs: [BotProfileId, number][] = [
		['afk', 24],
		['automated', 2],
		['balanced', 6],
		['tryhard', 4],
	];

	test.each(runs)('a %s bot over %i hours', (profile, hours) => {
		let worstRun = 0;
		let worstStep = 0;
		let previous: { clicks: number; earned: number; prestiges: number; time: number } | null = null;

		playHonestRun(profile, hours, () => {
			const now = gameManager.clock();
			const bounds = measureRunBounds(gameManager, now);
			const earned = gameManager.currencies[ATOMS].earnedRun;
			const clicks = gameManager.totalClicksRun;
			const prestiges = gameManager.totalProtonisesAllTime + gameManager.totalElectronizesAllTime + gameManager.totalIonizesAllTime;
			worstRun = Math.max(worstRun, earned / maxRunAtoms(bounds, (now - gameManager.runStartedAt) / 1000, clicks) || 0);
			if (previous?.prestiges === prestiges) {
				worstStep = Math.max(worstStep, (earned - previous.earned) / maxRunAtoms(bounds, (now - previous.time) / 1000, clicks - previous.clicks) || 0);
			}
			previous = { clicks, earned, prestiges, time: now };
		});

		expect(worstRun).toBeLessThan(1);
		expect(worstStep).toBeLessThan(1);
	}, 60_000);
});

describe('bounds', () => {
	test('measuring leaves the live game as it was', () => {
		gameManager.generators = { molecule: { count: 10, level: 0, unlocked: true } };
		const before = JSON.stringify(gameManager.getCurrentState());
		measureRunBounds(gameManager, Date.now());
		expect(JSON.stringify(gameManager.getCurrentState())).toBe(before);
	});

	test('ten molecules and a hundred clicks cannot reach the first Protonize in a minute', () => {
		gameManager.generators = { molecule: { count: 10, level: 0, unlocked: true } };
		expect(maxRunAtoms(measureRunBounds(gameManager, Date.now()), 60, 100)).toBeLessThan(PROTONS_ATOMS_REQUIRED);
	});

	test('an unknown run start falls back to the save start, never before the game existed', () => {
		const now = Date.UTC(2026, 0, 2);
		expect(runSeconds(now - 60_000, 0, now)).toBe(60);
		expect(runSeconds(0, now - 3_600_000, now)).toBe(3600);
		expect(runSeconds(0, 0, now)).toBe((now - Date.UTC(2024, 9, 31)) / 1000);
		expect(runSeconds(now + 60_000, 0, now)).toBe(0);
	});
});

describe('balance rebase', () => {
	function loadSave(edit: (state: Record<string, unknown>) => void) {
		gameManager.generators = { molecule: { count: 1, level: 0, unlocked: true } };
		currenciesManager.add(ATOMS, 1e40);
		const state = JSON.parse(JSON.stringify(gameManager.getCurrentState())) as Record<string, unknown>;
		edit(state);
		gameManager.resetAll();
		gameManager.loadSaveData(validateAndRepairGameState(state).state!);
	}

	test('a save from before the balance checks gets its run cut to what the current balance allows', () => {
		loadSave(state => delete state.balanceVersion);
		expect(gameManager.atoms).toBeLessThan(1e9);
		expect(gameManager.currencies[ATOMS].earnedRun).toBeLessThan(1e9);
		expect(gameManager.currencies[ATOMS].earnedAllTime).toBe(1e40);
		expect(gameManager.balanceVersion).toBe(BALANCE_VERSION);
		expect(gameManager.runStartedAt).toBe(0);
	});

	test('a save checked against the current balance loads untouched', () => {
		loadSave(() => {});
		expect(gameManager.atoms).toBe(1e40);
	});

	test('every prestige stamps the start of the new run', () => {
		gameManager.clock = () => 123_456;
		try {
			currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
			expect(gameManager.protonise()).toBe(true);
			expect(gameManager.runStartedAt).toBe(123_456);
		} finally {
			gameManager.clock = () => Date.now();
		}
	});
});
