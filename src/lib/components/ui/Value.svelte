<script lang="ts">
	import {CURRENCIES, type CurrencyName} from '#data/currencies.js';
	import {formatNumber} from '#lib/utils.js';
	import Currency from '#components/ui/Currency.svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SpanAttributes = SvelteHTMLElements['span'];

	interface Props extends SpanAttributes {
		class?: string;
		currency?: CurrencyName | undefined;
		currencyClass?: string;
		postfix?: string;
		precision?: number | undefined;
		prefix?: string;
		value: number;
	}

	let {
		class: className = '',
		currency = undefined,
		currencyClass = '',
		postfix = '',
		precision = undefined,
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
