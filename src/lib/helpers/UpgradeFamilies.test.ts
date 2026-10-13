import { beforeEach, describe, expect, test } from 'bun:test';
import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
import { GENERATOR_TYPES } from '#data/generators.js';
import { UPGRADE_CATEGORIES, UPGRADES } from '#data/upgrades.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { type FamilyView, upgradeFamilies } from '#helpers/UpgradeFamilies.svelte.js';
import { PROTONS_ATOMS_REQUIRED } from '#lib/constants.js';

const { ATOMS, ELECTRONS, PROTONS } = CurrenciesTypes;

function view(family: string): FamilyView {
	const found = upgradeFamilies.views.find(({ family: { id } }) => id === family);
	if (!found) throw new Error(`No family ${family}`);
	return found;
}

function setAchievements(count: number) {
	gameManager.achievements = Array.from({ length: count }, (_, i) => `fake_${i}`);
}

/** The panel's old "Buy all": the available upgrades of the tab sorted cheapest first, each one bought if the balance still pays for it. */
function oldBuyAll(currency: CurrencyName): string[] {
	const owned = new Set(gameManager.upgrades);
	const bought: string[] = [];
	const available = Object.values(UPGRADES)
		.filter(upgrade => (upgrade.condition?.(gameManager) ?? true) && !owned.has(upgrade.id) && upgrade.cost.currency === currency)
		.sort((a, b) => a.cost.amount - b.cost.amount);
	for (const upgrade of available) if (gameManager.purchaseUpgrade(upgrade.id)) bought.push(upgrade.id);
	return bought;
}

beforeEach(() => {
	gameManager.resetAll();
	gameManager.quarkEntitlements = [];
});

describe('grouping', () => {
	test('every upgrade sits in exactly one family, tiers in data order with one currency and category', () => {
		const ids = upgradeFamilies.views.flatMap(({ family }) => family.tiers.map(tier => tier.id));
		expect(ids.toSorted()).toEqual(Object.keys(UPGRADES).toSorted());

		for (const { family } of upgradeFamilies.views) {
			const dataOrder = Object.keys(UPGRADES).filter(id => upgradeFamilies.byUpgrade.get(id)?.family.id === family.id);
			expect(family.tiers.map(tier => tier.id)).toEqual(dataOrder);
			for (const tier of family.tiers) {
				expect(tier.cost.currency).toBe(family.currency);
				expect(tier.category).toBe(family.category);
			}
		}
	});

	test('tiers share one name and the table has the expected sizes', () => {
		expect(view('molecule').family.tiers).toHaveLength(20);
		expect(view('molecule').family.name).toBe('Molecule Boost');
		expect(view('offline_cap').max).toBe(5);
		expect(view('proton_electron_boost').max).toBe(3);
		expect(view('proton_electron_boost').family.name).toBe('Electron Yield');
	});

	test('categories follow the display order, then the data order', () => {
		for (const type of GENERATOR_TYPES) gameManager.unlockGenerator(type);
		gameManager.skillUpgrades = ['autoClicker'];
		const groups = upgradeFamilies.categories(ATOMS);
		const order = groups.map(({ category }) => UPGRADE_CATEGORIES.indexOf(category));
		expect(order.length).toBeGreaterThan(2);
		expect(order).toEqual(order.toSorted((a, b) => a - b));

		const dataOrder = upgradeFamilies.views.map(({ family }) => family.id);
		for (const { views } of groups) {
			const positions = views.map(({ family }) => dataOrder.indexOf(family.id));
			expect(positions).toEqual(positions.toSorted((a, b) => a - b));
		}
	});
});

describe('gates keep the conditions of before', () => {
	test('a Boost tier needs its generator and floor((tier - 1) / 5) protonises', () => {
		for (const type of GENERATOR_TYPES) {
			for (const unlocked of [false, true]) {
				for (let protonises = 0; protonises <= 3; protonises++) {
					gameManager.generators = unlocked ? { [type]: { count: 0, level: 0, unlocked: true } } : {};
					gameManager.totalProtonisesAllTime = protonises;
					for (let tier = 1; tier <= 20; tier++) {
						const upgrade = UPGRADES[`${type.toLowerCase()}_${tier}`];
						expect(upgrade.condition?.(gameManager), `${upgrade.id} at ${protonises} protonises`).toBe(unlocked && protonises >= Math.floor((tier - 1) / 5));
					}
				}
			}
		}
	});

	test('an Atom Soup tier above the first needs more than ten achievements per level', () => {
		for (const count of [0, 10, 11, 20, 21, 30, 31, 110, 111]) {
			setAchievements(count);
			for (let tier = 1; tier <= 11; tier++) {
				expect(UPGRADES[`global_achievements_mul_${tier}`].condition?.(gameManager), `tier ${tier} at ${count}`).toBe(tier > 1 ? count > 10 * tier : true);
			}
		}
	});

	test('only the Boost and Atom Soup families have gates', () => {
		const gated = new Set(Object.values(UPGRADES).filter(upgrade => upgrade.gate).map(upgrade => upgrade.family));
		expect(gated).toEqual(new Set([...GENERATOR_TYPES.map(type => type.toLowerCase()), 'global_achievements_mul']));
	});
});

describe('Boost tracks across Protonizes', () => {
	test('a first run opens five levels and says what opens the rest', () => {
		gameManager.unlockGenerator('molecule');
		currenciesManager.add(ATOMS, 1e30);
		const boost = view('molecule');
		expect(boost.open).toBe(5);
		expect(upgradeFamilies.buyMax(boost)).toBe(5);
		expect([boost.level, boost.shown, boost.next]).toEqual([5, 5, null]);
		expect(boost.lockReason).toBe('More levels after your next Protonize');
		expect(boost.maxed).toBe(false);
	});

	test('a Protonize opens five more levels', () => {
		gameManager.unlockGenerator('molecule');
		currenciesManager.add(ATOMS, 1e30);
		upgradeFamilies.buyMax(view('molecule'));

		gameManager.totalProtonisesAllTime = 1;
		const boost = view('molecule');
		expect(boost.open).toBe(10);
		expect(boost.next?.id).toBe('molecule_6');
		expect(boost.lockReason).toBeNull();
	});

	test('after three Protonizes the whole track is open and a full one is maxed', () => {
		gameManager.unlockGenerator('molecule');
		gameManager.totalProtonisesAllTime = 3;
		currenciesManager.add(ATOMS, 1e30);
		const boost = view('molecule');
		expect(upgradeFamilies.buyMax(boost)).toBe(20);
		expect(boost.maxed).toBe(true);
		expect(boost.lockReason).toBeNull();
	});

	test('a real Protonize hides the family until its generator is back, then reads 0/10', () => {
		gameManager.unlockGenerator('molecule');
		currenciesManager.add(ATOMS, 1e30);
		upgradeFamilies.buyMax(view('molecule'));
		expect(view('molecule').visible).toBe(true);

		currenciesManager.add(ATOMS, PROTONS_ATOMS_REQUIRED);
		expect(gameManager.protonise()).toBe(true);
		expect(view('molecule').visible).toBe(false);

		gameManager.unlockGenerator('molecule');
		const boost = view('molecule');
		expect([boost.level, boost.shown, boost.visible]).toEqual([0, 10, true]);
	});
});

describe('Atom Soup', () => {
	test('shows what opens the next level', () => {
		setAchievements(0);
		currenciesManager.add(ATOMS, 1e30);
		const soup = view('global_achievements_mul');
		expect(upgradeFamilies.buyMax(soup)).toBe(1);
		expect([soup.level, soup.shown]).toEqual([1, 1]);
		expect(soup.lockReason).toBe('Next level at 21 achievements');
	});

	test.each([
		[21, 2],
		[31, 3],
		[111, 11],
	])('with %d achievements %d levels are open', (count, open) => {
		setAchievements(count);
		expect(view('global_achievements_mul').open).toBe(open);
	});
});

describe('chains', () => {
	test('a chain is open all the way and offers one level at a time', () => {
		gameManager.skillUpgrades = ['autoUpgrade'];
		currenciesManager.add(ELECTRONS, 1000);
		const chain = view('electron_auto_upgrade');
		expect(chain.open).toBe(3);
		expect(chain.next?.id).toBe('electron_auto_upgrade_2');
		expect(upgradeFamilies.buyNext(chain)).toBe(true);
		expect(chain.next?.id).toBe('electron_auto_upgrade_3');
	});

	test.each(['electron_power_up_interval', 'proton_electron_boost'])('%s is never gated', family => {
		expect(view(family).open).toBe(view(family).max);
	});
});

describe('visibility', () => {
	test('a Multiplier stays hidden until a hundred of its generator', () => {
		gameManager.generators = { molecule: { count: 99, level: 0, unlocked: true } };
		expect(view('molecule_multiplier').visible).toBe(false);
		gameManager.generators = { molecule: { count: 100, level: 1, unlocked: true } };
		expect(view('molecule_multiplier').visible).toBe(true);
	});
});

describe('buying', () => {
	const tierCost = (tier: number) => UPGRADES[`molecule_${tier}`].cost.amount;

	test('the x chip counts the levels the balance pays for and Max buys exactly them', () => {
		gameManager.unlockGenerator('molecule');
		currenciesManager.add(ATOMS, tierCost(1) + tierCost(2) + tierCost(3));
		const boost = view('molecule');
		expect(boost.affordableTiers).toBe(3);
		expect(upgradeFamilies.buyMax(boost)).toBe(3);
		expect(boost.level).toBe(3);
		expect(boost.affordableTiers).toBe(0);
	});

	test('with nothing in the bank no level is affordable', () => {
		gameManager.unlockGenerator('molecule');
		expect(view('molecule').affordableTiers).toBe(0);
		expect(view('molecule').affordable).toBe(false);
	});

	test('an unaffordable buy fails and leaves the balance alone', () => {
		gameManager.unlockGenerator('molecule');
		currenciesManager.add(ATOMS, tierCost(1) - 1);
		expect(upgradeFamilies.buyNext(view('molecule'))).toBe(false);
		expect(gameManager.atoms).toBe(tierCost(1) - 1);
		expect(view('molecule').level).toBe(0);
	});

	test('levels past the open ones are never counted', () => {
		gameManager.unlockGenerator('molecule');
		currenciesManager.add(ATOMS, 1e30);
		expect(view('molecule').affordableTiers).toBe(5);
	});
});

describe('buy all', () => {
	const setups: [CurrencyName, () => void][] = [
		[
			ATOMS,
			() => {
				for (const type of GENERATOR_TYPES) gameManager.unlockGenerator(type);
				currenciesManager.add(ATOMS, 5e12);
			},
		],
		[
			ELECTRONS,
			() => {
				gameManager.skillUpgrades = ['autoUpgrade', 'moleculeAutoBuy', 'crystalAutoBuy'];
				currenciesManager.add(ELECTRONS, 120);
			},
		],
		[
			PROTONS,
			() => {
				gameManager.skillUpgrades = ['autoClicker'];
				currenciesManager.add(PROTONS, 5e6);
			},
		],
	];

	test.each(setups)('buys what the old panel bought for %s, cheapest first', (currency, setup) => {
		setup();
		const expected = oldBuyAll(currency);
		const balance = currenciesManager.getAmount(currency);
		expect(expected.length).toBeGreaterThan(1);

		gameManager.resetAll();
		setup();
		expect(upgradeFamilies.buyAll(currency)).toBe(expected.length);
		expect(gameManager.upgrades).toEqual(expected);
		expect(currenciesManager.getAmount(currency)).toBe(balance);

		const costs = gameManager.upgrades.map(id => UPGRADES[id].cost.amount);
		expect(costs).toEqual(costs.toSorted((a, b) => a - b));
	});

	test('counts the families a tab can buy from', () => {
		gameManager.unlockGenerator('molecule');
		currenciesManager.add(ATOMS, 1e6);
		const count = upgradeFamilies.affordableCount(ATOMS);
		expect(count).toBeGreaterThan(1);
		expect(upgradeFamilies.affordableCount(PROTONS)).toBe(0);
	});
});
