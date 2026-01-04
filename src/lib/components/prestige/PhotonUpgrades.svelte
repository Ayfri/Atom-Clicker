<script lang="ts">
	import { PHOTON_UPGRADES, EXCITED_PHOTON_UPGRADES } from '$data/photonUpgrades';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import Currency from '@components/ui/Currency.svelte';
	import PhotonUpgradeItem from './PhotonUpgradeItem.svelte';
	import { Eye, EyeOff } from 'lucide-svelte';

	let selectedCurrency = $state<CurrencyName>(CurrenciesTypes.PHOTONS);

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

<div id="photon-upgrades" class="bg-black/10 backdrop-blur-xs rounded-lg p-3 flex flex-col gap-2 h-[600px] lg:h-[calc(100vh-180px)]">
	<div class="header flex justify-between items-center gap-2">
		<h2 class="text-sm lg:text-base text-realm-400">Photon Upgrades</h2>
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
			onclick={() => selectedCurrency = CurrenciesTypes.PHOTONS}
		>
			<Currency name={CurrenciesTypes.PHOTONS} />
		</button>
		{#if showExcitedTab}
			<button
				class="currency-tab flex items-center bg-white/5 border-none rounded-lg cursor-pointer p-2 transition-all duration-200 hover:bg-white/10 active:bg-white/15 active:shadow-[0_0_10px_rgba(255,255,255,0.1)]"
				class:active={selectedCurrency === CurrenciesTypes.EXCITED_PHOTONS}
				onclick={() => selectedCurrency = CurrenciesTypes.EXCITED_PHOTONS}
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
