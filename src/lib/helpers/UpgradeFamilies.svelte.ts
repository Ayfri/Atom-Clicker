import type { CurrencyName } from '#data/currencies.js';
import { GENERATORS, type GeneratorType } from '#data/generators.js';
import type { IconName } from '#data/iconNames.js';
import { UPGRADE_CATEGORIES, UPGRADES, type UpgradeCategory } from '#data/upgrades.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { effectAmount } from '#helpers/effects.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import type { EffectStat, Upgrade } from '#lib/types.js';
import { formatNumber } from '#lib/utils.js';

/** Totals of `add` effects, a stat missing here never shows a total. */
const ADD_TOTALS: Partial<Record<EffectStat, (value: number) => string>> = {
	auto_click: value => `+${formatNumber(value)} auto clicks per second`,
	auto_upgrade: value => `${formatNumber(value / 1000)}s auto-upgrade interval`,
	click: value => `+${formatNumber(value)} base value per click`,
	click_aps: value => `+${formatNumber(value * 100)}% of your Atoms per second per click`,
	electron_gain: value => `+${formatNumber(value)} electrons from Electronize`,
	stability_boost: value => `+${formatNumber(value * 100)}% Stability Field bonus`,
	stability_capacity: value => `×${formatNumber(1 + value)} Stability Field max bonus`,
	stability_speed: value => `+${formatNumber(value * 100)}% Stability Field speed`,
	start_atoms: value => `+${formatNumber(value)} atoms after a Protonize`,
};

/** What `mul` and `sum` effects multiply, a stat missing here never shows a total. */
const MUL_LABELS: Partial<Record<EffectStat, string>> = {
	chromatic_damage: 'colored photon damage',
	click: 'click power',
	electron_gain: 'electrons from Electronize',
	global: 'production',
	power_up_duration: 'power-up duration',
	power_up_interval: 'power-up interval',
	proton_gain: 'protons from Protonize',
};

interface Total {
	kind: 'add' | 'mul' | 'sum';
	stat: EffectStat;
	target?: GeneratorType;
	value: number;
}

function totalText({ kind, stat, target, value }: Total): string | null {
	if (kind === 'add') return ADD_TOTALS[stat]?.(value) ?? null;
	const label = stat === 'generator' && target ? `${GENERATORS[target].name} production` : MUL_LABELS[stat];
	if (!label) return null;
	return kind === 'mul' ? `×${formatNumber(value)} ${label}` : `+${formatNumber(value * 100)}% ${label}`;
}

/** The tiers of `UPGRADES` that share a `family`, one row of the panel. Ids and saves are untouched. */
interface Family {
	category: UpgradeCategory;
	currency: CurrencyName;
	icon: IconName;
	id: string;
	name: string;
	tiers: readonly Upgrade[];
}

interface UpgradeGroup {
	category: UpgradeCategory;
	views: FamilyView[];
}

function buildFamilies(): Family[] {
	const groups = new Map<string, Upgrade[]>();
	for (const upgrade of Object.values(UPGRADES)) {
		const key = upgrade.family ?? upgrade.id;
		const tiers = groups.get(key);
		if (tiers) tiers.push(upgrade);
		else groups.set(key, [upgrade]);
	}

	return [...groups].map(([id, tiers]) => ({
		category: tiers[0].category,
		currency: tiers[0].cost.currency,
		icon: tiers[0].icon ?? 'upgrade',
		id,
		name: tiers[0].familyName ?? tiers[0].name,
		tiers,
	}));
}

const FAMILIES: readonly Family[] = buildFamilies();

/** Per-family reactive state, so a purchase only touches the row of its own family. */
export class FamilyView {
	readonly family: Family;
	readonly max: number;
	private readonly gated: boolean;
	private readonly owned: () => ReadonlySet<string>;

	private readonly unbought = $derived.by(() => this.family.tiers.filter(tier => !this.owned().has(tier.id)));

	level = $derived.by(() => this.max - this.unbought.length);
	maxed = $derived.by(() => this.level === this.max);

	/** Tiers before this index pass their gate, a family without gates is open all the way. */
	open = $derived.by(() => {
		if (!this.gated) return this.max;
		const closed = this.family.tiers.findIndex(tier => tier.gate && !tier.gate.open(gameManager));
		return closed < 0 ? this.max : closed;
	});

	/** Segments of the bar: the open levels, plus any bought level that a gate closed since. */
	shown = $derived(Math.max(this.open, this.level));

	next = $derived<Upgrade | null>(this.unbought.find(tier => tier.condition?.(gameManager) ?? true) ?? null);
	nextCost = $derived(this.next?.cost.amount ?? Infinity);
	affordable = $derived(this.next !== null && gameManager.canAfford(this.next.cost));
	visible = $derived(this.level > 0 || this.next !== null);

	/** What stops the track, only once every open level is bought. */
	lockReason = $derived.by(() => (this.level >= this.open && this.open < this.max ? (this.family.tiers[this.open].gate?.reason(gameManager) ?? null) : null));

	preview = $derived.by(() => this.next ?? this.unbought[0] ?? this.family.tiers[this.max - 1]);

	/**
	 * What the owned levels give together right now, one line per stat. Empty for a single level with constant effects, its description
	 * already says it all. A family's `sum` effects share one reader, so they add up as a percent.
	 * @example ['×248.83K click power'] for a maxed Click Power
	 */
	totals = $derived.by(() => {
		const effects = this.family.tiers.filter(tier => this.owned().has(tier.id)).flatMap(tier => tier.effects);
		if (this.max === 1 && effects.every(effect => effect.kind !== 'sum' && typeof effect.amount === 'number')) return [];
		const totals = new Map<string, Total>();
		for (const effect of effects) {
			const target = effect.kind === 'sum' ? undefined : effect.target;
			const key = `${effect.stat}:${target}:${effect.kind}`;
			const amount = effectAmount(effect, gameManager);
			const total = totals.get(key);
			if (!total) totals.set(key, { kind: effect.kind, stat: effect.stat, target, value: amount });
			else total.value = effect.kind === 'mul' ? total.value * amount : total.value + amount;
		}
		/** Some descriptions already count every level (Field Strength), their total would only repeat them. */
		return [...totals.values()].map(totalText).filter(text => text !== null && text !== this.preview.description);
	});

	/** Running totals of the unbought open tiers, what buying them in a row costs. */
	private readonly costs = $derived.by(() => {
		const owned = this.owned();
		const totals: number[] = [];
		let total = 0;
		for (let i = 0; i < this.open; i++) {
			const tier = this.family.tiers[i];
			if (owned.has(tier.id)) continue;
			total += tier.cost.amount;
			totals.push(total);
		}
		return totals;
	});

	/** How many levels the balance pays for in a row, a binary search over `costs`. */
	affordableTiers = $derived.by(() => {
		if (!this.affordable) return 0;
		const amount = currenciesManager.getAmount(this.family.currency);
		let low = 0;
		let high = this.costs.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (this.costs[middle] <= amount) low = middle + 1;
			else high = middle;
		}
		return low;
	});

	constructor(family: Family, owned: () => ReadonlySet<string>) {
		this.family = family;
		this.gated = family.tiers.some(tier => tier.gate);
		this.max = family.tiers.length;
		this.owned = owned;
	}
}

class UpgradeFamilies {
	readonly byUpgrade: ReadonlyMap<string, FamilyView>;
	readonly views: readonly FamilyView[];

	private readonly owned = $derived(new Set(gameManager.upgrades));

	constructor() {
		this.views = FAMILIES.map(family => new FamilyView(family, () => this.owned));
		this.byUpgrade = new Map(this.views.flatMap(view => view.family.tiers.map((tier): [string, FamilyView] => [tier.id, view])));
	}

	affordableCount(currency: CurrencyName): number {
		return this.views.filter(view => view.family.currency === currency && view.affordable).length;
	}

	/** Buys every affordable upgrade of `currency` the way auto-upgrade does, cheapest first. Returns the number bought. */
	buyAll(currency: CurrencyName): number {
		return gameManager.purchaseAffordableUpgrades(currency).length;
	}

	buyMax(view: FamilyView): number {
		let bought = 0;
		while (this.buyNext(view)) bought++;
		return bought;
	}

	buyNext(view: FamilyView): boolean {
		return view.next !== null && gameManager.purchaseUpgrade(view.next.id);
	}

	/** Visible families minus `hidden` ids, in category order then data order: nothing moves when bought, affordable or maxed. */
	categories(currency: CurrencyName, hidden: ReadonlySet<string>): UpgradeGroup[] {
		const visible = this.views.filter(view => view.family.currency === currency && view.visible && !hidden.has(view.family.id));
		return UPGRADE_CATEGORIES.flatMap(category => {
			const views = visible.filter(view => view.family.category === category);
			return views.length > 0 ? [{ category, views }] : [];
		});
	}
}

export const upgradeFamilies = new UpgradeFamilies();
