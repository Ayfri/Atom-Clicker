<script lang="ts">
	import Currency from '#components/ui/Currency.svelte';
	import { CURRENCIES, type CurrencyName } from '#data/currencies.js';
	import { formatNumber } from '#lib/utils.js';
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SpanAttributes = SvelteHTMLElements['span'];

	interface Props extends SpanAttributes {
		class?: string;
		currency?: CurrencyName;
		currencyClass?: string;
		postfix?: string;
		precision?: number;
		prefix?: string;
		value: number;
	}

	let {
		class: className = '',
		currency,
		currencyClass = '',
		postfix = '',
		precision,
		prefix = '',
		value,
		...rest
	}: Props = $props();

	const currencyObject = $derived(currency ? CURRENCIES[currency] : undefined);
</script>

<span title={currencyObject?.name} class="inline-flex items-center gap-1 {className}" {...rest}>
	{prefix}{formatNumber(value, precision)}
	{#if currency}
		<Currency name={currency} class={currencyClass} size={18}/>
	{/if}
	{postfix}
</span>
