import { beforeEach, describe, expect, test } from 'bun:test';
import {
	BOOST_SPECTRUM,
	CHROMATIC,
	CHROMATIC_BASE_SPAWN_INTERVAL,
	CHROMATIC_COLORS,
	CHROMATIC_UPGRADES,
	ChromaticColors,
	getChromaticUpgradeCost,
	KILLS_PER_SPECTRUM_LEVEL,
	WHITE_RECIPE,
} from '#data/chromatic.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';

const { BLUE_LIGHT, GREEN_LIGHT, RED_LIGHT, WHITE_LIGHT } = CurrenciesTypes;
const { BLUE, RED } = ChromaticColors;

beforeEach(() => gameManager.resetAll());

describe('recombine', () => {
	test('turns every full set of the three colors into White Light and keeps the rest', () => {
		currenciesManager.add(RED_LIGHT, 2 * WHITE_RECIPE + 5);
		currenciesManager.add(GREEN_LIGHT, 3 * WHITE_RECIPE + 1);
		currenciesManager.add(BLUE_LIGHT, 2 * WHITE_RECIPE);
		expect(chromaticManager.recombinable).toBe(2);

		expect(chromaticManager.recombine()).toBe(2);
		expect(currenciesManager.getAmount(RED_LIGHT)).toBe(5);
		expect(currenciesManager.getAmount(GREEN_LIGHT)).toBe(WHITE_RECIPE + 1);
		expect(currenciesManager.getAmount(BLUE_LIGHT)).toBe(0);
		expect(currenciesManager.getAmount(WHITE_LIGHT)).toBe(2);

		expect(chromaticManager.recombine()).toBe(0);
		expect(currenciesManager.getAmount(WHITE_LIGHT)).toBe(2);
	});
});

describe('Prism upgrades', () => {
	test('cost their price once per level and stop at the max level', () => {
		const upgrade = CHROMATIC_UPGRADES.red_focus;
		const cost = getChromaticUpgradeCost(upgrade, 0);
		currenciesManager.add(RED_LIGHT, cost);
		expect(chromaticManager.purchaseUpgrade('red_focus')).toBe(true);
		expect(currenciesManager.getAmount(RED_LIGHT)).toBe(0);
		expect(chromaticManager.level('red_focus')).toBe(1);
		expect(chromaticManager.purchaseUpgrade('red_focus')).toBe(false);

		chromaticManager.upgradeLevels = { red_focus: upgrade.maxLevel };
		currenciesManager.add(RED_LIGHT, 1e30);
		expect(chromaticManager.purchaseUpgrade('red_focus')).toBe(false);
		expect(chromaticManager.level('red_focus')).toBe(upgrade.maxLevel);
	});

	test('an upgrade priced in every color needs the full price in each of them', () => {
		const upgrade = CHROMATIC_UPGRADES.prism_excitation;
		const cost = getChromaticUpgradeCost(upgrade, 0);
		currenciesManager.add(RED_LIGHT, cost);
		currenciesManager.add(GREEN_LIGHT, cost);
		currenciesManager.add(BLUE_LIGHT, cost - 1);
		expect(chromaticManager.purchaseUpgrade(upgrade.id)).toBe(false);
		expect(currenciesManager.getAmount(RED_LIGHT)).toBe(cost);

		currenciesManager.add(BLUE_LIGHT, 1);
		expect(chromaticManager.purchaseUpgrade(upgrade.id)).toBe(true);
		for (const color of CHROMATIC_COLORS) expect(currenciesManager.getAmount(CHROMATIC[color].currency)).toBe(0);
	});

	test('a color boost stays locked until its color reaches the spectrum level', () => {
		const upgrade = CHROMATIC_UPGRADES.red_ember;
		currenciesManager.add(RED_LIGHT, 1e9);
		expect(chromaticManager.purchaseUpgrade(upgrade.id)).toBe(false);

		chromaticManager.kills = { ...chromaticManager.kills, [RED]: BOOST_SPECTRUM * KILLS_PER_SPECTRUM_LEVEL };
		expect(chromaticManager.spectrumLevel(RED)).toBe(BOOST_SPECTRUM);
		expect(chromaticManager.purchaseUpgrade(upgrade.id)).toBe(true);
	});
});

describe('breaks', () => {
	test('a break pays its Light and counts toward the spectrum, a Blue half only pays', () => {
		chromaticManager.collect({ color: RED, drop: CHROMATIC.red.drop, half: false, x: 0, y: 0 }, 0);
		expect(currenciesManager.getAmount(RED_LIGHT)).toBe(CHROMATIC.red.drop);
		expect(chromaticManager.kills.red).toBe(1);

		chromaticManager.collect({ color: BLUE, drop: 1, half: true, x: 0, y: 0 }, 0);
		expect(currenciesManager.getAmount(BLUE_LIGHT)).toBe(1);
		expect(chromaticManager.kills.blue).toBe(0);
	});

	test('more spectrum levels make a color tougher faster than they make it pay', () => {
		const hp = chromaticManager.maxHp(RED);
		const light = chromaticManager.lightFor(RED, 1, 0);
		chromaticManager.kills = { ...chromaticManager.kills, [RED]: 10 * KILLS_PER_SPECTRUM_LEVEL };
		expect(chromaticManager.maxHp(RED) / hp).toBeGreaterThan(chromaticManager.lightFor(RED, 1, 0) / light);
	});
});

describe('offline Light', () => {
	test('grows with the auto-clicker until each color breaks as fast as it spawns', () => {
		const slow = chromaticManager.autoLightPerSecond(0.01, 1, 0);
		const twice = chromaticManager.autoLightPerSecond(0.02, 1, 0);
		expect(twice.red).toBeCloseTo(2 * slow.red);

		const flooded = chromaticManager.autoLightPerSecond(1e9, 1, 0);
		const spawnsPerColor = 1000 / CHROMATIC_BASE_SPAWN_INTERVAL / CHROMATIC_COLORS.length;
		expect(flooded.red).toBeCloseTo(spawnsPerColor * chromaticManager.lightFor(RED, CHROMATIC.red.drop, 0));
		expect(chromaticManager.autoLightPerSecond(1e12, 1, 0)).toEqual(flooded);
	});
});
