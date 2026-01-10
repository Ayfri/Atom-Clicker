<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import {formatNumber} from '$lib/utils';
	import { mobile } from '$stores/window.svelte';
	import { CurrenciesTypes } from '@/lib/data/currencies';
	import AutoButton from '@components/ui/AutoButton.svelte';
	import { fade } from 'svelte/transition';

	const hasAutoClick = $derived((gameManager.photonUpgrades['auto_clicker'] || 0) > 0);
</script>

<div class="mb-8 text-center z-1 sm:mb-4 relative">
	<div class="mb-2">
		{#if gameManager.currencies[CurrenciesTypes.EXCITED_PHOTONS].earnedAllTime > 0}
			<div>
				<span id="excited-photons-value" class="text-2xl font-bold text-yellow-400">{formatNumber(gameManager.excitedPhotons)}</span>
				<span class="font-bold text-lg opacity-80 text-realm-200">excited photons</span>
			</div>
		{/if}

		<div class="flex items-center justify-center gap-2">
			<span id="photons-value" class="sm:text-[2.75rem] sm:leading-[1.35] text-5xl font-bold text-realm-400 transition-[filter] duration-200">{formatNumber(gameManager.photons)}</span>
			<span class="font-bold text-2xl opacity-80 text-realm-200">photons</span>

			{#if hasAutoClick && !mobile.current}
				<div class="mt-1.5">
					<AutoButton
						onClick={() => gameManager.toggleAutoClickPhotons()}
						toggled={gameManager.settings.automation.autoClickPhotons}
					/>
				</div>
			{/if}
		</div>
	</div>

	{#if gameManager.currencies[CurrenciesTypes.PHOTONS].earnedAllTime < 10}
		<div class="text-lg relative flex justify-center items-center">
			<div class="text-realm-300 text-base" transition:fade={{ duration: 5000 }}>
				Click the purple circles to collect more photons!
			</div>
		</div>
	{/if}

	{#if mobile.current && hasAutoClick}
		<div class="mt-2">
			<AutoButton
				onClick={() => gameManager.toggleAutoClickPhotons()}
				toggled={gameManager.settings.automation.autoClickPhotons}
			/>
		</div>
	{/if}
</div>
