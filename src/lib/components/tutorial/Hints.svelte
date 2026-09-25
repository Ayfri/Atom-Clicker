<script lang="ts">
	import { HINTS, type Hint } from '$data/hints';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { highlightCurrencies } from '$lib/utils/highlightCurrencies';
	import type { TooltipPosition } from '$stores/tooltip.svelte';
	import { ui } from '$stores/ui.svelte';
	import { X } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import { fly } from 'svelte/transition';

	const MARGIN = 12;
	const POLL_MS = 250;

	const tutorial = $derived(gameManager.tutorialManager);

	const unseen = $derived(tutorial.state.enabled ? HINTS.filter(hint => !tutorial.hasSeen(hint.id)) : []);

	// Completion is tracked for every unseen hint, so a player who already did the action never gets told to do it.
	$effect(() => {
		for (const hint of unseen) if (hint.done?.()) tutorial.markSeen(hint.id);
	});

	const pending = $derived(
		unseen.filter(hint => hint.realm === realmManager.selectedRealmId && (!hint.show || hint.show()) && !hint.done?.()),
	);

	// `pending` is rebuilt on every atom commit, the polling effect only restarts when it empties or fills.
	const hasPending = $derived(pending.length > 0);

	let current = $state.raw<Hint | null>(null);
	let targetRect = $state.raw<DOMRect | null>(null);
	let bubble = $state<HTMLDivElement>();

	function visibleRect(hint: Hint): DOMRect | null {
		for (const selector of hint.targets ?? []) {
			const rect = document.querySelector(selector)?.getBoundingClientRect();
			if (rect && rect.width > 0 && rect.height > 0) return rect;
		}
		return null;
	}

	/** The current hint stays until it completes, otherwise the first pending hint whose target is on screen takes over. */
	function pick() {
		const candidates = current && pending.includes(current) ? [current, ...pending] : pending;
		for (const hint of candidates) {
			const rect = hint.targets ? visibleRect(hint) : null;
			if (hint.targets && !rect) continue;
			current = hint;
			targetRect = rect;
			return;
		}
		current = null;
		targetRect = null;
	}

	$effect(() => {
		if (!hasPending) {
			current = null;
			return;
		}
		untrack(pick);
		const interval = setInterval(pick, POLL_MS);
		window.addEventListener('scroll', pick, { capture: true, passive: true });
		return () => {
			clearInterval(interval);
			window.removeEventListener('scroll', pick, { capture: true });
		};
	});

	const visible = $derived(current && pending.includes(current) && !ui.activeModal ? current : null);

	/** Space between the target and its halo, a round halo breathes further out. */
	const pad = $derived(visible?.round ? 14 : 4);

	const position = $derived.by(() => {
		if (!targetRect || !bubble || !visible) return null;
		const viewportWidth = innerWidth.current ?? window.innerWidth;
		const viewportHeight = innerHeight.current ?? window.innerHeight;
		const { height, width } = bubble.getBoundingClientRect();
		const target = {
			bottom: Math.min(viewportHeight, targetRect.bottom + pad),
			left: Math.max(0, targetRect.left - pad),
			right: Math.min(viewportWidth, targetRect.right + pad),
			top: Math.max(0, targetRect.top - pad),
		};

		const positionFor = (side: TooltipPosition) => {
			let left = (target.left + target.right) / 2 - width / 2;
			let top = side === 'top' ? target.top - height - MARGIN : target.bottom + MARGIN;
			if (side === 'left' || side === 'right') {
				left = side === 'left' ? target.left - width - MARGIN : target.right + MARGIN;
				top = (target.top + target.bottom) / 2 - height / 2;
			}
			return {
				left: Math.max(MARGIN, Math.min(left, viewportWidth - width - MARGIN)),
				top: Math.max(MARGIN, Math.min(top, viewportHeight - height - MARGIN)),
			};
		};
		const overlaps = ({ left, top }: { left: number; top: number }) =>
			left < target.right && left + width > target.left && top < target.bottom && top + height > target.top;

		// Phones rarely fit the preferred side, and the clamp would then drop the bubble onto the very thing it points at.
		for (const side of [visible.placement ?? 'bottom', 'bottom', 'top', 'right', 'left'] as TooltipPosition[]) {
			const pos = positionFor(side);
			if (!overlaps(pos)) return pos;
		}
		return positionFor(visible.placement ?? 'bottom');
	});

	const flyFrom = $derived.by(() => {
		const side = visible?.placement ?? 'bottom';
		if (!targetRect) return { x: 0, y: 16 };
		return { x: side === 'left' ? 12 : side === 'right' ? -12 : 0, y: side === 'top' ? 12 : side === 'bottom' ? -12 : 0 };
	});
</script>

{#if visible}
	{@const hint = visible}
	{#key hint.id}
		{#if targetRect}
			<div
				class="hint-ring pointer-events-none fixed z-9998 ring-2 ring-accent-400 {hint.round ? 'rounded-full' : 'rounded-xl'}"
				style="left: {targetRect.left - pad}px; top: {targetRect.top - pad}px; width: {targetRect.width + pad * 2}px; height: {targetRect.height + pad * 2}px;"
			></div>
		{/if}
		<div
			bind:this={bubble}
			class="pointer-events-none fixed z-9999 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-accent-400/40 bg-accent-950/95 p-3 pr-7 shadow-2xl shadow-accent-500/20 backdrop-blur-md transition-[left,top] duration-200 {(
				targetRect
			) ?
				''
			:	'bottom-6 left-1/2 -translate-x-1/2'}"
			style={position ? `left: ${position.left}px; top: ${position.top}px;` : targetRect ? 'visibility: hidden;' : ''}
			in:fly={{ ...flyFrom, duration: 350 }}
			out:fly={{ ...flyFrom, duration: 200 }}
		>
			<button
				aria-label="Dismiss tip"
				class="pointer-events-auto absolute right-1.5 top-1.5 rounded p-0.5 text-white/40 transition-colors hover:text-white"
				onclick={() => tutorial.markSeen(hint.id)}
			>
				<X size={14} />
			</button>
			<h3 class="text-sm font-bold text-white">{hint.title}</h3>
			<p class="mt-1 text-xs text-white/70">{@html highlightCurrencies(hint.text)}</p>
			{#if !hint.done}
				<button
					class="pointer-events-auto mt-2 rounded-md bg-accent-500 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-accent-400"
					onclick={() => tutorial.markSeen(hint.id)}
				>
					Got it
				</button>
			{/if}
		</div>
	{/key}
{/if}

<style>
	.hint-ring {
		animation: hint-pulse 1.6s ease-in-out infinite;
		transition: all 200ms;
	}

	@keyframes hint-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-400) 50%, transparent);
			opacity: 1;
		}
		50% {
			box-shadow: 0 0 0 8px transparent;
			opacity: 0.6;
		}
	}
</style>
