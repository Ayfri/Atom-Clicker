<script lang="ts">
	import { CHROMATIC, CHROMATIC_COLORS } from '#data/chromatic.js';
	import { COSMOS_OBJECTS_BY_ID, studyCost } from '#data/cosmos.js';
	import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import Currency from '#components/ui/Currency.svelte';
	import { Globe, Orbit, X } from '@lucide/svelte';

	interface Props {
		id: string;
		onClose: () => void;
		/** Shown away from the Earth, flies the camera back home. */
		onHome?: () => void;
		onStudy: () => void;
	}

	let { id, onClose, onHome, onStudy }: Props = $props();

	const object = $derived(COSMOS_OBJECTS_BY_ID[id]);
	const level = $derived(cosmosManager.level(id));
	const cost = $derived(studyCost(object, level));
	const skyLight = $derived(cosmosManager.skyLightOf(id));
	const affordable = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) >= cost);
</script>

<article class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-linear-to-br from-accent-900/95 to-accent-800/95 p-4 shadow-2xl backdrop-blur-xs">
	<header class="flex items-start gap-3">
		<div class="min-w-0 flex-1">
			<p class="text-xs text-white/50">{object.year} · {object.discoverer}</p>
			<h2
				class="text-xl font-bold"
				style:color={object.color}
			>
				{object.name}
			</h2>
		</div>
		<button
			class="grid size-8 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
			aria-label="Close"
			onclick={onClose}
		>
			<X size={18} />
		</button>
	</header>

	<p class="text-sm text-white/75">{object.fact}</p>

	<dl class="grid grid-cols-2 gap-3 text-sm">
		<div>
			<dt class="text-xs text-white/50">Radiates</dt>
			<dd class="flex flex-col gap-0.5 font-mono tabular-nums">
				<span class="flex items-center gap-1 text-[#cfe8ff]">
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
			<dt class="text-xs text-white/50">Boost</dt>
			<dd class="font-semibold text-white">+{Math.round(object.boost.amount * (level + 1) * 100)}% {object.boost.label}</dd>
		</div>
	</dl>

	<div class="flex gap-2">
		<button
			class="flex flex-1 items-center justify-between gap-2 rounded-lg bg-accent-600 px-3 py-2 font-semibold text-white transition-colors enabled:hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
			data-hint="cosmos-study"
			disabled={!affordable || !cosmosManager.unlocked}
			onclick={onStudy}
		>
			<span class="flex items-center gap-1.5">
				<Orbit size={16} />
				Study <span class="text-xs font-normal text-white/60">lvl {level}</span>
			</span>
			<span class="flex items-center gap-1 font-mono text-sm tabular-nums">
				<Currency
					name={CurrenciesTypes.STARLIGHT}
					size={14}
				/>
				{formatNumber(cost)}
			</span>
		</button>
		{#if onHome}
			<button
				class="grid size-10 place-items-center rounded-lg border border-accent-500/30 bg-accent-500/15 text-accent-300 transition-colors hover:bg-accent-500/25"
				aria-label="Back to the Earth"
				title="Back to the Earth"
				onclick={onHome}
			>
				<Globe size={18} />
			</button>
		{/if}
	</div>
</article>
