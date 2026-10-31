import { beforeEach, describe, expect, test } from 'bun:test';
import {
	APERTURE_WIDEN_MS,
	COSMOS_INSTRUMENTS,
	COSMOS_OBJECTS,
	COSMOS_OBJECTS_BY_ID,
	IONIZE_FLASH_SECONDS,
	ionizeStarlightMultiplier,
	OBSERVE_APS_SECONDS,
	SKY_LIGHT,
	SKY_SECTIONS,
	SPECTROSCOPE_ID,
	studyCost,
} from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { GeneratorTypes } from '#data/generators.js';
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
		expect(starlight()).toBeCloseTo(2 * ionizeStarlightMultiplier(1) * IONIZE_FLASH_SECONDS * (peak / IONIZE_CPM) ** 2);
	});
});

describe('sky', () => {
	beforeEach(() => {
		gameManager.totalIonizesAllTime = 1;
	});

	test('radiates Starlight from the given objects, times the Ionize multiplier', () => {
		expect(cosmosManager.starlightPerSecond).toBe(2 * ionizeStarlightMultiplier(1));
		gameManager.tick(4000, true);
		expect(starlight()).toBeCloseTo(8 * ionizeStarlightMultiplier(1));
	});

	test('radiates its own Light once the Spectroscope reads it, each study level adding it again', () => {
		cosmosManager.discovered = ['mira'];
		cosmosManager.studies = { mira: 2 };
		expect(cosmosManager.skyLight).toEqual({ blue: 0, green: 0, red: 0 });

		cosmosManager.instruments = [SPECTROSCOPE_ID];
		expect(cosmosManager.skyLightOf('mira')).toEqual({ red: SKY_LIGHT * 3 });
		expect(cosmosManager.skyLightOf('jupiter')).toEqual({});
		/** The Sun, given from the start, splits its Light in thirds. */
		expect(cosmosManager.skyLight.red).toBeCloseTo(SKY_LIGHT * (3 + 1 / 3));
		expect(cosmosManager.skyLight.green).toBeCloseTo(SKY_LIGHT / 3);
		expect(cosmosManager.skyLight.blue).toBeCloseTo(SKY_LIGHT / 3);

		cosmosManager.discovered = [];
		expect(cosmosManager.skyLightOf('mira')).toEqual({});
	});

	test('an observation costs a minute of atom production to launch', () => {
		currenciesManager.add(CurrenciesTypes.ATOMS, 1e6);
		expect(gameManager.purchaseGenerator(GeneratorTypes.MOLECULE)).toBe(true);
		const cost = gameManager.atomsPerSecond * OBSERVE_APS_SECONDS;
		expect(cost).toBeGreaterThan(0);
		expect(gameManager.observationCost).toBe(cost);
		const atoms = currenciesManager.getAmount(CurrenciesTypes.ATOMS);
		expect(gameManager.startObservation()).toBe(true);
		expect(currenciesManager.getAmount(CurrenciesTypes.ATOMS)).toBeCloseTo(atoms - cost);

		currenciesManager.remove(CurrenciesTypes.ATOMS, currenciesManager.getAmount(CurrenciesTypes.ATOMS) - cost / 2);
		expect(gameManager.startObservation()).toBe(false);
		currenciesManager.add(CurrenciesTypes.ATOMS, cost);
		cosmosManager.discover('moon');
		expect(gameManager.startObservation()).toBe(false);
	});

	test('discovers objects brightest first, once the Aperture reaches them and an owned instrument sees them', () => {
		expect(cosmosManager.nextDiscovery?.id).toBe('moon');
		expect(cosmosManager.discover('mars')).toBe(false);
		expect(cosmosManager.discover('moon')).toBe(true);
		expect(cosmosManager.canObserve).toBe(false);
		expect(cosmosManager.discover('venus')).toBe(false);

		for (const id of ['venus', 'tycho', 'jupiter', 'mars', 'mercury', 'saturn', 'mira']) {
			while (!cosmosManager.canObserve) {
				currenciesManager.add(CurrenciesTypes.STARLIGHT, cosmosManager.nextApertureCost);
				expect(cosmosManager.purchaseAperture()).toBe(true);
				expect(cosmosManager.purchaseAperture()).toBe(false);
				cosmosManager.tick(APERTURE_WIDEN_MS);
			}
			expect(cosmosManager.discover(id), id).toBe(true);
		}
		expect(cosmosManager.aperture).toBe(11);
		expect(cosmosManager.nextDiscovery).toBeNull();
		currenciesManager.add(CurrenciesTypes.STARLIGHT, cosmosManager.nextApertureCost);
		expect(cosmosManager.apertureMaxed).toBe(true);
		expect(cosmosManager.purchaseAperture()).toBe(false);

		currenciesManager.remove(CurrenciesTypes.STARLIGHT, starlight());
		currenciesManager.add(CurrenciesTypes.STARLIGHT, cosmosManager.nextInstrument!.cost);
		expect(cosmosManager.purchaseInstrument('refractor')).toBe(true);
		expect(starlight()).toBe(0);
		expect(cosmosManager.nextDiscovery).toBeNull();

		const { researchMs } = cosmosManager.nextInstrument!;
		cosmosManager.tick(researchMs - 1000);
		expect(cosmosManager.research?.leftMs).toBe(1000);
		cosmosManager.tick(1000);
		expect(cosmosManager.research).toBeNull();
		expect(cosmosManager.nextDiscovery?.id).toBe('ganymede');
		expect(cosmosManager.limit).toBe(4);
		expect(cosmosManager.canObserve).toBe(false);

		currenciesManager.add(CurrenciesTypes.STARLIGHT, cosmosManager.nextInstrument!.cost);
		expect(cosmosManager.apertureMaxed).toBe(false);
		expect(cosmosManager.purchaseInstrument('reflector')).toBe(false);
	});

	test('a color boost raises the Light of that color only', () => {
		const mars = COSMOS_OBJECTS_BY_ID.mars;
		cosmosManager.discovered = ['mars'];
		expect(gameManager.lightGain).toEqual({ blue: 1, green: 1, red: 1 + mars.boost.amount });
	});

	test('objects come era by era in instrument order, the brightest first within an era', () => {
		const eras = COSMOS_INSTRUMENTS.map(instrument => instrument.era);
		const sky = COSMOS_OBJECTS.filter(object => !object.given);
		for (let i = 1; i < sky.length; i++) {
			const [previous, object] = [sky[i - 1], sky[i]];
			expect(eras.indexOf(object.era), object.id).toBeGreaterThanOrEqual(eras.indexOf(previous.era));
			if (object.era === previous.era) expect(object.magnitude, object.id).toBeGreaterThanOrEqual(previous.magnitude);
			expect(object.starlight, object.id).toBeGreaterThan(previous.starlight);
		}
	});

	test('the Sky list sections hold every object once, moons in their planet section', () => {
		expect(SKY_SECTIONS.flat().toSorted()).toEqual(COSMOS_OBJECTS.map(object => object.id).toSorted());
		for (const ids of SKY_SECTIONS) for (const id of ids) if (COSMOS_OBJECTS_BY_ID[id].orbits) expect(ids, id).toContain(COSMOS_OBJECTS_BY_ID[id].orbits!);
	});

	test('every object sits within the reach of the instrument of its era', () => {
		for (const object of COSMOS_OBJECTS) {
			const instrument = COSMOS_INSTRUMENTS.find(item => item.era === object.era)!;
			expect(object.magnitude, object.id).toBeLessThanOrEqual(instrument.reach);
		}
	});

	test('every object has its own details text, free of dashes', () => {
		for (const object of COSMOS_OBJECTS) {
			expect(object.details.length, object.id).toBeGreaterThan(200);
			expect(object.details, object.id).not.toBe(object.fact);
			expect(object.details, object.id).not.toMatch(/[–—]/);
		}
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
		expect(cosmosManager.starlightPerSecond).toBe((1 + 3) * ionizeStarlightMultiplier(1));
		expect(gameManager.globalMultiplier / globalBefore).toBeCloseTo((1 + earth.boost.amount * 3) / (1 + earth.boost.amount));
	});

	test('survives every prestige and drops unknown ids from a save', () => {
		cosmosManager.discover('moon');
		gameManager.resetLayer(4);
		expect(cosmosManager.discovered).toEqual(['moon']);

		gameManager.cosmos = {
			aperture: -3,
			discovered: ['moon', 'death_star'],
			instruments: ['warp'],
			research: { id: 'refractor', leftMs: 1e12 },
			studies: { moon: 2, sun: Number.NaN, tatooine: 9 },
		};
		expect(cosmosManager.getState()).toEqual({
			aperture: 0,
			discovered: ['moon'],
			instruments: [],
			research: { id: 'refractor', leftMs: COSMOS_INSTRUMENTS[1].researchMs },
			studies: { moon: 2 },
		});
	});
});

describe('daily quests', () => {
	beforeEach(() => {
		gameManager.totalIonizesAllTime = 1;
	});

	test('count the Starlight radiated online and the study levels bought', () => {
		gameManager.tick(4000, true);
		expect(gameManager.dailyStats.starlightEarned).toBeCloseTo(starlight());

		currenciesManager.add(CurrenciesTypes.STARLIGHT, studyCost(COSMOS_OBJECTS_BY_ID.sun, 0));
		expect(gameManager.studyCosmosObject('sun')).toBe(true);
		expect(gameManager.studyCosmosObject('sun')).toBe(false);
		expect(gameManager.dailyStats.cosmosStudies).toBe(1);
	});

	test('the study target is what the budget buys, cheapest level first', () => {
		const sun = COSMOS_OBJECTS_BY_ID.sun;
		expect(cosmosManager.studyLevelsWithin(0)).toBe(0);
		/** Sun and Earth share a price, so their first two levels go before either second level. */
		expect(cosmosManager.studyLevelsWithin(2 * studyCost(sun, 0))).toBe(2);
		expect(cosmosManager.studyLevelsWithin(2 * studyCost(sun, 0) + studyCost(sun, 1) - 1)).toBe(2);
		expect(gameManager.dailyQuestContext(false)).toMatchObject({ hasCosmos: true, starlightPerSecond: cosmosManager.starlightPerSecond });
	});
});
