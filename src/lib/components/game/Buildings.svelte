<script lang="ts">
	import { BUILDING_COLORS, BUILDING_LEVEL_UP_COST, BUILDINGS, BuildingTypes, type BuildingData, type BuildingType } from '$data/buildings';
	import { getUpgradesWithEffects } from '$lib/helpers/effects';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { autoBuyManager } from '$stores/autoBuy.svelte';
	import { clock } from '$stores/clock.svelte';
	import BlackHoleIcon from '@components/icons/buildings/BlackHole.svelte';
	import CrystalIcon from '@components/icons/buildings/Crystal.svelte';
	import MicroorganismIcon from '@components/icons/buildings/Microorganism.svelte';
	import MoleculeIcon from '@components/icons/buildings/Molecule.svelte';
	import NanostructureIcon from '@components/icons/buildings/Nanostructure.svelte';
	import NeutronStarIcon from '@components/icons/buildings/NeutronStar.svelte';
	import PlanetIcon from '@components/icons/buildings/Planet.svelte';
	import RockIcon from '@components/icons/buildings/Rock.svelte';
	import StarIcon from '@components/icons/buildings/Star.svelte';
	import AutoButton from '@components/ui/AutoButton.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import Value from '@components/ui/Value.svelte';
	import type { Component } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';

	const BUILDING_ICONS: Record<BuildingType, Component<{ color?: string; size?: number }>> = {
		[BuildingTypes.BLACK_HOLE]: BlackHoleIcon,
		[BuildingTypes.CRYSTAL]: CrystalIcon,
		[BuildingTypes.MICROORGANISM]: MicroorganismIcon,
		[BuildingTypes.MOLECULE]: MoleculeIcon,
		[BuildingTypes.NANOSTRUCTURE]: NanostructureIcon,
		[BuildingTypes.NEUTRON_STAR]: NeutronStarIcon,
		[BuildingTypes.PLANET]: PlanetIcon,
		[BuildingTypes.ROCK]: RockIcon,
		[BuildingTypes.STAR]: StarIcon,
	};

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

	// The rows re-render on every atom commit, so the automation lookup is folded once instead of scanning every upgrade per row.
	const automatedByUpgrade = $derived(
		new Set(
			getUpgradesWithEffects(gameManager.currentUpgradesBought, { type: 'auto_buy' })
				.flatMap(upgrade => upgrade.effects ?? [])
				.filter(effect => effect.type === 'auto_buy' && effect.target)
				.map(effect => effect.target as BuildingType),
		),
	);

	const hiddenBuildings = $derived(
		buildingsEntries.filter(([type, building]) => !gameManager.buildings[type]?.unlocked && !gameManager.canAfford(building.cost)),
	);

	const obfuscatedBuildings = $derived(new Set(hiddenBuildings.map(([type]) => type)));
	// The first hidden building is teased rather than fully hidden, so the player always sees the next thing to unlock.
	const fullyHiddenBuildings = $derived(new Set(hiddenBuildings.slice(1).map(([type]) => type)));

	const purchaseAmounts = $derived(
		Object.fromEntries(
			buildingsEntries.map(([type]) => {
				if (selectedPurchaseMode === 'max') {
					return [type, gameManager.getMaxAffordableBuilding(type)];
				}
				return [type, PurchaseModes[selectedPurchaseMode]];
			}),
		) as Record<BuildingType, number>,
	);

	const affordableBuildings = $derived(
		new Set(
			buildingsEntries
				.filter(([type]) => {
					const amount = purchaseAmounts[type];
					if (amount <= 0) return false;
					const cost = gameManager.getBuildingCost(type, amount);
					return gameManager.canAfford({ amount: cost, currency: BUILDINGS[type].cost.currency });
				})
				.map(([type]) => type),
		),
	);

	function handlePurchase(type: BuildingType) {
		if (!affordableBuildings.has(type)) return;
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

<div class="bg-black/10 backdrop-blur-xs rounded-lg p-3 flex flex-col gap-2 h-150 lg:h-[calc(100vh-180px)]">
	<div class="flex items-center gap-1.5">
		<h2 class="text-lg">Buildings</h2>
		<HelpIcon position="bottom">
			{#snippet content()}
				<p class="text-xs text-white/80">
					Buildings produce atoms automatically every second. Their cost increases with each purchase, and every
					{BUILDING_LEVEL_UP_COST} owned levels them up, boosting their production.
				</p>
			{/snippet}
		</HelpIcon>
	</div>
	<div class="flex items-center gap-1 my-1">
		{#each purchaseModes as mode}
			<button
				class="bg-white/5 hover:bg-white/10 rounded-sm px-2 py-0.5 text-xs text-white transition-all duration-200 cursor-pointer {(
					selectedPurchaseMode === mode
				) ?
					'bg-white/20!'
				:	''}"
				onclick={() => (selectedPurchaseMode = mode)}
			>
				{mode === 'max' ? 'Max' : mode}
			</button>
		{/each}
	</div>

	<div id="buildings-list" class="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar px-1 flex-1">
		{#each buildingsEntries as [type, building], i}
			{@const saveData = gameManager.buildings[type]}
			{@const unaffordable = !affordableBuildings.has(type)}
			{@const obfuscated = obfuscatedBuildings.has(type)}
			{@const hidden = fullyHiddenBuildings.has(type)}
			{@const level = saveData?.level ?? 0}
			{@const color = BUILDING_COLORS[level]}
			{@const purchaseAmount = purchaseAmounts[type]}
			{@const totalCost = gameManager.getBuildingCost(type, purchaseAmount || 1)}
			{@const isAutomated = gameManager.settings.automation.buildings.includes(type)}
			{@const hasAutomation = automatedByUpgrade.has(type)}
			{@const autoPurchasedCount = autoBuyManager.recentlyAutoPurchasedBuildings.get(type) || 0}
			{@const IconComponent = BUILDING_ICONS[type]}
			{@const autoBuyInterval = autoBuyManager.autoBuyIntervals[type]}
			{@const autoBuyNextFire = autoBuyManager.nextFireTimes.get(type)}

			{#snippet autoBuyTooltip()}
				<div class="flex flex-col gap-1">
					<p class="text-xs text-white/80">Automatically buys 1 {building.name} whenever you can afford it.</p>
					{#if isAutomated && autoBuyInterval}
						<p class="text-xs text-white/60">
							Checks every {(autoBuyInterval / 1000).toFixed(1)}s
							{#if autoBuyNextFire}
								- next in {Math.max(0, (autoBuyNextFire - clock.now) / 1000).toFixed(1)}s
							{/if}
						</p>
					{/if}
				</div>
			{/snippet}

			<button
				class="relative text-start bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer p-2 transition-all duration-200 {(
					unaffordable
				) ?
					'opacity-50 cursor-not-allowed'
				:	''}"
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
				<div class="flex items-start gap-2">
					<div class="shrink-0 mt-0.5 opacity-80">
						{#if obfuscated}
							<div class="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs text-white/40">?</div>
						{:else}
							<IconComponent
								{color}
								size={24}
							/>
						{/if}
					</div>
					<div class="flex-1 min-w-0">
						<h3
							class="text-sm m-0"
							style="color: var(--color);"
						>
							{obfuscated ? '???' : building.name}
							{saveData?.count ? `(${saveData.count})` : ''}
							{#if level > 0}
								<span class="text-xs">⇮{level}</span>
							{/if}
						</h3>
						<p class="text-xs my-0.5">
							{saveData && saveData.count > 0 ? '' : 'Will produce'}
							<Value
								value={gameManager.buildingProductions[type] ||
									building.rate * gameManager.globalMultiplier * gameManager.bonusMultiplier}
								currency="Atoms"
								postfix="/s"
								class="text-accent-300"
							/>
							{#if gameManager.buildingProductions[type]}
								<span class="opacity-60 text-[0.6rem] leading-3">
									<Value
										value={gameManager.buildingProductions[type] / (saveData?.count ?? 1)}
										prefix="("
									/>
									× {saveData?.count ?? 1})
								</span>
							{/if}
						</p>
					</div>
				</div>
				<div
					class="text-xs mt-1 flex justify-between items-center"
					style="color: var(--color);"
				>
					<div>
						Cost: <Value
							value={totalCost}
							currency={saveData?.cost?.currency ?? building.cost.currency}
						/>
						{#if selectedPurchaseMode === 'max' && purchaseAmount > 0}
							<span class="opacity-60 text-[0.6rem] leading-3 ml-1">(×{purchaseAmount})</span>
						{/if}
					</div>
					{#if hasAutomation}
						<AutoButton
							onClick={e => {
								e.stopPropagation();
								gameManager.toggleAutomation(type);
							}}
							toggled={isAutomated}
							tooltipContent={autoBuyTooltip}
						/>
					{/if}
				</div>
			</button>
		{/each}
	</div>
</div>
