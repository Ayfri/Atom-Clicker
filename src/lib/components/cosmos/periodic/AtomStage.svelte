<script lang="ts">
	import { AtomRenderer, CANVAS_OVERFLOW, NUCLEON_RANGE, type AtomScene } from '#helpers/AtomRenderer.js';
	import { untrack } from 'svelte';
	import { nucleonsOf, partialShells, shellsOf, type StageKind } from './atoms.js';
	import type { Point } from './TableParticles.js';

	interface Props {
		/** Whether holding the atom spends Light on it, a ready element the player can afford. */
		affordable: boolean;
		class?: string;
		color: string;
		kind: StageKind;
		/** Forge progress from 0 to 1, the nucleus gains its nucleons with it. */
		progress: number;
		siteColor: string;
		z: number;
		/** Called every few frames while charging, so the page can fly Light from its counters into the atom. */
		onfeed: (center: Point) => void;
		onidentify: () => void;
		onrefuse: () => void;
	}

	let { affordable, class: className, color, kind, progress, siteColor, z, onfeed, onidentify, onrefuse }: Props = $props();

	const BARE_COLOR = '#c3cad6';
	const SHELL_SLOTS = 7;
	/** A full hold fills the atom in this many seconds, each tap adds `TAP_CHARGE` on top like a click. */
	const HOLD_SECONDS = 1.6;
	const TAP_CHARGE = 0.06;
	/** A released atom keeps its charge this long, then loses it at `DRAIN` per second. */
	const DRAIN_DELAY = 600;
	const DRAIN = 0.6;
	const FEED_EVERY = 110;

	let host = $state<HTMLButtonElement>();
	let renderer = $state.raw<AtomRenderer>();
	/** Keyed by element, so a charge never carries over to the next one selected. */
	let charging = $state({ value: 0, z: 0 });
	const charge = $derived(charging.z === z ? charging.value : 0);
	let holding = false;
	let lastPress = 0;
	let lastFeed = 0;
	let frame = 0;

	const shells = $derived(shellsOf(z));
	const total = $derived(shells.reduce((sum, count) => sum + count, 0));
	const nucleons = $derived(Math.min(NUCLEON_RANGE.max, nucleonsOf(z)));

	const scene: AtomScene = $derived.by(() => {
		const electrons = kind === 'identified' || kind === 'reading' ? total : kind === 'ready' ? Math.floor(charge * total) : 0;
		const shellColor = kind === 'identified' ? color : '#ffffff';
		return {
			auras: kind === 'forging' ? [siteColor] : kind === 'waiting' ? [] : [color],
			bonus: false,
			energy: kind === 'identified' ? 0.25 : 0.1 + 0.9 * charge,
			nucleonColors: [kind === 'identified' ? color : kind === 'forging' ? siteColor : BARE_COLOR],
			nucleons: kind === 'forging' ? Math.max(1, Math.floor(progress * nucleons)) : nucleons,
			shells: partialShells(shells, electrons).map((count, line) => ({ color: shellColor, count, line })),
		};
	});

	/** The realm's atom stays the one purchase comets aim at. */
	function mount(canvas: HTMLCanvasElement) {
		const realmAtom = AtomRenderer.current;
		const instance = new AtomRenderer(canvas, untrack(() => scene), SHELL_SLOTS);
		AtomRenderer.current = realmAtom;
		renderer = instance;
		return () => {
			instance.destroy();
			renderer = undefined;
			cancelAnimationFrame(frame);
		};
	}

	$effect(() => {
		if (renderer) renderer.scene = scene;
	});

	function center(): Point {
		const rect = host!.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}

	/** Charges while held, drains once released, and stops itself when the atom is full or empty. */
	function step(previous: number) {
		frame = requestAnimationFrame(now => {
			const dt = Math.min(0.1, (now - previous) / 1000);
			let value = charge;
			if (holding) value += dt / HOLD_SECONDS;
			else if (now - lastPress > DRAIN_DELAY) value -= dt * DRAIN;
			value = Math.min(1, Math.max(0, value));
			charging = { value, z };
			if (value > 0 && value < 1 && now - lastFeed > FEED_EVERY) {
				lastFeed = now;
				onfeed(center());
			}
			if (value >= 1) {
				holding = false;
				frame = 0;
				onidentify();
			} else if (value > 0 || holding) step(now);
			else frame = 0;
		});
	}

	function press(event: PointerEvent) {
		if (event.button !== 0 || kind !== 'ready') return;
		if (!affordable) {
			onrefuse();
			host?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
			return;
		}
		holding = true;
		lastPress = performance.now();
		charging = { value: Math.min(0.99, charge + TAP_CHARGE), z };
		const rect = host!.getBoundingClientRect();
		renderer?.pulse(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
		if (!frame) step(lastPress);
	}

	const release = () => (holding = false);
</script>

<button
	bind:this={host}
	class={['stage relative flex items-center justify-center bg-transparent', kind === 'ready' && 'cursor-pointer', className]}
	aria-label={kind === 'ready' ? 'Hold to identify' : 'Element atom'}
	onlostpointercapture={release}
	onpointercancel={release}
	onpointerdown={event => {
		press(event);
		host?.setPointerCapture(event.pointerId);
	}}
	onpointerup={release}
>
	<canvas
		class="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2"
		style:height="{100 * CANVAS_OVERFLOW}%"
		style:width="{100 * CANVAS_OVERFLOW}%"
		{@attach mount}
	></canvas>
	{#if kind === 'waiting'}
		<span class="absolute inset-[22%] rounded-full border-2 border-dashed border-amber-300/40"></span>
	{:else if kind === 'ready'}
		<!-- The charge ring fills with the hold, the faint ring under it calls for the press while the atom is empty. -->
		<span class={['absolute inset-[6%] rounded-full', affordable && charge === 0 ? 'calling border-2 border-white/40' : 'border border-white/10']}></span>
		<svg
			class="absolute inset-[6%] -rotate-90"
			viewBox="0 0 100 100"
		>
			<circle
				cx="50"
				cy="50"
				fill="none"
				r="49"
				stroke={color}
				stroke-dasharray={2 * Math.PI * 49}
				stroke-dashoffset={2 * Math.PI * 49 * (1 - charge)}
				stroke-linecap="round"
				stroke-width="1.5"
			/>
		</svg>
	{/if}
</button>

<style>
	.stage {
		-webkit-tap-highlight-color: transparent;
		touch-action: none;
		user-select: none;
	}

	@media (prefers-reduced-motion: no-preference) {
		.calling {
			animation: calling 1.8s ease-out infinite;
		}
	}

	@keyframes calling {
		from {
			opacity: 1;
			transform: scale(0.55);
		}
		to {
			opacity: 0;
			transform: scale(1);
		}
	}
</style>
