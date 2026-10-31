<script lang="ts">
	import { CHROMATIC, CHROMATIC_COLORS } from '#data/chromatic.js';
	import { COSMOS_OBJECTS_BY_ID, studyCost } from '#data/cosmos.js';
	import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import ActionButton from '#components/cosmos/ActionButton.svelte';
	import SiteLine from '#components/cosmos/SiteLine.svelte';
	import Currency from '#components/ui/Currency.svelte';
	import { ChevronDown, Orbit, X } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		id: string;
		onClose: () => void;
		onStudy: (event: MouseEvent) => void;
	}

	let { id, onClose, onStudy }: Props = $props();

	/** Stays open from one object to the next, the panel is not remounted when `id` changes. */
	let detailsOpen = $state(false);

	const object = $derived(COSMOS_OBJECTS_BY_ID[id]);
	const level = $derived(cosmosManager.level(id));
	const cost = $derived(studyCost(object, level));
	const skyLight = $derived(cosmosManager.skyLightOf(id));
	const affordable = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) >= cost);
</script>

<article class="flex flex-col gap-3 rounded-xl bg-cosmos-hud/95 p-4 shadow-2xl ring-1 ring-white/10">
	<header class="flex items-start gap-1">
		<div class="min-w-0 flex-1">
			<p class="text-[10px] font-semibold uppercase tracking-widest text-white/40">{object.year} · {object.discoverer}</p>
			<h2
				class="text-xl font-bold"
				style:color={object.color}
			>
				{object.name}
			</h2>
		</div>
		<button
			class="grid size-9 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
			aria-label="Close"
			onclick={onClose}
		>
			<X size={18} />
		</button>
	</header>

	<div>
		<p class="text-sm text-white/75">{object.fact}</p>
		<button
			class="-mb-1 flex min-h-8 items-center gap-1 text-xs text-accent-300 hover:text-accent-200"
			aria-expanded={detailsOpen}
			onclick={() => (detailsOpen = !detailsOpen)}
		>
			{detailsOpen ? 'Less' : `More about ${object.name}`}
			<ChevronDown
				class="transition-transform {detailsOpen ? 'rotate-180' : ''}"
				size={14}
			/>
		</button>
		{#if detailsOpen}
			<p
				class="max-h-40 overflow-y-auto overscroll-contain text-sm leading-relaxed text-white/70 md:max-h-56"
				transition:slide={{ duration: 180 }}
			>
				{object.details}
			</p>
		{/if}
	</div>

	<dl class="grid grid-cols-2 gap-3 text-sm">
		<div>
			<dt class="text-[10px] font-semibold uppercase tracking-widest text-white/40">Radiates</dt>
			<dd class="flex flex-col gap-0.5 font-mono tabular-nums">
				<span class="flex items-center gap-1 text-cosmos-starlight">
					<Currency
						name={CurrenciesTypes.STARLIGHT}
						size={14}
					/>
					{formatNumber(cosmosManager.starlightOf(id))}/s
				</span>
				{#each CHROMATIC_COLORS as color (color)}
					{@const rate = skyLight[color] ?? 0}
					{#if rate > 0}
						<span
							class="flex items-center gap-1"
							style:color={CURRENCIES[CHROMATIC[color].currency].color}
						>
							<Currency
								name={CHROMATIC[color].currency}
								size={14}
							/>
							{formatNumber(rate)}/s
						</span>
					{/if}
				{/each}
			</dd>
		</div>
		<div>
			<dt class="text-[10px] font-semibold uppercase tracking-widest text-white/40">Boost</dt>
			<dd class="font-semibold text-white">+{Math.round(object.boost.amount * (level + 1) * 100)}% {object.boost.label}</dd>
		</div>
	</dl>

	<SiteLine objectId={id} />

	<ActionButton
		class="w-full"
		cost={{ affordable, amount: cost, currency: CurrenciesTypes.STARLIGHT }}
		disabled={!affordable || !cosmosManager.unlocked}
		hint="cosmos-study"
		icon={Orbit}
		label="Study"
		onclick={onStudy}
		sub="Lv {level}"
	/>
</article>
