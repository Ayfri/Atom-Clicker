<script lang="ts">
import { BUILDING_COLORS, BUILDINGS, type BuildingData, type BuildingType } from '$data/buildings';
import { getUpgradesWithEffects } from '$lib/helpers/effects';
import { gameManager } from '$helpers/GameManager.svelte';
import { autoBuyManager } from '$stores/autoBuy.svelte';
import AutoButton from '@components/ui/AutoButton.svelte';
import Value from '@components/ui/Value.svelte';
import { fade, fly, scale } from 'svelte/transition';

	const buildingsEntries = Object.entries(BUILDINGS) as [BuildingType, BuildingData][];

	const PurchaseModes = {
		x1: 1,
		x5: 5,
		x25: 25,
		max: Infinity,
	} as const;
	type PurchaseMode = keyof typeof PurchaseModes;

	const purchaseModes = Object.keys(PurchaseModes) as PurchaseMode[];

	let selectedPurchaseMode: PurchaseMode = $state('x1');


	const hiddenBuildings = $derived(
		buildingsEntries.filter(
			([type, building]) =>
				!gameManager.buildings[type]?.unlocked &&
				!gameManager.canAfford(building.cost)
		)
	);

	const purchaseAmounts = $derived(
		Object.fromEntries(
			buildingsEntries.map(([type]) => {
				if (selectedPurchaseMode === 'max') {
					return [type, gameManager.getMaxAffordableBuilding(type)];
				}
				return [type, PurchaseModes[selectedPurchaseMode]];
			})
		) as Record<BuildingType, number>
	);

	const affordableBuildings = $derived(
		buildingsEntries.filter(([type]) => {
			const amount = purchaseAmounts[type];
			if (amount <= 0) return false;
			const cost = gameManager.getBuildingCost(type, amount);
			return gameManager.canAfford({ amount: cost, currency: BUILDINGS[type].cost.currency });
		}).map(([type]) => type)
	);

	function handlePurchase(type: BuildingType) {
		if (!affordableBuildings.includes(type)) return;
		const amount = purchaseAmounts[type];
		if (amount > 0) {
			gameManager.purchaseBuilding(type, amount);
		}
	}

	$effect(() => {
		// Auto-unlock buildings that are affordable but not yet unlocked
		buildingsEntries
			.filter(([type, building]) => {
				const isUnlocked = gameManager.buildings[type]?.unlocked;
				const isAffordable = gameManager.canAfford(building.cost);
				return !isUnlocked && isAffordable;
			})
			.forEach(([type]) => gameManager.unlockBuilding(type));
	});
</script>

<div class="bg-black/10 backdrop-blur-xs rounded-lg p-3 buildings flex flex-col gap-2 h-[600px] lg:h-[calc(100vh-180px)]">
	<h2 class="text-lg">Buildings</h2>
	<div class="flex items-center gap-1 my-1">
		{#each purchaseModes as mode}
			<button
				class="bg-white/5 hover:bg-white/10 rounded-sm px-2 py-0.5 text-xs text-white transition-all duration-200 cursor-pointer {selectedPurchaseMode === mode ? 'bg-white/20!' : ''}"
				onclick={() => selectedPurchaseMode = mode}
			>
				{mode === 'max' ? 'Max' : mode}
			</button>
		{/each}
	</div>

	<div class="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar px-1 flex-1">
		{#each buildingsEntries as [type, building], i}
			{@const saveData = gameManager.buildings[type]}
			{@const unaffordable = !affordableBuildings.includes(type)}
			{@const obfuscated = hiddenBuildings.some(([t]) => t === type)}
			{@const hidden = hiddenBuildings.slice(1).some(([t]) => t === type)}
			{@const level = saveData?.level ?? 0}
			{@const color = BUILDING_COLORS[level]}
			{@const purchaseAmount = purchaseAmounts[type]}
			{@const totalCost = gameManager.getBuildingCost(type, purchaseAmount || 1)}
			{@const isAutomated = gameManager.settings.automation.buildings.includes(type)}
			{@const hasAutomation = getUpgradesWithEffects(gameManager.currentUpgradesBought, { type: 'auto_buy', target: type }).length > 0}
			{@const autoPurchasedCount = autoBuyManager.recentlyAutoPurchasedBuildings.get(type) || 0}

			<button
				class="relative text-start bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer p-2 transition-all duration-200 {unaffordable ? 'opacity-50 cursor-not-allowed' : ''}"
				style="--color: {color};"
				onclick={() => handlePurchase(type)}
				transition:fade
				{hidden}
			>
				{#if autoPurchasedCount > 0}
					<div
						class="absolute top-1 right-1 bg-blue-500/20 text-blue-300 font-medium text-[0.65rem] px-1 py-0.5 rounded border border-blue-500/30 z-10 pointer-events-none"
						in:scale={{ duration: 150, start: 0.5 }}
						out:fly={{ y: -20, duration: 300, opacity: 0, delay: 200 }}
					>
						+{autoPurchasedCount}
					</div>
				{/if}
				<div>
					<h3 class="text-sm m-0" style="color: var(--color);">
						{obfuscated ? '???' : building.name}
						{saveData?.count ? `(${saveData.count})` : ''}
						{#if level > 0}
							<span class="text-xs">⇮{level}</span>
						{/if}
					</h3>
					<p class="text-xs my-0.5">
						{saveData && saveData.count > 0 ? '' : 'Will produce'}
						<Value value={gameManager.buildingProductions[type] || building.rate * gameManager.globalMultiplier * gameManager.bonusMultiplier} currency="Atoms" postfix="/s" class="text-accent-300"/>
						{#if gameManager.buildingProductions[type]}
							<span class="opacity-60 text-[0.6rem] leading-3">
								<Value value={gameManager.buildingProductions[type] / (saveData?.count ?? 1)} prefix="(" />
								× {saveData?.count ?? 1})
							</span>
						{/if}
					</p>
				</div>
				<div class="text-xs mt-1 flex justify-between items-center" style="color: var(--color);">
					<div>
						Cost: <Value value={totalCost} currency={saveData?.cost?.currency ?? building.cost.currency} />
						{#if selectedPurchaseMode === 'max' && purchaseAmount > 0}
							<span class="opacity-60 text-[0.6rem] leading-3 ml-1">(×{purchaseAmount})</span>
						{/if}
					</div>
					{#if hasAutomation}
						<AutoButton
							onClick={(e) => {
								e.stopPropagation();
								gameManager.toggleAutomation(type);
							}}
							toggled={isAutomated}
						/>
					{/if}
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.buildings {
		grid-area: buildings;
	}

	:global(.skill-tree-icon) {
		cursor: pointer;
		float: right;
	}
</style>
