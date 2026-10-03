import { beforeEach, describe, expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES, GENERATORS, GeneratorTypes } from '#data/generators.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { LAYERS } from '#helpers/statConstants.js';
import { PROTONS_ATOMS_REQUIRED } from '#lib/constants.js';

const { ATOMS, ELECTRONS, EXCITED_PHOTONS, PHOTONS, PROTONS, RED_LIGHT } = CurrenciesTypes;

beforeEach(() => {
	gameManager.resetAll();
	gameManager.quarkEntitlements = [];
});

describe('generator purchases', () => {
	test.each(GENERATOR_TYPES)('the max affordable %s count is exactly what the bank pays for', type => {
		for (const count of [0, 1, 37, 99, 100, 250]) {
			gameManager.generators = { [type]: { count, level: 0, unlocked: true } };
			const next = gameManager.getGeneratorCost(type, 1);
			for (const owned of [0, next - 1, next, next * 1.5, next * 7.3, next * 1e3, next * 1e9]) {
				currenciesManager.hardReset();
				currenciesManager.add(GENERATORS[type].cost.currency, owned);
				const max = gameManager.getMaxAffordableGenerator(type);
				if (max > 0) expect(gameManager.getGeneratorCost(type, max), `${type} ×${max} at count ${count} with ${owned}`).toBeLessThanOrEqual(owned);
				expect(gameManager.getGeneratorCost(type, max + 1), `${type} ×${max + 1} at count ${count} with ${owned}`).toBeGreaterThan(owned);
			}
		}
	});

	test('an overflowed bank neither hangs Max nor turns into NaN on purchase', () => {
		currenciesManager.add(ATOMS, Infinity);
		const max = gameManager.getMaxAffordableGenerator(GeneratorTypes.MOLECULE);
		expect(max).toBe(Infinity);
		expect(gameManager.purchaseGenerator(GeneratorTypes.MOLECULE, max)).toBe(false);
		expect(gameManager.atoms).toBe(Infinity);
		expect(gameManager.generators.molecule).toBeUndefined();
	});

	test('bulk cost equals the sum of single purchases', () => {
		const bulk = gameManager.getGeneratorCost(GeneratorTypes.CRYSTAL, 10);
		currenciesManager.add(ATOMS, 1e12);
		let singles = 0;
		for (let i = 0; i < 10; i++) {
			singles += gameManager.getGeneratorCost(GeneratorTypes.CRYSTAL, 1);
			expect(gameManager.purchaseGenerator(GeneratorTypes.CRYSTAL)).toBe(true);
		}
		expect(singles).toBeCloseTo(bulk, -1);
	});

	test('spends the cost, levels up every hundred and counts the purchase', () => {
		const cost = gameManager.getGeneratorCost(GeneratorTypes.MOLECULE, GENERATOR_LEVEL_UP_COST);
		currenciesManager.add(ATOMS, cost + 5);
		expect(gameManager.purchaseGenerator(GeneratorTypes.MOLECULE, GENERATOR_LEVEL_UP_COST)).toBe(true);
		expect(gameManager.atoms).toBeCloseTo(5);
		expect(gameManager.generators.molecule).toEqual({ count: GENERATOR_LEVEL_UP_COST, level: 1, unlocked: true });
		expect(gameManager.totalGeneratorsPurchasedAllTime).toBe(GENERATOR_LEVEL_UP_COST);
		expect(gameManager.dailyStats.generatorsPurchased).toBe(GENERATOR_LEVEL_UP_COST);
	});

	test('refuses a purchase the bank cannot cover and leaves everything untouched', () => {
		currenciesManager.add(ATOMS, gameManager.getGeneratorCost(GeneratorTypes.MOLECULE, 2) - 1);
		const before = gameManager.atoms;
		expect(gameManager.purchaseGenerator(GeneratorTypes.MOLECULE, 2)).toBe(false);
		expect(gameManager.atoms).toBe(before);
		expect(gameManager.generators.molecule).toBeUndefined();
	});
});

describe('reset layers', () => {
	const seed = () => {
		for (const currency of [ATOMS, ELECTRONS, EXCITED_PHOTONS, PHOTONS, PROTONS, RED_LIGHT]) currenciesManager.add(currency, 100);
		gameManager.achievements = ['a'];
		gameManager.generators = { molecule: { count: 5, level: 0, unlocked: true } };
		gameManager.photonUpgrades = { photon_efficiency: 1 };
		gameManager.radiationUpgrades = { fuel: 1 };
		gameManager.skillUpgrades = ['unlockLevels'];
		gameManager.totalClicksAllTime = 50;
		gameManager.totalClicksRun = 50;
		gameManager.totalProtonisesRun = 3;
		gameManager.totalXP = 1000;
		gameManager.upgrades = ['molecular_boost'];
	};

	test('Protonize clears the run and keeps protons, electrons and everything permanent', () => {
		seed();
		gameManager.resetLayer(LAYERS.PROTONIZER);
		expect(gameManager.atoms).toBe(0);
		expect(gameManager.generators).toEqual({});
		expect(gameManager.upgrades).toEqual([]);
		expect(gameManager.totalXP).toBe(0);
		expect(gameManager.totalClicksRun).toBe(0);
		expect(gameManager.protons).toBe(100);
		expect(gameManager.electrons).toBe(100);
		expect(gameManager.totalProtonisesRun).toBe(3);
		expect(gameManager.totalClicksAllTime).toBe(50);
		expect(gameManager.achievements).toEqual(['a']);
		expect(gameManager.skillUpgrades).toEqual(['unlockLevels']);
		expect(currenciesManager.currencies[ATOMS].earnedAllTime).toBe(100);
	});

	test('Electronize also clears protons and the protonize count, never electrons', () => {
		seed();
		gameManager.resetLayer(LAYERS.ELECTRONIZE);
		expect(gameManager.protons).toBe(0);
		expect(gameManager.totalProtonisesRun).toBe(0);
		expect(gameManager.electrons).toBe(100);
		expect(gameManager.photonUpgrades).toEqual({ photon_efficiency: 1 });
	});

	test('the Radiation layer clears photon and radiation upgrades and keeps skills and colored light', () => {
		seed();
		gameManager.resetLayer(LAYERS.RADIATION_REALM);
		expect(gameManager.photonUpgrades).toEqual({});
		expect(gameManager.radiationUpgrades).toEqual({});
		expect(currenciesManager.getAmount(PHOTONS)).toBe(0);
		expect(currenciesManager.getAmount(EXCITED_PHOTONS)).toBe(0);
		expect(currenciesManager.getAmount(RED_LIGHT)).toBe(100);
		expect(gameManager.skillUpgrades).toEqual(['unlockLevels']);
	});

	test('the keep-boosts entitlement spares currency boosts', () => {
		gameManager.currencyBoosts = { [ATOMS]: 2 };
		gameManager.quarkEntitlements = ['convenience_keep_currency_boosts'];
		gameManager.resetLayer(LAYERS.PROTONIZER);
		expect(gameManager.currencyBoosts).toEqual({ [ATOMS]: 2 });

		gameManager.quarkEntitlements = [];
		gameManager.resetLayer(LAYERS.PROTONIZER);
		expect(gameManager.currencyBoosts).toEqual({});
	});

	test('a reset never hands out the shared default objects', () => {
		gameManager.resetLayer(LAYERS.PROTONIZER);
		gameManager.upgrades.push('molecular_boost');
		gameManager.resetLayer(LAYERS.PROTONIZER);
		expect(gameManager.upgrades).toEqual([]);
	});
});

describe('protonise', () => {
	test('needs the atom threshold', () => {
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED - 1);
		expect(gameManager.protonise()).toBe(false);
		expect(gameManager.totalProtonisesAllTime).toBe(0);
	});

	test('pays protons and keeps only the upgrades paid in protons or electrons', () => {
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED * 4);
		gameManager.upgrades = ['molecular_boost', 'proton_boost_1', 'stability_speed_1', 'proton_electron_boost_1'];
		const gain = gameManager.protoniseProtonsGain;
		expect(gain).toBeGreaterThan(0);
		expect(gameManager.protonise()).toBe(true);
		expect(gameManager.protons).toBe(gain);
		expect(gameManager.upgrades).toEqual(['proton_boost_1', 'stability_speed_1', 'proton_electron_boost_1']);
		expect(gameManager.totalProtonisesAllTime).toBe(1);
		expect(gameManager.totalProtonisesRun).toBe(1);
		expect(gameManager.dailyStats.protonises).toBe(1);
	});
});

describe('CurrenciesManager', () => {
	test('add counts earnings, ignoring zero and negative amounts', () => {
		currenciesManager.add(ATOMS, 10);
		currenciesManager.add(ATOMS, -5);
		currenciesManager.add(ATOMS, 0);
		expect(currenciesManager.currencies[ATOMS]).toEqual({ amount: 10, earnedAllTime: 10, earnedRun: 10 });
	});

	test('remove floors at zero and never touches earnings', () => {
		currenciesManager.add(PROTONS, 10);
		currenciesManager.remove(PROTONS, 25);
		expect(currenciesManager.currencies[PROTONS]).toEqual({ amount: 0, earnedAllTime: 10, earnedRun: 10 });
	});
});
