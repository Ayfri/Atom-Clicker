import { SPECTROSCOPE_ID } from '#data/cosmos.js';
import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
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
import {
	BASE_RATES,
	CHAINS,
	DECAY_EVENTS_PER_SECOND,
	DECAY_SITES,
	FORGE_COST_SECONDS,
	FORGE_MILESTONES,
	MAX_FORGES,
	MAX_UNREAD,
	SITE_IDS,
	siteStudyCost,
	SITES,
	type SiteId,
} from '#data/sites.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { mul } from '#helpers/effects.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import type { EffectSource, EffectStat, PeriodicState, SiteForge } from '#lib/types.js';

/**
 * `forging`, `full` and `waiting` only describe sources holding a forge, an open source without one is `idle` whatever its next element needs.
 * `full` wins over `waiting` because reading is the step the player can take.
 */
export type SiteStatus =
	| { kind: 'done' | 'locked' }
	| { kind: 'forging'; progress: number; z: number }
	| { kind: 'full'; unread: number[]; z: number }
	| { kind: 'idle'; missing: number[]; object: string | null; progress: number; z: number }
	| { kind: 'waiting'; missing: number[]; object: string | null; z: number };

export const TUNING_DEFAULT: number = TUNING.min;

const LIGHT_CURRENCIES = { blue: CurrenciesTypes.BLUE_LIGHT, green: CurrenciesTypes.GREEN_LIGHT, red: CurrenciesTypes.RED_LIGHT } as const;
const LIGHT_COLORS = Object.keys(LIGHT_CURRENCIES) as LightColor[];
/** The reactor forges faster with its power over the ionization line, up to this many times its base rate. */
const MAX_REACTOR_FACTOR = 4;
/** Float sums of per-frame shares land a hair under 1, this much counts as fully paid. `pour` accepts twice as much so a read `canAfford` accepts always completes. */
const PAID_EPSILON = 1e-9;
const FAMILY_MEMBERS = Object.fromEntries(FAMILY_IDS.map(family => [family, ELEMENTS.filter(element => element.family === family).map(element => element.z)]));

/** Everything here is kept through every prestige. */
class PeriodicManager {
	/** Sources holding a forge, only these advance. */
	active = $state.raw<SiteId[]>([]);
	/** Forges owned, the first one is free and `FORGE_MILESTONES` unlock the others. */
	forges = $state(1);
	identified = $state.raw<number[]>([]);
	/** Set once the introduction played, whether the player opened the Table from it or not. */
	introSeen = $state(false);
	/** Counts the saves loaded and the offline catch-ups, so a watcher tells a replaced state from forging that happened. */
	loads = $state(0);
	/** Neutrinos caught, the achievements and the server read it. */
	neutrinos = $state(0);
	/** Share of each ready element's cost already paid. A share, not amounts, so it stays valid when the Prism tuning changes the cost. */
	paid = $state.raw<Partial<Record<number, number>>>({});
	sites = $state.raw<Partial<Record<SiteId, SiteForge>>>({});
	/** Center in nm of the Prism's tuning window, only read once the Prism Tuning upgrade is bought. */
	tuning = $state(TUNING_DEFAULT);

	unlocked = $derived(cosmosManager.unlocked && cosmosManager.instruments.includes(SPECTROSCOPE_ID));

	tuned = $derived(chromaticManager.level('prism_tuning') > 0);

	identifiedSet = $derived(new Set(this.identified));

	activeSet = $derived(new Set(this.active));

	freeForges = $derived(this.forges - this.active.length);

	/** The next forge is buyable once enough elements are identified. */
	nextForgeUnlocked = $derived(this.forges < MAX_FORGES && this.identified.length >= FORGE_MILESTONES[this.forges - 1]);

	/** About `FORGE_COST_SECONDS` of Starlight production right now without the currency boost, never free. */
	forgeCost = $derived(Math.max(1, Math.ceil(cosmosManager.unboostedStarlightPerSecond * FORGE_COST_SECONDS)));

	/** `tick` rewrites `sites` every second for the progress, a key of the chain indices only changes when an element is finished. */
	#chainKey = $derived(SITE_IDS.map(id => this.forge(id).index).join());

	forged = $derived(new Set(this.#chainKey.split(',').flatMap((index, i) => CHAINS[SITE_IDS[i]].steps.slice(0, Number(index)))));

	open = $derived(new Set(SITE_IDS.filter(id => this.isOpen(id))));

	statuses = $derived(Object.fromEntries(SITE_IDS.map(id => [id, this.statusOf(id)])) as Record<SiteId, SiteStatus>);

	ready = $derived(ELEMENTS.filter(element => this.forged.has(element.z) && !this.identifiedSet.has(element.z)).map(element => element.z));

	complete = $derived(this.identified.length === ELEMENT_COUNT);

	/** Identified elements' untuned cost paid back over `LAMP_PAYBACK_SECONDS`. */
	lampLight = $derived.by((): Record<LightColor, number> => {
		const rates: Record<LightColor, number> = { blue: 0, green: 0, red: 0 };
		for (const z of this.identified) {
			const cost = lightCost(ELEMENTS[z - 1]);
			for (const color of LIGHT_COLORS) rates[color] += cost[color] / LAMP_PAYBACK_SECONDS;
		}
		return rates;
	});

	/** Decay events per second, paid by `GameManager.tick` online, `applyOfflineProgress` offline and `GameManager.catchNeutrino`, never by `tick` here. */
	decayEventsPerSecond = $derived(DECAY_SITES.reduce((rate, id) => rate + (this.open.has(id) ? DECAY_EVENTS_PER_SECOND * (1 + this.forge(id).level) : 0), 0));

	/** Whether running the Table ahead pays anything: a source is forging or Decay events are coming in. */
	skippable = $derived(this.decayEventsPerSecond > 0 || Object.values(this.statuses).some(status => status.kind === 'forging'));

	/** One source per family (`1 + step% × members`, ×SET_BONUS when complete) and one for the generator affinities. */
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

	/** The reactor's speed-up at `cpm`, by default the power it runs now. */
	reactorFactor(cpm = radiationManager.currentCpm): number {
		return Math.min(MAX_REACTOR_FACTOR, cpm / radiationManager.ionizeCpm);
	}

	/** `reactor` replaces the live reactor factor, the offline catch-up passes the average over the gap. */
	rateOf(id: SiteId, reactor?: number): number {
		return BASE_RATES[id] * (1 + this.forge(id).level) * (id === 'reactor' ? (reactor ?? this.reactorFactor()) : 1);
	}

	/** `tick` passes the index it is advancing. */
	unreadOf(id: SiteId, index = this.forge(id).index): number[] {
		return CHAINS[id].steps.slice(0, index).filter(z => !this.identifiedSet.has(z));
	}

	etaOf(id: SiteId): number {
		const status = this.statuses[id];
		if (status.kind !== 'forging') return Infinity;
		const rate = this.rateOf(id);
		return rate > 0 ? (ELEMENTS[status.z - 1].need - status.progress) / rate : Infinity;
	}

	/** `null` tuning is the plain cost. */
	costOf(z: number, tuning: number | null = this.tuned ? this.tuning : null): { decay: number; light: Record<LightColor, number> } {
		const element = ELEMENTS[z - 1];
		return { decay: decayCost(element), light: lightCost(element, tuning) };
	}

	/** Whether what is left of the cost is held, the part already paid is not asked again. */
	canAfford(z: number, tuning?: number | null): boolean {
		/** Same tolerance as `pour`, which completes the read, so holding exactly the remainder never fails on float dust. */
		const left = 1 - (this.paid[z] ?? 0) - PAID_EPSILON;
		return this.#parts(z, tuning).every(([name, cost]) => currenciesManager.getAmount(name) >= cost * left);
	}

	/** Whether a hold can start: every currency the reading needs has something in it. */
	canPour(z: number): boolean {
		return this.forged.has(z) && !this.identifiedSet.has(z) && this.#parts(z).every(([name]) => currenciesManager.getAmount(name) > 0);
	}

	setTuning(nm: number) {
		if (Number.isNaN(nm)) return;
		this.tuning = Math.min(Math.max(Math.round(nm), TUNING.min), TUNING.max);
	}

	/** Pays what is left of the reading at once. The `> 0` matters: `canAfford` ignores elements that are not ready. */
	identify(z: number): boolean {
		if (!this.canAfford(z)) return false;
		return this.pour(z, 1) > 0 && this.identifiedSet.has(z);
	}

	/** Pays `fraction` more of every currency of `z` at once, limited by the scarcest one and by what is left, identifies it once fully paid. Returns the share paid. */
	pour(z: number, fraction: number): number {
		if (!this.unlocked || !this.forged.has(z) || this.identifiedSet.has(z) || !(fraction > 0)) return 0;
		const paid = this.paid[z] ?? 0;
		const parts = this.#parts(z);
		const share = Math.min(fraction, 1 - paid, ...parts.map(([name, cost]) => currenciesManager.getAmount(name) / cost));
		if (!(share > 0)) return 0;
		const done = paid + share >= 1 - 2 * PAID_EPSILON;
		for (const [name, cost] of parts) currenciesManager.remove(name, cost * (done ? 1 - paid : share));
		if (done) {
			const rest = { ...this.paid };
			delete rest[z];
			this.paid = rest;
			this.identified = [...this.identified, z].sort((a, b) => a - b);
		} else this.paid = { ...this.paid, [z]: paid + share };
		return share;
	}

	study(id: SiteId): boolean {
		if (!this.open.has(id)) return false;
		const forge = this.forge(id);
		const cost = siteStudyCost(forge.level);
		if (currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < cost) return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, cost);
		this.sites = { ...this.sites, [id]: { ...forge, level: forge.level + 1 } };
		return true;
	}

	/** Puts a forge on an open source. The single forge of a player who has only one follows them, one of several never leaves a busy source on its own. */
	assign(id: SiteId): boolean {
		if (!this.open.has(id) || this.activeSet.has(id) || this.statuses[id].kind === 'done') return false;
		if (this.freeForges > 0) this.active = [...this.active, id];
		else if (this.forges === 1) this.active = [id];
		else return false;
		return true;
	}

	release(id: SiteId): boolean {
		if (!this.activeSet.has(id)) return false;
		this.active = this.active.filter(other => other !== id);
		return true;
	}

	buyForge(): boolean {
		if (!this.nextForgeUnlocked) return false;
		const cost = this.forgeCost;
		if (currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) < cost) return false;
		currenciesManager.remove(CurrenciesTypes.STARLIGHT, cost);
		this.forges++;
		return true;
	}

	/**
	 * Online ticks and offline catch-up both land here, a long gap finishes elements until the source holds `MAX_UNREAD` unread ones, then it stops and the rest of the gap is lost.
	 * A finished chain frees its forge. Returns the elements forged.
	 * Each source runs on its own clock and passes repeat while one finishes an element, so a step waiting on another source starts when that element is made, whatever the order of `active`.
	 * `reactor` is the reactor factor the whole gap runs at, the offline catch-up passes its time-weighted average because the live power is the one at the end of the gap.
	 */
	tick(deltaMs: number, reactor?: number): number[] {
		if (!this.unlocked || !this.active.length) return [];
		const made: number[] = [];
		const madeAt = new Map<number, number>();
		const total = deltaMs / 1000;
		const runs = this.active.map(id => ({ clock: 0, forge: { ...this.forge(id) }, id, rate: this.rateOf(id, reactor) }));
		let progressed = true;
		while (progressed) {
			progressed = false;
			for (const run of runs) {
				const { forge, id, rate } = run;
				while (rate > 0 && run.clock < total) {
					const status = this.statusOf(id, forge.index, made);
					if (status.kind !== 'forging') break;
					const start = Math.max(run.clock, ...(CHAINS[id].seeds[status.z]?.needs ?? []).map(z => madeAt.get(z) ?? 0));
					const left = ELEMENTS[status.z - 1].need - forge.progress;
					const budget = Math.max(0, rate * (total - start));
					run.clock = start;
					if (budget < left) {
						forge.progress += budget;
						run.clock = total;
						break;
					}
					run.clock += left / rate;
					made.push(status.z);
					madeAt.set(status.z, run.clock);
					forge.index++;
					forge.progress = 0;
					progressed = true;
				}
			}
		}
		const finished = new Set(runs.filter(({ forge, id }) => forge.index >= CHAINS[id].steps.length).map(({ id }) => id));
		const moved = runs.filter(({ forge, id }) => forge.index !== this.forge(id).index || forge.progress !== this.forge(id).progress);
		if (moved.length) this.sites = { ...this.sites, ...Object.fromEntries(moved.map(({ forge, id }) => [id, forge])) };
		if (finished.size) this.active = this.active.filter(id => !finished.has(id));
		return made;
	}

	getState(): PeriodicState {
		return {
			active: this.active,
			forges: this.forges,
			identified: this.identified,
			introSeen: this.introSeen,
			neutrinos: this.neutrinos,
			paid: this.paid,
			sites: this.sites,
			tuning: this.tuning,
		};
	}

	/**
	 * Drops unknown sites and Z from a tampered or future save, identified elements the chain never forged, paid shares that are not a part of a ready element's cost,
	 * and forges on sources that are closed, finished or beyond the forges owned.
	 */
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
		this.paid = Object.fromEntries(
			Object.entries(state.paid ?? {})
				.map(([z, share]) => [Number(z), share] as const)
				.filter(([z, share]) => this.forged.has(z) && !this.identifiedSet.has(z) && typeof share === 'number' && share > 0 && share < 1),
		);
		this.introSeen = state.introSeen === true;
		const caught = state.neutrinos ?? 0;
		this.neutrinos = Number.isSafeInteger(caught) && caught > 0 ? caught : 0;
		const { active, forges } = state;
		this.forges = typeof forges === 'number' && Number.isInteger(forges) ? Math.min(Math.max(forges, 1), MAX_FORGES) : 1;
		/** The Table's lock depends on the Ionize count, which loads after it: only what the sources themselves ask for is checked here. */
		this.active = [...new Set(Array.isArray(active) ? active : [])]
			.filter(id => SITE_IDS.includes(id) && this.meetsGate(id) && this.forge(id).index < CHAINS[id].steps.length)
			.slice(0, this.forges);
		this.loads++;
	}

	/** Currencies a reading spends with their full cost, `undefined` tuning keeps `costOf`'s default. */
	#parts(z: number, tuning?: number | null): [CurrencyName, number][] {
		const { decay, light } = this.costOf(z, tuning);
		const parts: [CurrencyName, number][] = [[CurrenciesTypes.DECAY_EVENTS, decay], ...LIGHT_COLORS.map((color): [CurrencyName, number] => [LIGHT_CURRENCIES[color], light[color]])];
		return parts.filter(([, cost]) => cost > 0);
	}

	private isOpen(id: SiteId): boolean {
		return this.unlocked && this.meetsGate(id);
	}

	/** The discovery or the identified elements that open a source, without the Table's own lock. */
	private meetsGate(id: SiteId): boolean {
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
		const progress = index === this.forge(id).index ? this.forge(id).progress : 0;
		if (!this.activeSet.has(id)) return { kind: 'idle', missing, object, progress, z };
		const unread = this.unreadOf(id, index);
		if (unread.length >= MAX_UNREAD) return { kind: 'full', unread, z };
		if (missing.length || object) return { kind: 'waiting', missing, object, z };
		return { kind: 'forging', progress, z };
	}
}

export const periodicManager = new PeriodicManager();
