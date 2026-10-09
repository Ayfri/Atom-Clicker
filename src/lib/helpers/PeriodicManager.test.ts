import { beforeEach, describe, expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { ELEMENTS, lightCost, SET_BONUS, zs } from '#data/elements.js';
import { BASE_RATES, siteStudyCost } from '#data/sites.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { periodicManager, SPECTROSCOPE_ID } from '#helpers/PeriodicManager.svelte.js';

const DAY_MS = 86_400_000;
const xp = () => gameManager.effects.value('xp_gain', 1, gameManager);

function payLight(z: number) {
	const cost = lightCost(ELEMENTS[z - 1]);
	currenciesManager.add(CurrenciesTypes.RED_LIGHT, cost.red);
	currenciesManager.add(CurrenciesTypes.GREEN_LIGHT, cost.green);
	currenciesManager.add(CurrenciesTypes.BLUE_LIGHT, cost.blue);
}

beforeEach(() => {
	gameManager.resetAll();
	gameManager.totalIonizesAllTime = 1;
});

describe('unlock', () => {
	test('stays closed until the Spectroscope, then opens the sites whose Cosmos object is found', () => {
		expect(periodicManager.unlocked).toBe(false);
		expect(periodicManager.tick(DAY_MS)).toEqual([]);
		cosmosManager.instruments = [SPECTROSCOPE_ID];
		expect(periodicManager.unlocked).toBe(true);
		expect([...periodicManager.open]).toEqual(['bigbang']);
		cosmosManager.discovered = ['mira', 'crab_nebula'];
		expect([...periodicManager.open].toSorted()).toEqual(['bigbang', 'lowmass', 'massive']);
	});
});

describe('table', () => {
	beforeEach(() => {
		cosmosManager.instruments = [SPECTROSCOPE_ID];
	});

	test('forges each chain in order, a long gap finishes several elements, and a step waits on its seed', () => {
		cosmosManager.discovered = ['mira'];
		expect(periodicManager.statuses.lowmass).toEqual({ kind: 'waiting', missing: zs('He'), object: null, z: 6 });
		expect(periodicManager.tick(DAY_MS)).toEqual(zs('H He C N'));
		expect(periodicManager.statuses.bigbang).toEqual({ kind: 'waiting', missing: [], object: 'cmb', z: 3 });
		cosmosManager.discovered = ['mira', 'cmb'];
		expect(periodicManager.statuses.bigbang.kind).toBe('forging');
	});

	test('identifying pays the Light of its lines and adds its family bonus', () => {
		periodicManager.tick(DAY_MS);
		expect(periodicManager.identify(1)).toBe(false);
		payLight(1);
		const before = xp();
		expect(periodicManager.identify(1)).toBe(true);
		expect(xp()).toBeCloseTo(before * 1.02);
		expect(currenciesManager.getAmount(CurrenciesTypes.RED_LIGHT) + currenciesManager.getAmount(CurrenciesTypes.BLUE_LIGHT)).toBe(0);
		expect(periodicManager.identify(1)).toBe(false);
		expect(periodicManager.identify(3)).toBe(false);
	});

	test('a full family multiplies its bonus once more', () => {
		const nonmetals = zs('H C N O P S Se');
		gameManager.periodic = { identified: nonmetals, sites: { bigbang: { index: 2, level: 0, progress: 0 }, lowmass: { index: 2, level: 0, progress: 0 }, massive: { index: 18, level: 0, progress: 0 } } };
		expect(periodicManager.identified).toEqual(nonmetals.toSorted((a, b) => a - b));
		expect(xp()).toBeCloseTo((1 + 0.02 * nonmetals.length) * SET_BONUS);
	});

	test('a study adds the base forge rate again for Starlight', () => {
		expect(periodicManager.study('bigbang')).toBe(false);
		currenciesManager.add(CurrenciesTypes.STARLIGHT, siteStudyCost(0));
		expect(periodicManager.study('bigbang')).toBe(true);
		expect(periodicManager.rateOf('bigbang')).toBe(BASE_RATES.bigbang * 2);
		expect(periodicManager.study('lowmass')).toBe(false);
	});

	test('survives every prestige, and a save only keeps what its chains could have forged', () => {
		periodicManager.tick(DAY_MS);
		payLight(1);
		periodicManager.identify(1);
		gameManager.resetLayer(4);
		expect(periodicManager.identified).toEqual([1]);

		gameManager.periodic = {
			identified: [1, 2, 3, 92, 1, 999],
			sites: { bigbang: { index: 99, level: -2, progress: Number.NaN }, nowhere: { index: 1, level: 1, progress: 0 } } as never,
		};
		expect(periodicManager.sites).toEqual({ bigbang: { index: 3, level: 0, progress: 0 } });
		expect(periodicManager.identified).toEqual([1, 2, 3]);
	});
});
