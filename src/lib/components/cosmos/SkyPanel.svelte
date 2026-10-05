<script lang="ts">
	import { COSMOS_INSTRUMENTS, studyCost } from '#data/cosmos.js';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import Currency from '#components/ui/Currency.svelte';
	import { Check, Lock, Orbit, X } from '@lucide/svelte';

	interface Props {
		onBuyInstrument: (id: string) => void;
		onClose: () => void;
		onFocus: (id: string) => void;
		onStudy: (id: string) => void;
	}

	let { onBuyInstrument, onClose, onFocus, onStudy }: Props = $props();

	let tab = $state<'instruments' | 'objects'>('objects');

	const starlight = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT));
</script>

{#snippet starlightAmount(amount: number)}
	<span class="flex items-center gap-1 font-mono text-xs tabular-nums">
		<Currency
			name={CurrenciesTypes.STARLIGHT}
			size={12}
		/>
		{formatNumber(amount)}
	</span>
{/snippet}

<section class="flex max-h-full flex-col rounded-2xl border border-white/10 bg-accent-900/95 shadow-2xl backdrop-blur-xs">
	<header class="flex items-center gap-1 p-2">
		{#each [['objects', 'Objects'], ['instruments', 'Instruments']] as const as [id, label] (id)}
			<button
				class={['rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', tab === id ? 'bg-accent-600 text-white' : 'text-white/50 hover:text-white']}
				onclick={() => (tab = id)}
			>
				{label}
			</button>
		{/each}
		<button
			class="ml-auto grid size-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
			aria-label="Close"
			onclick={onClose}
		>
			<X size={18} />
		</button>
	</header>

	<ul class="flex flex-col overflow-y-auto overscroll-contain px-2 pb-2">
		{#if tab === 'objects'}
			{#each cosmosManager.objects as object (object.id)}
				{@const level = cosmosManager.level(object.id)}
				{@const cost = studyCost(object, level)}
				<li class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
					<button
						class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
						onclick={() => onFocus(object.id)}
					>
						<span
							class="size-3 shrink-0 rounded-full"
							style:background-color={object.color}
						></span>
						<span class="min-w-0">
							<span class="block truncate text-sm font-semibold text-white">{object.name}</span>
							<span class="block truncate text-xs text-white/50">
								+{Math.round(object.boost.amount * (level + 1) * 100)}% {object.boost.label} · {formatNumber(cosmosManager.starlightOf(object.id))}/s
							</span>
						</span>
					</button>
					<button
						class="flex shrink-0 items-center gap-2 rounded-lg bg-accent-600 px-2.5 py-1.5 text-white transition-colors enabled:hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
						aria-label="Study {object.name}"
						disabled={!cosmosManager.unlocked || starlight < cost}
						onclick={() => onStudy(object.id)}
					>
						<Orbit size={14} />
						<span class="text-xs text-white/60">{level}</span>
						{@render starlightAmount(cost)}
					</button>
				</li>
			{/each}
		{:else}
			{#each COSMOS_INSTRUMENTS as instrument (instrument.id)}
				{@const owned = cosmosManager.ownsEra(instrument.era)}
				{@const next = cosmosManager.nextInstrument?.id === instrument.id}
				<li class={['flex items-center gap-3 rounded-lg px-2 py-2', !owned && !next && 'opacity-50']}>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold text-white">
							{instrument.name} <span class="text-xs font-normal text-white/40">{instrument.year}</span>
						</p>
						<p class="text-xs text-white/50">{instrument.description}</p>
					</div>
					{#if owned}
						<Check
							class="shrink-0 text-accent-300"
							size={18}
						/>
					{:else if next}
						<button
							class="shrink-0 rounded-lg bg-accent-600 px-2.5 py-1.5 text-white transition-colors enabled:hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={!cosmosManager.unlocked || starlight < instrument.cost}
							onclick={() => onBuyInstrument(instrument.id)}
						>
							{@render starlightAmount(instrument.cost)}
						</button>
					{:else}
						<Lock
							class="shrink-0 text-white/40"
							size={16}
						/>
					{/if}
				</li>
			{/each}
		{/if}
	</ul>
</section>
