<script lang="ts">
	import { APERTURE_STEP, APERTURE_WIDEN_MS, COSMOS_INSTRUMENTS, type CosmosObject, formatMagnitude, studyCost } from '#data/cosmos.js';
	import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import type { EffectStat } from '#lib/types.js';
	import { formatDuration, formatNumber } from '#lib/utils.js';
	import Currency from '#components/ui/Currency.svelte';
	import FillLine from '#components/ui/FillLine.svelte';
	import Tabs from '#components/ui/Tabs.svelte';
	import { Aperture, Check, ChevronsUp, Cog, Factory, Lock, MousePointerClick, Orbit, Shield, ShieldPlus, Telescope, Timer, X, Zap } from '@lucide/svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	interface Props {
		onBuyInstrument: (id: string) => void;
		onClose: () => void;
		onFocus: (id: string) => void;
		onStudy: (id: string) => void;
	}

	let { onBuyInstrument, onClose, onFocus, onStudy }: Props = $props();

	const TABS = [
		{ icon: Orbit, id: 'objects', label: 'Objects' },
		{ icon: Telescope, id: 'instruments', label: 'Instruments' },
	] as const;

	let tab = $state<(typeof TABS)[number]['id']>('objects');

	const starlight = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT));

	/** What each boost raises: a currency shows its own icon, the other stats a pictogram. */
	const BOOST_ICONS: Partial<Record<EffectStat, typeof Factory | CurrencyName>> = {
		click: MousePointerClick,
		electron_gain: CurrenciesTypes.ELECTRONS,
		generator: Cog,
		global: Factory,
		photon_value: CurrenciesTypes.PHOTONS,
		power_up_duration: Timer,
		power_up_multiplier: Zap,
		proton_gain: CurrenciesTypes.PROTONS,
		stability_boost: ShieldPlus,
		stability_capacity: Shield,
		xp_gain: ChevronsUp,
	};

	/** Planets in discovery order, each followed by its discovered moons and rings. */
	const groups = $derived(
		cosmosManager.objects.filter(object => !object.orbits).map(object => ({ children: cosmosManager.objects.filter(child => child.orbits === object.id), object })),
	);
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

{#snippet row(object: CosmosObject)}
	{const level = $derived(cosmosManager.level(object.id))}
	{const cost = $derived(studyCost(object, level))}
	{const icon = $derived(BOOST_ICONS[object.boost.stat])}
	<div class="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
		<button
			class="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
			onclick={() => onFocus(object.id)}
		>
			<span class="flex min-w-0 items-center gap-2">
				<span
					class="size-2.5 shrink-0 rounded-full"
					style:background-color={object.color}
				></span>
				<span class="truncate text-sm font-semibold text-white">{object.name}</span>
				<span class="shrink-0 font-mono text-[0.7rem] tabular-nums text-[#cfe8ff]/60">{formatNumber(cosmosManager.starlightOf(object.id))}/s</span>
			</span>
			<span class="flex min-w-0 items-center gap-1 pl-4.5 text-xs text-white/60">
				{#if typeof icon === 'string'}
					<Currency
						name={icon}
						size={13}
					/>
				{:else if icon}
					{const Icon = $derived(icon)}
					<Icon
						class="shrink-0 text-accent-300"
						size={13}
					/>
				{/if}
				<span class="font-mono tabular-nums text-white/85">+{Math.round(object.boost.amount * (level + 1) * 100)}%</span>
				<span class="truncate">{object.boost.label}</span>
			</span>
		</button>
		<button
			class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-accent-600 px-2.5 py-1.5 text-white transition-colors enabled:hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
			aria-label="Study {object.name}"
			data-hint="cosmos-study"
			disabled={!cosmosManager.unlocked || starlight < cost}
			onclick={() => onStudy(object.id)}
		>
			<span class="text-[0.65rem] text-white/60">Lv {level}</span>
			{@render starlightAmount(cost)}
		</button>
	</div>
{/snippet}

<!-- Slides in from the left edge like a drawer, the sky stays visible and clickable beside it. -->
<section
	class="flex max-h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-accent-900/95 shadow-2xl backdrop-blur-xs"
	transition:fly={{ duration: 300, easing: cubicOut, x: '-110%' }}
>
	<header class="flex items-center gap-2 p-2">
		<Tabs
			buttonClass="px-3 py-1.5 text-sm"
			class="flex-1"
			onselect={id => (tab = id)}
			selected={tab}
			tabs={TABS}
		/>
		<button
			class="grid size-9 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
			aria-label="Close"
			onclick={onClose}
		>
			<X size={18} />
		</button>
	</header>

	<ul class="custom-scrollbar flex min-h-0 flex-col overflow-y-auto overscroll-contain px-2 pb-2">
		{#if tab === 'objects'}
			{#each groups as { children, object } (object.id)}
				<li>
					{@render row(object)}
					{#if children.length}
						<!-- Moons and rings hang under their planet, a neutral guide line ties them to it. -->
						<ul class="ml-3.5 border-l border-white/10 pl-1.5">
							{#each children as child (child.id)}
								<li>{@render row(child)}</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		{:else}
			<li class="flex items-center gap-3 rounded-lg px-2 py-2">
				<Aperture
					class="shrink-0 text-accent-300"
					size={18}
				/>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-semibold text-white">Aperture <span class="text-xs font-normal text-white/40">Lv {cosmosManager.aperture}</span></p>
					<p class="text-xs text-white/50">Your sight reaches magnitude {formatMagnitude(cosmosManager.limit)}, each level {APERTURE_STEP} fainter.</p>
				</div>
				{const widening = $derived(cosmosManager.wideningMs > 0)}
				<button
					class={[
						'relative shrink-0 overflow-hidden whitespace-nowrap rounded-lg bg-accent-600 px-2.5 py-1.5 text-white transition-colors enabled:hover:bg-accent-500 disabled:cursor-not-allowed',
						!widening && 'disabled:opacity-40',
					]}
					disabled={!cosmosManager.unlocked || widening || starlight < cosmosManager.nextApertureCost}
					onclick={() => cosmosManager.purchaseAperture()}
				>
					{#if widening}
						<FillLine duration={APERTURE_WIDEN_MS} />
						<span class="text-xs">Widening…</span>
					{:else}
						{@render starlightAmount(cosmosManager.nextApertureCost)}
					{/if}
				</button>
			</li>
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
					{:else if cosmosManager.research?.id === instrument.id}
						<span class="flex w-24 shrink-0 flex-col items-end gap-1">
							<span class="font-mono text-xs tabular-nums text-white/60">{formatDuration(cosmosManager.research.leftMs)}</span>
							<span class="h-1 w-full overflow-hidden rounded-full bg-white/10">
								<span
									class="block h-full origin-left bg-[#ffd27a] transition-transform duration-1000 ease-linear"
									style:transform="scaleX({1 - cosmosManager.research.leftMs / instrument.researchMs})"
								></span>
							</span>
						</span>
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
