<script lang="ts">
	import {
		BOOST_SPECTRUM,
		CHROMATIC,
		CHROMATIC_COLORS,
		CHROMATIC_UPGRADES,
		type ChromaticUpgrade,
		getChromaticUpgradeCost,
		WHITE_RECIPE,
	} from '$data/chromatic';
	import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
	import { chromaticManager } from '$helpers/ChromaticManager.svelte';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { reveal } from '$helpers/reveals.svelte';
	import Value from '@components/ui/Value.svelte';

	const UPGRADES = Object.values(CHROMATIC_UPGRADES);
	const byPrefix = (prefix: string) => UPGRADES.filter(upgrade => upgrade.id.startsWith(prefix));

	const visible = (upgrade: ChromaticUpgrade) =>
		chromaticManager.isUnlocked(upgrade) &&
		(chromaticManager.level(upgrade.id) < upgrade.maxLevel || gameManager.settings.upgrades.displayAlreadyBought);

	const whiteUnlocked = $derived(chromaticManager.recombinable > 0 || currenciesManager.getEarnedAllTime(CurrenciesTypes.WHITE_LIGHT) > 0);
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
		disabled={maxed}
		in:reveal={{ y: 0 }}
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
	<div class="flex flex-wrap items-center justify-between gap-2 text-sm">
		{#each CHROMATIC_COLORS as color (color)}
			<Value class="font-semibold" currency={CHROMATIC[color].currency} value={currenciesManager.getAmount(CHROMATIC[color].currency)} />
		{/each}
		{#if whiteUnlocked}
			<Value class="font-semibold" currency={CurrenciesTypes.WHITE_LIGHT} value={currenciesManager.getAmount(CurrenciesTypes.WHITE_LIGHT)} />
		{/if}
	</div>

	{#each CHROMATIC_COLORS as color (color)}
		{@const spectrum = chromaticManager.spectrumLevel(color)}
		<section class="flex flex-col gap-1.5">
			<h3 class="flex items-baseline justify-between text-xs">
				<span class="font-semibold" style:color={CURRENCIES[CHROMATIC[color].currency].color}>{CHROMATIC[color].name}</span>
				<span class="text-white/40">Spectrum {spectrum}</span>
			</h3>
			{#each byPrefix(`${color}_`).filter(visible) as upgrade (upgrade.id)}
				{@render item(upgrade)}
			{/each}
			{#if spectrum < BOOST_SPECTRUM}
				<p class="border-t border-white/5 pt-1 text-[11px] text-white/35">Spectrum {BOOST_SPECTRUM} unlocks boosts for the other realms</p>
			{/if}
		</section>
	{/each}

	<section class="flex flex-col gap-1.5">
		<h3 class="text-xs font-semibold text-realm-300">Prism</h3>
		{#each byPrefix('prism_').filter(visible) as upgrade (upgrade.id)}
			{@render item(upgrade)}
		{/each}
	</section>

	{#if whiteUnlocked}
		<section class="flex flex-col gap-1.5" in:reveal={{ y: 0 }}>
			<h3 class="text-xs font-semibold" style:color={CURRENCIES[CurrenciesTypes.WHITE_LIGHT].color}>White</h3>
			<button
				class="flex items-center justify-between gap-2 rounded-sm border border-white/15 bg-white/5 p-2 text-start text-xs transition-colors enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
				data-hint="prism-recombine"
				disabled={chromaticManager.recombinable === 0}
				onclick={() => chromaticManager.recombine()}
			>
				<span class="text-white/60">Recombine {WHITE_RECIPE} of each color into 1 White Light</span>
				<Value class="whitespace-nowrap font-semibold" currency={CurrenciesTypes.WHITE_LIGHT} prefix="+" value={chromaticManager.recombinable} />
			</button>
			{#each byPrefix('white_').filter(visible) as upgrade (upgrade.id)}
				{@render item(upgrade)}
			{/each}
		</section>
	{/if}
</div>
