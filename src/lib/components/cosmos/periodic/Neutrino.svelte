<script lang="ts">
	import { neutrinoPath } from '#components/cosmos/periodic/neutrinoPath.js';
	import { NEUTRINO_FACTS, NEUTRINO_SKIP_MS } from '#data/neutrinos.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { tierIconStack } from '#helpers/iconStacks.js';
	import { perfTracker } from '#helpers/perfTracker.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { neutrino } from '#stores/neutrino.svelte.js';
	import { toastStore } from '#stores/toasts.svelte.js';
	import { ui } from '#stores/ui.svelte.js';
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';

	const RISE = 28;

	let box = $state<HTMLElement>();
	let button = $state<HTMLButtonElement>();
	/** The one popup of the last catch, reused. */
	let popup = $state<HTMLElement>();
	let pageVisible = $state(true);
	/** The running flight, which is also what tells a neutrino is on screen. */
	let flight: Animation | null = null;

	const halted = $derived(ui.activeModal !== null || !pageVisible);
	/** Only time spent watching the Table counts, and a neutrino is pointless when nothing would speed up. */
	const eligible = $derived(realmManager.tableOpen && !realmManager.introPlaying && !halted && periodicManager.skippable && !neutrino.visible);

	$effect(() => {
		if (!eligible) return;
		const start = performance.now();
		const timeout = setTimeout(spawn, untrack(() => neutrino.timer.remainingMs));
		return () => {
			clearTimeout(timeout);
			neutrino.timer.consume(performance.now() - start);
		};
	});

	$effect(() => {
		if (neutrino.requested && !neutrino.visible) untrack(spawn);
	});

	$effect(() => {
		if (!neutrino.visible) return;
		if (halted) flight?.pause();
		else if (flight?.playState === 'paused') flight.play();
	});

	/** Closing the Table with one on screen counts as a miss. */
	$effect(() => leave);

	function spawn() {
		if (flight || !box || !button) return;
		neutrino.requested = false;
		neutrino.visible = true;
		perfTracker.action('periodic:neutrino');
		const { durationMs, keyframes } = neutrinoPath(box.clientWidth, box.clientHeight, Math.random, prefersReducedMotion.current);
		flight = button.animate(keyframes, { duration: durationMs, fill: 'forwards' });
		flight.onfinish = leave;
	}

	function leave() {
		if (!flight) return;
		flight.cancel();
		flight = null;
		neutrino.visible = false;
		neutrino.timer.restart();
	}

	function catchIt(event: Event) {
		event.stopPropagation();
		if (!flight || !box || !button || !popup) return;
		const spot = button.getBoundingClientRect();
		const area = box.getBoundingClientRect();
		const [x, y] = [spot.left + spot.width / 2 - area.left, spot.top + spot.height / 2 - area.top];
		leave();
		gameManager.catchNeutrino();
		const at = (rise: number) => `translate(${x}px, ${y - rise}px) translate(-50%, -50%)`;
		popup.animate(
			[
				{ opacity: 1, transform: at(0) },
				{ opacity: 0, transform: at(RISE) },
			],
			{ duration: 900, easing: 'ease-out' },
		);
		toastStore.info({
			duration: 8000,
			icon: tierIconStack('atom', 0),
			message: NEUTRINO_FACTS[Math.floor(Math.random() * NEUTRINO_FACTS.length)],
			title: 'Neutrino caught',
		});
	}
</script>

<svelte:document onvisibilitychange={() => (pageVisible = !document.hidden)} />

<!-- Above the Table's own layers, below the toasts. Only the button takes input, the rest of the overlay lets everything through. -->
<div
	class="pointer-events-none absolute inset-0 z-40 overflow-hidden"
	bind:this={box}
>
	<p
		class="sr-only"
		aria-live="polite"
	>
		{neutrino.visible ? 'A neutrino is crossing the Table.' : ''}
	</p>
	<button
		class={['pointer-events-auto absolute top-0 left-0 -mt-5.5 -ml-5.5 grid size-11 cursor-pointer place-items-center', !neutrino.visible && 'hidden']}
		aria-label="Catch the neutrino"
		bind:this={button}
		onclick={catchIt}
		onpointerdown={catchIt}
		type="button"
	>
		<span
			class="neutrino-core relative block size-3.5 rounded-full bg-[#ede9fe] shadow-[0_0_10px_3px_rgb(167_139_250/0.65)] after:absolute after:top-1/2 after:right-full after:h-1.5 after:w-2.5 after:-translate-y-1/2 after:bg-linear-to-r after:from-transparent after:to-[#a78bfa]/60"
			data-paused={halted || undefined}
		></span>
	</button>
	<span
		class="pointer-events-none absolute top-0 left-0 text-sm font-bold whitespace-nowrap text-violet-200 tabular-nums opacity-0 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]"
		bind:this={popup}
	>
		+{NEUTRINO_SKIP_MS / 60_000} min
	</span>
</div>

<style>
	@keyframes neutrino-wobble {
		from {
			transform: rotate(-14deg) translateY(-1px);
		}
		to {
			transform: rotate(14deg) translateY(2px);
		}
	}

	.neutrino-core {
		animation: neutrino-wobble 0.35s ease-in-out infinite alternate;
	}

	.neutrino-core[data-paused] {
		animation-play-state: paused;
	}

	@media (prefers-reduced-motion: reduce) {
		.neutrino-core {
			animation: none;
		}
	}
</style>
