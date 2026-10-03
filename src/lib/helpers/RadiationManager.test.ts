import { beforeEach, describe, expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { IONIZE_CPM, IONIZE_CPM_STEP, IONIZE_HOLD_SECONDS, MASS_PER_ELECTRON, radiationManager } from '#helpers/RadiationManager.svelte.js';

beforeEach(() => {
	gameManager.resetAll();
	radiationManager.unlock();
	radiationManager.random = () => 1;
});

describe('fuel', () => {
	test('turns electrons into mass and counts it for the daily quest', () => {
		currenciesManager.add(CurrenciesTypes.ELECTRONS, 100);
		expect(gameManager.injectFuel(40)).toBe(true);
		expect(gameManager.electrons).toBe(60);
		expect(radiationManager.mass).toBeCloseTo(40 * MASS_PER_ELECTRON);
		expect(gameManager.dailyStats.fuelInjected).toBeCloseTo(40 * MASS_PER_ELECTRON);
	});

	test('refuses more than the bank, nothing, negative and NaN amounts', () => {
		currenciesManager.add(CurrenciesTypes.ELECTRONS, 10);
		for (const amount of [11, 0, -100, NaN]) expect(gameManager.injectFuel(amount), `${amount}`).toBe(false);
		expect(radiationManager.mass).toBe(0);
		expect(gameManager.electrons).toBe(10);
		expect(gameManager.dailyStats.fuelInjected).toBe(0);
	});
});

describe('reactor', () => {
	test('output follows mass and control, capped by the coolant', () => {
		radiationManager.mass = 10;
		radiationManager.setControlRodLevel(0.5);
		expect(radiationManager.currentCpm).toBe(50);
		expect(radiationManager.radiationMultiplier).toBe(2);
		radiationManager.mass = 1e9;
		expect(radiationManager.currentCpm).toBe(radiationManager.maxCpm);
		radiationManager.setControlRodLevel(7);
		expect(radiationManager.controlRodLevel).toBe(1);
	});

	test('the offline closed form lands where many small ticks do', () => {
		radiationManager.upgradeLevels = { breeder_reactor: 5 };
		radiationManager.setControlRodLevel(0.8);
		radiationManager.mass = 500;
		const startMass = radiationManager.mass;
		for (let i = 0; i < 36_000; i++) radiationManager.tick(100);
		const ticked = radiationManager.mass;

		radiationManager.mass = startMass;
		radiationManager.tickOffline(3600);
		expect(radiationManager.mass / ticked).toBeCloseTo(1, 2);
	});

	test('an unfuelled or locked core never moves', () => {
		expect(radiationManager.tickOffline(3600)).toBe(1);
		radiationManager.tick(1000);
		expect(radiationManager.mass).toBe(0);
	});
});

describe('ionize', () => {
	/** A flooded core runs at its coolant cap: 20 pump levels reach 11,000 CPM, 17 stop at 9,500, under the first line. */
	const holdAt = (coolantPumps: number, seconds: number) => {
		radiationManager.upgradeLevels = { coolant_pumps: coolantPumps };
		radiationManager.setControlRodLevel(1);
		for (let i = 0; i < seconds; i++) {
			radiationManager.mass = 1e6;
			radiationManager.tick(1000);
		}
	};

	test('needs the line held for a full minute without a break', () => {
		holdAt(20, IONIZE_HOLD_SECONDS - 1);
		expect(radiationManager.currentCpm).toBeGreaterThanOrEqual(IONIZE_CPM);
		expect(gameManager.ionize()).toBe(false);
		holdAt(17, 1);
		expect(radiationManager.ionizeHold).toBe(0);
	});

	test('resets the run, empties electrons and the core, keeps photon upgrades and raises the line', () => {
		gameManager.photonUpgrades = { photon_efficiency: 1 };
		gameManager.skillUpgrades = ['unlockLevels'];
		gameManager.radiationUpgrades = { fuel: 1 };
		currenciesManager.add(CurrenciesTypes.ELECTRONS, 50);
		currenciesManager.add(CurrenciesTypes.PHOTONS, 50);
		holdAt(20, IONIZE_HOLD_SECONDS);
		expect(radiationManager.ionizeReady).toBe(true);

		expect(gameManager.ionize()).toBe(true);
		expect(gameManager.totalIonizesAllTime).toBe(1);
		expect(gameManager.electrons).toBe(0);
		expect(gameManager.photons).toBe(0);
		expect(radiationManager.mass).toBe(0);
		expect(radiationManager.ionizeHold).toBe(0);
		expect(radiationManager.ionizeCpm).toBe(IONIZE_CPM + IONIZE_CPM_STEP);
		expect(gameManager.photonUpgrades).toEqual({ photon_efficiency: 1 });
		expect(gameManager.radiationUpgrades).toEqual({});
		expect(gameManager.skillUpgrades).toEqual(['unlockLevels']);
	});
});
