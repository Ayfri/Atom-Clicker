<script lang="ts">
	import {
		GENERATOR_LEVEL_MULTIPLIER,
		GENERATOR_LEVEL_UP_COST,
		GENERATOR_TYPES,
		GENERATORS,
		getGeneratorColor,
		type GeneratorType,
	} from '$data/generators';
	import { GENERATOR_ICON_NAMES, ICONS } from '$data/icons';
	import { GENERATOR_COST_MULTIPLIER } from '$lib/constants';
	import { getUpgradesWithEffects } from '$lib/helpers/effects';
	import { formatNumber } from '$lib/utils';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { reveal, reveals } from '$helpers/reveals.svelte';
	import { autoBuyManager } from '$stores/autoBuy.svelte';
	import { clock } from '$stores/clock.svelte';
	import AutoButton from '@components/ui/AutoButton.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import Value from '@components/ui/Value.svelte';
	import { fade, fly, scale } from 'svelte/transition';

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
				.flatMap(effect => (effect.type === 'auto_buy' && effect.target ? [effect.target] : [])),
		),
	);

	const hiddenGenerators = $derived(
		GENERATOR_TYPES.filter(type => !gameManager.generators[type]?.unlocked && !gameManager.canAfford(GENERATORS[type].cost)),
	);

	const obfuscatedGenerators = $derived(new Set(hiddenGenerators));
	// The first hidden generator is teased rather than fully hidden, so the player always sees the next thing to unlock.
	const fullyHiddenGenerators = $derived(new Set(hiddenGenerators.slice(1)));

	const purchaseAmounts = $derived(
		Object.fromEntries(
			GENERATOR_TYPES.map(type => [
				type,
				selectedPurchaseMode === 'max' ? gameManager.getMaxAffordableGenerator(type) : PurchaseModes[selectedPurchaseMode],
			]),
		) as Record<GeneratorType, number>,
	);

	const affordableGenerators = $derived(
		new Set(
			GENERATOR_TYPES.filter(type => {
				const amount = purchaseAmounts[type];
				if (amount <= 0) return false;
				return gameManager.canAfford({ amount: gameManager.getGeneratorCost(type, amount), currency: GENERATORS[type].cost.currency });
			}),
		),
	);

	const totalProduction = $derived(GENERATOR_TYPES.reduce((sum, type) => sum + gameManager.generatorProductions[type], 0));

	function handlePurchase(type: GeneratorType) {
		const amount = purchaseAmounts[type];
		if (affordableGenerators.has(type) && amount > 0) gameManager.purchaseGenerator(type, amount);
	}

	function formatShare(production: number) {
		const share = (production / totalProduction) * 100;
		return share < 1 ? '<1%' : `${Math.round(share)}%`;
	}

	$effect(() => {
		for (const type of GENERATOR_TYPES) {
			if (!gameManager.generators[type]?.unlocked && gameManager.canAfford(GENERATORS[type].cost)) gameManager.unlockGenerator(type);
		}
	});
</script>

<div class="bg-black/10 backdrop-blur-xs rounded-lg p-3 flex flex-col gap-2 h-150 lg:h-[calc(100vh-180px)]">
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-1.5">
			<h2 class="text-lg">Generators</h2>
			<HelpIcon position="bottom">
				{#snippet content()}
					<div class="flex flex-col gap-1.5 text-xs text-white/80">
						<p>Generators produce atoms every second, each one costs {Math.round((GENERATOR_COST_MULTIPLIER - 1) * 100)}% more than the last.</p>
						<p>
							Every {GENERATOR_LEVEL_UP_COST} of the same generator is a level: ×{GENERATOR_LEVEL_MULTIPLIER} production for that generator and a
							boost point to spend in Boosts.
						</p>
					</div>
				{/snippet}
			</HelpIcon>
		</div>
		{#if reveals.purchaseModes}
			<div class="flex items-center gap-0.5 rounded-md bg-white/5 p-0.5" in:reveal={{ y: 0 }}>
				{#each purchaseModes as mode (mode)}
					<button
						class="rounded-sm px-1.5 py-0.5 text-xs transition-colors duration-200 cursor-pointer {selectedPurchaseMode === mode ?
							'bg-white/20 text-white'
						:	'text-white/60 hover:bg-white/10 hover:text-white'}"
						onclick={() => (selectedPurchaseMode = mode)}
					>
						{mode === 'max' ? 'Max' : `×${PurchaseModes[mode]}`}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div id="generators-list" class="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar px-1 flex-1">
		{#each GENERATOR_TYPES as type (type)}
			{@const generator = GENERATORS[type]}
			{@const saveData = gameManager.generators[type]}
			{@const count = saveData?.count ?? 0}
			{@const affordable = affordableGenerators.has(type)}
			{@const obfuscated = obfuscatedGenerators.has(type)}
			{@const level = saveData?.level ?? 0}
			{@const color = getGeneratorColor(level)}
			{@const nextColor = getGeneratorColor(level + 1)}
			{@const levelProgress = count % GENERATOR_LEVEL_UP_COST}
			{@const purchaseAmount = purchaseAmounts[type]}
			{@const previewProgress = affordable ? Math.min(GENERATOR_LEVEL_UP_COST, levelProgress + purchaseAmount) : levelProgress}
			{@const production = gameManager.generatorProductions[type]}
			{@const isAutomated = gameManager.settings.automation.generators.includes(type)}
			{@const autoPurchasedCount = autoBuyManager.recentlyAutoPurchasedGenerators.get(type) ?? 0}
			{@const Icon = ICONS[GENERATOR_ICON_NAMES[type]]}

			{#snippet autoBuyTooltip()}
				{@const interval = autoBuyManager.autoBuyIntervals[type]}
				{@const nextFire = autoBuyManager.nextFireTimes.get(type)}
				<div class="flex flex-col gap-1">
					<p class="text-xs text-white/80">Automatically buys 1 {generator.name} whenever you can afford it.</p>
					{#if isAutomated && interval}
						<p class="text-xs text-white/60">
							Checks every {(interval / 1000).toFixed(1)}s
							{#if nextFire}
								- next in {Math.max(0, (nextFire - clock.now) / 1000).toFixed(1)}s
							{/if}
						</p>
					{/if}
				</div>
			{/snippet}

			<button
				class="relative text-start rounded-lg border p-2 transition-all duration-200 {affordable ?
					'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer'
				:	'bg-white/5 border-transparent opacity-50 cursor-not-allowed'}"
				data-generator={type}
				hidden={fullyHiddenGenerators.has(type)}
				onclick={() => handlePurchase(type)}
				style="--color: {color};"
				transition:fade
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
				<div class="flex items-center gap-2.5">
					<div class="grid size-9 shrink-0 place-items-center rounded-md bg-black/20">
						{#if obfuscated}
							<span class="text-sm text-white/40">?</span>
						{:else}
							<Icon {color} size={26} />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-1.5">
							<h3 class="truncate text-sm font-semibold text-(--color)">{obfuscated ? '???' : generator.name}</h3>
							{#if level > 0}
								<span class="shrink-0 rounded-sm bg-(--color)/20 px-1 text-[10px] font-bold text-(--color)">Lv {level}</span>
							{/if}
							{#if count > 0}
								<span class="ml-auto text-base font-bold tabular-nums text-white/90">{formatNumber(count, 0)}</span>
							{/if}
						</div>
						<p class="flex items-center gap-1 text-xs text-white/50">
							{#if production > 0}
								<Value class="font-medium text-accent-300" postfix="/s" value={production} />
								<span>· {formatShare(production)}</span>
							{:else if !obfuscated}
								<Value class="text-accent-300" postfix="/s each" prefix="+" value={gameManager.generatorUnitProductions[type]} />
							{/if}
						</p>
					</div>
				</div>
				<div class="mt-1.5 flex items-center justify-between gap-2 text-xs">
					<span class="flex items-center gap-1 {affordable ? 'text-white' : 'text-white/70'}">
						<Value currency={generator.cost.currency} value={gameManager.getGeneratorCost(type, purchaseAmount || 1)} />
						{#if selectedPurchaseMode !== 'x1' && purchaseAmount > 0}
							<span class="text-[10px] text-white/50">×{purchaseAmount}</span>
						{/if}
					</span>
					<span class="flex items-center gap-2">
						{#if count > 0}
							<span class="text-[10px] text-(--next-color)" style="--next-color: {nextColor};">
								{GENERATOR_LEVEL_UP_COST - levelProgress} to Lv {level + 1}
							</span>
						{/if}
						{#if automatedByUpgrade.has(type)}
							<AutoButton
								onClick={e => {
									e.stopPropagation();
									gameManager.toggleAutomation(type);
								}}
								toggled={isAutomated}
								tooltipContent={autoBuyTooltip}
							/>
						{/if}
					</span>
				</div>
				{#if count > 0}
					<div class="absolute bottom-0 inset-x-2 h-0.5 overflow-hidden rounded-full bg-white/5 pointer-events-none">
						<div
							class="absolute inset-0 origin-left opacity-30 transition-transform duration-300"
							style="background: {nextColor}; transform: scaleX({previewProgress / GENERATOR_LEVEL_UP_COST});"
						></div>
						<div
							class="absolute inset-0 origin-left bg-(--color) opacity-70 transition-transform duration-300"
							style="transform: scaleX({levelProgress / GENERATOR_LEVEL_UP_COST});"
						></div>
					</div>
				{/if}
			</button>
		{/each}
	</div>
</div>
