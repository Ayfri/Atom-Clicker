import { SPECTROSCOPE_ID } from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import {
	decayCost,
	ELEMENT_COUNT,
	ELEMENT_GENERATOR_PERCENT,
	ELEMENTS,
	elementStat,
	FAMILIES,
	FAMILY_IDS,
	GENERATOR_ELEMENTS,
	LAMP_PAYBACK_SECONDS,
	lightCost,
	type LightColor,
	SET_BONUS,
	TUNING,
	zs,
} from '#data/elements.js';
import { GENERATOR_TYPES } from '#data/generators.js';
import { BASE_RATES, CHAINS, DECAY_EVENTS_PER_SECOND, DECAY_SITES, SITE_IDS, siteStudyCost, SITES, type SiteId } from '#data/sites.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { mul } from '#helpers/effects.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import type { EffectSource, EffectStat, PeriodicState, SiteForge } from '#lib/types.js';

export type SiteStatus =
	| { kind: 'done' | 'locked' }
	| { kind: 'forging'; progress: number; z: number }
	| { kind: 'waiting'; missing: number[]; object: string | null; z: number };

/** Where the tuning window starts: at the blue end of the strip. */
export const TUNING_DEFAULT: number = TUNING.min;

const LIGHT_CURRENCIES = { blue: CurrenciesTypes.BLUE_LIGHT, green: CurrenciesTypes.GREEN_LIGHT, red: CurrenciesTypes.RED_LIGHT } as const;
const LIGHT_COLORS = Object.keys(LIGHT_CURRENCIES) as LightColor[];
/** The reactor forges at its power over the ionization line, up to this many times its base rate. */
const MAX_REACTOR_FACTOR = 4;
const FAMILY_MEMBERS = Object.fromEntries(FAMILY_IDS.map(family => [family, ELEMENTS.filter(element => element.family === family).map(element => element.z)]));

/**
 * The Periodic Table: each nucleosynthesis site forges its chain of elements idle, and a forged element is identified by paying the Light
 * of its spectral lines, which lights its cell and adds its family bonus. Everything here is kept through every prestige.
 */
class PeriodicManager {
	identified = $state.raw<number[]>([]);
	/** Study level and progress of each site that has forged at least once or been studied. */
	sites = $state.raw<Partial<Record<SiteId, SiteForge>>>({});
	/** Center in nm of the Prism's tuning window, only read once the Prism Tuning upgrade is bought. */
	tuning = $state(TUNING_DEFAULT);

	/** Owning the Spectroscope opens the Table. */
	unlocked = $derived(cosmosManager.unlocked && cosmosManager.instruments.includes(SPECTROSCOPE_ID));

	/** The Prism Tuning upgrade is bought, lines inside the window cost less to read. */
	tuned = $derived(chromaticManager.level('prism_tuning') > 0);

	identifiedSet = $derived(new Set(this.identified));

	/** Every step of a chain before its current index is forged. */
	forged = $derived(new Set(SITE_IDS.flatMap(id => CHAINS[id].steps.slice(0, this.forge(id).index))));

	open = $derived(new Set(SITE_IDS.filter(id => this.isOpen(id))));

	statuses = $derived(Object.fromEntries(SITE_IDS.map(id => [id, this.statusOf(id)])) as Record<SiteId, SiteStatus>);

	/** Forged elements waiting for their Light, in Z order. */
	ready = $derived(ELEMENTS.filter(element => this.forged.has(element.z) && !this.identifiedSet.has(element.z)).map(element => element.z));

	complete = $derived(this.identified.length === ELEMENT_COUNT);

	/** Light per second each color gets from the identified elements' lamps: their untuned cost paid back over `LAMP_PAYBACK_SECONDS`. */
	lampLight = $derived.by((): Record<LightColor, number> => {
		const rates: Record<LightColor, number> = { blue: 0, green: 0, red: 0 };
		for (const z of this.identified) {
			const cost = lightCost(ELEMENTS[z - 1]);
			for (const color of LIGHT_COLORS) rates[color] += cost[color] / LAMP_PAYBACK_SECONDS;
		}
		return rates;
	});

	/** Decay events per second, paid by `GameManager.tick` online and `applyOfflineProgress` offline, never by `tick` here. */
	decayEventsPerSecond = $derived(DECAY_SITES.reduce((rate, id) => rate + (this.open.has(id) ? DECAY_EVENTS_PER_SECOND * (1 + this.forge(id).level) : 0), 0));

	/**
	 * One source per family that has started, its bonus `1 + step% × members`, once more ×SET_BONUS when every member is identified,
	 * and one for the element affinities: each generator gets `1 + 10% × identified related elements`.
	 */
	effectSources = $derived.by((): EffectSource[] => {
		const families = FAMILY_IDS.flatMap((family): EffectSource[] => {
			const lit = FAMILY_MEMBERS[family].filter(z => this.identifiedSet.has(z));
			if (!lit.length) return [];
			const set = lit.length === FAMILY_MEMBERS[family].length ? SET_BONUS : 1;
			const counts = new Map<EffectStat, number>();
			for (const z of lit) {
				const stat = elementStat(ELEMENTS[z - 1]);
				counts.set(stat, (counts.get(stat) ?? 0) + 1);
			}
			const { name, step } = FAMILIES[family];
			return [{ effects: [...counts].map(([stat, count]) => mul(stat, (1 + (step / 100) * count) * set)), id: `periodic_${family}`, name }];
		});
		const affinities = GENERATOR_TYPES.flatMap(type => {
			const lit = GENERATOR_ELEMENTS[type]?.filter(z => this.identifiedSet.has(z)).length ?? 0;
			return lit ? [mul('generator', 1 + (ELEMENT_GENERATOR_PERCENT / 100) * lit, type)] : [];
		});
		return affinities.length ? [...families, { effects: affinities, id: 'periodic_generators', name: 'Element affinities' }] : families;
	});

	forge(id: SiteId): SiteForge {
		return this.sites[id] ?? { index: 0, level: 0, progress: 0 };
	}

	/** Nuclei per second, each study level adds the base rate again. */
	rateOf(id: SiteId): number {
		const reactor = id === 'reactor' ? Math.min(MAX_REACTOR_FACTOR, radiationManager.currentCpm / radiationManager.ionizeCpm) : 1;
		return BASE_RATES[id] * (1 + this.forge(id).level) * reactor;
	}

	/** Seconds left on the element a site is forging, Infinity when it isn't forging. */
	etaOf(id: SiteId): number {
		const status = this.statuses[id];
		if (status.kind !== 'forging') return Infinity;
		const rate = this.rateOf(id);
		return rate > 0 ? (ELEMENTS[status.z - 1].need - status.progress) / rate : Infinity;
	}

	/** What identifying an element costs: the Light of its lines read through the tuning window, or `null` for the plain cost, and its Decay events. */
	costOf(z: number, tuning: number | null = this.tuned ? this.tuning : null): { decay: number; light: Record<LightColor, number> } {
		const element = ELEMENTS[z - 1];
		return { decay: decayCost(element), light: lightCost(element, tuning) };
	}

	canAfford(z: number, tuning?: number | null): boolean {
		const { decay, light } = this.costOf(z, tuning);
		return currenciesManager.getAmount(CurrenciesTypes.DECAY_EVENTS) >= decay && LIGHT_COLORS.every(color => currenciesManager.getAmount(LIGHT_CURRENCIES[color]) >= light[color]);
	}

	/** Moves the tuning window, rounded and kept on the strip. */
	setTuning(nm: number) {
		if (Number.isNaN(nm)) return;
		this.tuning = Math.min(Math.max(Math.round(nm), TUNING.min), TUNING.max);
	}

	/** Pays the Light of a forged element's lines, or the Decay events of one nobody has measured, which lights its cell and adds its family bonus. */
	identify(z: number): boolean {
		if (!this.unlocked || !this.forged.has(z) || this.identifiedSet.has(z) || !this.canAfford(z)) return false;
		const { decay, light } = this.costOf(z);
		for (const color of LIGHT_COLORS) if (light[color] > 0) currenciesManager.remove(LIGHT_CURRENCIES[color], light[color]);
		currenciesManager.remove(CurrenciesTypes.DECAY_EVENTS, decay);
		this.identified = [...this.identified, z].sort((a, b) => a - b);
		return true;
	}

	/** Studies a site's Cosmos object, which multiplies its forge rate. */
	study(id: SiteId): boolean {
		if (!this.open.has(id)) return false;
		const forge = this.forge(id);
		const cost = siteStudyCost(forge.level);
		if (currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < cost) return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, cost);
		this.sites = { ...this.sites, [id]: { ...forge, level: forge.level + 1 } };
		return true;
	}

	/** Online ticks and offline catch-up both forge, a long gap can finish several elements of a chain in one call. Returns the elements forged. */
	tick(deltaMs: number): number[] {
		if (!this.unlocked) return [];
		const made: number[] = [];
		let sites = this.sites;
		for (const id of this.open) {
			let budget = (this.rateOf(id) * deltaMs) / 1000;
			const forge = { ...this.forge(id) };
			while (budget > 0) {
				const status = this.statusOf(id, forge.index, made);
				if (status.kind !== 'forging') break;
				const left = ELEMENTS[status.z - 1].need - forge.progress;
				if (budget < left) {
					forge.progress += budget;
					break;
				}
				budget -= left;
				made.push(status.z);
				forge.index++;
				forge.progress = 0;
			}
			sites = { ...sites, [id]: forge };
		}
		this.sites = sites;
		return made;
	}

	getState(): PeriodicState {
		return { identified: this.identified, sites: this.sites, tuning: this.tuning };
	}

	/** Unknown sites and Z from a tampered or future save are dropped, and so is an identified element its chain never forged. */
	loadState(state: PeriodicState) {
		const sites: Partial<Record<SiteId, SiteForge>> = {};
		for (const id of SITE_IDS) {
			const forge = state.sites?.[id];
			if (!forge) continue;
			const index = Number.isInteger(forge.index) ? Math.min(Math.max(forge.index, 0), CHAINS[id].steps.length) : 0;
			const level = Number.isInteger(forge.level) ? Math.max(forge.level, 0) : 0;
			const progress = Number.isFinite(forge.progress) ? Math.max(forge.progress, 0) : 0;
			sites[id] = { index, level, progress };
		}
		this.sites = sites;
		const { tuning } = state;
		this.tuning = typeof tuning === 'number' && tuning >= TUNING.min && tuning <= TUNING.max ? tuning : TUNING_DEFAULT;
		this.identified = [...new Set(state.identified ?? [])].filter(z => this.forged.has(z)).sort((a, b) => a - b);
	}

	private isOpen(id: SiteId): boolean {
		if (!this.unlocked) return false;
		const { object, opensWith } = SITES[id];
		if (object) return cosmosManager.discovered.includes(object);
		if (opensWith) return zs(opensWith).every(z => this.identifiedSet.has(z));
		return true;
	}

	/** `index` and `made` let `tick` read a chain it is advancing before the new state is written. */
	private statusOf(id: SiteId, index = this.forge(id).index, made: number[] = []): SiteStatus {
		if (!this.open.has(id)) return { kind: 'locked' };
		const z = CHAINS[id].steps[index];
		if (z === undefined) return { kind: 'done' };
		const seed = CHAINS[id].seeds[z];
		const missing = seed?.needs.filter(other => !this.forged.has(other) && !made.includes(other)) ?? [];
		const object = seed?.object && !cosmosManager.discovered.includes(seed.object) ? seed.object : null;
		if (missing.length || object) return { kind: 'waiting', missing, object, z };
		return { kind: 'forging', progress: index === this.forge(id).index ? this.forge(id).progress : 0, z };
	}
}

export const periodicManager = new PeriodicManager();
