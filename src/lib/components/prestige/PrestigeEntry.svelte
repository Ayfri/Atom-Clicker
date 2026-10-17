<script lang="ts">
	import Currency from '#components/ui/Currency.svelte';
	import type { CurrencyName } from '#data/currencies.js';

	interface Props {
		currencies?: CurrencyName[];
		label: string;
	}

	let { currencies = [], label }: Props = $props();
</script>

<span>
	{#each currencies as currency (currency)}
		<Currency
			class="mr-0.5 -mt-0.5 align-middle"
			name={currency}
			size={15}
		/>
	{/each}
	{label}
</span>
