import { beforeEach, describe, expect, test } from 'bun:test';
import { COSMOS_OBJECTS_BY_ID, IONIZE_FLASH_SECONDS, studyCost } from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { IONIZE_CPM, IONIZE_HOLD_SECONDS, radiationManager } from '#helpers/RadiationManager.svelte.js';

const starlight = () => currenciesManager.getAmount(CurrenciesTypes.STARLIGHT);

beforeEach(() => {
	gameManager.resetAll();
	radiationManager.random = () => 1;
});

describe('unlock', () => {
	test('stays dark, without Starlight or boosts, until the first Ionize', () => {
		gameManager.tick(10_000, true);
		expect(cosmosManager.unlocked).toBe(false);
		expect(starlight()).toBe(0);
		expect(cosmosManager.effectSources).toEqual([]);
	});

	test('the first Ionize opens it and pays a flash sized by the reactor peak', () => {
		radiationManager.unlock();
		radiationManager.upgradeLevels = { coolant_pumps: 20 };
		radiationManager.setControlRodLevel(1);
		for (let i = 0; i < IONIZE_HOLD_SECONDS; i++) {
			radiationManager.mass = 1e6;
			radiationManager.tick(1000);
		}
		const peak = radiationManager.peakCpm;
		expect(peak).toBe(radiationManager.maxCpm);

		expect(gameManager.ionize()).toBe(true);
		expect(cosmosManager.unlocked).toBe(true);
		expect(radiationManager.peakCpm).toBe(0);
		/** Sun and Earth radiate 1 each, x1.25 after one Ionize. */
		expect(starlight()).toBeCloseTo(2 * 1.25 * IONIZE_FLASH_SECONDS * (peak / IONIZE_CPM) ** 2);
	});
});

describe('sky', () => {
	beforeEach(() => {
		gameManager.totalIonizesAllTime = 1;
	});

	test('radiates Starlight from the given objects, times the Ionize multiplier', () => {
		expect(cosmosManager.starlightPerSecond).toBe(2.5);
		gameManager.tick(4000, true);
		expect(starlight()).toBeCloseTo(10);
	});

	test('discovers objects in history order, and only those the instruments can see', () => {
		expect(cosmosManager.nextDiscovery?.id).toBe('moon');
		expect(cosmosManager.discover('mars')).toBe(false);
		for (const id of ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']) expect(cosmosManager.discover(id), id).toBe(true);
		expect(cosmosManager.nextDiscovery).toBeNull();

		currenciesManager.add(CurrenciesTypes.STARLIGHT, cosmosManager.nextInstrument!.cost);
		expect(cosmosManager.purchaseInstrument('refractor')).toBe(true);
		expect(starlight()).toBe(0);
		expect(cosmosManager.nextDiscovery?.id).toBe('io');
	});

	test('studies add the object rate again and raise its boost, which reaches the game stats', () => {
		const globalBefore = gameManager.globalMultiplier;
		const earth = COSMOS_OBJECTS_BY_ID.earth;
		currenciesManager.add(CurrenciesTypes.STARLIGHT, studyCost(earth, 0) + studyCost(earth, 1));
		expect(cosmosManager.study('earth')).toBe(true);
		expect(cosmosManager.study('earth')).toBe(true);
		expect(cosmosManager.study('earth')).toBe(false);
		expect(cosmosManager.study('mars')).toBe(false);
		expect(starlight()).toBeCloseTo(0);
		expect(cosmosManager.starlightPerSecond).toBe((1 + 3) * 1.25);
		expect(gameManager.globalMultiplier / globalBefore).toBeCloseTo((1 + 0.1 * 3) / 1.1);
	});

	test('survives every prestige and drops unknown ids from a save', () => {
		cosmosManager.discover('moon');
		gameManager.resetLayer(4);
		expect(cosmosManager.discovered).toEqual(['moon']);

		gameManager.cosmos = { discovered: ['moon', 'death_star'], instruments: ['warp'], studies: { moon: 2, sun: Number.NaN, tatooine: 9 } };
		expect(cosmosManager.getState()).toEqual({ discovered: ['moon'], instruments: [], studies: { moon: 2 } });
	});
});
