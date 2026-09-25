<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { GENERATOR_TYPES, GENERATORS } from '$data/generators';
	import { GENERATOR_ICON_NAMES, ICONS } from '$data/icons';
	import { Info } from '@lucide/svelte';
	import { getUpgradesWithEffects } from '$helpers/effects';
	import { reveal, reveals } from '$helpers/reveals.svelte';
	import AutoButton from '@components/ui/AutoButton.svelte';
	import Tooltip from '@components/ui/Tooltip.svelte';
	import { mobile } from '$stores/window.svelte';

	const generatorsWithProduction = $derived(
		GENERATOR_TYPES.filter(type => gameManager.generatorProductions[type] > 0).map(type => ({
			count: gameManager.generators[type]?.count ?? 0,
			name: GENERATORS[type].name,
			production: gameManager.generatorProductions[type],
			type,
		})),
	);

	const hasAutoClick = $derived(getUpgradesWithEffects(gameManager.currentUpgradesBought, { type: 'auto_click' }).length > 0);
</script>

<div class="mb-8 text-center z-1 sm:mb-4 relative">
	<div class="mb-2">
		{#if gameManager.electrons > 0}
			<div>
				<span
					id="electrons-value"
					class="text-2xl font-bold text-green-400">{formatNumber(gameManager.electrons)}</span
				>
				<span class="font-bold text-lg opacity-80">electrons</span>
			</div>
		{/if}
		{#if gameManager.protons > 0}
			<div>
				<span
					id="protons-value"
					class="text-2xl font-bold text-yellow-400">{formatNumber(gameManager.protons)}</span
				>
				<span class="font-bold text-lg opacity-80">protons</span>
			</div>
		{/if}
		<div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-0">
			<span
				id="atoms-value"
				class="text-3xl sm:text-4xl md:text-5xl font-bold text-accent-500 transition-[filter] duration-200 {gameManager.hasBonus ?
					'drop-shadow-[0_0_10px_#4a90e2]'
				:	''}">{formatNumber(gameManager.atoms)}</span
			>
			<span class="font-bold text-xl sm:text-2xl opacity-80">atoms</span>

			{#if !mobile.current && hasAutoClick}
				<div class="mt-1.5">
					<AutoButton
						onClick={() => gameManager.toggleAutoClick()}
						toggled={gameManager.settings.automation.autoClick}
						tooltipContent={autoClickTooltip}
					/>
				</div>
			{/if}
		</div>
	</div>
	{#if reveals.production}
	<div class="text-lg relative flex justify-center items-center rounded-lg" in:reveal>
		<div class="mr-2">
			<span
				id="atoms-per-second-value"
				class="{gameManager.hasBonus ? 'opacity-100' : 'opacity-80'} font-bold transition-[filter] duration-200 {(
					gameManager.hasBonus
				) ?
					'drop-shadow-[0_0_7px_currentColor]'
				:	''}"
			>
				{formatNumber(gameManager.atomsPerSecond)}
			</span> atoms per second
		</div>

		{#if generatorsWithProduction.length > 0}
			<Tooltip
				position="bottom"
				size="md"
			>
				<Info
					size={16}
					class="inline cursor-help text-white/60 hover:text-white/80 transition-colors"
				/>

				{#snippet content()}
					<div class="text-xs font-semibold mb-2">Generators production</div>
					<div class="space-y-1">
						{#each generatorsWithProduction as generator (generator.type)}
							{@const IconComponent = ICONS[GENERATOR_ICON_NAMES[generator.type]]}
							<div class="flex justify-between items-center text-xs">
								<span class="text-white/80 flex items-center gap-1.5">
									<IconComponent
										size={14}
										color="currentColor"
									/>
									{generator.name} (×{generator.count})
								</span>
								<span class="text-accent-300 font-medium"
									>{formatNumber(generator.production)}/s ({Math.round(
										(generator.production / gameManager.atomsPerSecond) * 100,
									)}%)</span
								>
							</div>
						{/each}
					</div>
				{/snippet}
			</Tooltip>
		{/if}
	</div>
	{/if}

	{#if mobile.current && hasAutoClick}
		<AutoButton
			onClick={() => gameManager.toggleAutoClick()}
			toggled={gameManager.settings.automation.autoClick}
			tooltipContent={autoClickTooltip}
		/>
	{/if}
</div>

{#snippet autoClickTooltip()}
	<div class="flex flex-col gap-1">
		<p class="text-xs text-white/80">Automatically clicks the atom for you, continuously.</p>
		{#if gameManager.settings.automation.autoClick && gameManager.autoClicksPerSecond > 0}
			<p class="text-xs text-white/60">Currently clicking {formatNumber(gameManager.autoClicksPerSecond, 1)} times per second.</p>
		{/if}
	</div>
{/snippet}
