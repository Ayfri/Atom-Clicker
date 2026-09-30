<script lang="ts">
	import AutoButton from '@components/ui/AutoButton.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { fade } from 'svelte/transition';

	const SIDE_CURRENCIES = [
		CurrenciesTypes.EXCITED_PHOTONS,
		CurrenciesTypes.RED_LIGHT,
		CurrenciesTypes.GREEN_LIGHT,
		CurrenciesTypes.BLUE_LIGHT,
		CurrenciesTypes.WHITE_LIGHT,
	];

	const hasAutoClick = $derived((gameManager.photonUpgrades['auto_clicker'] || 0) > 0);
	const sideCurrencies = $derived(SIDE_CURRENCIES.filter(type => gameManager.currencies[type].earnedAllTime > 0));
</script>

<div class="relative z-1 mb-8 flex w-full flex-col items-center text-center sm:mb-4 max-lg:landscape:mb-2">
	{#if sideCurrencies.length > 0}
		<div class="mb-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-lg font-bold tabular-nums">
			{#each sideCurrencies as type (type)}
				<span class="flex items-center gap-1.5" style:color={CURRENCIES[type].color} title={type}>
					<Currency name={type} size={20} />
					{formatNumber(gameManager.currencies[type].amount)}
				</span>
			{/each}
		</div>
	{/if}

	<div class="flex items-center gap-2.5">
		<Currency class="shrink-0 max-sm:size-7" name={CurrenciesTypes.PHOTONS} size={38} />
		<span
			class="text-3xl font-black tabular-nums text-realm-300 sm:text-4xl md:text-5xl [text-shadow:0_0_24px_color-mix(in_srgb,var(--color-realm-500)_55%,transparent)]"
		>
			{formatNumber(gameManager.photons)}
		</span>
	</div>
	<span class="text-[11px] font-bold tracking-[0.3em] text-white/45 uppercase">Photons</span>

	{#if hasAutoClick}
		<div class="mt-2 flex items-center gap-2">
			{#if gameManager.settings.automation.autoClickPhotons && gameManager.photonAutoClicksPer5Seconds > 0}
				<span class="font-mono text-sm font-bold tabular-nums text-realm-200">
					{formatNumber(gameManager.photonAutoClicksPer5Seconds / 5, 1)}<span class="text-white/45"> clicks/s</span>
				</span>
			{/if}
			<AutoButton
				onClick={() => gameManager.toggleAutoClickPhotons()}
				toggled={gameManager.settings.automation.autoClickPhotons}
				tooltipContent={autoClickPhotonsTooltip}
			/>
		</div>
	{/if}

	{#if gameManager.currencies[CurrenciesTypes.PHOTONS].earnedAllTime < 10}
		<p class="mt-2 text-base text-realm-300" transition:fade={{ duration: 5000 }}>Click the purple circles to collect more photons!</p>
	{/if}
</div>

{#snippet autoClickPhotonsTooltip()}
	<div class="flex flex-col gap-1">
		<p class="text-xs text-white/80">Automatically clicks purple circles for you, continuously.</p>
		{#if gameManager.settings.automation.autoClickPhotons && gameManager.photonAutoClicksPer5Seconds > 0}
			<p class="text-xs text-white/60">Currently clicking {formatNumber(gameManager.photonAutoClicksPer5Seconds / 5, 1)} times per second.</p>
		{/if}
	</div>
{/snippet}
