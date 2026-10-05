<script lang="ts">
	import { dev } from '$app/env';
	import { APERTURE_WIDEN_MS, COSMOS_INSTRUMENTS, COSMOS_OBJECTS_BY_ID, formatMagnitude } from '#data/cosmos.js';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import type { CosmosScene } from '#lib/cosmos/CosmosScene.svelte.js';
	import { formatDuration, formatNumber } from '#lib/utils.js';
	import { ui } from '#stores/ui.svelte.js';
	import ObjectPanel from '#components/cosmos/ObjectPanel.svelte';
	import SkyPanel from '#components/cosmos/SkyPanel.svelte';
	import Currency from '#components/ui/Currency.svelte';
	import FillLine from '#components/ui/FillLine.svelte';
	import { Aperture, ChevronDown, ChevronRight, List, RotateCcw, Telescope, X } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { MediaQuery } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';

	interface Popup {
		key: number;
		text: string;
		x: number;
		y: number;
	}

	/** The followed object survives reloads of the tab, the view reopens on it. */
	const FOCUS_KEY = 'cosmos-focus';
	const wide = new MediaQuery('(min-width: 768px)');

	let arrow = $state<HTMLElement>();
	let canvas = $state<HTMLCanvasElement>();
	let failure = $state('');
	let popups = $state.raw<Popup[]>([]);
	let progress = $state<HTMLElement>();
	let scene = $state.raw<CosmosScene | null>(null);

	$effect(() => {
		if (!arrow || !canvas || !progress) return;
		const hud = { arrow, progress };
		const target = canvas;
		const discovered = untrack(() => [...cosmosManager.discovered]);
		const focus = sessionStorage.getItem(FOCUS_KEY) ?? undefined;
		let created: CosmosScene | null = null;
		let disposed = false;
		(async () => {
			const tools = dev ? await import('#lib/cosmos/devTools.js') : null;
			/** Three.js is a ~280 KB gzip chunk, only fetched once the Cosmos opens. */
			const { CosmosScene } = await import('#lib/cosmos/CosmosScene.svelte.js');
			const instance = await CosmosScene.create(target, {
				discovered,
				focus,
				hud,
				limit: untrack(() => cosmosManager.limit),
				live: tools?.liveSurfaces(focus),
				onDiscover: id => cosmosManager.discover(id),
				timestamps: dev,
			});
			if (disposed) return instance.dispose();
			created = instance;
			scene = instance;
			tools?.installDevTools(instance);
		})().catch((error: unknown) => (failure = error instanceof Error ? error.message : String(error)));
		return () => {
			disposed = true;
			created?.dispose();
			scene = null;
		};
	});

	/** The realms behind stop drawing. */
	$effect(() => ui.cover());

	/** The selected object shows what it radiated every second, Starlight itself accrues in the game tick. */
	onMount(() => {
		let key = 0;
		const timer = setInterval(() => {
			const id = scene?.mode === 'overview' ? scene.selected : null;
			const amount = id ? cosmosManager.starlightOf(id) : 0;
			const spot = amount > 0 ? scene?.onScreen().find(object => object.id === id) : undefined;
			popups = spot ? [{ key: key++, text: `+${formatNumber(amount)}`, x: spot.x, y: spot.y }] : [];
		}, 1000);
		return () => clearInterval(timer);
	});

	let pointer = $state({ x: 0, y: 0 });
	const hovered = $derived(scene?.hovered ? COSMOS_OBJECTS_BY_ID[scene.hovered] : null);

	const mode = $derived(scene?.mode);
	const next = $derived(cosmosManager.nextDiscovery);
	const instrument = $derived(cosmosManager.nextInstrument);
	const research = $derived(cosmosManager.research);
	const starlight = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT));
	const revealed = $derived(scene?.revealed ? COSMOS_OBJECTS_BY_ID[scene.revealed] : null);
	const selected = $derived(mode === 'overview' ? scene?.selected : null);

	let skyOpen = $state(false);

	/** The sky stops under a modal. */
	$effect(() => scene?.setPaused(ui.activeModal !== null));
	$effect(() => scene?.setBuilding(research !== null));
	$effect(() => scene?.setLimit(cosmosManager.limit));

	$effect(() => {
		if (scene?.mode === 'overview') sessionStorage.setItem(FOCUS_KEY, scene.focused);
	});

	/** Phones have room for one sheet, the object's own panel replaces the list. */
	function focusFromList(id: string) {
		if (!wide.current) skyOpen = false;
		scene?.focus(id);
	}
</script>

{#snippet starlightCost(amount: number)}
	<span class="flex items-center gap-1 font-mono text-sm tabular-nums">
		<Currency
			name={CurrenciesTypes.STARLIGHT}
			size={14}
		/>
		{formatNumber(amount)}
	</span>
{/snippet}

<svelte:window onpointermove={event => (pointer = { x: event.clientX, y: event.clientY })} />

<!-- Slides down over the realms like a look up into the sky. The desktop side nav stays reachable on its left. -->
<div
	class="fixed inset-x-0 bottom-0 z-45 select-none overflow-hidden bg-[#05070f] text-white lg:left-18"
	style:top="var(--banner-height)"
	transition:fly|global={{ duration: 700, easing: cubicInOut, y: '-100%' }}
>
	<canvas
		bind:this={canvas}
		class={['pointer-events-auto z-0 h-full w-full touch-none', hovered && 'cursor-pointer']}
	></canvas>

	{#if hovered}
		<p
			class="pointer-events-none fixed z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-accent-900/95 px-2.5 py-1.5 text-xs shadow-lg"
			style:left="{pointer.x + 14}px"
			style:top="{pointer.y + 14}px"
		>
			<span
				class="font-semibold"
				style:color={hovered.color}>{hovered.name}</span
			>
			{#if cosmosManager.starlightOf(hovered.id) > 0}
				<span class="flex items-center gap-1 font-mono tabular-nums text-[#cfe8ff]">
					<Currency
						name={CurrenciesTypes.STARLIGHT}
						size={12}
					/>
					+{formatNumber(cosmosManager.starlightOf(hovered.id))}/s
				</span>
			{/if}
		</p>
	{/if}

	{#each popups as popup (popup.key)}
		<span
			class="starlight-popup pointer-events-none absolute text-xs font-semibold tabular-nums text-[#cfe8ff] [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]"
			style:left="{popup.x}px"
			style:top="{popup.y}px"
		>
			{popup.text}
		</span>
	{/each}

	<header class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
		<div class="rounded-xl border border-white/10 bg-accent-900/80 px-3 py-2 backdrop-blur-xs">
			<p class="flex items-center gap-1.5 font-semibold tabular-nums text-[#cfe8ff]">
				<Currency
					name={CurrenciesTypes.STARLIGHT}
					size={18}
				/>
				{formatNumber(starlight)}
				<span class="text-xs font-normal text-white/50">+{formatNumber(cosmosManager.starlightPerSecond)}/s</span>
			</p>
			{#if dev && scene}
				<p class="text-[10px] text-white/35">{scene.backend} · {scene.fps} fps</p>
			{/if}
		</div>
		{#if scene}
			<div class="pointer-events-auto flex gap-2">
				<button
					class={[
						'flex items-center gap-1.5 rounded-lg border border-accent-500/30 px-3 py-2 text-xs font-semibold backdrop-blur-xs transition-colors hover:bg-accent-800 disabled:opacity-40',
						skyOpen ? 'bg-accent-600 text-white' : 'bg-accent-900/80 text-accent-300',
					]}
					data-hint="cosmos-sky"
					disabled={mode !== 'overview'}
					onclick={() => (skyOpen = !skyOpen)}
				>
					<List size={14} />
					Sky
				</button>
				<button
					class="rounded-lg border border-accent-500/30 bg-accent-900/80 px-3 py-2 text-xs font-semibold text-accent-300 backdrop-blur-xs transition-colors hover:bg-accent-800"
					onclick={() => scene?.setQuality(scene.quality === 'high' ? 'low' : 'high')}
				>
					{scene.quality === 'high' ? 'High' : 'Low'} quality
				</button>
				<button
					class="grid size-9 place-items-center rounded-lg border border-accent-500/30 bg-accent-900/80 text-accent-300 backdrop-blur-xs transition-colors hover:bg-accent-800 disabled:opacity-40"
					aria-label="Replay the intro"
					disabled={mode !== 'overview'}
					onclick={() => scene?.replayIntro()}
				>
					<RotateCcw size={16} />
				</button>
			</div>
		{/if}
	</header>

	<div class={['pointer-events-none absolute inset-0', mode !== 'observe' && 'hidden']}>
		<div
			class="absolute left-1/2 top-1/2 size-28 -translate-1/2 rounded-full border border-[#8ff5ff]/40"
			data-hint="cosmos-reticle"
		>
			<span class="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-[#8ff5ff]/60"></span>
			<span class="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-[#8ff5ff]/60"></span>
			<span class="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-[#8ff5ff]/60"></span>
			<span class="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-[#8ff5ff]/60"></span>
		</div>
		<!-- Fills clockwise from the top while the signal stays in the reticle, the photons' timer ring played backward. -->
		<div
			bind:this={progress}
			class="absolute left-1/2 top-1/2 -ml-9 -mt-9 size-18 opacity-0"
		>
			<svg
				class="size-full -rotate-90"
				viewBox="0 0 72 72"
			>
				<circle
					class="stroke-white/10"
					cx="36"
					cy="36"
					fill="none"
					r="32"
					stroke-width="1.5"
				/>
				<circle
					class="stroke-[#8ff5ff] [stroke-dashoffset:calc(1-var(--progress,0))]"
					cx="36"
					cy="36"
					fill="none"
					pathLength="1"
					r="32"
					stroke-dasharray="1"
					stroke-linecap="round"
					stroke-width="2"
				/>
			</svg>
		</div>
		<div
			bind:this={arrow}
			class="absolute left-1/2 top-1/2 -ml-4 -mt-4 text-[#8ff5ff] opacity-0 transition-opacity"
		>
			<ChevronRight size={32} />
		</div>
		<div class="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-16 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-6">
			<p class={['rounded-lg bg-accent-900/70 px-3 py-1.5 text-center text-xs backdrop-blur-xs', scene?.faint ? 'text-[#8ff5ff]' : 'text-white/70']}>
				{#if scene?.faint}
					Too faint at this zoom, pinch or scroll to zoom in on it.
				{:else}
					Keep the signal inside the reticle until the ring fills. Pinch or scroll to zoom.
				{/if}
			</p>
			<button
				class="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-accent-500/30 bg-accent-900/80 px-3 py-1.5 text-xs font-semibold text-accent-300 backdrop-blur-xs transition-colors hover:bg-accent-800"
				onclick={() => scene?.stopObserving()}
			>
				<X size={14} />
				Stop observing
			</button>
		</div>
	</div>

	<!-- Icon only on phones, so it stays clear of the centered actions, and out of the way of the bottom sheets. -->
	<button
		class={[
			'absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-10 flex size-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-accent-900/80 text-xs font-semibold text-accent-300 backdrop-blur-xs transition-colors hover:bg-accent-800 sm:w-auto sm:pl-2.5 sm:pr-3.5',
			(selected || skyOpen || mode === 'discovery') && 'max-md:hidden',
		]}
		aria-label="Back to the realms"
		onclick={() => (realmManager.cosmosOpen = false)}
	>
		<ChevronDown size={18} />
		<span class="max-sm:hidden">Realms</span>
	</button>

	{#if failure}
		<p class="absolute inset-x-0 top-1/2 px-6 text-center text-sm text-red-300">The 3D view failed to start: {failure}</p>
	{:else if !scene}
		<p class="absolute inset-x-0 top-1/2 text-center text-sm text-white/50">Loading the cosmos…</p>
	{:else if mode === 'overview'}
		{#if skyOpen}
			<div
				class="absolute inset-x-3 bottom-3 z-20 flex max-h-[55dvh] flex-col pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:bottom-auto md:left-4 md:top-24 md:max-h-[min(44rem,calc(100%-8rem))] md:w-[26rem]"
			>
				<SkyPanel
					onBuyInstrument={id => cosmosManager.purchaseInstrument(id)}
					onClose={() => (skyOpen = false)}
					onFocus={focusFromList}
					onStudy={id => gameManager.studyCosmosObject(id)}
				/>
			</div>
		{/if}
		{#if selected && (wide.current || !skyOpen)}
			<div class="absolute inset-x-3 bottom-3 pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:right-4 md:top-20 md:bottom-auto md:w-80">
				<ObjectPanel
					id={selected}
					onClose={() => scene && (scene.selected = null)}
					onHome={scene.focused === 'earth' ? undefined : () => scene?.focus('earth')}
					onStudy={() => gameManager.studyCosmosObject(selected)}
				/>
			</div>
		{/if}
		<div
			class={[
				'pointer-events-none absolute inset-x-0 bottom-0 flex-col items-center gap-2 px-16 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-6 *:pointer-events-auto',
				selected || skyOpen ? 'hidden md:flex' : 'flex',
			]}
		>
			{#if next && cosmosManager.canObserve}
				<button
					class="flex items-center gap-2 rounded-lg bg-accent-600 px-5 py-3 font-semibold text-white shadow-lg shadow-black/40 transition-colors hover:bg-accent-500"
					data-hint="cosmos-observe"
					onclick={() => scene?.observe(next.id)}
				>
					<Telescope size={18} />
					Observe the sky
				</button>
				<p class="text-center text-xs text-white/50">A faint signal waits somewhere in the night sky. Tap an object to study it.</p>
			{:else if next}
				{const widening = $derived(cosmosManager.wideningMs > 0)}
				<button
					class={[
						'relative flex items-center gap-3 overflow-hidden rounded-lg bg-accent-600 px-5 py-3 font-semibold text-white shadow-lg shadow-black/40 transition-colors enabled:hover:bg-accent-500 disabled:cursor-not-allowed',
						!widening && 'disabled:opacity-50',
					]}
					data-hint="cosmos-aperture"
					disabled={widening || starlight < cosmosManager.nextApertureCost}
					onclick={() => cosmosManager.purchaseAperture()}
				>
					{#if widening}
						<FillLine duration={APERTURE_WIDEN_MS} />
					{/if}
					<Aperture
						class={widening ? 'animate-spin [animation-duration:3s]' : ''}
						size={18}
					/>
					{widening ? 'Widening the aperture…' : 'Widen the aperture'}
					{#if !widening}
						{@render starlightCost(cosmosManager.nextApertureCost)}
					{/if}
				</button>
				<p class="text-center text-xs text-white/50">
					The next signal shines at magnitude {formatMagnitude(next.magnitude)}, your sight reaches {formatMagnitude(cosmosManager.limit)}.
				</p>
			{:else if research}
				{const researched = $derived(COSMOS_INSTRUMENTS.find(item => item.id === research.id)!)}
				{const progress = $derived(1 - research.leftMs / researched.researchMs)}
				<div class="flex w-full max-w-sm flex-col gap-2.5 rounded-lg bg-accent-900/80 px-4 py-3 backdrop-blur-xs">
					<div class="flex items-center gap-3">
						<Telescope
							class="shrink-0 text-[#ffd27a]"
							size={20}
						/>
						<div class="min-w-0 flex-1">
							<p class="text-[10px] font-semibold uppercase tracking-widest text-white/40">Building · {Math.floor(progress * 100)}%</p>
							<p class="truncate text-sm font-semibold">{researched.name}</p>
						</div>
						<span class="shrink-0 whitespace-nowrap font-mono text-sm tabular-nums text-[#ffd27a]">{formatDuration(research.leftMs)}</span>
					</div>
					<div class="h-1.5 rounded-full bg-white/10">
						<div
							class="h-full origin-left rounded-full bg-linear-to-r from-[#b8792a] to-[#ffd27a] shadow-[0_0_8px_#ffd27a80] transition-transform duration-1000 ease-linear"
							style:transform="scaleX({progress})"
						></div>
					</div>
				</div>
				<p class="text-center text-xs text-white/50">The workshop lights up on the Earth while it works. {researched.description}</p>
			{:else if instrument}
				<button
					class="flex items-center gap-3 rounded-lg bg-accent-600 px-5 py-3 font-semibold text-white shadow-lg shadow-black/40 transition-colors enabled:hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
					data-hint="cosmos-instrument"
					disabled={starlight < instrument.cost}
					onclick={() => cosmosManager.purchaseInstrument(instrument.id)}
				>
					<Telescope size={18} />
					{instrument.name}
					{@render starlightCost(instrument.cost)}
				</button>
				<p class="text-center text-xs text-white/50">Your instruments have found everything they can. {instrument.description}</p>
			{:else}
				<p class="text-center text-sm text-white/70">Every object your instruments can see is in your sky.</p>
			{/if}
		</div>
	{:else if mode === 'discovery' && revealed}
		<div class="absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
			<article
				class="discovery-card flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-linear-to-br from-accent-900/95 to-accent-800/95 p-5 shadow-2xl backdrop-blur-xs"
			>
				<div>
					<p class="text-xs font-semibold uppercase tracking-widest text-[#8ff5ff]">New discovery</p>
					<h2
						class="text-2xl font-bold"
						style:color={revealed.color}
					>
						{revealed.name}
					</h2>
					<p class="text-xs text-white/50">{revealed.year} · {revealed.discoverer}</p>
				</div>
				<p class="text-sm text-white/75">{revealed.fact}</p>
				<p class="flex items-center justify-between gap-2 text-sm">
					<span class="font-semibold text-white">+{Math.round(revealed.boost.amount * 100)}% {revealed.boost.label}</span>
					<span class="flex items-center gap-1 font-mono tabular-nums text-[#cfe8ff]">
						<Currency
							name={CurrenciesTypes.STARLIGHT}
							size={14}
						/>
						+{formatNumber(cosmosManager.starlightOf(revealed.id))}/s
					</span>
				</p>
				<button
					class="rounded-lg bg-accent-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-500"
					onclick={() => scene?.continue()}
				>
					Continue
				</button>
			</article>
		</div>
	{/if}
</div>

<style>
	.discovery-card {
		animation: card-in 0.7s 1.8s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
	}

	.starlight-popup {
		animation: starlight-rise 1.2s ease-out both;
	}

	@keyframes card-in {
		from {
			opacity: 0;
			transform: translateY(24px) scale(0.96);
		}
	}

	@keyframes starlight-rise {
		from {
			opacity: 0;
			transform: translate(-50%, -20px);
		}
		20% {
			opacity: 1;
		}
		to {
			opacity: 0;
			transform: translate(-50%, -56px);
		}
	}
</style>
