<script lang="ts">
	import { PHOTON_UPGRADES, EXCITED_PHOTON_UPGRADES } from '$data/photonUpgrades';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { reveal } from '$helpers/reveals.svelte';
	import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
	import { photonUpgradesTab } from '$stores/photonUpgradesTab.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import CurrencyLabel from '@components/ui/CurrencyLabel.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import PhotonUpgradeItem from './PhotonUpgradeItem.svelte';
	import { Eye, EyeOff } from '@lucide/svelte';

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
</script>

<div id="photon-upgrades" class="bg-black/10 backdrop-blur-xs rounded-lg p-3 flex flex-col gap-2 h-150 lg:h-[calc(100vh-180px)]">
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

	<div class="currency-tabs flex gap-1 mb-1">
		<button
			class="currency-tab flex items-center bg-white/5 border-none rounded-lg cursor-pointer p-2 transition-all duration-200 hover:bg-white/10 active:bg-white/15 active:shadow-[0_0_10px_rgba(255,255,255,0.1)]"
			class:active={selectedCurrency === CurrenciesTypes.PHOTONS}
			onclick={() => photonUpgradesTab.selected = CurrenciesTypes.PHOTONS}
			title={CURRENCIES[CurrenciesTypes.PHOTONS].name}
		>
			<Currency name={CurrenciesTypes.PHOTONS} />
		</button>
		{#if showExcitedTab}
			<button
				class="currency-tab flex items-center bg-white/5 border-none rounded-lg cursor-pointer p-2 transition-all duration-200 hover:bg-white/10 active:bg-white/15 active:shadow-[0_0_10px_rgba(255,255,255,0.1)]"
				class:active={selectedCurrency === CurrenciesTypes.EXCITED_PHOTONS}
				data-hint="excited-photons-tab"
				in:reveal={{ y: 0 }}
				onclick={() => photonUpgradesTab.selected = CurrenciesTypes.EXCITED_PHOTONS}
				title={CURRENCIES[CurrenciesTypes.EXCITED_PHOTONS].name}
			>
				<Currency name={CurrenciesTypes.EXCITED_PHOTONS} />
			</button>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto px-1 custom-scrollbar">
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
	</div>
</div>

<style>
	.currency-tab.active {
		background: rgba(255, 255, 255, 0.15);
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
	}
</style>
