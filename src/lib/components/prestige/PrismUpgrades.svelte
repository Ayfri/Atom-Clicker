<script lang="ts">
	import { CHROMATIC, CHROMATIC_COLORS, CHROMATIC_UPGRADES, type ChromaticUpgrade, getChromaticUpgradeCost } from '$data/chromatic';
	import { CURRENCIES } from '$data/currencies';
	import { chromaticManager } from '$helpers/ChromaticManager.svelte';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import Value from '@components/ui/Value.svelte';

	const PRISM_UPGRADES = Object.values(CHROMATIC_UPGRADES).filter(upgrade => upgrade.id.startsWith('prism_'));

	const visible = (upgrade: ChromaticUpgrade) =>
		chromaticManager.level(upgrade.id) < upgrade.maxLevel || gameManager.settings.upgrades.displayAlreadyBought;
</script>

{#snippet item(upgrade: ChromaticUpgrade)}
	{@const level = chromaticManager.level(upgrade.id)}
	{@const maxed = level >= upgrade.maxLevel}
	{@const cost = getChromaticUpgradeCost(upgrade, level)}
	{@const affordable = chromaticManager.canAfford(upgrade)}
	<button
		class={[
			'rounded-sm border border-realm-500/20 bg-realm-900/20 p-2 text-start transition-all duration-200',
			maxed ? 'cursor-default opacity-85' : 'hover:border-realm-500/40 hover:bg-realm-900/30',
			!maxed && (affordable ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'),
		]}
		data-hint="prism-upgrade"
		disabled={maxed}
		onclick={() => chromaticManager.purchaseUpgrade(upgrade.id)}
	>
		<div class="mb-0.5 flex items-start justify-between">
			<h4 class="text-xs font-medium leading-tight text-realm-200">{upgrade.name}</h4>
			<span class="ml-1 whitespace-nowrap text-xs text-realm-400/80">{level}/{upgrade.maxLevel}</span>
		</div>
		<p class="mb-0.5 text-xs leading-tight text-realm-200/50">{upgrade.description(maxed ? level : level + 1)}</p>
		{#if !maxed}
			<span class="flex flex-wrap gap-x-2">
				{#each upgrade.currencies as currency (currency)}
					<Value class="text-xs" {currency} value={cost} />
				{/each}
			</span>
		{/if}
	</button>
{/snippet}

<div class="flex flex-col gap-3">
	<div class="flex items-center justify-between gap-2 text-sm">
		{#each CHROMATIC_COLORS as color (color)}
			<Value class="font-semibold" currency={CHROMATIC[color].currency} value={currenciesManager.getAmount(CHROMATIC[color].currency)} />
		{/each}
	</div>

	{#each CHROMATIC_COLORS as color (color)}
		{@const upgrades = Object.values(CHROMATIC_UPGRADES).filter(upgrade => upgrade.id.startsWith(`${color}_`) && visible(upgrade))}
		<section class="flex flex-col gap-1.5">
			<h3 class="flex items-baseline justify-between text-xs">
				<span class="font-semibold" style:color={CURRENCIES[CHROMATIC[color].currency].color}>{CHROMATIC[color].name}</span>
				<span class="text-white/40">Spectrum {chromaticManager.spectrumLevel(color)}</span>
			</h3>
			{#each upgrades as upgrade (upgrade.id)}
				{@render item(upgrade)}
			{/each}
		</section>
	{/each}

	<section class="flex flex-col gap-1.5">
		<h3 class="text-xs font-semibold text-realm-300">Prism</h3>
		{#each PRISM_UPGRADES.filter(visible) as upgrade (upgrade.id)}
			{@render item(upgrade)}
		{/each}
	</section>
</div>
