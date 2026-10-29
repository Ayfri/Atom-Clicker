import { beforeEach, describe, expect, test } from 'bun:test';
import { SPECTROSCOPE_ID } from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { bestTuning, decayCost, ELEMENTS, LAMP_PAYBACK_SECONDS, lightCost, SET_BONUS, zs } from '#data/elements.js';
import { GENERATOR_TYPES } from '#data/generators.js';
import { BASE_RATES, CHAINS, DECAY_EVENTS_PER_SECOND, SITE_IDS, siteStudyCost, type SiteId } from '#data/sites.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { periodicManager, TUNING_DEFAULT } from '#helpers/PeriodicManager.svelte.js';

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

	test('an identified element glows with its own Light, and the browser tick still pays it', () => {
		const [h] = zs('H');
		const [md] = zs('Md');
		gameManager.periodic = { identified: [h], sites: { bigbang: { index: 2, level: 0, progress: 0 } } };
		const cost = lightCost(ELEMENTS[h - 1]);
		for (const color of ['blue', 'green', 'red'] as const) expect(periodicManager.lampLight[color]).toBeCloseTo(cost[color] / LAMP_PAYBACK_SECONDS, 12);
		expect(Object.values(periodicManager.lampLight).some(rate => rate > 0)).toBe(true);

		/** The Light gain stat multiplies lamps and sky, the Prism multipliers (Ionize count, spectrum level) do not. */
		const lights = { blue: CurrenciesTypes.BLUE_LIGHT, green: CurrenciesTypes.GREEN_LIGHT, red: CurrenciesTypes.RED_LIGHT } as const;
		gameManager.tick(1000, true, true);
		for (const color of ['blue', 'green', 'red'] as const) {
			expect(gameManager.passiveLight[color]).toBeCloseTo((periodicManager.lampLight[color] + cosmosManager.skyLight[color]) * gameManager.lightGain[color], 12);
			expect(currenciesManager.getAmount(lights[color])).toBeCloseTo(gameManager.passiveLight[color], 12);
		}

		gameManager.periodic = { identified: [md], sites: { accelerator: { index: 1, level: 0, progress: 0 } } };
		expect(Object.values(periodicManager.lampLight)).toEqual([0, 0, 0]);
	});

	test('the Prism tuning makes the lines inside its window cheaper and the others dearer, only once bought', () => {
		const fe = ELEMENTS[zs('Fe')[0] - 1];
		const at = ELEMENTS[zs('At')[0] - 1];
		const total = (cost: Record<'blue' | 'green' | 'red', number>) => cost.blue + cost.green + cost.red;

		periodicManager.setTuning(800);
		expect(periodicManager.costOf(fe.z).light).toEqual(lightCost(fe));

		chromaticManager.upgradeLevels = { prism_tuning: 1 };
		periodicManager.setTuning(bestTuning(fe.lines));
		/** All five Fe lines sit within 25 nm of each other, and the ceil adds at most 1 Light per color. */
		expect(Math.abs(total(periodicManager.costOf(fe.z).light) - 0.2 * total(lightCost(fe)))).toBeLessThanOrEqual(1);
		periodicManager.setTuning(800);
		expect(Math.abs(total(periodicManager.costOf(fe.z).light) - 2 * total(lightCost(fe)))).toBeLessThanOrEqual(1);
		/** At only has ultraviolet lines, the window never reaches them. */
		expect(periodicManager.costOf(at.z).light).toEqual(lightCost(at));

		periodicManager.setTuning(bestTuning(fe.lines));
		gameManager.periodic = { identified: [], sites: { whitedwarf: { index: 5, level: 0, progress: 0 } }, tuning: periodicManager.tuning };
		const price = periodicManager.costOf(fe.z).light;
		currenciesManager.add(CurrenciesTypes.BLUE_LIGHT, price.blue - 1);
		expect(periodicManager.identify(fe.z)).toBe(false);
		currenciesManager.add(CurrenciesTypes.BLUE_LIGHT, 1);
		expect(periodicManager.identify(fe.z)).toBe(true);
		expect(currenciesManager.getAmount(CurrenciesTypes.BLUE_LIGHT)).toBe(0);
	});

	test('the tuning window stays on the strip and a save only keeps a valid one', () => {
		periodicManager.setTuning(10);
		expect(periodicManager.tuning).toBe(375);
		periodicManager.setTuning(2000);
		expect(periodicManager.tuning).toBe(875);
		periodicManager.setTuning(Number.NaN);
		expect(periodicManager.tuning).toBe(875);
		periodicManager.setTuning(600.4);
		expect(periodicManager.tuning).toBe(600);

		for (const tuning of ['x', 9999, undefined] as never[]) {
			gameManager.periodic = { identified: [], sites: {}, tuning };
			expect(periodicManager.tuning).toBe(TUNING_DEFAULT);
			periodicManager.setTuning(600);
		}
		gameManager.periodic = { identified: [], sites: {}, tuning: 640 };
		expect(periodicManager.getState().tuning).toBe(640);
	});

	test('a full family multiplies its bonus once more', () => {
		const nonmetals = zs('H C N O P S Se');
		gameManager.periodic = { identified: nonmetals, sites: { bigbang: { index: 2, level: 0, progress: 0 }, lowmass: { index: 2, level: 0, progress: 0 }, massive: { index: 18, level: 0, progress: 0 } } };
		expect(periodicManager.identified).toEqual(nonmetals.toSorted((a, b) => a - b));
		expect(xp()).toBeCloseTo((1 + 0.02 * nonmetals.length) * SET_BONUS);
	});

	describe('element affinities', () => {
		const output = () => Object.fromEntries(GENERATOR_TYPES.map(type => [type, gameManager.effects.value('generator', 1, gameManager, type)]));
		/** Output of every generator once the elements are identified, every chain forged. */
		const boosts = (identified: number[]) => {
			const sites = Object.fromEntries(SITE_IDS.map(id => [id, { index: CHAINS[id].steps.length, level: 0, progress: 0 }]));
			gameManager.periodic = { identified, sites };
			return output();
		};

		test('Au boosts the Neutron Star by 10% and nothing else', () => {
			const plain = boosts([]);
			expect(boosts(zs('Au'))).toEqual({ ...plain, neutronStar: 1.1 });
		});

		test('C boosts Crystal, Micro-organism and Star, and each further related element adds 10% more', () => {
			const plain = boosts([]);
			expect(boosts(zs('C'))).toEqual({ ...plain, crystal: 1.1, microorganism: 1.1, star: 1.1 });
			const both = boosts(zs('C N'));
			expect(both.microorganism).toBeCloseTo(1.2);
			expect(both.star).toBeCloseTo(1.2);
			expect(both.molecule).toBeCloseTo(1.1);
			expect(both.crystal).toBeCloseTo(1.1);
		});

		test('a Black Hole has no related element, and the source only exists once an element is identified', () => {
			expect(boosts(ELEMENTS.map(element => element.z)).blackHole).toBe(1);
			boosts([]);
			expect(periodicManager.effectSources).toEqual([]);
		});

		test('the Alkaline earths bonus, untargeted, reaches the production of every generator', () => {
			boosts([]);
			const plain = { ...gameManager.generatorUnitProductions };
			boosts(zs('Ba'));
			for (const type of GENERATOR_TYPES) expect(gameManager.generatorUnitProductions[type] / plain[type]).toBeCloseTo(1.02);
		});
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
