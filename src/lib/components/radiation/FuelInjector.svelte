<script lang="ts">
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { MASS_PER_ELECTRON, radiationManager } from '$helpers/RadiationManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { Zap } from '@lucide/svelte';

	const SHARES = [
		{ label: '10%', share: 0.1 },
		{ label: '25%', share: 0.25 },
		{ label: '50%', share: 0.5 },
		{ label: 'Max', share: 1 },
	] as const;

	let share = $state(0.25);

	const balance = $derived(currenciesManager.getAmount(CurrenciesTypes.ELECTRONS));
	const electrons = $derived(Math.max(1, Math.floor(balance * share)));
	const addedMass = $derived(electrons * MASS_PER_ELECTRON);
	const cpmGain = $derived(
		radiationManager.cpmFor(radiationManager.mass + addedMass, radiationManager.controlRodLevel) - radiationManager.currentCpm,
	);
	const affordable = $derived(balance >= electrons);

	function inject() {
		if (!radiationManager.unlocked) radiationManager.unlock();
		radiationManager.bombardCore(electrons);
	}
</script>

<div class="flex w-full flex-col gap-2" data-hint="radiation-fuel">
	<div class="flex items-center justify-between gap-2">
		<span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Inject</span>
		<div class="flex gap-0.5 rounded-md bg-white/5 p-0.5">
			{#each SHARES as option (option.label)}
				<button
					class="cursor-pointer rounded-sm px-2 py-0.5 text-xs transition-colors duration-200 {share === option.share ?
						'bg-white/20 text-white'
					:	'text-white/60 hover:bg-white/10 hover:text-white'}"
					onclick={() => (share = option.share)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<button
		class="group relative flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left font-bold transition-[transform,box-shadow,filter] duration-100
			disabled:cursor-not-allowed {affordable ?
			'bg-radiation text-black shadow-[0_4px_0_color-mix(in_srgb,var(--color-radiation)_40%,black),0_0_24px_color-mix(in_srgb,var(--color-radiation)_35%,transparent)] hover:brightness-110 active:translate-y-1 active:shadow-[0_0_0_transparent]'
		:	'bg-white/10 text-white/40'}"
		disabled={!affordable}
		onclick={inject}
	>
		<Zap class="size-6 shrink-0" fill="currentColor" />
		<span class="flex min-w-0 flex-1 flex-col leading-tight">
			<span class="text-base uppercase tracking-wider">Inject fuel</span>
			<span class="truncate font-mono text-xs font-semibold opacity-70">
				+{formatNumber(addedMass, 1)} u{cpmGain > 0 ? `, +${formatNumber(cpmGain, 0)} CPM` : ''}
			</span>
		</span>
		<Value class="shrink-0 font-mono text-sm" currency={CurrenciesTypes.ELECTRONS} currencyClass={affordable ? 'brightness-0' : ''} value={electrons} />
	</button>
</div>
