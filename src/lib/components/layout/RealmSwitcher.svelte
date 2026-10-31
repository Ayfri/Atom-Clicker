<script lang="ts">
	import { CurrenciesTypes } from '#data/currencies.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { realmManager, type RealmConfig } from '#helpers/RealmManager.svelte.js';
	import { reveal } from '#helpers/reveals.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import { mobile } from '#stores/window.svelte.js';
	import Currency from '#components/ui/Currency.svelte';
	import { Telescope } from '@lucide/svelte';
	import { cubicInOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { crossfade, fade } from 'svelte/transition';

	const WARP_STREAKS = [
		{ delay: 0, top: 14, width: 28 },
		{ delay: 60, top: 27, width: 18 },
		{ delay: 20, top: 39, width: 36 },
		{ delay: 110, top: 48, width: 22 },
		{ delay: 40, top: 57, width: 40 },
		{ delay: 140, top: 68, width: 16 },
		{ delay: 80, top: 79, width: 30 },
		{ delay: 30, top: 90, width: 24 },
	] as const;

	/** Switches spammed mid-swing restart the transitions from wherever they are and pile up warps. */
	const SWITCH_COOLDOWN_MS = 500;
	/** Below this the gesture stays a tap, so a slightly shaky finger still presses the tab under it. */
	const DRAG_START_PX = 6;
	/** A short flick past this moves one realm even when the pill hasn't crossed half a tab. */
	const FLICK_PX = 28;

	const SWITCHER_KEY = 'realm-switcher';

	/** The panel travels between its realm spot and the Cosmos dock, a first appearance falls back to the reveal. */
	const [send, receive] = crossfade({
		duration: () => (prefersReducedMotion.current ? 0 : 600),
		easing: cubicInOut,
		fallback: (node, _params, intro) => (intro && !inCosmos ? reveal(node, { y: 0 }) : { duration: 0 }),
	});

	const desktop = $derived(!mobile.current);
	const inCosmos = $derived(realmManager.view === 'cosmos');
	const realms = $derived(realmManager.availableRealms);
	const selectedIndex = $derived(realmManager.selectedIndex);
	const starlight = $derived(formatNumber(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT)));

	/** One-shot overlay of a player-triggered switch, a new `id` remounts it so back-to-back switches restart it. */
	let warp = $state<{ color: string; direction: 1 | -1; id: number } | null>(null);
	let lastSwitchTime = -SWITCH_COOLDOWN_MS;

	/** Pill offset from the selected tab while dragging, in tabs. */
	let dragOffset = $state<number | null>(null);
	let gesture: { pointerId: number; startX: number; tabWidth: number; track: HTMLElement } | null = null;
	/** Set when a drag ends, so the click the browser fires after it never lands on the tab under the finger. */
	let dragged = false;

	const pillPosition = $derived(dragOffset === null ? selectedIndex : Math.max(0, Math.min(realms.length - 1, selectedIndex + dragOffset)));
	const pillColor = $derived(realms[Math.round(pillPosition)]?.color);

	function switchRealm(realm: RealmConfig, index: number) {
		realmManager.tableOpen = false;
		const now = performance.now();
		if (index === selectedIndex || now - lastSwitchTime < SWITCH_COOLDOWN_MS) return;
		lastSwitchTime = now;
		warp = { color: realm.color, direction: index > selectedIndex ? 1 : -1, id: (warp?.id ?? 0) + 1 };
		realmManager.selectRealm(realm.id);
	}

	/** The Cosmos closing is the transition, so the realm is selected without the warp or the cooldown. */
	function leaveCosmos(realm: RealmConfig) {
		realmManager.cosmosOpen = false;
		if (realm.id !== realmManager.selectedRealmId) realmManager.selectRealm(realm.id);
	}

	function endWarp(event: AnimationEvent) {
		if (event.target === event.currentTarget) warp = null;
	}

	/** Only the phone bar is draggable, a desktop column has no room for a horizontal swipe. */
	function startDrag(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (!mobile.current || !event.isPrimary) return;
		const track = event.currentTarget;
		dragged = false;
		gesture = { pointerId: event.pointerId, startX: event.clientX, tabWidth: track.clientWidth / realms.length, track };
	}

	function moveDrag(event: PointerEvent) {
		if (gesture?.pointerId !== event.pointerId) return;
		const dx = event.clientX - gesture.startX;
		if (dragOffset === null) {
			if (Math.abs(dx) < DRAG_START_PX) return;
			gesture.track.setPointerCapture(event.pointerId);
		}
		dragOffset = dx / gesture.tabWidth;
	}

	function endDrag(event: PointerEvent) {
		if (gesture?.pointerId !== event.pointerId) return;
		const { tabWidth } = gesture;
		gesture = null;
		if (dragOffset === null) return;

		const offset = dragOffset;
		dragOffset = null;
		dragged = true;
		if (event.type === 'pointercancel' || Math.abs(offset) * tabWidth < FLICK_PX) return;

		const index = Math.max(0, Math.min(realms.length - 1, selectedIndex + Math.sign(offset) * Math.max(1, Math.round(Math.abs(offset)))));
		switchRealm(realms[index], index);
	}

	function swallowDragClick(event: MouseEvent) {
		if (!dragged) return;
		dragged = false;
		event.stopPropagation();
	}
</script>

{#snippet tab(realm: RealmConfig, index: number, docked: boolean)}
	{const selected = $derived(!docked && realmManager.selectedRealmId === realm.id)}
	{const amount = $derived(formatNumber(currenciesManager.getAmount(realm.currency.name)))}
	<button
		aria-label={docked ? `Back to the ${realm.title}` : undefined}
		aria-selected={docked ? undefined : selected}
		class={[
			'group relative flex min-w-0 items-center gap-2 rounded-lg',
			desktop ? 'pointer-events-auto px-2.5 py-2 transition-colors hover:bg-white/5' : 'flex-1 justify-center px-1',
		]}
		id={docked ? undefined : `realm-${realm.id}`}
		onclick={() => (docked ? leaveCosmos(realm) : switchRealm(realm, index))}
		role={docked ? undefined : 'tab'}
		title={realm.title}
	>
		<Currency
			class="shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] {selected ? 'scale-115' : 'group-hover:scale-110'}"
			name={realm.currency.name}
			size={desktop ? 24 : 22}
		/>
		<!-- Fixed width, so a ticking amount never resizes the tab or shifts its icon. -->
		<span class="flex w-18 min-w-0 flex-col items-start leading-tight">
			<span class="max-w-full truncate text-sm font-semibold tabular-nums transition-colors {selected ? 'text-white' : 'text-white/65 group-hover:text-white/90'}">
				{amount}
			</span>
			<span class="max-w-full truncate text-[0.65rem] transition-colors {selected ? 'text-white/60' : 'text-white/35'}">{realm.currency.name}</span>
		</span>
	</button>
{/snippet}

{#snippet entry(docked: boolean)}
	<Telescope
		class="shrink-0 text-[#cfe8ff] {docked ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110'}"
		size={desktop ? 22 : 20}
	/>
	<span class={['min-w-0 flex-col items-start leading-tight', desktop ? 'flex w-18' : 'hidden min-[400px]:flex w-14']}>
		<span class={['max-w-full truncate text-sm font-semibold tabular-nums', docked ? 'text-white' : 'text-white/65 group-hover:text-white/90']}>{starlight}</span>
		<span class={['max-w-full truncate text-[0.65rem]', docked ? 'text-white/60' : 'text-white/35']}>Cosmos</span>
	</span>
{/snippet}

<!-- `docked` is a literal so the outgoing variant never restyles mid-travel. -->
{#snippet panel(docked: boolean)}
	<!-- Outside the tablist: the Cosmos opens above the selected realm instead of replacing it. -->
	{#if cosmosManager.unlocked}
		{#if docked}
			<div
				aria-current="page"
				class={[
					'flex min-w-0 shrink-0 items-center gap-2 rounded-lg bg-white/10 ring-1 ring-cosmos-starlight/40',
					desktop ? 'mb-1 w-full px-2.5 py-2' : 'mr-1 h-full px-2',
				]}
				title="Cosmos"
			>
				{@render entry(true)}
			</div>
		{:else}
			<button
				class={[
					'group flex min-w-0 shrink-0 items-center gap-2 rounded-lg transition-colors hover:bg-white/5',
					desktop ? 'pointer-events-auto mb-1 w-full border-b border-white/10 px-2.5 py-2' : 'h-full border-r border-white/10 px-2',
				]}
				id="cosmos-entry"
				in:reveal
				onclick={() => {
					realmManager.tableOpen = false;
					realmManager.cosmosOpen = true;
				}}
				title="Cosmos"
			>
				{@render entry(false)}
			</button>
		{/if}
	{/if}
	<div
		aria-orientation={docked ? undefined : desktop ? 'vertical' : 'horizontal'}
		class={[
			'relative',
			desktop ? 'grid auto-rows-fr' : 'flex h-full min-w-0 flex-1',
			!desktop && !docked && 'touch-none',
		]}
		onclickcapture={docked ? undefined : swallowDragClick}
		onpointercancel={docked ? undefined : endDrag}
		onpointerdown={docked ? undefined : startDrag}
		onpointermove={docked ? undefined : moveDrag}
		onpointerup={docked ? undefined : endDrag}
		role={docked ? undefined : 'tablist'}
		tabindex="-1"
	>
		{#if !docked}
			<!-- Only `translate` moves it, a drag just rewrites `--i`. The glow is a static shadow, nothing loops. -->
			<div
				aria-hidden="true"
				class={[
					'pointer-events-none absolute rounded-lg border border-(--c)/45 bg-(--c)/18 shadow-[0_0_16px_-4px_var(--c)]',
					desktop ?
						'inset-x-0 top-0 h-[calc(100%/var(--n))] translate-y-[calc(var(--i)*100%)]'
					:	'inset-y-0 left-0 w-[calc(100%/var(--n))] translate-x-[calc(var(--i)*100%)]',
					dragOffset === null ?
						'transition-[translate,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]'
					:	'will-change-[translate]',
				]}
				style:--c={pillColor}
				style:--i={pillPosition}
				style:--n={realms.length}
			></div>
		{/if}
		{#each realms as realm, i (realm.id)}
			{@render tab(realm, i, docked)}
		{/each}
	</div>
{/snippet}

<!-- One crossfade key: the panel travels between its realm spot and the Cosmos dock, the only way out of the Cosmos, so it
     shows even with a single realm. The dock sits above the Cosmos (z-46), below the modals. No backdrop blur: the realm
     behind animates every frame, so the blur would be recomputed every frame too. -->
{#if inCosmos}
	<!-- The Periodic Table covers the Cosmos with its own close button. -->
	{#if !realmManager.tableOpen}
		<nav
			aria-label="Realms"
			class={desktop ? 'pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-46' : 'fixed inset-x-0 bottom-(--mobile-dock-height) z-46'}
			id={desktop ? undefined : 'realm-dock'}
			transition:fade={{ duration: prefersReducedMotion.current ? 0 : 200 }}
		>
			<div
				class={desktop ?
					'pointer-events-auto rounded-xl border border-white/10 bg-accent-950/90 p-1'
				:	'flex h-(--realm-bar-height) w-full border-t border-white/10 bg-accent-950/95 px-2 py-1'}
				in:receive|global={{ key: SWITCHER_KEY }}
				out:send|global={{ key: SWITCHER_KEY }}
			>
				{@render panel(true)}
			</div>
		</nav>
	{/if}
{:else if realms.length > 1}
	<!-- Phones dock it above the nav, where `#realm-bar` adds its height to `--mobile-nav-height`, desktop keeps a
	     click-through column at the top right where only the tabs take clicks. Over the Periodic Table (z-47) it moves to z-48. -->
	<div
		class={desktop ?
			['pointer-events-none fixed right-4 top-[calc(var(--banner-height)+5rem)] rounded-xl border border-white/10 bg-accent-950/80 p-1', realmManager.tableOpen ? 'z-48' : 'z-30']
		:	['fixed inset-x-0 bottom-(--mobile-dock-height) flex h-(--realm-bar-height) border-t border-white/10 bg-accent-950/95 px-2 py-1', realmManager.tableOpen ? 'z-48' : 'z-40']}
		id={desktop ? undefined : 'realm-bar'}
		in:receive|global={{ key: SWITCHER_KEY }}
		out:send|global={{ key: SWITCHER_KEY }}
	>
		{@render panel(false)}
	</div>
{/if}

{#if warp}
	{#key warp.id}
		<div aria-hidden="true" class="realm-warp" onanimationend={endWarp} style="--warp-color: {warp.color}; --warp-dir: {warp.direction};">
			<div class="realm-warp-sweep"></div>
			{#each WARP_STREAKS as streak, i (i)}
				<div class="realm-warp-streak" style="animation-delay: {streak.delay}ms; top: {streak.top}%; width: {streak.width}vw;"></div>
			{/each}
		</div>
	{/key}
{/if}

<style>
	/* Only opacity and transform animate, so the whole overlay stays on the compositor even on small phones. */
	.realm-warp {
		animation: warp-flash 750ms ease-out both;
		background: radial-gradient(
			ellipse 70% 90% at calc(50% + var(--warp-dir) * 50%) 50%,
			color-mix(in srgb, var(--warp-color), transparent 65%),
			transparent 70%
		);
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		position: fixed;
		z-index: 20;
	}

	.realm-warp-sweep {
		animation: warp-sweep 650ms cubic-bezier(0.65, 0, 0.35, 1) both;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--warp-color), transparent 75%) 35%,
			color-mix(in srgb, var(--warp-color), white 45%) 50%,
			color-mix(in srgb, var(--warp-color), transparent 75%) 65%,
			transparent
		);
		inset-block: -10%;
		left: 32.5vw;
		position: absolute;
		width: 35vw;
	}

	.realm-warp-streak {
		animation: warp-streak 450ms cubic-bezier(0.5, 0, 0.75, 0) both;
		background: linear-gradient(90deg, transparent, var(--warp-color), transparent);
		border-radius: 9999px;
		height: 2px;
		left: 0;
		position: absolute;
	}

	@keyframes warp-flash {
		0% {
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	@keyframes warp-sweep {
		0% {
			opacity: 0;
			transform: translateX(calc(var(--warp-dir) * 90vw)) skewX(-14deg);
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateX(calc(var(--warp-dir) * -90vw)) skewX(-14deg);
		}
	}

	@keyframes warp-streak {
		0% {
			opacity: 0;
			transform: translateX(calc(var(--warp-dir) * 110vw));
		}
		30% {
			opacity: 0.8;
		}
		100% {
			opacity: 0;
			transform: translateX(calc(var(--warp-dir) * -110vw));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.realm-warp {
			display: none;
		}
	}
</style>
