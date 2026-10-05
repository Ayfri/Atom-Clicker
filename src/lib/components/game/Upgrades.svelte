<script lang="ts">
	import {CURRENCIES, CurrenciesTypes, type CurrencyName} from '#data/currencies.js';
	import { AmbientField } from '#helpers/AmbientField.js';
	import { AtomRenderer } from '#helpers/AtomRenderer.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { UPGRADES, boostTiersUnlockedByNextProtonise } from '#data/upgrades.js';
	import { ICONS } from '#data/icons.js';
	import { RealmTypes } from '#data/realms.js';
	import type { Upgrade } from '#lib/types.js';
	import AutoButton from '#components/ui/AutoButton.svelte';
	import Currency from '#components/ui/Currency.svelte';
	import Value from '#components/ui/Value.svelte';
	import { reveal, reveals } from '#helpers/reveals.svelte.js';
	import { autoUpgradeManager } from '#stores/autoUpgrade.svelte.js';
	import { clock } from '#stores/clock.svelte.js';
	import CurrencyLabel from '#components/ui/CurrencyLabel.svelte';
	import HelpIcon from '#components/ui/HelpIcon.svelte';
	import Tabs from '#components/ui/Tabs.svelte';
	import { fly, scale } from 'svelte/transition';
	import { Eye, EyeOff } from '@lucide/svelte';

	let selectedCurrency: CurrencyName = $state(CurrenciesTypes.ATOMS);

	const hasProtonUpgrades = $derived(gameManager.upgrades.some(id => id.startsWith('proton')));
	const showProtons = $derived(gameManager.protons > 0 || gameManager.totalProtonisesAllTime > 0 || hasProtonUpgrades);

	const hasElectronUpgrades = $derived(gameManager.upgrades.some(id => id.startsWith('electron')));
	const showElectrons = $derived(gameManager.electrons > 0 || gameManager.totalElectronizesAllTime > 0 || hasElectronUpgrades);

	const currencyTabs = $derived(
		[CurrenciesTypes.ATOMS, ...(showProtons ? [CurrenciesTypes.PROTONS] : []), ...(showElectrons ? [CurrenciesTypes.ELECTRONS] : [])].map(id => ({ id, title: CURRENCIES[id].name })),
	);

	const boughtUpgrades = $derived(new Set(gameManager.upgrades));

	const availableUpgrades = $derived.by(() => {
		return Object.values(UPGRADES)
			.filter((upgrade) => {
				const condition = upgrade.condition?.(gameManager) ?? true;
				const notPurchased = !boughtUpgrades.has(upgrade.id);
				const matchesCurrency = upgrade.cost.currency === selectedCurrency;
				const shouldDisplay = gameManager.settings.upgrades.displayAlreadyBought || notPurchased;
				return condition && shouldDisplay && matchesCurrency;
			})
			.sort((a, b) => {
				const aBought = boughtUpgrades.has(a.id);
				const bBought = boughtUpgrades.has(b.id);
				if (aBought !== bBought) return aBought ? 1 : -1;
				return a.cost.amount - b.cost.amount;
			});
	});

	let hasAutomation = $derived(gameManager.effects.has('auto_upgrade'));

	const gatedBoostTiers = $derived(selectedCurrency === CurrenciesTypes.ATOMS ? boostTiersUnlockedByNextProtonise(gameManager) : 0);

	const affordableCount = $derived(availableUpgrades.filter(upgrade => !boughtUpgrades.has(upgrade.id) && gameManager.canAfford(upgrade.cost)).length);

	function buyAll(event: MouseEvent) {
		// availableUpgrades is sorted cheapest first, so this drains the balance into as many upgrades as possible.
		let bought = 0;
		for (const upgrade of availableUpgrades) if (gameManager.purchaseUpgrade(upgrade.id)) bought++;
		const nucleus = AtomRenderer.current?.target();
		if (bought > 0) {
			AmbientField.emit(RealmTypes.ATOMS, 'bloom', event, {
				color: CURRENCIES[selectedCurrency].color,
				count: 10 + Math.min(14, bought),
				surge: Math.min(20, 4 + bought * 2),
				// One comet per upgrade bought, streaming into the nucleus.
				target: nucleus && Array.from({ length: Math.min(10, bought) }, () => nucleus),
			});
		}
	}

	function buy(upgrade: Upgrade, event: MouseEvent) {
		if (!gameManager.purchaseUpgrade(upgrade.id)) return;
		// Upgrades boost the whole atom, so the comet lands on the nucleus.
		AmbientField.emit(RealmTypes.ATOMS, 'bloom', event, { color: CURRENCIES[upgrade.cost.currency].color, surge: 6, target: AtomRenderer.current?.target() });
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
				{#if reveals.boughtUpgradesToggle}
					<button
						class="flex items-center justify-center p-1 rounded-md transition-all duration-200 border {gameManager.settings.upgrades.displayAlreadyBought ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25' : 'bg-transparent text-gray-400 border-white/10 hover:bg-white/5'}"
						in:reveal={{ y: 0 }}
						onclick={() => gameManager.settings.upgrades.displayAlreadyBought = !gameManager.settings.upgrades.displayAlreadyBought}
						title={gameManager.settings.upgrades.displayAlreadyBought ? 'Hide bought upgrades' : 'Show bought upgrades'}
					>
						{#if gameManager.settings.upgrades.displayAlreadyBought}
							<Eye size={18} />
						{:else}
							<EyeOff size={18} />
						{/if}
					</button>
				{/if}
				{#if hasAutomation}
					{#snippet autoUpgradeTooltip()}
						<div class="flex flex-col gap-1">
							<p class="text-xs text-white/80">Automatically buys the cheapest affordable upgrade.</p>
							{#if gameManager.settings.automation.upgrades && gameManager.autoUpgradeInterval}
								<p class="text-xs text-white/60">
									Checks every {(gameManager.autoUpgradeInterval / 1000).toFixed(1)}s
									{#if autoUpgradeManager.nextFireTime}
										- next in {Math.max(0, (autoUpgradeManager.nextFireTime - clock.now) / 1000).toFixed(1)}s
									{/if}
								</p>
							{/if}
						</div>
					{/snippet}
					<AutoButton
						onClick={(e) => {
							e.stopPropagation();
							gameManager.toggleUpgradeAutomation();
						}}
						toggled={gameManager.settings.automation.upgrades}
						tooltipContent={autoUpgradeTooltip}
					/>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex items-center gap-1">
		<Tabs accent={CURRENCIES[selectedCurrency].color} buttonClass="p-1.5" onselect={currency => (selectedCurrency = currency)} selected={selectedCurrency} tabs={currencyTabs}>
			{#snippet item(tab)}
				<Currency name={tab.id} />
			{/snippet}
		</Tabs>
		{#if affordableCount > 3}
			<button
				class="ml-auto rounded-lg border border-accent-500/30 bg-accent-500/15 px-2 py-1 text-xs font-semibold text-accent-400 transition-all duration-200 hover:bg-accent-500/25 cursor-pointer"
				onclick={buyAll}
				title="Buy every affordable upgrade, cheapest first"
			>
				Buy all ({affordableCount})
			</button>
		{/if}
	</div>

	<div id="upgrades-list" class="flex-1 lg:overflow-y-auto px-1 custom-scrollbar">
		<div class="grid gap-1.5">
			{#each availableUpgrades as upgrade (upgrade.id)}
				{const isBought = $derived(boughtUpgrades.has(upgrade.id))}
				{const affordable = $derived(gameManager.canAfford(upgrade.cost) && !isBought)}
				{const wasAutoPurchased = $derived(autoUpgradeManager.recentlyAutoPurchased.has(upgrade.id))}
				{const Icon = $derived(upgrade.icon ? ICONS[upgrade.icon] : null)}
				<button
					class="relative text-start rounded-lg p-2 transition-all duration-200 border
					{isBought
						? 'bg-green-300/3 cursor-default'
						: `bg-white/5 hover:bg-white/10 cursor-pointer ${affordable ? 'opacity-100 border-white/10' : 'opacity-45 cursor-not-allowed border-transparent'}`
					}"
					onclick={event => {
						if (affordable && !isBought) buy(upgrade, event);
					}}
					disabled={isBought}
				>
					{#if wasAutoPurchased}
						<div
							class="absolute top-1 right-1 bg-linear-to-br from-green-500 to-green-700 text-white font-bold text-xs px-1.5 py-0.5 rounded shadow-lg shadow-green-500/40 z-10 pointer-events-none"
							in:scale={{ duration: 200, start: 0.3 }}
							out:fly={{ y: -30, duration: 500, opacity: 0 }}
						>
							+1
						</div>
					{/if}
					<h3 class="text-blue-400 text-sm flex items-center gap-2">
						{#if Icon}
							<Icon size={14} color="currentColor" />
						{/if}
						{upgrade.name}
						{#if isBought}
							<span class="text-[10px] uppercase font-bold text-white/50 bg-white/10 px-1 rounded-sm">Bought</span>
						{/if}
					</h3>
					<p class="text-xs my-0.5">{upgrade.description}</p>
					<div class="text-xs mt-1" style="color: {CURRENCIES[upgrade.cost.currency].color}">
						{#if !isBought}
							Cost: <Value value={upgrade.cost.amount} currency={upgrade.cost.currency}/>
						{/if}
					</div>
				</button>
			{/each}
			{#if gatedBoostTiers > 0}
				<p class="rounded-lg border border-dashed border-white/10 p-2 text-center text-xs text-white/50">
					{gatedBoostTiers} more Boost tiers unlock after your next Protonize
				</p>
			{/if}
		</div>
	</div>
</div>
