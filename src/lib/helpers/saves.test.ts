import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { loadSavedState, migrateSavedState, SAVE_KEY, SAVE_VERSION, serializeSaveState, validateAndRepairGameState } from '#helpers/saves.js';
import { statsConfig } from '#helpers/statConstants.js';
import type { GameState } from '#lib/types.js';

/** Fields the game writes on top of `statsConfig`, they carry no default so a missing one stays missing. */
const UNTRACKED_STATE_KEYS = ['lastInteractionTime', 'version'];

const storage = new Map<string, string>();

beforeAll(() => {
	// The loader logs every state it accepts.
	spyOn(console, 'log').mockImplementation(() => {});
	spyOn(console, 'error').mockImplementation(() => {});
	globalThis.localStorage = {
		clear: () => storage.clear(),
		getItem: key => storage.get(key) ?? null,
		key: index => [...storage.keys()][index] ?? null,
		get length() {
			return storage.size;
		},
		removeItem: key => void storage.delete(key),
		setItem: (key, value) => void storage.set(key, value),
	};
});

/** Bun shares globals between test files, so the spies and the storage shim must not outlive this one. */
afterAll(() => {
	mock.restore();
	Reflect.deleteProperty(globalThis, 'localStorage');
});

afterEach(() => storage.clear());

function migrate(save: Record<string, unknown>): GameState {
	const state = migrateSavedState(structuredClone(save));
	if (!state) throw new Error(`The v${save.version} save was dropped`);
	return state;
}

describe('migrateSavedState', () => {
	test('drops version 1 saves, which predate a hard balance reset', () => {
		expect(migrateSavedState({ buildings: {}, version: 1 })).toBeUndefined();
	});

	test('passes through non-object input as nothing', () => {
		expect(migrateSavedState(null)).toBeUndefined();
		expect(migrateSavedState('save')).toBeUndefined();
	});

	test.each([2, 3, 4, 5])('migrates a v%i save with its generators intact', version => {
		const molecule = { cost: 10, count: 250, rate: 1, unlocked: true, ...(version > 2 && { level: 2 }) };
		const state = migrate({ achievements: [], buildings: { molecule }, upgrades: [], version });
		expect(state.version).toBe(SAVE_VERSION);
		expect(state.generators.molecule).toEqual({ count: 250, level: 2, unlocked: true });
		expect(state).not.toHaveProperty('molecule');
		expect(state).not.toHaveProperty('buildings');
	});

	test('moves v15 loose currencies and run counters into the currency map', () => {
		const state = migrate({
			achievements: ['bonus_photons_clicked_1'],
			atoms: 500,
			buildings: { crystal: { cost: { amount: 5, currency: 'Atoms' }, count: 3, level: 0, unlocked: true } },
			electrons: 4,
			photons: 7,
			protons: 12,
			settings: { automation: { autoClick: true, autoClickPhotons: false, buildings: ['crystal'], upgrades: false }, upgrades: { displayAlreadyBought: true } },
			skillUpgrades: [],
			totalAtomsEarned: 9_000,
			totalAtomsEarnedAllTime: 20_000,
			totalBuildingsPurchased: 3,
			totalClicks: 40,
			totalClicksAllTime: 90,
			totalElectronizes: 2,
			totalProtonises: 6,
			totalProtonsEarned: 30,
			upgrades: [],
			version: 15,
		});

		expect(state.currencies[CurrenciesTypes.ATOMS]).toEqual({ amount: 500, earnedAllTime: 20_000, earnedRun: 9_000 });
		expect(state.currencies[CurrenciesTypes.PROTONS]).toEqual({ amount: 12, earnedAllTime: 30, earnedRun: 30 });
		expect(state.currencies[CurrenciesTypes.ELECTRONS].amount).toBe(4);
		expect(state.currencies[CurrenciesTypes.PHOTONS].amount).toBe(7);
		expect(state).toMatchObject({ totalClicksRun: 40, totalElectronizesAllTime: 2, totalGeneratorsPurchasedAllTime: 3, totalProtonisesAllTime: 6 });
		expect(state.generators.crystal).toEqual({ count: 3, level: 0, unlocked: true });
		expect(state.settings.automation.generators).toEqual(['crystal']);
		for (const key of ['atoms', 'electrons', 'photons', 'protons', 'totalAtomsEarned', 'totalClicks', 'totalBuildingsPurchased']) expect(state).not.toHaveProperty(key);
	});

	test('converts the v20 skill-point system to currency skills', () => {
		const state = migrate({
			buildings: {},
			photonUpgrades: { feature_hover_collection: 1 },
			skillUpgrades: ['xpBoost0', 'clickPowerBoost1', 'somethingKept'],
			upgrades: ['feature_levels', 'feature_offline_progress', 'atom_boost'],
			version: 20,
		});
		expect(state.upgrades).toEqual(expect.arrayContaining(['atom_boost', 'xpBoost0', 'clickPowerBoost1']));
		expect(state.skillUpgrades).toEqual(expect.arrayContaining(['somethingKept', 'unlockLevels', 'offlineProgress', 'hoverCollection']));
		expect(state.skillUpgrades).not.toContain('xpBoost0');
		expect(state.upgrades).not.toContain('feature_levels');
	});

	test('renames buildings to generators everywhere at v25, keeping the quest-server ids', () => {
		const state = migrate({
			buildings: { molecule: { count: 1, level: 0, unlocked: true } },
			dailyStats: { buildingsPurchased: 4, dayKey: '2026-01-01' },
			settings: { automation: { autoClick: false, autoClickPhotons: false, buildings: ['molecule'], upgrades: false }, upgrades: { displayAlreadyBought: false } },
			totalBuildingsPurchasedAllTime: 11,
			tutorial: { enabled: true, seen: ['atoms:building', 'atoms:click'] },
			version: 25,
		});
		expect(state.generators.molecule?.count).toBe(1);
		expect(state.totalGeneratorsPurchasedAllTime).toBe(11);
		expect(state.dailyStats.generatorsPurchased).toBe(4);
		expect(state.dailyStats).not.toHaveProperty('buildingsPurchased');
		expect(state.settings.automation.generators).toEqual(['molecule']);
		expect(state.tutorial.seen).toEqual(['atoms:generator', 'atoms:click']);
	});

	test('swaps stat skills and automation upgrades between the lists at v27', () => {
		const state = migrate({
			generators: {},
			photonUpgrades: {},
			skillUpgrades: ['globalMultiplier', 'moleculeMultiplier', 'photonEfficiency', 'unlockLevels'],
			upgrades: ['proton_auto_click_1', 'electron_auto_buy_molecule', 'atom_boost'],
			version: 27,
		});
		expect(state.upgrades.toSorted()).toEqual(['atom_boost', 'global_multiplier', 'molecule_multiplier']);
		expect(state.skillUpgrades.toSorted()).toEqual(['autoClicker', 'moleculeAutoBuy', 'unlockLevels']);
		expect(state.photonUpgrades.photon_efficiency).toBe(1);
	});

	test('a bare save of every version comes out complete', () => {
		for (let version = 2; version <= SAVE_VERSION; version++) {
			const { state } = validateAndRepairGameState(migrate({ [version < 26 ? 'buildings' : 'generators']: {}, version }));
			expect(Object.keys(statsConfig).filter(key => !(key in state!)), `v${version}`).toEqual([]);
		}
	});

	test('removes duplicated and id-less power-ups', () => {
		const powerUp = { duration: 1000, id: 'a', multiplier: 2, name: 'x', startTime: 0 };
		const state = migrate({ activePowerUps: [powerUp, { ...powerUp }, { ...powerUp, id: '' }, { ...powerUp, id: 'b' }], generators: {}, version: SAVE_VERSION });
		expect(state.activePowerUps.map(p => p.id)).toEqual(['a', 'b']);
	});
});

describe('validateAndRepairGameState', () => {
	test('rejects a non-object state', () => {
		expect(validateAndRepairGameState(null).state).toBeNull();
		expect(validateAndRepairGameState(42).state).toBeNull();
	});

	test('fills missing fields and resets broken ones to their defaults', () => {
		const { repairs, state } = validateAndRepairGameState({ lastSave: Infinity, settings: { automation: 'nope' }, totalClicksRun: NaN, totalXP: Infinity, upgrades: 'x' });
		expect(repairs).toContain('Repaired invalid totalXP: null');
		expect(state).toMatchObject({ lastSave: statsConfig.lastSave.defaultValue, totalClicksRun: 0, totalXP: 0, upgrades: [], version: SAVE_VERSION });
		expect(state?.settings).toEqual(statsConfig.settings.defaultValue);
	});

	test('leaves a valid state untouched', () => {
		const { repairs } = validateAndRepairGameState(JSON.parse(JSON.stringify(gameManager.getCurrentState())));
		expect(repairs).toEqual([]);
	});

	test('never shares a default object with the repaired state', () => {
		const pristine = structuredClone(statsConfig.dailyStats.defaultValue);
		const { state } = validateAndRepairGameState({});
		state!.dailyStats.clicks = 99;
		state!.dailyStats.questIds.push('x');
		expect(statsConfig.dailyStats.defaultValue).toEqual(pristine);
	});
});

describe('save round trip', () => {
	beforeEach(() => gameManager.resetAll());

	test('the live game state names only stats the reset and migration code knows', () => {
		const unknown = Object.keys(gameManager.getCurrentState()).filter(key => !(key in statsConfig) && !UNTRACKED_STATE_KEYS.includes(key));
		expect(unknown).toEqual([]);
	});

	test('a fresh save loads back unchanged, without integrity warnings', () => {
		const current = gameManager.getCurrentState();
		storage.set(SAVE_KEY, serializeSaveState(current));
		const result = loadSavedState();
		expect(result.success).toBe(true);
		expect(result.integrityTampered).toBe(false);
		expect(result.integrityWarnings).toEqual([]);
		expect(result.state).toEqual(JSON.parse(JSON.stringify(current)));
	});

	test('flags a payload edited without its checksum', () => {
		const wrapped = JSON.parse(serializeSaveState(gameManager.getCurrentState()));
		wrapped.payload = wrapped.payload.replace('"totalXP":0', '"totalXP":1');
		storage.set(SAVE_KEY, JSON.stringify(wrapped));
		const result = loadSavedState();
		expect(result.success).toBe(true);
		expect(result.integrityTampered).toBe(true);
	});

	test('keeps the raw data of an unreadable save for the recovery screen', () => {
		storage.set(SAVE_KEY, '{broken');
		expect(loadSavedState()).toMatchObject({ errorType: 'invalid_json', rawData: '{broken', success: false });
	});

	test('treats a missing save as a new game', () => {
		expect(loadSavedState()).toEqual({ state: null, success: true });
	});
});
