import {
	APERTURE_STEP,
	APERTURE_WIDEN_MS,
	apertureCost,
	COSMOS_INSTRUMENTS,
	COSMOS_OBJECTS,
	COSMOS_OBJECTS_BY_ID,
	type CosmosObject,
	cosmosEffects,
	IONIZE_FLASH_SECONDS,
	ionizeStarlightMultiplier,
	studyCost,
} from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import type { CosmosState, EffectSource } from '#lib/types.js';

/** The sky above the realms: discovered objects radiate Starlight and boost the rest of the game, all kept through every prestige. */
class CosmosManager {
	/** Aperture levels, each one pushes every instrument's limit `APERTURE_STEP` magnitudes fainter. */
	aperture = $state(0);
	discovered = $state.raw<string[]>([]);
	instruments = $state.raw<string[]>([]);
	/** Instrument paid for and still being built, owned once `leftMs` runs out. */
	research = $state.raw<CosmosState['research']>(null);
	studies = $state.raw<Record<string, number>>({});
	/** Time left before the paid Aperture level counts, 0 when none is widening. */
	wideningMs = $state(0);

	/** The first Ionize opens the Cosmos, and every Ionize after it raises Starlight. */
	unlocked = $derived(radiationManager.ionizes > 0);

	objects = $derived(COSMOS_OBJECTS.filter(object => object.given || this.discovered.includes(object.id)));

	/** First undiscovered object in history order, null once the owned instruments see nothing new. */
	nextDiscovery = $derived.by((): CosmosObject | null => {
		const next = COSMOS_OBJECTS.find(object => !object.given && !this.discovered.includes(object.id));
		return next && this.ownsEra(next.era) ? next : null;
	});

	/** Latest owned instrument, the one the player looks through. */
	instrument = $derived(COSMOS_INSTRUMENTS.findLast(instrument => instrument.cost === 0 || this.instruments.includes(instrument.id))!);

	/** Faintest magnitude the instrument reaches at the current Aperture, never past its reach. */
	limit = $derived(Math.min(this.instrument.reach, this.instrument.limit + APERTURE_STEP * this.aperture));

	/** The Aperture is as wide as the instrument allows, only the next instrument sees further. */
	apertureMaxed = $derived(this.limit >= this.instrument.reach);

	/** The next object is bright enough for the instrument, its signal can be observed. */
	canObserve = $derived(this.nextDiscovery !== null && this.nextDiscovery.magnitude <= this.limit);

	nextApertureCost = $derived(apertureCost(this.aperture));

	/** The instrument being built, else the next one to buy. */
	nextInstrument = $derived(COSMOS_INSTRUMENTS.find(instrument => instrument.cost > 0 && !this.instruments.includes(instrument.id)) ?? null);

	starlightMultiplier = $derived(ionizeStarlightMultiplier(radiationManager.ionizes));

	/** Before the Ionize multiplier, and also counted while locked so the first Ionize can size its flash. */
	baseStarlight = $derived(this.objects.reduce((rate, object) => rate + object.starlight * (1 + this.level(object.id)), 0));

	starlightPerSecond = $derived(this.unlocked ? this.baseStarlight * this.starlightMultiplier : 0);

	/** Folded into `gameManager.effects`, so the run bounds and the simulation read the Cosmos like any upgrade. */
	effectSources = $derived.by((): EffectSource[] => {
		if (!this.unlocked) return [];
		return this.objects.map(object => ({ effects: cosmosEffects(object, this.level(object.id)), id: `cosmos_${object.id}`, name: object.name }));
	});

	level(objectId: string): number {
		return this.studies[objectId] ?? 0;
	}

	/** Starlight per second one object radiates, 0 until it is in the sky and the Cosmos is unlocked. */
	starlightOf(objectId: string): number {
		const object = COSMOS_OBJECTS_BY_ID[objectId];
		if (!this.unlocked || !object || !this.objects.includes(object)) return 0;
		return object.starlight * (1 + this.level(objectId)) * this.starlightMultiplier;
	}

	ownsEra(era: string): boolean {
		return COSMOS_INSTRUMENTS.some(instrument => instrument.era === era && (instrument.cost === 0 || this.instruments.includes(instrument.id)));
	}

	discover(objectId: string): boolean {
		if (!this.canObserve || this.nextDiscovery?.id !== objectId) return false;
		this.discovered = [...this.discovered, objectId];
		return true;
	}

	/**
	 * Starlight an Ionize pays at the new Ionize count: IONIZE_FLASH_SECONDS of Starlight times the squared ratio of the run's peak CPM
	 * to the ionization line it crossed, so a reactor pushed past the line earns more.
	 */
	flashFor(peakCpm: number, ionizeCpm: number, ionizes: number): number {
		return this.baseStarlight * ionizeStarlightMultiplier(ionizes) * IONIZE_FLASH_SECONDS * (peakCpm / ionizeCpm) ** 2;
	}

	/** Pays for the next Aperture level, which counts once it has widened for `APERTURE_WIDEN_MS`. */
	purchaseAperture(): boolean {
		const cost = this.nextApertureCost;
		if (!this.unlocked || this.wideningMs > 0 || this.apertureMaxed || currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < cost) return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, cost);
		this.wideningMs = APERTURE_WIDEN_MS;
		return true;
	}

	/** Pays for the next instrument, which is owned once its research time has passed. */
	purchaseInstrument(instrumentId: string): boolean {
		const instrument = this.nextInstrument;
		if (!this.unlocked || this.research || instrument?.id !== instrumentId || currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < instrument.cost)
			return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, instrument.cost);
		this.research = { id: instrumentId, leftMs: instrument.researchMs };
		this.advance(0);
		return true;
	}

	/** Online ticks and offline catch-up both widen the Aperture and build the instrument. */
	advance(deltaMs: number) {
		if (this.wideningMs > 0) {
			this.wideningMs = Math.max(0, this.wideningMs - deltaMs);
			if (this.wideningMs === 0) this.aperture++;
		}
		if (!this.research) return;
		const leftMs = this.research.leftMs - deltaMs;
		if (leftMs > 0) {
			this.research = { id: this.research.id, leftMs };
			return;
		}
		this.instruments = [...this.instruments, this.research.id];
		this.research = null;
	}

	study(objectId: string): boolean {
		const object = COSMOS_OBJECTS_BY_ID[objectId];
		if (!this.unlocked || !object || !this.objects.includes(object)) return false;
		const level = this.level(objectId);
		const cost = studyCost(object, level);
		if (currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < cost) return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, cost);
		this.studies = { ...this.studies, [objectId]: level + 1 };
		return true;
	}

	tick(deltaMs: number) {
		if (this.starlightPerSecond > 0) currenciesManager.add(CurrenciesTypes.STARLIGHT, (this.starlightPerSecond * deltaMs) / 1000);
		this.advance(deltaMs);
	}

	/** A level still widening is saved as done, a reload only skips its last seconds. */
	getState(): CosmosState {
		return { aperture: this.aperture + (this.wideningMs > 0 ? 1 : 0), discovered: this.discovered, instruments: this.instruments, research: this.research, studies: this.studies };
	}

	/** Unknown ids from a tampered or future save are dropped, they would otherwise count toward the boosts. */
	loadState(state: CosmosState) {
		this.aperture = Number.isInteger(state.aperture) && state.aperture > 0 ? state.aperture : 0;
		this.wideningMs = 0;
		this.discovered = (state.discovered ?? []).filter(id => id in COSMOS_OBJECTS_BY_ID);
		this.instruments = (state.instruments ?? []).filter(id => COSMOS_INSTRUMENTS.some(instrument => instrument.id === id));
		const research = state.research;
		const researched = COSMOS_INSTRUMENTS.find(instrument => instrument.id === research?.id && !this.instruments.includes(instrument.id));
		this.research = research && researched ? { id: researched.id, leftMs: Math.min(Math.max(research.leftMs, 0), researched.researchMs) || 0 } : null;
		this.studies = Object.fromEntries(Object.entries(state.studies ?? {}).filter(([id, level]) => id in COSMOS_OBJECTS_BY_ID && Number.isFinite(level) && level > 0));
	}
}

export const cosmosManager = new CosmosManager();
