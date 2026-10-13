<script lang="ts">
	import UpgradeTrack from '#components/game/UpgradeTrack.svelte';
	import AutoButton from '#components/ui/AutoButton.svelte';
	import Currency from '#components/ui/Currency.svelte';
	import CurrencyLabel from '#components/ui/CurrencyLabel.svelte';
	import HelpIcon from '#components/ui/HelpIcon.svelte';
	import Tabs from '#components/ui/Tabs.svelte';
	import { CURRENCIES, CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
	import { RealmTypes } from '#data/realms.js';
	import type { UpgradeCategory } from '#data/upgrades.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { type FamilyView, upgradeFamilies } from '#helpers/UpgradeFamilies.svelte.js';
	import { bloomPurchase, buyAllFamilies } from '#helpers/upgradeFx.js';
	import { autoUpgradeManager } from '#stores/autoUpgrade.svelte.js';
	import { Bot, ChevronDown, Factory, MousePointerClick, ShieldCheck, TrendingUp, Wrench, Zap } from '@lucide/svelte';

	const CATEGORY_ICONS = {
		Automation: Bot,
		Click: MousePointerClick,
		Electrons: Zap,
		Generators: Factory,
		Production: TrendingUp,
		'Stability Field': ShieldCheck,
		Utility: Wrench,
	} as const satisfies Record<UpgradeCategory, typeof Factory>;

	let selectedCurrency: CurrencyName = $state(CurrenciesTypes.ATOMS);
	/** A currency's list is built the first time its tab opens, then kept so switching back never remounts it. */
	let visited: CurrencyName[] = $state([CurrenciesTypes.ATOMS]);
	/** Keyed `currency:category`, a section the player folded. */
	let collapsed: Record<string, boolean> = $state({});

	const hasProtonUpgrades = $derived(gameManager.upgrades.some(id => id.startsWith('proton')));
	const showProtons = $derived(gameManager.protons > 0 || gameManager.totalProtonisesAllTime > 0 || hasProtonUpgrades);

	const hasElectronUpgrades = $derived(gameManager.upgrades.some(id => id.startsWith('electron')));
	const showElectrons = $derived(gameManager.electrons > 0 || gameManager.totalElectronizesAllTime > 0 || hasElectronUpgrades);

	const currencyTabs = $derived(
		[CurrenciesTypes.ATOMS, ...(showProtons ? [CurrenciesTypes.PROTONS] : []), ...(showElectrons ? [CurrenciesTypes.ELECTRONS] : [])].map(id => ({ id, title: CURRENCIES[id].name })),
	);

	const hasAutomation = $derived(gameManager.effects.has('auto_upgrade'));

	const affordableCount = $derived(realmManager.live(RealmTypes.ATOMS, () => upgradeFamilies.affordableCount(selectedCurrency)));

	/** Levels the auto-upgrade bought in the last seconds, by family. */
	const autoBought = $derived.by(() => {
		const counts = new Map<FamilyView, number>();
		for (const id of autoUpgradeManager.recentlyAutoPurchased) {
			const view = upgradeFamilies.byUpgrade.get(id);
			if (view) counts.set(view, (counts.get(view) ?? 0) + 1);
		}
		return counts;
	});

	let list = $state<HTMLDivElement>();
	let seenAuto = new Map<FamilyView, number>();

	/**
	 * Levels the auto-upgrade buys bloom like a click: from their row, clamped into the visible part of the list when it is
	 * scrolled away, or from the top of the list when the row sits in a folded section or another currency tab.
	 */
	$effect(() => {
		const counts = autoBought;
		const previous = seenAuto;
		seenAuto = counts;
		/** Counts also drop as purchases age out, those changes must not touch the layout. */
		const gains: [FamilyView, number][] = [];
		for (const [view, count] of counts) {
			const bought = count - (previous.get(view) ?? 0);
			if (bought > 0) gains.push([view, bought]);
		}
		if (gains.length === 0 || !list?.checkVisibility()) return;

		const bounds = list.getBoundingClientRect();
		const top = Math.max(bounds.top, 0) + 16;
		const bottom = Math.min(bounds.bottom, window.innerHeight) - 16;
		if (bottom <= top) return;
		const x = bounds.left + bounds.width / 2;
		for (const [view, bought] of gains) {
			const row = list.querySelector(`[data-family="${view.family.id}"]`);
			const box = row?.checkVisibility() ? row.getBoundingClientRect() : null;
			const y = box ? Math.min(Math.max(box.top + box.height / 2, top), bottom) : top;
			bloomPurchase({ x, y }, view.family.currency, bought);
		}
	});

	function select(currency: CurrencyName) {
		selectedCurrency = currency;
		if (!visited.includes(currency)) visited.push(currency);
	}
</script>

<div id="upgrades" class="bg-black/10 backdrop-blur-xs rounded-lg p-3 flex flex-col gap-2 lg:h-[calc(100dvh-204px)]">
	<div class="header flex justify-between items-center gap-2">
		<div class="flex items-center gap-2 justify-between w-full">
			<div class="flex items-center gap-1.5">
				<h2 class="text-lg">Upgrades</h2>
				<HelpIcon position="bottom">
					{#snippet content()}
						<p class="text-xs text-white/80">
							Upgrades permanently boost your production, click power, or unlock new mechanics. Switch between currencies using the
							tabs below to see upgrades bought with <CurrencyLabel name={CurrenciesTypes.PROTONS} /> or
							<CurrencyLabel name={CurrenciesTypes.ELECTRONS} />.
						</p>
					{/snippet}
				</HelpIcon>
			</div>
			<div class="flex items-center gap-1">
				{#if hasAutomation}
					<AutoButton
						description="Automatically buys the cheapest affordable upgrade."
						interval={gameManager.autoUpgradeInterval}
						nextFire={autoUpgradeManager.nextFireTime}
						onClick={(e) => {
							e.stopPropagation();
							gameManager.toggleUpgradeAutomation();
						}}
						toggled={gameManager.settings.automation.upgrades}
					/>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex items-center gap-1">
		<Tabs accent={CURRENCIES[selectedCurrency].color} buttonClass="p-1.5" onselect={select} selected={selectedCurrency} tabs={currencyTabs}>
			{#snippet item(tab)}
				<Currency name={tab.id} />
			{/snippet}
		</Tabs>
		{#if affordableCount > 1}
			<button
				class="ml-auto rounded-lg border border-accent-500/30 bg-accent-500/15 px-2 py-1 text-xs font-semibold text-accent-400 transition-all duration-200 hover:bg-accent-500/25 cursor-pointer"
				onclick={event => buyAllFamilies(selectedCurrency, event)}
				title="Buy every affordable level of these upgrades, cheapest first"
			>
				Buy all ({affordableCount})
			</button>
		{/if}
	</div>

	<div bind:this={list} id="upgrades-list" class="flex-1 lg:overflow-y-auto px-1 custom-scrollbar">
		{#each visited as currency (currency)}
			<div class={['flex flex-col gap-3', currency !== selectedCurrency && 'hidden']}>
				{#each upgradeFamilies.categories(currency) as group (group.category)}
					{@const key = `${currency}:${group.category}`}
					{@const open = !collapsed[key]}
					{@const Icon = CATEGORY_ICONS[group.category]}
					<section class="flex flex-col gap-1.5">
						<button
							aria-expanded={open}
							class="-mb-2 flex min-h-10 cursor-pointer items-center gap-1.5 text-start text-[11px] font-semibold tracking-wider text-white/60 uppercase"
							onclick={() => (collapsed[key] = open)}
							type="button"
						>
							<Icon class="text-accent-400" size={14} />
							{group.category}
							<span class="h-px flex-1 bg-white/10"></span>
							<ChevronDown class="transition-transform {open ? '' : '-rotate-90'}" size={14} />
						</button>
						{#if open}
							{#each group.views as view (view.family.id)}
								<UpgradeTrack auto={autoBought.get(view) ?? 0} {view} />
							{/each}
						{/if}
					</section>
				{:else}
					<p class="p-4 text-center text-xs text-white/40">Nothing to buy with {CURRENCIES[currency].name} yet.</p>
				{/each}
			</div>
		{/each}
	</div>
</div>
