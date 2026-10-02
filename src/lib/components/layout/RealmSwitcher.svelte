<script lang="ts">
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { realmManager, type RealmConfig } from '#helpers/RealmManager.svelte.js';
	import { reveal } from '#helpers/reveals.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import { mobile } from '#stores/window.svelte.js';
	import Currency from '#components/ui/Currency.svelte';

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

	const realms = $derived(realmManager.availableRealms);
	const selectedIndex = $derived(realmManager.selectedIndex);

	/** One-shot overlay of a player-triggered switch, a new `id` remounts it so back-to-back switches restart it. */
	let warp = $state<{ color: string; direction: 1 | -1; id: number } | null>(null);
	let lastSwitchTime = -SWITCH_COOLDOWN_MS;

	let track = $state<HTMLDivElement>();
	/** Pill offset from the selected tab while dragging, in tabs. */
	let dragOffset = $state<number | null>(null);
	let gesture: { pointerId: number; startX: number; tabWidth: number } | null = null;
	/** Set when a drag ends, so the click the browser fires after it never lands on the tab under the finger. */
	let dragged = false;

	const pillPosition = $derived(dragOffset === null ? selectedIndex : Math.max(0, Math.min(realms.length - 1, selectedIndex + dragOffset)));
	const pillColor = $derived(realms[Math.round(pillPosition)]?.color);

	function switchRealm(realm: RealmConfig, index: number) {
		const now = performance.now();
		if (index === selectedIndex || now - lastSwitchTime < SWITCH_COOLDOWN_MS) return;
		lastSwitchTime = now;
		warp = { color: realm.color, direction: index > selectedIndex ? 1 : -1, id: (warp?.id ?? 0) + 1 };
		realmManager.selectRealm(realm.id);
	}

	function endWarp(event: AnimationEvent) {
		if (event.target === event.currentTarget) warp = null;
	}

	/** Only the phone bar is draggable, a desktop column has no room for a horizontal swipe. */
	function startDrag(event: PointerEvent) {
		if (!mobile.current || !event.isPrimary || !track) return;
		dragged = false;
		gesture = { pointerId: event.pointerId, startX: event.clientX, tabWidth: track.clientWidth / realms.length };
	}

	function moveDrag(event: PointerEvent) {
		if (gesture?.pointerId !== event.pointerId) return;
		const dx = event.clientX - gesture.startX;
		if (dragOffset === null) {
			if (Math.abs(dx) < DRAG_START_PX) return;
			track?.setPointerCapture(event.pointerId);
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

{#if realms.length > 1}
	{const vertical = $derived(!mobile.current)}
	<!-- Phones dock it above the nav, where `#realm-bar` adds its height to `--mobile-nav-height` so nothing floats over
	     it. Desktop keeps a click-through column on the right, only its tabs take clicks. No backdrop blur: the realm
	     behind animates every frame, so the blur would be recomputed every frame too. -->
	<div
		class={vertical ?
			'pointer-events-none fixed right-4 top-[calc(var(--banner-height)+5rem)] z-30 rounded-xl border border-white/10 bg-accent-950/80 p-1'
		:	'fixed inset-x-0 bottom-(--mobile-dock-height) z-40 h-(--realm-bar-height) border-t border-white/10 bg-accent-950/95 px-2 py-1'}
		id={vertical ? undefined : 'realm-bar'}
		in:reveal={{ y: 0 }}
	>
		<div
			aria-orientation={vertical ? 'vertical' : 'horizontal'}
			bind:this={track}
			class={['relative', vertical ? 'grid auto-rows-fr' : 'flex h-full touch-none']}
			onclickcapture={swallowDragClick}
			onpointercancel={endDrag}
			onpointerdown={startDrag}
			onpointermove={moveDrag}
			onpointerup={endDrag}
			role="tablist"
			tabindex="-1"
		>
			<!-- Only `translate` moves it, a drag just rewrites `--i`. The glow is a static shadow, nothing loops. -->
			<div
				aria-hidden="true"
				class={[
					'pointer-events-none absolute rounded-lg border border-(--c)/45 bg-(--c)/18 shadow-[0_0_16px_-4px_var(--c)]',
					vertical ?
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
			{#each realms as realm, i (realm.id)}
				{const selected = $derived(realmManager.selectedRealmId === realm.id)}
				{const amount = $derived(formatNumber(currenciesManager.getAmount(realm.currency.name)))}
				<button
					aria-selected={selected}
					class={[
						'group relative flex min-w-0 items-center gap-2 rounded-lg',
						vertical ? 'pointer-events-auto px-2.5 py-2 transition-colors hover:bg-white/5' : 'flex-1 justify-center px-1',
					]}
					id="realm-{realm.id}"
					onclick={() => switchRealm(realm, i)}
					role="tab"
					title={realm.title}
				>
					<Currency
						class="shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] {selected ? 'scale-115' : 'group-hover:scale-110'}"
						name={realm.currency.name}
						size={vertical ? 24 : 22}
					/>
					<!-- Fixed width, so a ticking amount never resizes the tab or shifts its icon. -->
					<span class="flex w-18 min-w-0 flex-col items-start leading-tight">
						<span class="max-w-full truncate text-sm font-semibold tabular-nums transition-colors {selected ? 'text-white' : 'text-white/65 group-hover:text-white/90'}">
							{amount}
						</span>
						<span class="max-w-full truncate text-[0.65rem] transition-colors {selected ? 'text-white/60' : 'text-white/35'}">{realm.currency.name}</span>
					</span>
				</button>
			{/each}
		</div>
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
