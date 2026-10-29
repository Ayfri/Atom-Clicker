import { beforeEach, describe, expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { decayCost, ELEMENTS, lightCost, SET_BONUS, zs } from '#data/elements.js';
import { BASE_RATES, CHAINS, DECAY_EVENTS_PER_SECOND, siteStudyCost, type SiteId } from '#data/sites.js';
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

	test('an element nobody measured costs Decay events and no Light', () => {
		const [md] = zs('Md');
		gameManager.periodic = { identified: [], sites: { accelerator: { index: 1, level: 0, progress: 0 } } };
		expect(periodicManager.ready).toEqual([md]);
		expect(lightCost(ELEMENTS[md - 1])).toEqual({ blue: 0, green: 0, red: 0 });
		const cost = decayCost(ELEMENTS[md - 1]);
		expect(cost).toBeGreaterThan(0);

		const lights = [CurrenciesTypes.RED_LIGHT, CurrenciesTypes.GREEN_LIGHT, CurrenciesTypes.BLUE_LIGHT];
		for (const light of lights) currenciesManager.add(light, 1e12);
		expect(periodicManager.identify(md)).toBe(false);
		currenciesManager.add(CurrenciesTypes.DECAY_EVENTS, cost - 1);
		expect(periodicManager.canAfford(md)).toBe(false);
		currenciesManager.add(CurrenciesTypes.DECAY_EVENTS, 1);
		expect(periodicManager.identify(md)).toBe(true);
		expect(currenciesManager.getAmount(CurrenciesTypes.DECAY_EVENTS)).toBe(0);
		for (const light of lights) expect(currenciesManager.getAmount(light)).toBe(1e12);
	});

	test('Decay events come from the open decay sites, grow with their study and still pay once their chain is done', () => {
		expect(periodicManager.decayEventsPerSecond).toBe(0);

		const chain = (id: SiteId, level = 0) => ({ index: CHAINS[id].steps.length, level, progress: 0 });
		gameManager.periodic = { identified: zs('U Th'), sites: { decay: { index: 0, level: 2, progress: 0 }, neutron: chain('neutron') } };
		expect(periodicManager.decayEventsPerSecond).toBe(3 * DECAY_EVENTS_PER_SECOND);

		gameManager.periodic = { identified: zs('U Th Fm'), sites: { decay: chain('decay', 2), neutron: chain('neutron'), reactor: chain('reactor') } };
		expect(periodicManager.open.has('accelerator')).toBe(true);
		expect(periodicManager.decayEventsPerSecond).toBe(4 * DECAY_EVENTS_PER_SECOND);

		expect(periodicManager.statuses.decay.kind).toBe('done');
		currenciesManager.add(CurrenciesTypes.STARLIGHT, siteStudyCost(2));
		expect(periodicManager.study('decay')).toBe(true);
		expect(periodicManager.decayEventsPerSecond).toBe(5 * DECAY_EVENTS_PER_SECOND);

		/** The browser's tick skips production, Decay events are not part of it. */
		gameManager.tick(2000, true, true);
		expect(currenciesManager.getAmount(CurrenciesTypes.DECAY_EVENTS)).toBeCloseTo(10 * DECAY_EVENTS_PER_SECOND);
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
