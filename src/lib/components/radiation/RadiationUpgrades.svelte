<script lang="ts">
	import { CurrenciesTypes } from '$data/currencies';
	import { RADIATION_UPGRADES, getRadiationUpgradeCost } from '$data/radiationUpgrades';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import CurrencyLabel from '@components/ui/CurrencyLabel.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import Value from '@components/ui/Value.svelte';

	const electronBalance = $derived(currenciesManager.getAmount(CurrenciesTypes.ELECTRONS));
	const upgradeLevels = $derived(radiationManager.upgradeLevels);

	function purchaseUpgrade(id: string) {
		if (radiationManager.purchaseUpgrade(id)) {
			// Sync to GameManager for save persistence
			gameManager.radiationUpgrades = { ...radiationManager.upgradeLevels };
		}
	}

	// Sort upgrades alphabetically by name
	const sortedUpgrades = Object.values(RADIATION_UPGRADES).sort((a, b) => a.name.localeCompare(b.name));
</script>

<div class="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-radiation/20">
	<h3 class="text-sm font-semibold text-radiation mb-3 flex items-center gap-2">
		<svg
			class="w-4 h-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<circle
				cx="12"
				cy="12"
				r="10"
			></circle>
			<path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10"></path>
			<path d="M12 2a15 15 0 0 0-4 10 15 15 0 0 0 4 10"></path>
			<line
				x1="2"
				y1="12"
				x2="22"
				y2="12"
			></line>
		</svg>
		Reactor Upgrades
		<HelpIcon position="bottom">
			{#snippet content()}
				<p class="text-xs text-white/80">
					Reactor upgrades are bought with <CurrencyLabel name={CurrenciesTypes.ELECTRONS} /> and permanently improve the radiation
					reactor: control rod efficiency, core fuel capacity, decay/regen rates, and more.
				</p>
			{/snippet}
		</HelpIcon>
		<Value
			class="ml-auto text-xs text-white/40 font-normal"
			value={electronBalance}
			currency={CurrenciesTypes.ELECTRONS}
		/>
	</h3>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
		{#each sortedUpgrades as upgrade (upgrade.id)}
			{@const currentLevel = upgradeLevels[upgrade.id] || 0}
			{@const cost = getRadiationUpgradeCost(upgrade, currentLevel)}
			{@const canAfford = electronBalance >= cost}
			{@const isMaxed = currentLevel >= upgrade.maxLevel}

			<button
				onclick={() => purchaseUpgrade(upgrade.id)}
				disabled={!canAfford || isMaxed}
				class="group flex flex-col p-3 rounded-lg transition-all duration-200 text-left border
					{isMaxed ? 'bg-radiation/10 border-radiation/30 cursor-default'
				: canAfford ? 'bg-white/5 border-radiation/20 hover:bg-radiation/10 hover:border-radiation/40 cursor-pointer'
				: 'bg-white/5 border-white/10 cursor-not-allowed opacity-60'}"
			>
				<!-- Header -->
				<div class="flex items-center justify-between mb-1">
					<span class="text-sm font-medium text-white">{upgrade.name}</span>
					<span
						class="text-xs font-mono px-1.5 py-0.5 rounded
						{isMaxed ? 'bg-radiation/20 text-radiation' : 'bg-white/10 text-white/60'}"
					>
						{currentLevel}/{upgrade.maxLevel}
					</span>
				</div>

				<!-- Description -->
				<p class="text-xs text-white/50 mb-2 line-clamp-2">
					{upgrade.description(currentLevel + 1)}
				</p>

				<!-- Cost -->
				<div class="flex items-center justify-between mt-auto">
					{#if isMaxed}
						<span class="text-xs text-radiation">MAXED</span>
					{:else}
						<span class="text-xs text-white/40">Cost:</span>
						<Value
							class="text-xs font-mono {canAfford ? 'text-radiation' : 'text-red-400'}"
							value={cost}
							currency={CurrenciesTypes.ELECTRONS}
						/>
					{/if}
				</div>

				<!-- Progress bar -->
				<div class="mt-2 h-1 bg-black/30 rounded-full overflow-hidden">
					<div
						class="h-full bg-linear-to-r from-radiation/60 to-radiation transition-all duration-300"
						style="width: {(currentLevel / upgrade.maxLevel) * 100}%"
					></div>
				</div>
			</button>
		{/each}
	</div>
</div>
