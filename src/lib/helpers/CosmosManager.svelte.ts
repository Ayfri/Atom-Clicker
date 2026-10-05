import {
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
	discovered = $state.raw<string[]>([]);
	instruments = $state.raw<string[]>([]);
	studies = $state.raw<Record<string, number>>({});

	/** The first Ionize opens the Cosmos, and every Ionize after it raises Starlight. */
	unlocked = $derived(radiationManager.ionizes > 0);

	objects = $derived(COSMOS_OBJECTS.filter(object => object.given || this.discovered.includes(object.id)));

	/** First undiscovered object in history order, null once the owned instruments see nothing new. */
	nextDiscovery = $derived.by((): CosmosObject | null => {
		const next = COSMOS_OBJECTS.find(object => !object.given && !this.discovered.includes(object.id));
		return next && this.ownsEra(next.era) ? next : null;
	});

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

	ownsEra(era: string): boolean {
		return COSMOS_INSTRUMENTS.some(instrument => instrument.era === era && (instrument.cost === 0 || this.instruments.includes(instrument.id)));
	}

	discover(objectId: string): boolean {
		if (this.nextDiscovery?.id !== objectId) return false;
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

	purchaseInstrument(instrumentId: string): boolean {
		const instrument = this.nextInstrument;
		if (!this.unlocked || instrument?.id !== instrumentId || currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < instrument.cost) return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, instrument.cost);
		this.instruments = [...this.instruments, instrumentId];
		return true;
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
	}

	getState(): CosmosState {
		return { discovered: this.discovered, instruments: this.instruments, studies: this.studies };
	}

	/** Unknown ids from a tampered or future save are dropped, they would otherwise count toward the boosts. */
	loadState(state: CosmosState) {
		this.discovered = (state.discovered ?? []).filter(id => id in COSMOS_OBJECTS_BY_ID);
		this.instruments = (state.instruments ?? []).filter(id => COSMOS_INSTRUMENTS.some(instrument => instrument.id === id));
		this.studies = Object.fromEntries(Object.entries(state.studies ?? {}).filter(([id, level]) => id in COSMOS_OBJECTS_BY_ID && Number.isFinite(level) && level > 0));
	}
}

export const cosmosManager = new CosmosManager();
