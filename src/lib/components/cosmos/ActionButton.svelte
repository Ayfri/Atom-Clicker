<script lang="ts">
	import type { CurrencyName } from '#data/currencies.js';
	import { formatNumber } from '#lib/utils.js';
	import Currency from '#components/ui/Currency.svelte';
	import FillLine from '#components/ui/FillLine.svelte';
	import type { Telescope } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		busyMs?: number;
		class?: ClassValue;
		cost?: { affordable: boolean; amount: number; currency: CurrencyName };
		disabled?: boolean;
		hint?: string;
		icon?: typeof Telescope;
		label: string;
		onclick: (event: MouseEvent) => void;
		pulse?: boolean;
		sub?: string;
		tile?: Snippet;
	}

	let { busyMs = 0, class: className, cost, disabled = false, hint, icon: Icon, label, onclick, pulse = false, sub, tile }: Props = $props();

	const muted = $derived(disabled && !busyMs);
</script>

<button
	class={[
		'group relative flex h-14 items-center gap-3 overflow-hidden rounded-xl bg-cosmos-hud/90 pl-2 pr-4 text-left ring-1 transition-[scale,box-shadow] duration-150 enabled:active:scale-[0.98]',
		muted ? 'cursor-not-allowed ring-white/10' : 'ring-accent-400/45 shadow-[0_0_20px_rgb(74_144_226/0.35)] enabled:hover:ring-accent-400',
		busyMs > 0 && 'cursor-progress',
		className,
	]}
	data-hint={hint}
	disabled={disabled || busyMs > 0}
	{onclick}
>
	{#if busyMs > 0}
		<FillLine duration={busyMs} />
	{/if}
	{#if pulse}
		<span
			class="action-pulse pointer-events-none absolute inset-0 rounded-xl shadow-[0_0_28px_-2px_var(--color-accent-400)] motion-reduce:hidden"
			aria-hidden="true"
		></span>
	{/if}
	<span class={['grid size-10 shrink-0 place-items-center rounded-lg', muted ? 'bg-white/8 text-white/40' : 'bg-accent-500 text-white']}>
		{#if tile}
			{@render tile()}
		{:else if Icon}
			<Icon size={20} />
		{/if}
	</span>
	<span class="flex min-w-0 flex-col">
		<span class={['truncate text-sm font-semibold', muted ? 'text-white/60' : 'text-white']}>{label}</span>
		{#if sub || cost}
			<span class="flex items-center gap-1.5 font-mono text-xs tabular-nums text-white/55">
				{sub}
				{#if cost}
					<span class={['flex items-center gap-1', muted ? 'text-white/50' : cost.affordable ? 'text-white' : 'text-red-300']}>
						<Currency
							name={cost.currency}
							size={13}
						/>
						{formatNumber(cost.amount)}
					</span>
				{/if}
			</span>
		{/if}
	</span>
</button>

<style>
	/** A few beats then a steady glow: an endless one restyles on every frame the 3D sky draws, about 150 times a second. */
	.action-pulse {
		animation: action-pulse 1.2s ease-in-out 5 alternate forwards;
	}

	@keyframes action-pulse {
		from {
			opacity: 0.2;
		}
		to {
			opacity: 0.7;
		}
	}
</style>
