import { beforeEach, describe, expect, test } from 'bun:test';
import { ionizeStarlightMultiplier, SPECTROSCOPE_ID } from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { bestTuning, decayCost, ELEMENTS, LAMP_PAYBACK_SECONDS, lightCost, SET_BONUS, TUNING, zs } from '#data/elements.js';
import { GENERATOR_TYPES } from '#data/generators.js';
import { NEUTRINO_SKIP_MS } from '#data/neutrinos.js';
import { BASE_RATES, CHAINS, DECAY_EVENTS_PER_SECOND, FORGE_COST_SECONDS, FORGE_MILESTONES, MAX_FORGES, SITE_IDS, siteStudyCost, type SiteId } from '#data/sites.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { periodicManager, TUNING_DEFAULT } from '#helpers/PeriodicManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import type { PeriodicState } from '#lib/types.js';

const DAY_MS = 86_400_000;
const xp = () => gameManager.effects.value('xp_gain', 1, gameManager);

function payLight(z: number, share = 1) {
	const cost = lightCost(ELEMENTS[z - 1]);
	currenciesManager.add(CurrenciesTypes.RED_LIGHT, cost.red * share);
	currenciesManager.add(CurrenciesTypes.GREEN_LIGHT, cost.green * share);
	currenciesManager.add(CurrenciesTypes.BLUE_LIGHT, cost.blue * share);
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

	test('forges each chain in order up to the unread cap, and a step waits on its seed once there is room', () => {
		cosmosManager.discovered = ['mira'];
		periodicManager.forges = 2;
		periodicManager.assign('bigbang');
		periodicManager.assign('lowmass');
		expect(periodicManager.statuses.lowmass).toEqual({ kind: 'waiting', missing: zs('He'), object: null, z: 6 });
		expect(periodicManager.tick(DAY_MS)).toEqual(zs('H He C N'));
		expect(periodicManager.statuses.bigbang).toEqual({ kind: 'full', unread: zs('H He'), z: 3 });
		payLight(1);
		expect(periodicManager.identify(1)).toBe(true);
		expect(periodicManager.statuses.bigbang).toEqual({ kind: 'waiting', missing: [], object: 'cmb', z: 3 });
		cosmosManager.discovered = ['mira', 'cmb'];
		expect(periodicManager.statuses.bigbang.kind).toBe('forging');
	});

	test('identifying pays the Light of its lines and adds its family bonus', () => {
		periodicManager.assign('bigbang');
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

	test('the Prism tuning makes the lines inside its window cheaper and never dearer than the plain cost, only once bought', () => {
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
		expect(periodicManager.costOf(fe.z).light).toEqual(lightCost(fe));
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

	test('no tuning window ever makes an element cost more Light than without the Prism, even with spread lines', () => {
		/** Six blue lines 20 nm apart: the best window holds 3, so raw weights (3 × 0.2 + 3 × 2) would cost 10% more than plain. */
		const spread = { ...ELEMENTS[zs('Fe')[0] - 1], lines: [380, 400, 420, 440, 460, 480] };
		expect(lightCost(spread, bestTuning(spread.lines))).toEqual(lightCost(spread));
		for (const element of [spread, ...ELEMENTS.filter(other => other.lines.length)]) {
			const plain = lightCost(element);
			for (let center = TUNING.min; center <= TUNING.max; center += 5) {
				const tuned = lightCost(element, center);
				for (const color of ['blue', 'green', 'red'] as const) expect(tuned[color]).toBeLessThanOrEqual(plain[color]);
			}
			const best = lightCost(element, bestTuning(element.lines));
			for (const color of ['blue', 'green', 'red'] as const) expect(best[color]).toBeLessThanOrEqual(plain[color]);
		}
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

	test('the introduction counts as unseen in saves without the field and survives a round trip', () => {
		gameManager.periodic = { identified: [], sites: {} };
		expect(periodicManager.introSeen).toBe(false);
		gameManager.periodic = { identified: [], introSeen: 'yes' as never, sites: {} };
		expect(periodicManager.introSeen).toBe(false);
		periodicManager.introSeen = true;
		gameManager.periodic = JSON.parse(JSON.stringify(periodicManager.getState()));
		expect(periodicManager.introSeen).toBe(true);
	});

	test('a full family multiplies its bonus once more', () => {
		const nonmetals = zs('H C N O P S Se');
		gameManager.periodic = { identified: nonmetals, sites: { bigbang: { index: 2, level: 0, progress: 0 }, lowmass: { index: 2, level: 0, progress: 0 }, massive: { index: 18, level: 0, progress: 0 } } };
		expect(periodicManager.identified).toEqual(nonmetals.toSorted((a, b) => a - b));
		expect(xp()).toBeCloseTo((1 + 0.02 * nonmetals.length) * SET_BONUS);
	});

	describe('element affinities', () => {
		const output = () => Object.fromEntries(GENERATOR_TYPES.map(type => [type, gameManager.effects.value('generator', 1, gameManager, type)]));
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
		periodicManager.assign('bigbang');
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

	describe('forges', () => {
		/** He is forged, so the red giants (C) and the supernovae (O) can both start, Big Bang waits for the microwave background. */
		beforeEach(() => {
			cosmosManager.discovered = ['mira', 'crab_nebula'];
			gameManager.periodic = { identified: [], sites: { bigbang: { index: 2, level: 0, progress: 0 } } };
		});

		const count = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

		test('one forge at the start, and a source without one never advances', () => {
			expect(periodicManager.forges).toBe(1);
			expect(periodicManager.active).toEqual([]);
			expect(periodicManager.statuses.lowmass.kind).toBe('idle');
			expect(periodicManager.tick(DAY_MS)).toEqual([]);
			expect(periodicManager.forge('lowmass').progress).toBe(0);
			expect(periodicManager.etaOf('lowmass')).toBe(Infinity);
		});

		test('the only forge moves to the source clicked and every source keeps its progress', () => {
			expect(periodicManager.assign('lowmass')).toBe(true);
			expect(periodicManager.assign('lowmass')).toBe(false);
			periodicManager.tick(1000);
			const lowmass = periodicManager.forge('lowmass');
			expect(lowmass.progress).toBeGreaterThan(0);

			expect(periodicManager.assign('massive')).toBe(true);
			expect(periodicManager.active).toEqual(['massive']);
			periodicManager.tick(1000);
			expect(periodicManager.forge('lowmass')).toEqual(lowmass);
			expect(periodicManager.forge('massive').progress).toBeGreaterThan(0);

			expect(periodicManager.assign('lowmass')).toBe(true);
			periodicManager.tick(1000);
			expect(periodicManager.forge('lowmass').progress).toBeGreaterThan(lowmass.progress);
		});

		test('with several forges a source is only added while one is free, and release gives it back', () => {
			periodicManager.forges = 2;
			expect(periodicManager.assign('lowmass')).toBe(true);
			expect(periodicManager.assign('massive')).toBe(true);
			expect(periodicManager.freeForges).toBe(0);
			expect(periodicManager.assign('bigbang')).toBe(false);
			expect(periodicManager.active).toEqual(['lowmass', 'massive']);

			expect(periodicManager.release('lowmass')).toBe(true);
			expect(periodicManager.release('lowmass')).toBe(false);
			expect(periodicManager.assign('bigbang')).toBe(true);
			expect(periodicManager.assign('accelerator')).toBe(false);
		});

		test('a finished chain frees its forge and cannot take another', () => {
			cosmosManager.discovered = ['cosmic_rays'];
			gameManager.periodic = {
				identified: [],
				sites: { bigbang: { index: 2, level: 0, progress: 0 }, cosmic: { index: 1, level: 0, progress: 0 }, lowmass: { index: 2, level: 0, progress: 0 }, massive: { index: 1, level: 0, progress: 0 } },
			};

			expect(periodicManager.assign('cosmic')).toBe(true);
			expect(periodicManager.tick(12 * DAY_MS)).toEqual(zs('B'));
			expect(periodicManager.statuses.cosmic.kind).toBe('done');
			expect(periodicManager.active).toEqual([]);
			expect(periodicManager.assign('cosmic')).toBe(false);
		});

		test('a tick gives the same result whatever order the sources were assigned in, a step waiting on another source starting when its element is made', () => {
			const [h, he, c] = zs('H He C');
			const heSeconds = (ELEMENTS[h - 1].need + ELEMENTS[he - 1].need) / BASE_RATES.bigbang;
			cosmosManager.discovered = ['mira'];
			periodicManager.forges = 2;

			const run = (active: SiteId[], deltaMs: number) => {
				gameManager.periodic = { identified: [], sites: {} };
				periodicManager.active = active;
				periodicManager.tick(deltaMs);
				return { forged: [...periodicManager.forged].toSorted((a, b) => a - b), lowmass: periodicManager.forge('lowmass') };
			};

			const long = run(['lowmass', 'bigbang'], DAY_MS);
			expect(long.forged).toEqual(expect.arrayContaining([h, he, c]));
			expect(run(['bigbang', 'lowmass'], DAY_MS)).toEqual(long);

			const short = run(['lowmass', 'bigbang'], (heSeconds + 1) * 1000);
			expect(short.forged).toEqual([h, he]);
			expect(short.lowmass.progress).toBeCloseTo(BASE_RATES.lowmass, 6);
			expect(run(['bigbang', 'lowmass'], (heSeconds + 1) * 1000)).toEqual(short);
		});

		test('the next forge unlocks at each milestone and the last one is the cap', () => {
			for (const [i, milestone] of FORGE_MILESTONES.entries()) {
				periodicManager.forges = i + 1;
				periodicManager.identified = count(milestone - 1);
				expect(periodicManager.nextForgeUnlocked).toBe(false);
				periodicManager.identified = count(milestone);
				expect(periodicManager.nextForgeUnlocked).toBe(true);
			}
			periodicManager.forges = MAX_FORGES;
			periodicManager.identified = count(118);
			expect(periodicManager.nextForgeUnlocked).toBe(false);
		});

		test('a forge costs half an hour of the Starlight made now, and buying it needs the milestone and the Starlight', () => {
			/** Only the given objects radiate once nothing is discovered. */
			cosmosManager.discovered = [];
			const cost = () => Math.ceil(2 * ionizeStarlightMultiplier(gameManager.totalIonizesAllTime) * FORGE_COST_SECONDS);
			expect(periodicManager.forgeCost).toBe(cost());
			gameManager.totalIonizesAllTime = 5;
			expect(periodicManager.forgeCost).toBe(cost());

			/** Boost points move for free, so the price ignores them. */
			gameManager.currencyBoosts = { [CurrenciesTypes.STARLIGHT]: 20 };
			expect(cosmosManager.starlightPerSecond).toBeGreaterThan(cosmosManager.unboostedStarlightPerSecond);
			expect(periodicManager.forgeCost).toBe(cost());

			currenciesManager.add(CurrenciesTypes.STARLIGHT, cost());
			periodicManager.identified = count(FORGE_MILESTONES[0] - 1);
			expect(periodicManager.buyForge()).toBe(false);
			periodicManager.identified = count(FORGE_MILESTONES[0]);
			currenciesManager.remove(CurrenciesTypes.STARLIGHT, 1);
			expect(periodicManager.buyForge()).toBe(false);
			currenciesManager.add(CurrenciesTypes.STARLIGHT, 1);
			expect(periodicManager.buyForge()).toBe(true);
			expect(periodicManager.forges).toBe(2);
			expect(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT)).toBe(0);
			expect(periodicManager.buyForge()).toBe(false);
		});

		test('a save keeps a whole number of forges within the cap, and only open, unfinished, distinct sources up to that many', () => {
			const load = (state: { active?: string[]; forges?: unknown }, sites: Partial<Record<SiteId, { index: number; level: number; progress: number }>> = {}) => {
				gameManager.periodic = { identified: [], sites, ...state } as never;
				return { active: periodicManager.active, forges: periodicManager.forges };
			};
			cosmosManager.discovered = ['mira'];

			expect(load({})).toEqual({ active: [], forges: 1 });
			for (const forges of ['x', 0, -3, 2.7, Number.NaN, null]) expect(load({ forges }).forges).toBe(1);
			expect(load({ forges: 99 }).forges).toBe(MAX_FORGES);

			const active = ['massive', 'nowhere', 'lowmass', 'lowmass', 'bigbang'];
			expect(load({ active, forges: 1 }).active).toEqual(['lowmass']);
			expect(load({ active, forges: 2 }).active).toEqual(['lowmass', 'bigbang']);
			expect(load({ active, forges: 5 }, { bigbang: { index: 3, level: 0, progress: 0 } }).active).toEqual(['lowmass']);
			expect(load({ active: 'lowmass' as never }).active).toEqual([]);

			/** The Ionize count loads after the Table, so a save read before it still holds its forges. */
			cosmosManager.instruments = [];
			expect(periodicManager.unlocked).toBe(false);
			expect(load({ active: ['bigbang'], forges: 1 }).active).toEqual(['bigbang']);
			expect(JSON.parse(JSON.stringify(periodicManager.getState()))).toMatchObject({ active: ['bigbang'], forges: 1 });
		});
	});

	describe('unread cap', () => {
		const forging = (massive: { index: number; level: number }) => {
			cosmosManager.discovered = ['crab_nebula'];
			gameManager.periodic = { identified: [], sites: { bigbang: { index: 2, level: 0, progress: 0 }, massive: { ...massive, progress: 0 } } };
		};

		test('a source stops at the cap however long the gap, keeps its forge and resumes after a read without banking time', () => {
			forging({ index: 0, level: 9 });
			periodicManager.assign('massive');
			const [o, f, ne] = zs('O F Ne');

			expect(periodicManager.tick(30 * DAY_MS)).toEqual([o, f]);
			expect(periodicManager.statuses.massive).toEqual({ kind: 'full', unread: [o, f], z: ne });
			expect(periodicManager.active).toEqual(['massive']);
			expect(periodicManager.forge('massive').progress).toBe(0);
			expect(periodicManager.etaOf('massive')).toBe(Infinity);
			expect(periodicManager.tick(DAY_MS)).toEqual([]);

			payLight(o);
			expect(periodicManager.identify(o)).toBe(true);
			expect(periodicManager.statuses.massive.kind).toBe('forging');
			expect(periodicManager.tick(1000)).toEqual([]);
			expect(periodicManager.forge('massive').progress).toBeCloseTo(periodicManager.rateOf('massive'), 6);
		});

		test('a tick with nothing forging leaves the sites object alone, so the open Table is not rebuilt every second', () => {
			forging({ index: 0, level: 0 });
			const before = periodicManager.sites;
			expect(periodicManager.tick(1000)).toEqual([]);
			expect(periodicManager.sites).toBe(before);
			periodicManager.assign('massive');
			periodicManager.tick(1000);
			expect(periodicManager.sites).not.toBe(before);
		});

		test('a source without a forge stays idle over the cap, and a save forged past the cap needs several reads', () => {
			forging({ index: 5, level: 0 });
			expect(periodicManager.statuses.massive.kind).toBe('idle');
			periodicManager.assign('massive');
			expect(periodicManager.statuses.massive.kind).toBe('full');

			for (const z of zs('O F Ne Na')) {
				expect(periodicManager.statuses.massive.kind).toBe('full');
				payLight(z);
				expect(periodicManager.identify(z)).toBe(true);
			}
			expect(periodicManager.statuses.massive.kind).toBe('forging');
		});
	});

	describe('reading', () => {
		const [h, he] = zs('H He');
		const [md] = zs('Md');
		const lights = [CurrenciesTypes.BLUE_LIGHT, CurrenciesTypes.GREEN_LIGHT, CurrenciesTypes.RED_LIGHT];
		const held = () => lights.map(light => currenciesManager.getAmount(light));

		beforeEach(() => {
			gameManager.periodic = { identified: [], sites: { bigbang: { index: 2, level: 0, progress: 0 } } };
		});

		test('a pour keeps what it paid, stops at what is held, and identify only pays the remainder', () => {
			payLight(h, 0.5);
			expect(periodicManager.canPour(h)).toBe(true);
			expect(periodicManager.pour(h, 1)).toBe(0.5);
			expect(periodicManager.paid[h]).toBe(0.5);
			expect(held()).toEqual([0, 0, 0]);
			expect(periodicManager.identifiedSet.has(h)).toBe(false);
			expect(periodicManager.canPour(h)).toBe(false);
			expect(periodicManager.pour(h, 1)).toBe(0);

			const { blue, red } = lightCost(ELEMENTS[h - 1]);
			currenciesManager.add(CurrenciesTypes.BLUE_LIGHT, blue / 2 - 1);
			currenciesManager.add(CurrenciesTypes.RED_LIGHT, red / 2);
			expect(periodicManager.identify(h)).toBe(false);
			currenciesManager.add(CurrenciesTypes.BLUE_LIGHT, 1);
			expect(periodicManager.identify(h)).toBe(true);
			expect(held()).toEqual([0, 0, 0]);
			expect(periodicManager.paid[h]).toBeUndefined();
		});

		test('the scarcest currency sets the share, and a pour never goes past what is left', () => {
			const { blue, red } = lightCost(ELEMENTS[h - 1]);
			currenciesManager.add(CurrenciesTypes.RED_LIGHT, red);
			currenciesManager.add(CurrenciesTypes.BLUE_LIGHT, blue / 2);
			expect(periodicManager.pour(h, 1)).toBe(0.5);
			expect(currenciesManager.getAmount(CurrenciesTypes.RED_LIGHT)).toBe(red / 2);

			payLight(h);
			expect(periodicManager.pour(h, 1)).toBe(0.5);
			expect(periodicManager.identifiedSet.has(h)).toBe(true);
			expect(currenciesManager.getAmount(CurrenciesTypes.BLUE_LIGHT)).toBe(blue / 2);
			expect(periodicManager.paid[h]).toBeUndefined();
		});

		test('a partial Decay pour is completed by exactly the remainder, whatever the float rounding', () => {
			gameManager.periodic = { identified: [], sites: { accelerator: { index: 1, level: 0, progress: 0 } } };
			const cost = decayCost(ELEMENTS[md - 1]);
			currenciesManager.add(CurrenciesTypes.DECAY_EVENTS, 1000);
			expect(periodicManager.pour(md, 1)).toBeCloseTo(1000 / cost, 12);
			expect(periodicManager.identifiedSet.has(md)).toBe(false);
			currenciesManager.add(CurrenciesTypes.DECAY_EVENTS, cost - 1000);
			expect(periodicManager.identify(md)).toBe(true);
			expect(currenciesManager.getAmount(CurrenciesTypes.DECAY_EVENTS)).toBeCloseTo(0, 6);
		});

		test('a pour on an element that is not ready, or of nothing, spends nothing', () => {
			payLight(h);
			payLight(he);
			const before = held();
			expect(periodicManager.pour(3, 1)).toBe(0);
			expect(periodicManager.pour(h, 0)).toBe(0);
			expect(periodicManager.pour(h, -1)).toBe(0);
			expect(periodicManager.pour(h, Number.NaN)).toBe(0);
			expect(periodicManager.identify(3)).toBe(false);
			expect(held()).toEqual(before);

			periodicManager.identified = [he];
			expect(periodicManager.pour(he, 1)).toBe(0);
			expect(periodicManager.identify(he)).toBe(false);
			expect(held()).toEqual(before);
		});

		test('the paid shares survive a save, and a save only keeps a share of a ready element', () => {
			payLight(h, 0.5);
			periodicManager.pour(h, 1);
			gameManager.periodic = JSON.parse(JSON.stringify(periodicManager.getState()));
			expect(periodicManager.paid).toEqual({ [h]: 0.5 });

			const load = (paid: unknown) => {
				gameManager.periodic = { identified: [he], paid, sites: { bigbang: { index: 2, level: 0, progress: 0 } } } as never;
				return periodicManager.paid;
			};
			expect(load({ [h]: 0.4 })).toEqual({ [h]: 0.4 });
			for (const share of [0, 1, 1.5, -0.2, Number.NaN, 'x', null]) expect(load({ [h]: share })).toEqual({});
			expect(load({ [he]: 0.5, 3: 0.5, 999: 0.5, x: 0.5 })).toEqual({});
			expect(load(undefined)).toEqual({});
			expect(load([0.5])).toEqual({});
		});
	});

	describe('neutrinos', () => {
		const SECONDS = NEUTRINO_SKIP_MS / 1000;
		const chain = (id: SiteId) => ({ index: CHAINS[id].steps.length, level: 0, progress: 0 });
		const colors = ['blue', 'green', 'red'] as const;
		const lights = { blue: CurrenciesTypes.BLUE_LIGHT, green: CurrenciesTypes.GREEN_LIGHT, red: CurrenciesTypes.RED_LIGHT } as const;
		const paidCurrencies = [CurrenciesTypes.DECAY_EVENTS, ...colors.map(color => lights[color])];
		const held = () => paidCurrencies.map(name => currenciesManager.getAmount(name));
		const forge = () => JSON.parse(JSON.stringify({ active: periodicManager.active, sites: periodicManager.sites }));

		/** The Table's own state after `act` and what it paid in Decay events then Light, starting from `snapshot`. */
		function measure(snapshot: PeriodicState, act: () => void) {
			gameManager.periodic = snapshot;
			const before = held();
			act();
			return { forge: forge(), paid: held().map((amount, i) => amount - before[i]) };
		}

		function setUpTable() {
			cosmosManager.discovered = ['cmb'];
			gameManager.periodic = {
				active: ['bigbang', 'decay'],
				forges: 2,
				identified: zs('H He U Th'),
				sites: { bigbang: { index: 2, level: 0, progress: 0 }, decay: { index: 0, level: 2, progress: 0 }, neutron: chain('neutron') },
			};
			return JSON.parse(JSON.stringify(periodicManager.getState())) as PeriodicState;
		}

		test('a catch pays what 10 minutes of the live tick pay the Table, without the sky Light', () => {
			const snapshot = setUpTable();
			expect(periodicManager.decayEventsPerSecond).toBeGreaterThan(0);
			expect(periodicManager.lampLight.red).toBeGreaterThan(0);
			expect(cosmosManager.skyLight.red).toBeGreaterThan(0);

			const caught = measure(snapshot, () => gameManager.catchNeutrino());
			const live = measure(snapshot, () => gameManager.tick(NEUTRINO_SKIP_MS, true, true));

			expect(caught.paid[0]).toBeGreaterThan(0);
			expect(caught.paid[0]).toBeCloseTo(live.paid[0], 6);
			expect(caught.paid[0]).toBeCloseTo(periodicManager.decayEventsPerSecond * SECONDS, 6);
			for (const [i, color] of colors.entries()) {
				const sky = cosmosManager.skyLight[color] * gameManager.lightGain[color] * SECONDS;
				expect(caught.paid[i + 1]).toBeGreaterThan(0);
				expect(caught.paid[i + 1] + sky).toBeCloseTo(live.paid[i + 1], 6);
			}
			expect(caught.forge).toEqual(live.forge);
			expect(caught.forge).not.toEqual(JSON.parse(JSON.stringify({ active: snapshot.active, sites: snapshot.sites })));
		});

		test('the paid Decay events and Light count as earned, the catch counts and the daily stats stay as they were', () => {
			setUpTable();
			const daily = JSON.stringify(gameManager.dailyStats);
			const earned = () => paidCurrencies.map(name => currenciesManager.getEarnedAllTime(name));
			const [earnedBefore, heldBefore] = [earned(), held()];
			gameManager.catchNeutrino();
			expect(periodicManager.neutrinos).toBe(1);
			expect(JSON.stringify(gameManager.dailyStats)).toBe(daily);
			for (const [i, amount] of held().entries()) expect(earned()[i] - earnedBefore[i]).toBeCloseTo(amount - heldBefore[i], 6);
		});

		test('the forges run at the reactor power of the moment', () => {
			gameManager.periodic = { active: ['reactor'], identified: zs('U'), sites: { neutron: chain('neutron'), reactor: { index: 0, level: 0, progress: 0 } } };
			const snapshot = JSON.parse(JSON.stringify(periodicManager.getState())) as PeriodicState;
			radiationManager.unlock();
			radiationManager.upgradeLevels = { coolant_pumps: 20 };
			radiationManager.setControlRodLevel(1);
			radiationManager.mass = 1000;
			const factor = periodicManager.reactorFactor();
			expect(factor).toBeGreaterThan(0.5);

			const caught = measure(snapshot, () => gameManager.catchNeutrino()).forge;
			expect(caught).toEqual(measure(snapshot, () => periodicManager.tick(NEUTRINO_SKIP_MS, factor)).forge);
			expect(caught).not.toEqual(measure(snapshot, () => periodicManager.tick(NEUTRINO_SKIP_MS, factor / 2)).forge);
		});

		test('a catch still counts when nothing is running, and pays nothing', () => {
			const before = held();
			expect(gameManager.catchNeutrino()).toEqual([]);
			expect(periodicManager.neutrinos).toBe(1);
			expect(held()).toEqual(before);
		});

		test('running the Table ahead is only worth it with a forge working or Decay events coming in', () => {
			expect(periodicManager.skippable).toBe(false);
			periodicManager.assign('bigbang');
			expect(periodicManager.statuses.bigbang.kind).toBe('forging');
			expect(periodicManager.skippable).toBe(true);
			periodicManager.release('bigbang');
			expect(periodicManager.skippable).toBe(false);

			gameManager.periodic = { identified: zs('U Th'), sites: { decay: { index: 0, level: 0, progress: 0 }, neutron: chain('neutron') } };
			expect(periodicManager.active).toEqual([]);
			expect(periodicManager.skippable).toBe(true);
		});

		test('the first, 25th and 250th catch unlock their achievement on the sweep', () => {
			const unlocked = (id: string) => gameManager.unlockedAchievementIds.has(id);
			periodicManager.neutrinos = 24;
			gameManager.tick();
			expect([unlocked('table_neutrinos_1'), unlocked('table_neutrinos_25'), unlocked('table_neutrinos_250')]).toEqual([true, false, false]);
			periodicManager.neutrinos = 25;
			gameManager.tick();
			expect(unlocked('table_neutrinos_25')).toBe(true);
			expect(unlocked('table_neutrinos_250')).toBe(false);
		});

		test('the count survives a save, and a save with a missing, negative, fractional or text count loads as none', () => {
			periodicManager.neutrinos = 7;
			gameManager.periodic = JSON.parse(JSON.stringify(periodicManager.getState()));
			expect(periodicManager.neutrinos).toBe(7);
			for (const neutrinos of [undefined, -1, 1.5, '3', Number.NaN, null] as never[]) {
				gameManager.periodic = { identified: [], neutrinos, sites: {} };
				expect(periodicManager.neutrinos).toBe(0);
				periodicManager.neutrinos = 7;
			}
		});
	});
});
