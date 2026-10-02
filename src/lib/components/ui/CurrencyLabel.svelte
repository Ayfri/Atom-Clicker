<script lang="ts">
	import Currency from '#components/ui/Currency.svelte';
	import { CURRENCIES, type CurrencyName } from '#data/currencies.js';

	interface Props {
		class?: string;
		name: CurrencyName;
		size?: number;
	}

	let { class: className = '', name, size = 12 }: Props = $props();

	const currency = $derived(CURRENCIES[name]);
</script>

<span class="inline-flex items-center gap-0.5 align-tFop whitespace-nowrap {className}" style="color: {currency.color}">
	<Currency {name} {size} />
	{currency.name}
</span>
