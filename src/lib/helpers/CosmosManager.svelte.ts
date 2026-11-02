import {
	APERTURE_STEP,
	APERTURE_WIDEN_MS,
	apertureCost,
	CLICKABLE_OBJECTS,
	COSMOS_INSTRUMENTS,
	COSMOS_OBJECTS,
	COSMOS_OBJECTS_BY_ID,
	type CosmosInstrument,
	type CosmosObject,
	cosmosEffects,
	IONIZE_FLASH_SECONDS,
	ionizeStarlightMultiplier,
	SKY_CLICK_STARLIGHT_SECONDS,
	SKY_LIGHT,
	SPECTROSCOPE_ID,
	STUDY_MS,
	studyCost,
} from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import type { LightColor } from '#data/elements.js';
import { GUEST_STAR_INTERVAL_MS, GUEST_STAR_REWARD_SECONDS } from '#data/guestStars.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import { MAX_CLICKS_PER_SECOND } from '#helpers/runBounds.js';
import type { CosmosState, EffectSource } from '#lib/types.js';

/** Everything here is kept through every prestige. */
class CosmosManager {
	aperture = $state(0);
	/** Flushed taps, sky taps are kept apart from the atom click counters so Click Mastery and the run click bound never see them. */
	clicks = $state.raw<Record<string, number>>({});
	discovered = $state.raw<string[]>([]);
	guestStars = $state(0);
	/** A guest star is in the sky, read by its hint and never saved. */
	guestStarShown = $state(false);
	instruments = $state.raw<string[]>([]);
	/** Counts the saves loaded and the offline catch-ups, so a watcher tells a replaced state from an instrument that was built. */
	loads = $state(0);
	/** Instrument paid for and still being built, owned once `leftMs` runs out. */
	research = $state.raw<CosmosState['research']>(null);
	studies = $state.raw<Record<string, number>>({});
	/** The one study being run, paid for and raising its object's level once `leftMs` runs out. */
	studying = $state.raw<{ id: string; leftMs: number } | null>(null);
	/** 0 when no paid Aperture level is widening. */
	wideningMs = $state(0);
	/** Reads the Starlight currency boost live, GameManager sets it since this module never imports it. */
	currencyBoost = $state.raw<() => number>(() => 1);

	/** Taps since the last tick, plain fields so an auto-clicker never writes reactive state or the currency per tap. */
	#pendingClicks: Record<string, number> = {};
	#pendingTotal = 0;
	/** Cosmos time left before the next guest star, -1 until drawn. Never saved, so time away earns none. */
	#guestStarDueMs = -1;

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

	/** Without the currency boost, which boost points can add and remove for free. */
	unboostedStarlightPerSecond = $derived(this.unlocked ? this.baseStarlight * this.starlightMultiplier : 0);

	starlightPerSecond = $derived(this.unboostedStarlightPerSecond * this.starlightBoost);

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

	/** Counts `elapsedMs` of eligible Cosmos time down, true once a guest star is due and until `guestStarSpawned()` is called. */
	guestStarDue(elapsedMs: number, random = Math.random): boolean {
		if (this.#guestStarDueMs < 0) this.#guestStarDueMs = GUEST_STAR_INTERVAL_MS[0] + random() * (GUEST_STAR_INTERVAL_MS[1] - GUEST_STAR_INTERVAL_MS[0]);
		this.#guestStarDueMs = Math.max(0, this.#guestStarDueMs - elapsedMs);
		return this.#guestStarDueMs === 0;
	}

	guestStarSpawned() {
		this.#guestStarDueMs = -1;
	}

	/** Pays the catch at the current Starlight rate and returns the amount, 0 while the Cosmos is locked. */
	catchGuestStar(): number {
		const starlight = this.starlightPerSecond * GUEST_STAR_REWARD_SECONDS;
		if (starlight > 0) currenciesManager.add(CurrenciesTypes.STARLIGHT, starlight);
		this.guestStars++;
		return Math.max(starlight, 0);
	}

	/** Counts a tap on a sky object, false for moons, rings and objects not in the sky yet. */
	click(objectId: string): boolean {
		const object = COSMOS_OBJECTS_BY_ID[objectId];
		if (!object || object.orbits || !this.objects.includes(object)) return false;
		this.#pendingClicks[objectId] = (this.#pendingClicks[objectId] ?? 0) + 1;
		this.#pendingTotal++;
		return true;
	}

	/**
	 * Pending taps within `limit`, every object's count scaled down by the same factor and rounded down. The server holds taps to
	 * `MAX_CLICKS_PER_SECOND`, so the excess of a macro is dropped instead of being counted and paid.
	 */
	#cappedPending(limit: number): { counts: Record<string, number>; total: number } {
		if (this.#pendingTotal <= limit) return { counts: this.#pendingClicks, total: this.#pendingTotal };
		const scale = limit / this.#pendingTotal;
		const counts: Record<string, number> = {};
		let total = 0;
		for (const [id, count] of Object.entries(this.#pendingClicks)) {
			const kept = Math.floor(count * scale);
			if (kept === 0) continue;
			counts[id] = kept;
			total += kept;
		}
		return { counts, total };
	}

	/** Merges the pending taps the elapsed time allows into `clicks` and pays their Starlight at the current rate, returns the amount credited. */
	#flushClicks(deltaMs: number): number {
		if (this.#pendingTotal === 0) return 0;
		const { counts, total } = this.#cappedPending(Math.floor((MAX_CLICKS_PER_SECOND * deltaMs) / 1000));
		const starlight = total * SKY_CLICK_STARLIGHT_SECONDS * this.starlightPerSecond;
		this.clicks = this.#mergeClicks(counts);
		this.#pendingClicks = {};
		this.#pendingTotal = 0;
		if (starlight > 0) currenciesManager.add(CurrenciesTypes.STARLIGHT, starlight);
		return Math.max(starlight, 0);
	}

	#mergeClicks(counts: Record<string, number>): Record<string, number> {
		const merged = { ...this.clicks };
		for (const [id, count] of Object.entries(counts)) merged[id] = (merged[id] ?? 0) + count;
		return merged;
	}

	/** Returns the Starlight credited, the daily stat counts the same amount. */
	tick(deltaMs: number): number {
		const starlight = (this.starlightPerSecond * deltaMs) / 1000;
		if (starlight > 0) currenciesManager.add(CurrenciesTypes.STARLIGHT, starlight);
		this.advance(deltaMs);
		return Math.max(starlight, 0) + this.#flushClicks(deltaMs);
	}

	/**
	 * A level still widening and a study still running are saved as done, a reload only skips their last seconds. The taps not flushed
	 * yet are saved up to one second of the tap bound, the next tick pays the rest.
	 */
	getState(): CosmosState {
		const studies = this.studying ? { ...this.studies, [this.studying.id]: this.level(this.studying.id) + 1 } : this.studies;
		return {
			aperture: this.aperture + (this.wideningMs > 0 ? 1 : 0),
			clicks: this.#pendingTotal === 0 ? this.clicks : this.#mergeClicks(this.#cappedPending(MAX_CLICKS_PER_SECOND).counts),
			discovered: this.discovered,
			guestStars: this.guestStars,
			instruments: this.instruments,
			research: this.research,
			studies,
		};
	}

	/** Unknown ids from a tampered or future save are dropped, they would count toward the boosts. */
	loadState(state: CosmosState) {
		this.aperture = Number.isInteger(state.aperture) && state.aperture > 0 ? state.aperture : 0;
		this.wideningMs = 0;
		this.studying = null;
		this.discovered = [...new Set(state.discovered ?? [])].filter(id => id in COSMOS_OBJECTS_BY_ID);
		this.instruments = [...new Set(state.instruments ?? [])].filter(id => COSMOS_INSTRUMENTS.some(instrument => instrument.id === id));
		const research = state.research;
		const researched = COSMOS_INSTRUMENTS.find(instrument => instrument.id === research?.id && !this.instruments.includes(instrument.id));
		this.research = research && researched ? { id: researched.id, leftMs: Math.min(Math.max(research.leftMs, 0), researched.researchMs) || 0 } : null;
		this.studies = Object.fromEntries(Object.entries(state.studies ?? {}).filter(([id, level]) => id in COSMOS_OBJECTS_BY_ID && Number.isSafeInteger(level) && level > 0));
		const guestStars = state.guestStars ?? 0;
		this.guestStars = Number.isSafeInteger(guestStars) && guestStars > 0 ? guestStars : 0;
		this.#pendingClicks = {};
		this.#pendingTotal = 0;
		this.clicks = Object.fromEntries(
			Object.entries(state.clicks ?? {}).filter(([id, count]) => CLICKABLE_OBJECTS.some(object => object.id === id) && Number.isSafeInteger(count) && count > 0),
		);
		this.loads++;
	}
}

export const cosmosManager = new CosmosManager();
