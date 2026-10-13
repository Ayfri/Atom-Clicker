import type { CurrencyName } from '#data/currencies.js';
import type { IconName } from '#data/icons.js';
import { UPGRADE_CATEGORIES, UPGRADES, type UpgradeCategory } from '#data/upgrades.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import type { Upgrade } from '#lib/types.js';

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

	/** Visible families in category order, then data order: nothing moves when bought, affordable or maxed. */
	categories(currency: CurrencyName): UpgradeGroup[] {
		const visible = this.views.filter(view => view.family.currency === currency && view.visible);
		return UPGRADE_CATEGORIES.flatMap(category => {
			const views = visible.filter(view => view.family.category === category);
			return views.length > 0 ? [{ category, views }] : [];
		});
	}
}

export const upgradeFamilies = new UpgradeFamilies();
