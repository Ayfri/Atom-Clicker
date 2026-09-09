<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import { CURRENCIES, type CurrencyName } from '$data/currencies';
	import Currency from '@components/ui/Currency.svelte';

	interface Props {
		currency?: CurrencyName;
		description?: string;
		fullValue?: string;
		icon?: LucideIcon;
		label: string;
		prefix?: string;
		suffix?: string;
		value: string | number;
		valueClass?: string;
	}

	let {
		currency,
		description,
		fullValue,
		icon: Icon,
		label,
		prefix = '',
		suffix = '',
		value,
		valueClass = 'text-accent',
	}: Props = $props();

	const currencyData = $derived(currency ? CURRENCIES[currency] : undefined);
</script>

<div
	class="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-2.5 transition-colors hover:bg-white/10"
	title={fullValue || undefined}
>
	<div class="flex items-center gap-2">
		{#if Icon || currency}
			<div class="flex size-6 shrink-0 items-center justify-center text-accent-300">
				{#if currency}
					<Currency name={currency} />
				{:else if Icon}
					<Icon size={16} />
				{/if}
			</div>
		{/if}
		<div class="flex flex-col">
			<span class="text-sm text-white/70">{label}</span>
			{#if description}
				<span class="text-xs text-white/40">{description}</span>
			{/if}
		</div>
	</div>
	<span
		class="font-semibold tabular-nums {currency ? '' : valueClass}"
		style:color={currencyData?.color}
	>
		{prefix}{value}{suffix}
	</span>
</div>
