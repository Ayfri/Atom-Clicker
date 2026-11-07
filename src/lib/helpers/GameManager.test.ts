import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { CHERENKOV_DROP, CHERENKOV_MIN, KILLS_PER_SPECTRUM_LEVEL } from '#data/chromatic.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES, GENERATORS, GeneratorTypes } from '#data/generators.js';
import { getPhotonUpgradeCost, PHOTON_UPGRADES } from '#data/photonUpgrades.js';
import { RealmTypes } from '#data/realms.js';
import { UPGRADES } from '#data/upgrades.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { IONIZE_HOLD_SECONDS, radiationManager } from '#helpers/RadiationManager.svelte.js';
import { LAYERS } from '#helpers/statConstants.js';
import {
	APP_PRODUCTION_MULTIPLIER,
	ELECTRONS_PROTONS_REQUIRED,
	MAX_BOOST_POINTS,
	OVERDRIVE_MULTIPLIER,
	OVERDRIVE_PERIOD_MS,
	PROTONS_ATOMS_REQUIRED,
} from '#lib/constants.js';
import type { GameState } from '#lib/types.js';

const { ATOMS, BLUE_LIGHT, ELECTRONS, EXCITED_PHOTONS, GREEN_LIGHT, PHOTONS, PROTONS, RED_LIGHT } = CurrenciesTypes;

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

	describe('auto-buy batches', () => {
		const { MOLECULE } = GeneratorTypes;

		test('buy one generator without Bulk Assembly, 15 at level 2 and every affordable one at level 4', () => {
			currenciesManager.add(ATOMS, 1e12);
			expect(gameManager.autoBuyGenerator(MOLECULE)).toBe(1);
			expect(gameManager.generators.molecule?.count).toBe(1);

			gameManager.photonUpgrades = { auto_buy_bulk: 2 };
			expect(gameManager.autoBuyGenerator(MOLECULE)).toBe(15);
			expect(gameManager.generators.molecule?.count).toBe(16);

			gameManager.photonUpgrades = { auto_buy_bulk: 4 };
			const max = gameManager.getMaxAffordableGenerator(MOLECULE);
			expect(max).toBeGreaterThan(50);
			expect(gameManager.autoBuyGenerator(MOLECULE)).toBe(max);
			expect(gameManager.generators.molecule?.count).toBe(16 + max);
		});

		test('a bank that pays for fewer than the batch buys what it pays for and spends exactly that', () => {
			gameManager.photonUpgrades = { auto_buy_bulk: 2 };
			const cost = gameManager.getGeneratorCost(MOLECULE, 7);
			currenciesManager.add(ATOMS, cost);
			expect(gameManager.autoBuyGenerator(MOLECULE)).toBe(7);
			expect(gameManager.atoms).toBe(0);
			expect(gameManager.generators.molecule?.count).toBe(7);
		});

		test('buys nothing when the next generator is out of reach or the bank overflowed', () => {
			gameManager.photonUpgrades = { auto_buy_bulk: 4 };
			currenciesManager.add(ATOMS, gameManager.getGeneratorCost(MOLECULE, 1) - 1);
			expect(gameManager.autoBuyGenerator(MOLECULE)).toBe(0);
			expect(gameManager.generators.molecule).toBeUndefined();

			currenciesManager.add(ATOMS, Infinity);
			for (const level of [0, 4]) {
				gameManager.photonUpgrades = { auto_buy_bulk: level };
				expect(gameManager.autoBuyGenerator(MOLECULE)).toBe(0);
			}
			expect(gameManager.atoms).toBe(Infinity);
		});

		test('Bulk Assembly needs an automated generator before it can be bought', () => {
			currenciesManager.add(PHOTONS, 1e9);
			expect(gameManager.purchasePhotonUpgrade('auto_buy_bulk')).toBe(false);
			gameManager.skillUpgrades = ['autoClicker', 'moleculeAutoBuy'];
			expect(gameManager.purchasePhotonUpgrade('auto_buy_bulk')).toBe(true);
			expect(gameManager.autoBuyAmount).toBe(5);
		});
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

describe('upgrade purchases', () => {
	test('auto-upgrade buys every affordable upgrade, cheapest first, and leaves nothing affordable behind', () => {
		currenciesManager.add(ATOMS, 300_000);
		const bought = gameManager.purchaseAffordableUpgrades();
		expect(bought.length).toBeGreaterThan(1);
		expect(gameManager.upgrades).toEqual(bought);

		const costs = bought.map(id => UPGRADES[id].cost.amount);
		expect(costs).toEqual(costs.toSorted((a, b) => a - b));
		const affordable = Object.values(UPGRADES).filter(
			upgrade => !gameManager.upgrades.includes(upgrade.id) && (upgrade.condition?.(gameManager) ?? true) && gameManager.canAfford(upgrade.cost),
		);
		expect(affordable.map(upgrade => upgrade.id)).toEqual([]);
	});

	test('buying affordable upgrades for one currency never touches the others', () => {
		currenciesManager.add(ATOMS, 1e12);
		currenciesManager.add(PROTONS, 1e6);
		const bought = gameManager.purchaseAffordableUpgrades(PROTONS);
		expect(bought.length).toBeGreaterThan(0);
		expect(bought.every(id => UPGRADES[id].cost.currency === PROTONS)).toBe(true);
		expect(gameManager.atoms).toBe(1e12);
	});

	test('photon upgrades spend photons level by level up to their max', () => {
		const upgrade = PHOTON_UPGRADES.auto_clicker;
		let total = 0;
		for (let level = 0; level < upgrade.maxLevel; level++) total += getPhotonUpgradeCost(upgrade, level);
		currenciesManager.add(PHOTONS, total + 1);

		for (let level = 0; level < upgrade.maxLevel; level++) expect(gameManager.purchasePhotonUpgrade(upgrade.id)).toBe(true);
		expect(gameManager.purchasePhotonUpgrade(upgrade.id)).toBe(false);
		expect(gameManager.photonUpgrades[upgrade.id]).toBe(upgrade.maxLevel);
		expect(gameManager.photons).toBe(1);
	});
});

describe('skills', () => {
	test('a skill needs its prerequisites, is bought once and opens its realm at once', () => {
		currenciesManager.add(ATOMS, 2e10);
		expect(gameManager.purchaseSkill('purpleRealm')).toBe(false);

		gameManager.skillUpgrades = ['unlockLevels'];
		expect(gameManager.purchaseSkill('purpleRealm')).toBe(true);
		expect(gameManager.realms[RealmTypes.PHOTONS].unlocked).toBe(true);
		expect(gameManager.atoms).toBe(1e10);
		expect(gameManager.purchaseSkill('purpleRealm')).toBe(false);
		expect(gameManager.atoms).toBe(1e10);
	});

	test('the Radiation Realm skill also unlocks the reactor', () => {
		gameManager.skillUpgrades = ['unlockLevels', 'purpleRealm'];
		currenciesManager.add(ELECTRONS, 100);
		expect(gameManager.purchaseSkill('radiationRealm')).toBe(true);
		expect(gameManager.realms[RealmTypes.RADIATION].unlocked).toBe(true);
		expect(radiationManager.unlocked).toBe(true);
	});

	test('an automated generator is bought every 30 seconds, only while its toggle is on', () => {
		gameManager.skillUpgrades = ['autoClicker', 'moleculeAutoBuy'];
		expect(gameManager.autoBuyIntervals).toEqual({});
		gameManager.toggleAutomation(GeneratorTypes.MOLECULE);
		expect(gameManager.autoBuyIntervals).toEqual({ [GeneratorTypes.MOLECULE]: 30_000 });
		gameManager.toggleAutomation(GeneratorTypes.MOLECULE);
		expect(gameManager.autoBuyIntervals).toEqual({});
	});
});

describe('currency boosts', () => {
	test('split evenly gives every currency its share of the points, one apart at most and capped', () => {
		gameManager.generators = { molecule: { count: 500, level: 5, unlocked: true } };
		gameManager.splitCurrencyBoostsEvenly([ATOMS, PROTONS]);
		expect(gameManager.currencyBoosts).toEqual({ [ATOMS]: 3, [PROTONS]: 2 });

		gameManager.generators = { molecule: { count: 10_000, level: 100, unlocked: true } };
		gameManager.splitCurrencyBoostsEvenly([ATOMS, PROTONS]);
		expect(gameManager.currencyBoosts).toEqual({ [ATOMS]: MAX_BOOST_POINTS, [PROTONS]: MAX_BOOST_POINTS });
		expect(gameManager.boostPointsAvailable).toBe(100 - 2 * MAX_BOOST_POINTS);
	});
});

describe('cloud saves', () => {
	test('a cloud save replaces the game, opens the realms its skills grant and keeps a local integrity flag', () => {
		gameManager.skillUpgrades = ['unlockLevels', 'purpleRealm'];
		currenciesManager.add(ATOMS, 123);
		const cloud = JSON.parse(JSON.stringify(gameManager.getCurrentState())) as GameState;

		gameManager.resetAll();
		gameManager.integrityFlagged = true;
		gameManager.loadCloudSave(cloud);
		expect(gameManager.atoms).toBe(123);
		expect(gameManager.skillUpgrades).toEqual(['unlockLevels', 'purpleRealm']);
		expect(gameManager.realms[RealmTypes.PHOTONS].unlocked).toBe(true);
		expect(gameManager.integrityFlagged).toBe(true);
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

	test('the Radiation layer clears photons and radiation upgrades and keeps photon upgrades, skills and colored light', () => {
		seed();
		gameManager.resetLayer(LAYERS.RADIATION_REALM);
		expect(gameManager.photonUpgrades).toEqual({ photon_efficiency: 1 });
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

describe('electronize', () => {
	test('needs a billion protons and pays one more electron per decade past it', () => {
		currenciesManager.add(PROTONS, 1e9 - 1);
		expect(gameManager.electronize()).toBe(false);
		currenciesManager.add(PROTONS, 1e12);
		expect(gameManager.electronizeElectronsGain).toBe(4);
	});

	test('pays electrons, clears protons and the run, keeps proton and electron upgrades', () => {
		currenciesManager.add(PROTONS, 1e12);
		currenciesManager.add(ATOMS, 1e6);
		gameManager.upgrades = ['molecular_boost', 'proton_boost_1'];
		gameManager.totalProtonisesRun = 4;
		expect(gameManager.electronize()).toBe(true);
		expect(gameManager.electrons).toBe(4);
		expect(gameManager.protons).toBe(0);
		expect(gameManager.atoms).toBe(0);
		expect(gameManager.totalProtonisesRun).toBe(0);
		expect(gameManager.upgrades).toEqual(['proton_boost_1']);
		expect([gameManager.totalElectronizesAllTime, gameManager.totalElectronizesRun, gameManager.dailyStats.electronizes]).toEqual([1, 1, 1]);
	});
});

describe('stability field', () => {
	test('fills with idle ticks, and a click after the tick gives back exactly ×1', () => {
		let now = 1_000_000;
		gameManager.clock = () => now;
		try {
			gameManager.skillUpgrades = ['stabilityField'];
			gameManager.lastInteractionTime = now;
			now += gameManager.stabilityTimeRequired / 2;
			gameManager.tick(1000, true, true);
			expect(gameManager.stabilityProgress).toBeCloseTo(0.5);
			expect(gameManager.stabilityMultiplier).toBeGreaterThan(1);

			for (const delay of [1, 7, 300]) {
				gameManager.lastInteractionTime = now + delay;
				expect(gameManager.stabilityMultiplier).toBe(1);
			}
		} finally {
			gameManager.clock = () => Date.now();
		}
	});
});

describe('installed app', () => {
	afterEach(() => {
		gameManager.installedApp = false;
	});

	test('multiplies production, leaves click power and never reaches the save', () => {
		gameManager.generators = { [GeneratorTypes.MOLECULE]: { count: 10, level: 0, unlocked: true } };
		const production = gameManager.atomsPerSecond;
		const clickPower = gameManager.clickPower;
		const state = JSON.stringify(gameManager.getCurrentState());

		gameManager.installedApp = true;
		expect(gameManager.appMultiplier).toBe(APP_PRODUCTION_MULTIPLIER);
		expect(gameManager.atomsPerSecond).toBeCloseTo(production * APP_PRODUCTION_MULTIPLIER, 10);
		expect(gameManager.clickPower).toBe(clickPower);
		expect(JSON.stringify(gameManager.getCurrentState())).toBe(state);

		gameManager.installedApp = false;
		expect(gameManager.atomsPerSecond).toBe(production);
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

describe('generator retention', () => {
	const MATTER = 'electron_keep_generators';
	const DEEP = 'electron_keep_generators_deep';
	const owned = { crystal: { count: 30, level: 0, unlocked: true }, molecule: { count: 120, level: 1, unlocked: true } };

	beforeEach(() => {
		gameManager.generators = structuredClone(owned);
	});

	test('Protonize with Matter Retention keeps generators and levels, records them and still resets Atom upgrades', () => {
		gameManager.upgrades = [MATTER, 'molecular_boost'];
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
		expect(gameManager.protonise()).toBe(true);
		expect(gameManager.generators).toEqual(owned);
		expect(gameManager.keptGenerators).toEqual({ crystal: 30, molecule: 120 });
		expect(gameManager.upgrades).toEqual([MATTER]);
	});

	test('a later Protonize records what the generators bought since as kept too', () => {
		gameManager.upgrades = [MATTER];
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
		gameManager.protonise();
		currenciesManager.add(ATOMS, 1e12);
		expect(gameManager.purchaseGenerator(GeneratorTypes.MOLECULE, 10)).toBe(true);
		gameManager.protonise();
		expect(gameManager.keptGenerators).toEqual({ crystal: 30, molecule: 130 });
	});

	test('without the upgrade a Protonize empties generators and the kept record', () => {
		gameManager.keptGenerators = { molecule: 10 };
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
		gameManager.protonise();
		expect(gameManager.generators).toEqual({});
		expect(gameManager.keptGenerators).toEqual({});
	});

	test('Electronize resets generators with Matter Retention alone and keeps them with Deep Retention', () => {
		gameManager.upgrades = [MATTER];
		gameManager.keptGenerators = { molecule: 120 };
		currenciesManager.add(PROTONS, ELECTRONS_PROTONS_REQUIRED);
		expect(gameManager.electronize()).toBe(true);
		expect(gameManager.generators).toEqual({});
		expect(gameManager.keptGenerators).toEqual({});

		gameManager.generators = structuredClone(owned);
		gameManager.upgrades = [MATTER, DEEP];
		currenciesManager.add(PROTONS, ELECTRONS_PROTONS_REQUIRED);
		expect(gameManager.electronize()).toBe(true);
		expect(gameManager.generators).toEqual(owned);
		expect(gameManager.keptGenerators).toEqual({ crystal: 30, molecule: 120 });
	});

	test('Ionize always resets the generators, even with both upgrades', () => {
		gameManager.upgrades = [MATTER, DEEP];
		gameManager.keptGenerators = { molecule: 120 };
		radiationManager.ionizeHold = IONIZE_HOLD_SECONDS;
		expect(gameManager.ionize()).toBe(true);
		expect(gameManager.generators).toEqual({});
		expect(gameManager.keptGenerators).toEqual({});
	});

	test('Deep Retention needs five Ionizes and Matter Retention', () => {
		const deep = UPGRADES[DEEP];
		gameManager.totalIonizesAllTime = 5;
		expect(deep.condition?.(gameManager)).toBe(false);
		gameManager.upgrades = [MATTER];
		expect(deep.condition?.(gameManager)).toBe(true);
		gameManager.totalIonizesAllTime = 4;
		expect(deep.condition?.(gameManager)).toBe(false);
	});
});

describe('Higgs Overdrive', () => {
	const { HIGGS_BOSON } = CurrenciesTypes;
	const T0 = 1_000_000_000_000;
	const bosons = () => currenciesManager.getAmount(HIGGS_BOSON);
	const at = (time: number) => {
		gameManager.clock = () => time;
		gameManager.tick(1000, true, true);
	};

	beforeEach(() => {
		gameManager.clock = () => T0;
		gameManager.skillUpgrades = ['higgsOverdrive'];
		gameManager.generators = { crystal: { count: 5, level: 0, unlocked: true }, molecule: { count: 10, level: 0, unlocked: true } };
		currenciesManager.add(HIGGS_BOSON, 10);
	});

	afterEach(() => {
		gameManager.clock = () => Date.now();
	});

	test('turning a generator on charges one boson and doubles only that generator', () => {
		const before = gameManager.generatorProductions;
		expect(gameManager.toggleOverdrive(GeneratorTypes.MOLECULE)).toBe(true);
		expect(bosons()).toBe(9);
		expect(gameManager.overdrive.molecule).toEqual({ active: true, paidUntil: T0 + OVERDRIVE_PERIOD_MS });
		expect(gameManager.generatorProductions.molecule).toBeCloseTo(before.molecule * OVERDRIVE_MULTIPLIER);
		expect(gameManager.generatorProductions.crystal).toBeCloseTo(before.crystal);
	});

	test('is refused without the skill, a boson or a generator, and charges nothing', () => {
		gameManager.skillUpgrades = [];
		expect(gameManager.toggleOverdrive(GeneratorTypes.MOLECULE)).toBe(false);
		gameManager.skillUpgrades = ['higgsOverdrive'];
		expect(gameManager.toggleOverdrive(GeneratorTypes.ROCK)).toBe(false);
		currenciesManager.remove(HIGGS_BOSON, 10);
		expect(gameManager.toggleOverdrive(GeneratorTypes.MOLECULE)).toBe(false);
		expect(gameManager.overdrive).toEqual({});
		expect(bosons()).toBe(0);
	});

	test('slots saved without the skill give no production', () => {
		const before = gameManager.generatorProductions.molecule;
		gameManager.overdrive = { molecule: { active: true, paidUntil: T0 + OVERDRIVE_PERIOD_MS } };
		gameManager.skillUpgrades = [];
		expect(gameManager.generatorProductions.molecule).toBeCloseTo(before);
	});

	test('renews for one boson when the paid period ends and not before', () => {
		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		at(T0 + OVERDRIVE_PERIOD_MS - 1000);
		expect(bosons()).toBe(9);
		at(T0 + OVERDRIVE_PERIOD_MS);
		expect(bosons()).toBe(8);
		expect(gameManager.overdrive.molecule?.paidUntil).toBe(T0 + 2 * OVERDRIVE_PERIOD_MS);
	});

	test('turns itself off when the bank cannot pay and keeps the paid time', () => {
		currenciesManager.remove(HIGGS_BOSON, 9);
		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		at(T0 + OVERDRIVE_PERIOD_MS);
		expect(gameManager.overdrive.molecule).toEqual({ active: false, paidUntil: T0 + OVERDRIVE_PERIOD_MS });
		expect(gameManager.overdriveActive).toEqual([]);
	});

	test('a gap of two hours costs one boson, never the periods it skipped', () => {
		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		const later = T0 + OVERDRIVE_PERIOD_MS + 2 * 3_600_000;
		at(later);
		expect(bosons()).toBe(8);
		expect(gameManager.overdrive.molecule?.paidUntil).toBe(later + OVERDRIVE_PERIOD_MS);
	});

	test('an edited paidUntil that is not a number is paid once, never every tick', () => {
		gameManager.overdrive = { molecule: { active: true, paidUntil: Number.NaN } };
		at(T0);
		expect(bosons()).toBe(9);
		expect(gameManager.overdrive.molecule).toEqual({ active: true, paidUntil: T0 + OVERDRIVE_PERIOD_MS });
		at(T0 + 1000);
		at(T0 + 2000);
		expect(bosons()).toBe(9);
	});

	test('off then on again is free while the paid time lasts and costs a boson after it', () => {
		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		expect(gameManager.overdriveActive).toEqual([]);
		gameManager.clock = () => T0 + OVERDRIVE_PERIOD_MS / 2;
		expect(gameManager.toggleOverdrive(GeneratorTypes.MOLECULE)).toBe(true);
		expect(bosons()).toBe(9);
		expect(gameManager.overdrive.molecule?.paidUntil).toBe(T0 + OVERDRIVE_PERIOD_MS);

		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		gameManager.clock = () => T0 + OVERDRIVE_PERIOD_MS;
		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		expect(bosons()).toBe(8);
	});

	test('Protonize clears it, Matter Retention keeps it with the generators', () => {
		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
		gameManager.protonise();
		expect(gameManager.overdrive).toEqual({});
		expect(bosons()).toBe(9);

		gameManager.generators = { molecule: { count: 10, level: 0, unlocked: true } };
		gameManager.toggleOverdrive(GeneratorTypes.MOLECULE);
		gameManager.upgrades = ['electron_keep_generators'];
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
		gameManager.protonise();
		expect(gameManager.overdrive.molecule?.active).toBe(true);
		expect(gameManager.overdriveActive).toEqual([GeneratorTypes.MOLECULE]);
	});
});

describe('Cherenkov Blue Light', () => {
	/** Full control rods and no enrichment make the output ten times the mass, up to the 16000 cap of 30 Coolant Pumps. */
	const setCpm = (cpm: number) => {
		radiationManager.mass = cpm / 10;
		expect(radiationManager.currentCpm).toBeCloseTo(cpm, 6);
	};

	beforeEach(() => {
		radiationManager.unlock();
		radiationManager.upgradeLevels = { coolant_pumps: 30 };
		radiationManager.setControlRodLevel(1);
		gameManager.totalIonizesAllTime = 1;
	});

	test('the core makes nothing before the first Ionize, nor when stopped', () => {
		gameManager.totalIonizesAllTime = 0;
		setCpm(radiationManager.maxCpm / 2);
		expect(gameManager.cherenkovLight).toBe(0);

		gameManager.totalIonizesAllTime = 1;
		expect(gameManager.cherenkovLight).toBeGreaterThan(0);
		radiationManager.setControlRodLevel(0);
		expect(gameManager.cherenkovLight).toBe(0);
	});

	test('the rate follows the share of the output cap and stops growing at the cap', () => {
		const cap = radiationManager.maxCpm;
		setCpm(cap / 4);
		const quarter = gameManager.cherenkovLight;
		setCpm(cap / 2);
		expect(gameManager.cherenkovLight).toBeCloseTo(quarter * 2, 12);
		setCpm(cap);
		expect(gameManager.cherenkovLight).toBeCloseTo(quarter * 4, 12);
		expect(gameManager.cherenkovLightAt(cap * 3)).toBe(gameManager.cherenkovLight);
	});

	test('a core at its cap makes at least the minimum rate, and Blue Light gains lift it past it', () => {
		setCpm(radiationManager.maxCpm);
		expect(gameManager.cherenkovLight).toBe(CHERENKOV_MIN);
		gameManager.chromaticUpgrades = { blue_yield: 20, white_spectrum: 10 };
		gameManager.chromatic = { kills: { blue: 40 * KILLS_PER_SPECTRUM_LEVEL, green: 0, red: 0 } };
		gameManager.totalIonizesAllTime = 50;
		expect(gameManager.cherenkovLight).toBeGreaterThan(CHERENKOV_MIN);
		expect(gameManager.cherenkovLight).toBeCloseTo(chromaticManager.lightFor('blue', CHERENKOV_DROP, gameManager), 12);
	});

	test('a tick pays it in Blue Light only, and the Cherenkov Glow upgrade does not change it', () => {
		setCpm(radiationManager.maxCpm / 2);
		const rate = gameManager.cherenkovLight;
		radiationManager.upgradeLevels = { cherenkov_glow: 5, coolant_pumps: 30 };
		expect(gameManager.cherenkovLight).toBe(rate);

		currenciesManager.hardReset();
		gameManager.tick(1000, true, true);
		expect(currenciesManager.getAmount(BLUE_LIGHT)).toBeCloseTo(gameManager.cherenkovLight, 12);
		expect(currenciesManager.getAmount(BLUE_LIGHT)).toBeGreaterThan(0);
		expect(currenciesManager.getAmount(GREEN_LIGHT)).toBe(0);
		expect(currenciesManager.getAmount(RED_LIGHT)).toBe(0);
	});

	test('catching a neutrino pays none', () => {
		setCpm(radiationManager.maxCpm / 2);
		currenciesManager.hardReset();
		gameManager.catchNeutrino();
		expect(currenciesManager.getAmount(BLUE_LIGHT)).toBe(0);
	});
});

describe('run achievements', () => {
	test('Pure Luck unlocks on a Higgs Boson caught before the first atom of a later run', () => {
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
		gameManager.incrementBonusHiggsBosonClicks();
		expect(gameManager.unlockedAchievementIds.has('higgs_no_atoms')).toBe(false);
		gameManager.resetLayer(LAYERS.ELECTRONIZE);
		gameManager.tick(1000, false, true);
		expect(gameManager.unlockedAchievementIds.has('higgs_no_atoms')).toBe(false);
		gameManager.incrementBonusHiggsBosonClicks();
		expect(gameManager.unlockedAchievementIds.has('higgs_no_atoms')).toBe(true);
	});

	test('Minimalist ignores skills and the upgrades kept through prestige', () => {
		gameManager.skillUpgrades = ['unlockLevels'];
		gameManager.upgrades = ['proton_boost_1'];
		currenciesManager.add(ATOMS, 1000);
		gameManager.tick(1000, false, true);
		expect(gameManager.unlockedAchievementIds.has('atoms_1000_no_upgrades')).toBe(true);
	});

	test('Minimalist leaves out the atoms Quick Start hands out', () => {
		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
		gameManager.upgrades = ['protonise_start_1'];
		expect(gameManager.protonise()).toBe(true);
		expect(gameManager.atoms).toBeGreaterThanOrEqual(1000);
		gameManager.tick(1000, false, true);
		expect(gameManager.unlockedAchievementIds.has('atoms_1000_no_upgrades')).toBe(false);
		currenciesManager.add(ATOMS, 1000);
		gameManager.tick(1000, false, true);
		expect(gameManager.unlockedAchievementIds.has('atoms_1000_no_upgrades')).toBe(true);
	});

	test('Minimalist refuses a run with an atom upgrade', () => {
		gameManager.upgrades = ['molecular_boost'];
		currenciesManager.add(ATOMS, 1000);
		gameManager.tick(1000, false, true);
		expect(gameManager.unlockedAchievementIds.has('atoms_1000_no_upgrades')).toBe(false);
	});
});
