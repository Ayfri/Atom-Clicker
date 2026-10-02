<script lang="ts">
	import Currency from '#components/ui/Currency.svelte';
	import { CURRENCIES, CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
	import { formatNumber } from '#lib/utils.js';

	interface Props {
		earned: Partial<Record<CurrencyName, number>>;
	}

	let { earned }: Props = $props();

	const types = $derived(Object.values(CurrenciesTypes).filter(type => (earned[type] ?? 0) > 0));
</script>

{#if types.length > 0}
	<section class="rounded-2xl border border-white/10 bg-black/20 p-4">
		<h3 class="mb-3 text-xs font-semibold tracking-wider text-white/40 uppercase">Earned all time</h3>
		<div class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
			{#each types as type (type)}
				<div class="flex items-center gap-2.5">
					<Currency name={type} size={26} />
					<span class="flex flex-col leading-tight">
						<span class="text-lg font-bold tabular-nums" style:color={CURRENCIES[type].color}>{formatNumber(earned[type] ?? 0)}</span>
						<span class="text-xs text-white/50">{type}</span>
					</span>
				</div>
			{/each}
		</div>
	</section>
{/if}
