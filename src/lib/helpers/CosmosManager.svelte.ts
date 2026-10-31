import {
	APERTURE_STEP,
	APERTURE_WIDEN_MS,
	apertureCost,
	COSMOS_INSTRUMENTS,
	COSMOS_OBJECTS,
	COSMOS_OBJECTS_BY_ID,
	type CosmosInstrument,
	type CosmosObject,
	cosmosEffects,
	IONIZE_FLASH_SECONDS,
	ionizeStarlightMultiplier,
	SKY_LIGHT,
	SPECTROSCOPE_ID,
	STUDY_MS,
	studyCost,
} from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import type { LightColor } from '#data/elements.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import type { CosmosState, EffectSource } from '#lib/types.js';

/** Everything here is kept through every prestige. */
class CosmosManager {
	aperture = $state(0);
	discovered = $state.raw<string[]>([]);
	instruments = $state.raw<string[]>([]);
	/** Counts the saves loaded, so a watcher tells a replaced state from an instrument that was built. */
	loads = $state(0);
	/** Instrument paid for and still being built, owned once `leftMs` runs out. */
	research = $state.raw<CosmosState['research']>(null);
	studies = $state.raw<Record<string, number>>({});
	/** The one study being run, paid for and raising its object's level once `leftMs` runs out. */
	studying = $state.raw<{ id: string; leftMs: number } | null>(null);
	/** 0 when no paid Aperture level is widening. */
	wideningMs = $state(0);
	/** Reads the Starlight currency boost live, GameManager sets it since this module never imports it. */
	currencyBoost: () => number = () => 1;

	unlocked = $derived(radiationManager.ionizes > 0);

	objects = $derived(COSMOS_OBJECTS.filter(object => object.given || this.discovered.includes(object.id)));

	/** First undiscovered object in history order, null once the owned instruments see nothing new. */
	nextDiscovery = $derived.by((): CosmosObject | null => {
		const next = COSMOS_OBJECTS.find(object => !object.given && !this.discovered.includes(object.id));
		return next && COSMOS_INSTRUMENTS.some(instrument => instrument.era === next.era && this.owns(instrument)) ? next : null;
	});

	/** Latest owned instrument that sees further, the one the player looks through. */
	instrument = $derived(COSMOS_INSTRUMENTS.findLast(instrument => !instrument.tool && this.owns(instrument))!);

	limit = $derived(Math.min(this.instrument.reach, this.instrument.limit + APERTURE_STEP * this.aperture));

	apertureMaxed = $derived(this.limit >= this.instrument.reach);

	canObserve = $derived(this.nextDiscovery !== null && this.nextDiscovery.magnitude <= this.limit);

	nextApertureCost = $derived(apertureCost(this.aperture));

	nextInstrument = $derived(COSMOS_INSTRUMENTS.find(instrument => instrument.cost > 0 && !this.instruments.includes(instrument.id)) ?? null);

	starlightMultiplier = $derived(ionizeStarlightMultiplier(radiationManager.ionizes));

	/** The Starlight currency boost, applied to every Starlight credit: the online tick, offline catch-up and the Ionize flash. */
	starlightBoost = $derived(this.currencyBoost());

	/** Also counted while locked so the first Ionize can size its flash. */
	baseStarlight = $derived(this.objects.reduce((rate, object) => rate + object.starlight * (1 + this.level(object.id)), 0));

	starlightPerSecond = $derived(this.unlocked ? this.baseStarlight * this.starlightMultiplier * this.starlightBoost : 0);

	/** Before the Light gain stat. */
	skyLight = $derived.by((): Record<LightColor, number> => {
		const rates: Record<LightColor, number> = { blue: 0, green: 0, red: 0 };
		for (const object of this.objects) {
			for (const [color, rate] of Object.entries(this.skyLightOf(object.id)) as [LightColor, number][]) rates[color] += rate;
		}
		return rates;
	});

	/** Folded into `gameManager.effects`, so the run bounds and the simulation read the Cosmos like any upgrade. */
	effectSources = $derived.by((): EffectSource[] => {
		if (!this.unlocked) return [];
		return this.objects.map(object => ({ effects: cosmosEffects(object, this.level(object.id)), id: `cosmos_${object.id}`, name: object.name }));
	});

	level(objectId: string): number {
		return this.studies[objectId] ?? 0;
	}

	starlightOf(objectId: string): number {
		const object = COSMOS_OBJECTS_BY_ID[objectId];
		if (!this.unlocked || !object || !this.objects.includes(object)) return 0;
		return object.starlight * (1 + this.level(objectId)) * this.starlightMultiplier * this.starlightBoost;
	}

	skyLightOf(objectId: string): Partial<Record<LightColor, number>> {
		const object = COSMOS_OBJECTS_BY_ID[objectId];
		if (!object?.light || !this.unlocked || !this.instruments.includes(SPECTROSCOPE_ID) || !this.objects.includes(object)) return {};
		const level = 1 + this.level(objectId);
		return Object.fromEntries(Object.entries(object.light).map(([color, weight]) => [color, SKY_LIGHT * weight * level]));
	}

	owns(instrument: CosmosInstrument): boolean {
		return instrument.cost === 0 || this.instruments.includes(instrument.id);
	}

	discover(objectId: string): boolean {
		if (!this.canObserve || this.nextDiscovery?.id !== objectId) return false;
		this.discovered = [...this.discovered, objectId];
		return true;
	}

	/** IONIZE_FLASH_SECONDS of Starlight times the squared ratio of the run's peak CPM to the ionization line, at the new Ionize count and the current boost. */
	flashFor(peakCpm: number, ionizeCpm: number, ionizes: number): number {
		return this.baseStarlight * ionizeStarlightMultiplier(ionizes) * this.starlightBoost * IONIZE_FLASH_SECONDS * (peakCpm / ionizeCpm) ** 2;
	}

	purchaseAperture(): boolean {
		const cost = this.nextApertureCost;
		if (!this.unlocked || this.wideningMs > 0 || this.apertureMaxed || currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < cost) return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, cost);
		this.wideningMs = APERTURE_WIDEN_MS;
		return true;
	}

	purchaseInstrument(instrumentId: string): boolean {
		const instrument = this.nextInstrument;
		if (
			!this.unlocked ||
			this.research ||
			!this.apertureMaxed ||
			instrument?.id !== instrumentId ||
			currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < instrument.cost
		)
			return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, instrument.cost);
		this.research = { id: instrumentId, leftMs: instrument.researchMs };
		this.advance(0);
		return true;
	}

	/** Online ticks and offline catch-up both widen the Aperture, finish the study and build the instrument. */
	advance(deltaMs: number) {
		if (this.wideningMs > 0) {
			this.wideningMs = Math.max(0, this.wideningMs - deltaMs);
			if (this.wideningMs === 0) this.aperture++;
		}
		if (this.studying) {
			const { id, leftMs } = this.studying;
			if (leftMs > deltaMs) this.studying = { id, leftMs: leftMs - deltaMs };
			else {
				this.studies = { ...this.studies, [id]: this.level(id) + 1 };
				this.studying = null;
			}
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

	studyLevelsWithin(budget: number): number {
		const levels = this.objects.map(object => this.level(object.id));
		let count = 0;
		while (true) {
			let cheapest = -1;
			let cost = Infinity;
			for (let i = 0; i < levels.length; i++) {
				const next = studyCost(this.objects[i], levels[i]);
				if (next < cost) {
					cheapest = i;
					cost = next;
				}
			}
			if (cheapest < 0 || cost > budget) return count;
			budget -= cost;
			levels[cheapest]++;
			count++;
		}
	}

	study(objectId: string): boolean {
		const object = COSMOS_OBJECTS_BY_ID[objectId];
		if (!this.unlocked || this.studying || !object || !this.objects.includes(object)) return false;
		const cost = studyCost(object, this.level(objectId));
		if (currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < cost) return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, cost);
		this.studying = { id: objectId, leftMs: STUDY_MS };
		return true;
	}

	tick(deltaMs: number) {
		if (this.starlightPerSecond > 0) currenciesManager.add(CurrenciesTypes.STARLIGHT, (this.starlightPerSecond * deltaMs) / 1000);
		this.advance(deltaMs);
	}

	/** A level still widening and a study still running are saved as done, a reload only skips their last seconds. */
	getState(): CosmosState {
		const studies = this.studying ? { ...this.studies, [this.studying.id]: this.level(this.studying.id) + 1 } : this.studies;
		return { aperture: this.aperture + (this.wideningMs > 0 ? 1 : 0), discovered: this.discovered, instruments: this.instruments, research: this.research, studies };
	}

	/** Unknown ids from a tampered or future save are dropped, they would count toward the boosts. */
	loadState(state: CosmosState) {
		this.aperture = Number.isInteger(state.aperture) && state.aperture > 0 ? state.aperture : 0;
		this.wideningMs = 0;
		this.studying = null;
		this.discovered = (state.discovered ?? []).filter(id => id in COSMOS_OBJECTS_BY_ID);
		this.instruments = (state.instruments ?? []).filter(id => COSMOS_INSTRUMENTS.some(instrument => instrument.id === id));
		const research = state.research;
		const researched = COSMOS_INSTRUMENTS.find(instrument => instrument.id === research?.id && !this.instruments.includes(instrument.id));
		this.research = research && researched ? { id: researched.id, leftMs: Math.min(Math.max(research.leftMs, 0), researched.researchMs) || 0 } : null;
		this.studies = Object.fromEntries(Object.entries(state.studies ?? {}).filter(([id, level]) => id in COSMOS_OBJECTS_BY_ID && Number.isFinite(level) && level > 0));
		this.loads++;
	}
}

export const cosmosManager = new CosmosManager();
