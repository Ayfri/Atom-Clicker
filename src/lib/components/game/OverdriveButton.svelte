<script lang="ts">
	import { CurrenciesTypes } from '#data/currencies.js';
	import { ICONS } from '#data/icons.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { OVERDRIVE_COST, OVERDRIVE_MULTIPLIER, OVERDRIVE_PERIOD_MS } from '#lib/constants.js';
	import { clock } from '#stores/clock.svelte.js';
	import { tooltip as tooltipStore } from '#stores/tooltip.svelte.js';

	interface Props {
		active?: boolean;
		onClick: (e: MouseEvent) => void;
		/** End of the period already paid, a generator turned back on before it costs nothing. */
		paidUntil?: number;
	}

	let { active = false, onClick, paidUntil = 0 }: Props = $props();

	const Icon = ICONS.overdrive;

	let trigger = $state<HTMLButtonElement>();

	const paidSeconds = $derived(Math.max(0, Math.ceil((paidUntil - clock.now) / 1000)));
	const affordable = $derived(
		active || paidSeconds > 0 || currenciesManager.getAmount(CurrenciesTypes.HIGGS_BOSON) >= OVERDRIVE_COST,
	);

	function showTooltip() {
		if (!trigger) return;
		tooltipStore.show({ content, position: 'top', size: 'sm', triggerRect: trigger.getBoundingClientRect() });
	}
</script>

{#snippet content()}
	<div class="flex flex-col gap-1">
		<p class="text-xs text-white/80">
			{OVERDRIVE_MULTIPLIER}x production. Costs {OVERDRIVE_COST} Higgs Boson every {OVERDRIVE_PERIOD_MS / 60_000} minutes, turns off when you run
			out.
		</p>
		{#if paidSeconds > 0}
			<p class="text-xs text-white/60">Paid for {Math.floor(paidSeconds / 60)}:{String(paidSeconds % 60).padStart(2, '0')} more</p>
		{/if}
	</div>
{/snippet}

<button
	bind:this={trigger}
	class="inline-flex items-center rounded-sm px-1.5 py-0.5 transition-colors duration-200 {active ?
		'bg-amber-400/20 hover:bg-amber-400/30'
	:	'bg-white/10 hover:bg-white/15'} {affordable ? '' : 'cursor-not-allowed opacity-40'}"
	aria-disabled={!affordable}
	aria-label="Overdrive"
	aria-pressed={active}
	data-hint="overdrive"
	onblur={() => tooltipStore.hide()}
	onclick={onClick}
	onfocus={showTooltip}
	onmouseenter={showTooltip}
	onmouseleave={() => tooltipStore.hide()}
>
	<Icon color={active ? '#fbbf24' : 'rgb(255 255 255 / 0.5)'} size={16} />
</button>
