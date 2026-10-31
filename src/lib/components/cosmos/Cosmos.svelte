<script lang="ts">
	import { dev } from '$app/env';
	import { APERTURE_WIDEN_MS, COSMOS_INSTRUMENTS, COSMOS_OBJECTS_BY_ID, formatMagnitude } from '#data/cosmos.js';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { AmbientField } from '#helpers/AmbientField.js';
	import { particlesEnabled } from '#helpers/CanvasLoop.js';
	import { cosmosFx } from '#helpers/cosmosFx.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { reveal } from '#helpers/reveals.svelte.js';
	import type { CosmosScene } from '#lib/cosmos/CosmosScene.svelte.js';
	import { formatDuration, formatNumber } from '#lib/utils.js';
	import { getJSON, setItem } from '#lib/utils/safeLocalStorage.js';
	import { ui } from '#stores/ui.svelte.js';
	import ActionButton from '#components/cosmos/ActionButton.svelte';
	import Blueprint from '#components/cosmos/Blueprint.svelte';
	import HudButton from '#components/cosmos/HudButton.svelte';
	import Iris from '#components/cosmos/Iris.svelte';
	import ObjectPanel from '#components/cosmos/ObjectPanel.svelte';
	import SiteLine from '#components/cosmos/SiteLine.svelte';
	import SkyPanel from '#components/cosmos/SkyPanel.svelte';
	import TableLink from '#components/cosmos/TableLink.svelte';
	import { horizon, lookUp, rateFlash } from '#components/cosmos/transitions.js';
	import Currency from '#components/ui/Currency.svelte';
	import Switch from '#components/ui/Switch.svelte';
	import { ChevronRight, Contrast, FlaskRound, Gauge, List, Orbit, Settings2, Telescope, X } from '@lucide/svelte';
	import { onMount, untrack } from 'svelte';
	import { cubicIn } from 'svelte/easing';
	import { MediaQuery } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';

	interface Popup {
		key: number;
		text: string;
		x: number;
		y: number;
	}

	interface CosmosView {
		orbits: boolean;
		realistic: boolean;
	}

	const FOCUS_KEY = 'cosmos-focus';
	const VIEW_KEY = 'cosmos-view';
	const TABLE_LINK = 'max-w-md justify-center text-center [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]';
	const wide = new MediaQuery('(min-width: 768px)');

	let arrow = $state<HTMLElement>();
	let canvas = $state<HTMLCanvasElement>();
	let failure = $state('');
	let fx = $state.raw<AmbientField>();
	let popups = $state.raw<Popup[]>([]);
	let progress = $state<HTMLElement>();
	let scene = $state.raw<CosmosScene | null>(null);
	let settingsOpen = $state(false);

	$effect(() => {
		if (!arrow || !canvas || !progress) return;
		const hud = { arrow, progress };
		const target = canvas;
		const discovered = untrack(() => [...cosmosManager.discovered]);
		const focus = sessionStorage.getItem(FOCUS_KEY) ?? undefined;
		let created: CosmosScene | null = null;
		let disposed = false;
		let uninstall: (() => void) | undefined;
		(async () => {
			const tools = dev ? await import('#lib/cosmos/devTools.svelte.js') : null;
			/** Three.js is a ~280 KB gzip chunk, only fetched once the Cosmos opens. */
			const { CosmosScene } = await import('#lib/cosmos/CosmosScene.svelte.js');
			const instance = await CosmosScene.create(target, {
				discovered,
				focus,
				hud,
				limit: untrack(() => cosmosManager.limit),
				live: tools?.liveSurfaces(focus),
				onDiscover: id => cosmosManager.discover(id),
				...getJSON<CosmosView>(VIEW_KEY, { orbits: true, realistic: false }),
				timestamps: dev,
			});
			if (disposed) return instance.dispose();
			created = instance;
			scene = instance;
			cosmosFx.canvas = target;
			cosmosFx.scene = instance;
			uninstall = tools?.installDevTools(instance);
		})().catch((error: unknown) => (failure = error instanceof Error ? error.message : String(error)));
		return () => {
			disposed = true;
			uninstall?.();
			created?.dispose();
			cosmosFx.canvas = null;
			cosmosFx.scene = null;
			scene = null;
		};
	});

	function mountFx(target: HTMLCanvasElement) {
		if (!particlesEnabled) return;
		const instance = untrack(() => new AmbientField(target, 'cosmos', '#4a90e2', { colors: [], density: 0 }));
		fx = instance;
		return () => {
			instance.destroy();
			fx = undefined;
		};
	}

	$effect(() => ui.cover());

	/** Display only: Starlight itself accrues in the game tick. */
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
	const atoms = $derived(currenciesManager.getAmount(CurrenciesTypes.ATOMS));
	const research = $derived(cosmosManager.research);
	const starlight = $derived(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT));
	const revealed = $derived(scene?.revealed ? COSMOS_OBJECTS_BY_ID[scene.revealed] : null);
	const selected = $derived(mode === 'overview' ? scene?.selected : null);

	/** Closed on phones, the sheet would cover the main action. */
	let skyOpen = $state(wide.current);

	const actionable = $derived(ui.activeModal === null && !realmManager.tableOpen && !realmManager.introPlaying);

	/** The Periodic Table's introduction plays once, at the first calm moment on the sky after the Spectroscope. */
	$effect(() => {
		if (periodicManager.unlocked && !periodicManager.introSeen && scene?.mode === 'overview' && ui.activeModal === null && !realmManager.tableOpen && !realmManager.introPlaying)
			realmManager.playIntro();
	});
	$effect(() => scene?.setPaused(!actionable));
	$effect(() => fx?.setActive(actionable));
	$effect(() => scene?.setBuilding(research !== null));
	$effect(() => scene?.setLimit(cosmosManager.limit));

	let building: string | null = null;
	$effect(() => {
		const id = research?.id ?? null;
		if (building && !id) cosmosFx.built();
		building = id;
	});

	const studyingId = $derived(cosmosManager.studying?.id ?? null);

	/** The burst plays when the study ends, a loaded save drops the pending one without a level. */
	let studied: { id: string; level: number } | null = null;
	$effect(() => {
		if (studied && !studyingId && cosmosManager.level(studied.id) > studied.level) cosmosFx.study(studied.id);
		studied = studyingId ? { id: studyingId, level: untrack(() => cosmosManager.level(studyingId)) } : null;
	});

	$effect(() => {
		if (scene?.mode === 'overview') sessionStorage.setItem(FOCUS_KEY, scene.focused);
	});

	$effect(() => {
		if (scene) setItem(VIEW_KEY, JSON.stringify({ orbits: scene.orbits, realistic: scene.realistic } satisfies CosmosView));
	});

	function focusFromList(id: string) {
		if (!wide.current) skyOpen = false;
		scene?.focus(id);
	}
</script>

<svelte:window
	onkeydown={event => {
		if (event.key === 'Escape') settingsOpen = false;
	}}
	onpointermove={event => (pointer = { x: event.clientX, y: event.clientY })}
/>

<!-- The desktop side nav stays reachable on the left. -->
<div
	class="fixed inset-x-0 bottom-[var(--mobile-dock-height,0px)] z-45 select-none bg-cosmos-sky text-white lg:left-18"
	style:top="var(--banner-height)"
	in:lookUp|global
	out:lookUp|global={{ duration: 600, easing: cubicIn }}
>
	<div class="absolute inset-0 overflow-hidden">
		<canvas
			bind:this={canvas}
			class={['pointer-events-auto z-0 h-full w-full touch-none', hovered && 'cursor-pointer']}
			in:lookUp|global={{ lag: 0.35 }}
			onpointerdown={() => (settingsOpen = false)}
			out:lookUp|global={{ duration: 600, easing: cubicIn, lag: 0.35 }}
		></canvas>
		<canvas
			class="z-0 size-full"
			aria-hidden="true"
			{@attach mountFx}
		></canvas>
		<div
			class={[
				'pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-[#24407a]/70 via-[#0e1a3a]/30 to-transparent transition-[opacity,visibility] duration-700',
				scene ? 'invisible opacity-0' : 'opacity-100',
			]}
			aria-hidden="true"
			out:horizon|global={{ duration: 600, easing: cubicIn }}
		></div>

		{#if hovered}
			<p
				class="pointer-events-none fixed z-10 flex items-center gap-2 rounded-md bg-cosmos-hud/95 px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-white/10"
				style:left="{pointer.x + 14}px"
				style:top="{pointer.y + 14}px"
			>
				<span
					class="font-semibold"
					style:color={hovered.color}>{hovered.name}</span
				>
				{#if cosmosManager.starlightOf(hovered.id) > 0}
					<span class="flex items-center gap-1 font-mono tabular-nums text-cosmos-starlight">
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
				class="starlight-popup pointer-events-none absolute text-xs font-semibold tabular-nums text-cosmos-starlight [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]"
				style:left="{popup.x}px"
				style:top="{popup.y}px"
			>
				{popup.text}
			</span>
		{/each}

		<header
			class="pointer-events-none absolute inset-x-0 top-0 z-25 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))]"
			in:fly|global={{ delay: 450, duration: 400, y: -12 }}
		>
			{#if dev && scene}
				<p class="font-mono text-[10px] text-white/35 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">{scene.backend} · {scene.fps} fps</p>
			{/if}
			<div
				class="order-last flex w-full flex-col items-center text-center [text-shadow:0_1px_3px_rgb(0_0_0/0.8)] sm:absolute sm:inset-x-0 sm:top-0 sm:order-none sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))]"
			>
				<p class="flex items-center gap-2.5 text-3xl font-black tabular-nums text-cosmos-starlight sm:text-4xl [text-shadow:0_1px_3px_rgb(0_0_0/0.8),0_0_24px_rgb(207_232_255/0.35)]">
					<Currency
						class="shrink-0 max-sm:size-7"
						name={CurrenciesTypes.STARLIGHT}
						size={32}
					/>
					{formatNumber(starlight)}
				</p>
				<span class="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">Starlight</span>
				{#key cosmosManager.starlightPerSecond}
					<p
						class="font-mono text-lg font-bold tabular-nums text-white/50"
						in:rateFlash
					>
						+{formatNumber(cosmosManager.starlightPerSecond)}<span class="text-sm">/s</span>
					</p>
				{/key}
			</div>
			{#if scene}
				<div class="pointer-events-auto relative ml-auto flex items-start gap-2">
					<HudButton
						active={skyOpen}
						aria-pressed={skyOpen}
						data-hint="cosmos-sky"
						disabled={mode !== 'overview'}
						icon={List}
						label="Sky"
						labelled="md"
						onclick={() => {
							skyOpen = !skyOpen;
							settingsOpen = false;
						}}
					/>
					{#if periodicManager.unlocked}
						<span
							class="relative inline-flex rounded-lg"
							in:reveal
						>
							<HudButton
								badge={periodicManager.ready.length}
								data-hint="cosmos-table"
								icon={FlaskRound}
								label="Table"
								labelled="md"
								onclick={() => {
									realmManager.openTable();
									settingsOpen = false;
								}}
							/>
						</span>
					{/if}
					<HudButton
						active={settingsOpen}
						aria-expanded={settingsOpen}
						icon={Settings2}
						label="View settings"
						onclick={() => (settingsOpen = !settingsOpen)}
					/>
					{#if settingsOpen}
						<div
							class="absolute right-0 top-full mt-2 flex w-60 flex-col rounded-xl bg-cosmos-hud/95 p-1.5 shadow-2xl ring-1 ring-white/10"
							transition:fly={{ duration: 150, y: -6 }}
						>
							<label class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-white/5">
								<Orbit
									class="text-white/50"
									size={16}
								/>
								<span class="flex-1 text-sm">Orbits</span>
								<Switch
									checked={scene.orbits}
									label="Orbits"
									onchange={on => scene?.setOrbits(on)}
								/>
							</label>
							<label class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-white/5">
								<Contrast
									class="text-white/50"
									size={16}
								/>
								<span class="flex-1 text-sm">Realistic lighting</span>
								<Switch
									checked={scene.realistic}
									label="Realistic lighting"
									onchange={on => scene?.setRealistic(on)}
								/>
							</label>
							<label class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-white/5">
								<Gauge
									class="text-white/50"
									size={16}
								/>
								<span class="flex-1 text-sm">High quality</span>
								<Switch
									checked={scene.quality === 'high'}
									label="High quality"
									onchange={on => scene?.setQuality(on ? 'high' : 'low')}
								/>
							</label>
						</div>
					{/if}
				</div>
			{/if}
		</header>

		<div class={['pointer-events-none absolute inset-0', mode !== 'observe' && 'hidden']}>
			<div
				class="absolute left-1/2 top-1/2 size-28 -translate-1/2 rounded-full border border-cosmos-reticle/40"
				data-hint="cosmos-reticle"
			>
				<span class="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-cosmos-reticle/60"></span>
				<span class="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-cosmos-reticle/60"></span>
				<span class="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-cosmos-reticle/60"></span>
				<span class="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-cosmos-reticle/60"></span>
			</div>
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
						class="stroke-cosmos-reticle [stroke-dashoffset:calc(1-var(--progress,0))]"
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
				class="absolute left-1/2 top-1/2 -ml-4 -mt-4 text-cosmos-reticle opacity-0 transition-opacity"
			>
				<ChevronRight size={32} />
			</div>
			<div class="absolute inset-x-0 bottom-(--cosmos-dock-height) flex flex-col items-center gap-3 px-16 pt-6 pb-3 md:px-6 lg:pb-6">
				<p class={['max-w-sm text-center text-xs [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]', scene?.faint ? 'text-cosmos-reticle' : 'text-white/70']}>
					{#if scene?.faint}
						Too faint at this zoom, pinch or scroll to zoom in on it.
					{:else}
						Keep the signal inside the reticle until the ring fills. Pinch or scroll to zoom.
					{/if}
				</p>
				<HudButton
					class="pointer-events-auto"
					icon={X}
					label="Stop observing"
					labelled="always"
					onclick={() => scene?.stopObserving()}
				/>
			</div>
		</div>

		{#if failure}
			<p class="absolute inset-x-0 top-1/2 px-6 text-center text-sm text-red-300">The 3D view failed to start: {failure}</p>
		{:else if !scene}
			<p class="absolute inset-x-0 top-1/2 text-center text-sm text-white/50">Loading the cosmos…</p>
		{:else if mode === 'overview'}
			{#if skyOpen}
				<div
					class="absolute inset-x-3 bottom-[calc(var(--cosmos-dock-height)+0.75rem)] z-20 flex max-h-[55dvh] flex-col md:inset-x-auto md:bottom-40 md:left-4 md:top-28 md:max-h-none md:w-[26rem]"
				>
					<SkyPanel
						onBuyInstrument={(id, event) => cosmosManager.purchaseInstrument(id) && cosmosFx.instrument(event)}
						onClose={() => (skyOpen = false)}
						onFocus={focusFromList}
						onStudy={id => gameManager.studyCosmosObject(id)}
					/>
				</div>
			{/if}
			{#if selected && (wide.current || !skyOpen)}
				<div class="absolute inset-x-3 bottom-[calc(var(--cosmos-dock-height)+0.75rem)] md:inset-x-auto md:right-4 md:top-28 md:bottom-auto md:max-h-[calc(100%-8rem-var(--cosmos-dock-height))] md:w-80 md:overflow-y-auto md:rounded-xl lg:max-h-[calc(100%-22rem)]">
					<ObjectPanel
						id={selected}
						onClose={() => scene && (scene.selected = null)}
						onStudy={() => gameManager.studyCosmosObject(selected)}
					/>
				</div>
			{/if}
			<div
				class={[
					'pointer-events-none absolute inset-x-0 bottom-(--cosmos-dock-height) flex-col items-center gap-2 px-16 pt-6 pb-3 md:px-6 lg:pb-6 *:pointer-events-auto',
					selected || skyOpen ? 'hidden md:flex' : 'flex',
				]}
			>
				{#if next && cosmosManager.canObserve}
					{const observable = $derived(atoms >= gameManager.observationCost)}
					<ActionButton
						cost={{ affordable: observable, amount: gameManager.observationCost, currency: CurrenciesTypes.ATOMS }}
						disabled={!observable}
						hint="cosmos-observe"
						icon={Telescope}
						label="Observe the sky"
						onclick={() => scene?.observe(next.id, () => gameManager.startObservation())}
						pulse={actionable && observable}
					/>
					<p class="max-w-md text-center text-xs text-white/55 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">A faint signal waits somewhere in the night sky. Tap an object to study it.</p>
				{:else if next || (instrument && !research && !cosmosManager.apertureMaxed)}
					{const widening = $derived(cosmosManager.wideningMs > 0)}
					{const widenable = $derived(starlight >= cosmosManager.nextApertureCost)}
					<ActionButton
						busyMs={widening ? APERTURE_WIDEN_MS : 0}
						cost={widening ? undefined : { affordable: widenable, amount: cosmosManager.nextApertureCost, currency: CurrenciesTypes.STARLIGHT }}
						disabled={widening || !widenable}
						hint="cosmos-aperture"
						label={widening ? 'Widening the aperture…' : 'Widen the aperture'}
						onclick={event => cosmosManager.purchaseAperture() && cosmosFx.aperture(event)}
						pulse={actionable && !widening && widenable}
					>
						{#snippet tile()}
							<Iris
								durationMs={widening ? APERTURE_WIDEN_MS : 0}
								progress={1 - cosmosManager.wideningMs / APERTURE_WIDEN_MS}
								size={28}
							/>
						{/snippet}
					</ActionButton>
					<p class="max-w-md text-center text-xs text-white/55 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">
						{#if next}
							The next signal shines at magnitude {formatMagnitude(next.magnitude)}, your sight reaches {formatMagnitude(cosmosManager.limit)}.
						{:else}
							{instrument?.name} needs your sight at magnitude {formatMagnitude(cosmosManager.instrument.reach)}, it reaches {formatMagnitude(cosmosManager.limit)}.
						{/if}
					</p>
					{#if !next && instrument}
						<TableLink
							class={TABLE_LINK}
							instrumentId={instrument.id}
						/>
					{/if}
				{:else if research}
					{const researched = $derived(COSMOS_INSTRUMENTS.find(item => item.id === research.id)!)}
					{const progress = $derived(1 - research.leftMs / researched.researchMs)}
					<div
						class="relative flex h-16 w-full max-w-sm items-center gap-3 overflow-hidden rounded-xl bg-cosmos-hud/90 pl-2 pr-4 ring-1 ring-cosmos-workshop/40"
						role="status"
					>
						<Blueprint
							class="size-12"
							id={researched.id}
							{progress}
						/>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[10px] font-semibold uppercase tracking-widest text-white/40">Building · {Math.floor(progress * 100)}%</span>
							<span class="truncate text-sm font-semibold">{researched.name}</span>
						</span>
						<span class="shrink-0 whitespace-nowrap font-mono text-sm tabular-nums text-cosmos-workshop">{formatDuration(research.leftMs)}</span>
						<span
							class="absolute inset-x-0 top-0 h-0.5 origin-left bg-cosmos-workshop transition-transform duration-1000 ease-linear"
							style:transform="scaleX({progress})"
						></span>
					</div>
					<p class="max-w-md text-center text-xs text-white/55 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">The workshop lights up on the Earth while it works. {researched.description}</p>
					<TableLink
						class={TABLE_LINK}
						instrumentId={researched.id}
					/>
				{:else if instrument}
					{const buildable = $derived(starlight >= instrument.cost)}
					<ActionButton
						cost={{ affordable: buildable, amount: instrument.cost, currency: CurrenciesTypes.STARLIGHT }}
						disabled={!buildable}
						hint="cosmos-instrument"
						icon={Telescope}
						label={instrument.name}
						onclick={event => cosmosManager.purchaseInstrument(instrument.id) && cosmosFx.instrument(event)}
						pulse={actionable && buildable}
					/>
					<p class="max-w-md text-center text-xs text-white/55 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">{instrument.tool ? '' : 'Your instruments have found everything they can. '}{instrument.description}</p>
					<TableLink
						class={TABLE_LINK}
						instrumentId={instrument.id}
					/>
				{:else}
					<p class="max-w-md text-center text-sm text-white/70 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">Every object your instruments can see is in your sky.</p>
				{/if}
			</div>
		{:else if mode === 'discovery' && revealed}
			<div class="absolute inset-x-0 bottom-(--cosmos-dock-height) flex justify-center p-3 sm:p-4">
				<article
					class="discovery-card flex w-full max-w-sm flex-col gap-3 rounded-xl bg-cosmos-hud/95 p-5 shadow-2xl ring-1 ring-white/10"
					onanimationstart={event => cosmosFx.discovery(event.currentTarget, revealed.color)}
				>
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-widest text-cosmos-signal">New discovery</p>
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
						<span class="flex items-center gap-1 font-mono tabular-nums text-cosmos-starlight">
							<Currency
								name={CurrenciesTypes.STARLIGHT}
								size={14}
							/>
							+{formatNumber(cosmosManager.starlightOf(revealed.id))}/s
						</span>
					</p>
					<SiteLine objectId={revealed.id} />
					<ActionButton
						class="w-full"
						icon={ChevronRight}
						label="Continue"
						onclick={() => scene?.continue()}
					/>
				</article>
			</div>
		{/if}
	</div>
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
