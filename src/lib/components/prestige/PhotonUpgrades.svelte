<script lang="ts">
	import { PHOTON_UPGRADES, EXCITED_PHOTON_UPGRADES } from '#data/photonUpgrades.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
	import { photonUpgradesTab } from '#stores/photonUpgradesTab.svelte.js';
	import Currency from '#components/ui/Currency.svelte';
	import CurrencyLabel from '#components/ui/CurrencyLabel.svelte';
	import HelpIcon from '#components/ui/HelpIcon.svelte';
	import Tabs from '#components/ui/Tabs.svelte';
	import PhotonUpgradeItem from './PhotonUpgradeItem.svelte';
	import PrismUpgrades from './PrismUpgrades.svelte';
	import { Eye, EyeOff, Triangle } from '@lucide/svelte';

	const selectedCurrency = $derived(photonUpgradesTab.selected);

	const availableUpgrades = $derived.by(() => {
		const upgrades = selectedCurrency === CurrenciesTypes.EXCITED_PHOTONS ? EXCITED_PHOTON_UPGRADES : PHOTON_UPGRADES;
		return Object.values(upgrades).filter(upgrade => {
			const currentLevel = gameManager.photonUpgrades[upgrade.id] || 0;
			const hasLevelsRemaining = currentLevel < upgrade.maxLevel;
			const meetsCondition = !upgrade.condition || upgrade.condition(gameManager);
			return (hasLevelsRemaining || gameManager.settings.upgrades.displayAlreadyBought) && meetsCondition;
		}).sort((a, b) => {
			const aMaxed = (gameManager.photonUpgrades[a.id] || 0) >= a.maxLevel;
			const bMaxed = (gameManager.photonUpgrades[b.id] || 0) >= b.maxLevel;
			if (aMaxed !== bMaxed) return aMaxed ? 1 : -1;
			return a.baseCost - b.baseCost;
		});
	});

	const showExcitedTab = $derived(gameManager.currencies[CurrenciesTypes.EXCITED_PHOTONS].earnedAllTime > 0);
	const showPrismTab = $derived(gameManager.totalIonizesAllTime > 0);
</script>

<div id="photon-upgrades" class="bg-black/10 backdrop-blur-xs rounded-lg p-3 flex flex-col gap-2 lg:h-[calc(100dvh-150px)]">
	<div class="header flex justify-between items-center gap-2">
		<div class="flex items-center gap-1.5">
			<h2 class="text-sm lg:text-base text-realm-400">Photon Upgrades</h2>
			<HelpIcon position="bottom">
				{#snippet content()}
					<p class="text-xs text-white/80">
						Spend <CurrencyLabel name={CurrenciesTypes.PHOTONS} /> on repeatable upgrades.
						{#if showExcitedTab}
							Rare <CurrencyLabel name={CurrenciesTypes.EXCITED_PHOTONS} /> unlock a separate tab with stronger effects.
						{/if}
						{#if showPrismTab}
							The Prism tab spends the Light of colored photons.
						{/if}
					</p>
				{/snippet}
			</HelpIcon>
		</div>
		<button
			class="flex items-center justify-center p-1 rounded-md transition-all duration-200 border {gameManager.settings.upgrades.displayAlreadyBought ? 'bg-realm-500/15 text-realm-400 border-realm-500/30 hover:bg-realm-500/25' : 'bg-transparent text-gray-400 border-white/10 hover:bg-white/5'}"
			onclick={() => gameManager.settings.upgrades.displayAlreadyBought = !gameManager.settings.upgrades.displayAlreadyBought}
			title={gameManager.settings.upgrades.displayAlreadyBought ? 'Hide bought upgrades' : 'Show bought upgrades'}
		>
			{#if gameManager.settings.upgrades.displayAlreadyBought}
				<Eye size={18} />
			{:else}
				<EyeOff size={18} />
			{/if}
		</button>
	</div>

	<Tabs
		accent={selectedCurrency === 'prism' ? 'var(--color-realm-200)' : CURRENCIES[selectedCurrency].color}
		buttonClass="p-1.5"
		class="mb-1 self-start"
		onselect={tab => (photonUpgradesTab.selected = tab)}
		selected={selectedCurrency}
		tabs={[
			{ id: CurrenciesTypes.PHOTONS, title: CURRENCIES[CurrenciesTypes.PHOTONS].name },
			...(showExcitedTab ? [{ hint: 'excited-photons-tab', id: CurrenciesTypes.EXCITED_PHOTONS, title: CURRENCIES[CurrenciesTypes.EXCITED_PHOTONS].name }] : []),
			...(showPrismTab ? [{ hint: 'prism-tab', id: 'prism' as const, title: 'Prism' }] : []),
		]}
	>
		{#snippet item(tab)}
			{#if tab.id === 'prism'}
				<Triangle class="text-realm-200" size={18} />
			{:else}
				<Currency name={tab.id} />
			{/if}
		{/snippet}
	</Tabs>

	<div class="flex-1 lg:overflow-y-auto px-1 custom-scrollbar">
		{#if selectedCurrency === 'prism'}
			<PrismUpgrades />
		{:else}
			<div class="grid gap-2">
				{#each availableUpgrades as upgrade (upgrade.id)}
					<PhotonUpgradeItem
						{upgrade}
						currency={selectedCurrency}
						isExcited={selectedCurrency === CurrenciesTypes.EXCITED_PHOTONS}
					/>
				{/each}

				{#if availableUpgrades.length === 0}
					<div class="text-center py-4 text-realm-400/60 text-sm">
						All upgrades maxed out!
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
