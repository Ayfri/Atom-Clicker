<script lang="ts">
	import {
		APERTURE_STEP,
		APERTURE_WIDEN_MS,
		COSMOS_INSTRUMENTS,
		COSMOS_OBJECTS_BY_ID,
		type CosmosObject,
		formatMagnitude,
		SKY_SECTIONS,
		studyCost,
	} from '#data/cosmos.js';
	import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
	import { cosmosFx } from '#helpers/cosmosFx.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { reveal } from '#helpers/reveals.svelte.js';
	import type { EffectStat } from '#lib/types.js';
	import { formatDuration, formatNumber } from '#lib/utils.js';
	import Blueprint from '#components/cosmos/Blueprint.svelte';
	import Iris from '#components/cosmos/Iris.svelte';
	import SkyThumbnail from '#components/cosmos/SkyThumbnail.svelte';
	import Currency from '#components/ui/Currency.svelte';
	import FillLine from '#components/ui/FillLine.svelte';
	import Tabs from '#components/ui/Tabs.svelte';
	import { Aperture, Check, ChevronsUp, Cog, Factory, Lock, MousePointerClick, Orbit, Shield, ShieldHalf, ShieldPlus, Telescope, Timer, X, Zap } from '@lucide/svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	interface Props {
		onBuyInstrument: (id: string, event: MouseEvent) => void;
		onClose: () => void;
		onFocus: (id: string) => void;
		onStudy: (id: string, event: MouseEvent) => void;
	}

	let { onBuyInstrument, onClose, onFocus, onStudy }: Props = $props();

	const TABS = [
		{ icon: Orbit, id: 'objects', label: 'Objects' },
		{ icon: Telescope, id: 'instruments', label: 'Instruments' },
	] as const;

	const CHIP =
		'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-white/6 px-2.5 py-1.5 ring-1 ring-cosmos-signal/30 transition-colors enabled:hover:bg-cosmos-signal/15 disabled:cursor-not-allowed disabled:ring-white/8';

	let tab = $state<(typeof TABS)[number]['id']>('objects');

	const starlight = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT));

	const BOOST_ICONS: Partial<Record<EffectStat, typeof Factory | CurrencyName>> = {
		blue_light_gain: CurrenciesTypes.BLUE_LIGHT,
		click: MousePointerClick,
		electron_gain: CurrenciesTypes.ELECTRONS,
		excited_photon_chance: CurrenciesTypes.EXCITED_PHOTONS,
		generator: Cog,
		global: Factory,
		green_light_gain: CurrenciesTypes.GREEN_LIGHT,
		photon_value: CurrenciesTypes.PHOTONS,
		power_up_duration: Timer,
		power_up_multiplier: Zap,
		proton_gain: CurrenciesTypes.PROTONS,
		red_light_gain: CurrenciesTypes.RED_LIGHT,
		stability_boost: ShieldPlus,
		stability_capacity: Shield,
		stability_speed: ShieldHalf,
		xp_gain: ChevronsUp,
	};

	const shown = $derived(new Set(cosmosManager.objects.map(object => object.id)));

	const sections = $derived(
		SKY_SECTIONS.map(ids =>
			ids
				.filter(id => shown.has(id) && !COSMOS_OBJECTS_BY_ID[id].orbits)
				.map(id => ({
					children: ids.filter(child => shown.has(child) && COSMOS_OBJECTS_BY_ID[child].orbits === id).map(child => COSMOS_OBJECTS_BY_ID[child]),
					object: COSMOS_OBJECTS_BY_ID[id],
				})),
		).filter(section => section.length),
	);
</script>

{#snippet starlightAmount(amount: number, affordable: boolean)}
	<span class={['flex items-center gap-1 font-mono text-xs tabular-nums', !affordable && 'text-red-300']}>
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
			class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
			onclick={() => onFocus(object.id)}
		>
			<SkyThumbnail
				color={object.color}
				id={object.id}
				small={!!object.orbits}
			/>
			<span class="flex min-w-0 flex-col gap-0.5">
				<span class="flex min-w-0 items-center gap-2">
					<span class="truncate text-sm font-semibold text-white">{object.name}</span>
					<span class="shrink-0 font-mono text-[0.7rem] tabular-nums text-cosmos-starlight/60">{formatNumber(cosmosManager.starlightOf(object.id))}/s</span>
				</span>
				<span class="flex min-w-0 items-center gap-1 text-xs text-white/60">
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
			</span>
		</button>
		<button
			class={[CHIP, !cosmosManager.unlocked && 'opacity-40']}
			aria-label="Study {object.name}"
			data-hint="cosmos-study"
			disabled={!cosmosManager.unlocked || starlight < cost}
			onclick={event => onStudy(object.id, event)}
		>
			<span class="text-[0.65rem] text-white/60">Lv {level}</span>
			{@render starlightAmount(cost, starlight >= cost)}
		</button>
	</div>
{/snippet}

<section
	class="flex max-h-full min-h-0 flex-col rounded-xl bg-cosmos-hud/95 shadow-2xl ring-1 ring-white/10"
	transition:fly|global={{ duration: 300, easing: cubicOut, x: '-110%' }}
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
			{#each sections as groups, i (i)}
				{#if i}
					<li
						class="mx-2 my-1.5 border-t border-white/10"
						role="separator"
					></li>
				{/if}
				{#each groups as { children, object } (object.id)}
					<li>
						{@render row(object)}
						{#if children.length}
							<ul class="ml-3.5 border-l border-white/10 pl-1.5">
								{#each children as child (child.id)}
									<li>{@render row(child)}</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			{/each}
		{:else}
			<li class="flex items-center gap-3 rounded-lg px-2 py-2">
				<Aperture
					class="shrink-0 text-accent-300"
					size={18}
				/>
				<div class="min-w-0 flex-1">
					<p class="text-sm font-semibold text-white">Aperture <span class="ml-1 text-xs font-normal text-white/40">Lv {cosmosManager.aperture}</span></p>
					<p class="text-xs text-white/50">
						{#if cosmosManager.apertureMaxed}
							Your sight reaches magnitude {formatMagnitude(cosmosManager.limit)}, as far as {cosmosManager.instrument.name} goes.
						{:else}
							Your sight reaches magnitude {formatMagnitude(cosmosManager.limit)}, each level {APERTURE_STEP} fainter.
						{/if}
					</p>
				</div>
				{const widening = $derived(cosmosManager.wideningMs > 0)}
				{#if cosmosManager.apertureMaxed && !widening}
					<Check
						class="shrink-0 text-accent-300"
						size={18}
					/>
				{:else}
					<button
						class={[CHIP, 'relative overflow-hidden', !cosmosManager.unlocked && 'opacity-40']}
						disabled={!cosmosManager.unlocked || widening || starlight < cosmosManager.nextApertureCost}
						onclick={event => cosmosManager.purchaseAperture() && cosmosFx.aperture(event)}
					>
						{#if widening}
							<FillLine duration={APERTURE_WIDEN_MS} />
							<Iris
								class="text-accent-300"
								durationMs={APERTURE_WIDEN_MS}
								progress={1 - cosmosManager.wideningMs / APERTURE_WIDEN_MS}
								size={16}
							/>
							<span class="text-xs">Widening…</span>
						{:else}
							{@render starlightAmount(cosmosManager.nextApertureCost, starlight >= cosmosManager.nextApertureCost)}
						{/if}
					</button>
				{/if}
			</li>
			{#each COSMOS_INSTRUMENTS as instrument (instrument.id)}
				{const owned = $derived(cosmosManager.owns(instrument))}
				{const next = $derived(cosmosManager.nextInstrument?.id === instrument.id)}
				<li class={['flex items-center gap-3 rounded-lg px-2 py-2', !owned && !next && 'opacity-50']}>
					<div class="min-w-0 flex-1">
						{#if owned || next}
							<p class="text-sm font-semibold text-white">
								{instrument.name} <span class="ml-1 text-xs font-normal text-white/40">{instrument.year}</span>
							</p>
							<p class="text-xs text-white/50">{instrument.description}</p>
							{#if next && !cosmosManager.apertureMaxed && !cosmosManager.research}
								<p class="mt-0.5 text-xs text-accent-300">Widen your sight to magnitude {formatMagnitude(cosmosManager.instrument.reach)} to build it.</p>
							{/if}
						{:else}
							<p class="text-sm font-semibold text-white">????</p>
							<p class="text-xs text-white/50">????</p>
						{/if}
					</div>
					{#if owned}
						<Check
							class="shrink-0 text-accent-300"
							size={18}
						/>
					{:else if cosmosManager.research?.id === instrument.id}
						<Blueprint
							class="size-8"
							id={instrument.id}
							progress={1 - cosmosManager.research.leftMs / instrument.researchMs}
						/>
						<span class="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-white/60">{formatDuration(cosmosManager.research.leftMs)}</span>
					{:else if next && cosmosManager.apertureMaxed}
						<button
							class={[CHIP, !cosmosManager.unlocked && 'opacity-40']}
							disabled={!cosmosManager.unlocked || starlight < instrument.cost}
							in:reveal
							onclick={event => onBuyInstrument(instrument.id, event)}
						>
							{@render starlightAmount(instrument.cost, starlight >= instrument.cost)}
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
