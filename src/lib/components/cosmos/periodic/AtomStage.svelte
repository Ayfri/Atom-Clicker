<script lang="ts">
	import { ELEMENTS } from '#data/elements.js';
	import { AtomRenderer, CANVAS_OVERFLOW, NUCLEON_RANGE, type AtomScene } from '#helpers/AtomRenderer.js';
	import { perfTracker } from '#helpers/perfTracker.js';
	import { Hand } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { nucleonsOf, partialShells, shellsOf, type StageKind } from './atoms.js';
	import type { Point } from './TableParticles.js';

	interface Props {
		class?: string;
		color: string;
		kind: StageKind;
		/** Share of the reading cost already paid, from 0 to 1. */
		paid: number;
		/** Whether some of every currency the reading needs is held. */
		payable: boolean;
		/** Forge progress from 0 to 1. */
		progress: number;
		siteColor: string;
		z: number;
		/** Called every few frames while holding. */
		onfeed: (center: Point) => void;
		/** Pays up to `fraction` more of the cost, returns the share paid. */
		onpour: (fraction: number) => number;
		onrefuse: () => void;
	}

	let { class: className, color, kind, paid, payable, progress, siteColor, z, onfeed, onpour, onrefuse }: Props = $props();

	const BARE_COLOR = '#c3cad6';
	const SHELL_SLOTS = 7;
	/** Seconds of holding that pay a whole reading from nothing, each frame pays its share. */
	const HOLD_SECONDS = 4;
	const FEED_EVERY = 110;

	let host = $state<HTMLButtonElement>();
	let renderer = $state.raw<AtomRenderer>();
	let holding = $state(false);
	let heldZ = 0;
	let lastFeed = 0;
	let frame = 0;

	const shells = $derived(shellsOf(z));
	const total = $derived(shells.reduce((sum, count) => sum + count, 0));
	const nucleons = $derived(Math.min(NUCLEON_RANGE.max, nucleonsOf(z)));

	const scene: AtomScene = $derived.by(() => {
		const electrons = kind === 'identified' || kind === 'reading' ? total : kind === 'ready' ? Math.floor(paid * total) : 0;
		const shellColor = kind === 'identified' ? color : '#ffffff';
		return {
			auras: kind === 'forging' ? [siteColor] : kind === 'waiting' ? [] : [color],
			bonus: false,
			energy: kind === 'identified' ? 0.25 : 0.1 + 0.9 * paid,
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

	function refuse() {
		onrefuse();
		host?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
	}

	/** A frame that can't pay its whole share ends the hold, and so does the read that completes: `kind` already says `reading` right after `onpour`. */
	function step(previous: number) {
		frame = requestAnimationFrame(now => {
			frame = 0;
			if (kind !== 'ready' || z !== heldZ) holding = false;
			if (!holding) return;
			const start = performance.now();
			const asked = Math.max(0, Math.min(0.1, (now - previous) / 1000)) / HOLD_SECONDS;
			const got = onpour(asked);
			perfTracker.track('table:pour', start);
			if (kind !== 'ready') {
				holding = false;
				return;
			}
			if (got < asked) {
				holding = false;
				refuse();
				return;
			}
			if (now - lastFeed > FEED_EVERY) {
				lastFeed = now;
				onfeed(center());
			}
			step(now);
		});
	}

	function press(x: number, y: number) {
		if (kind !== 'ready') return;
		if (!payable) {
			refuse();
			return;
		}
		holding = true;
		heldZ = z;
		const rect = host!.getBoundingClientRect();
		renderer?.pulse(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2);
		if (!frame) step(performance.now());
	}

	/** Holding Space or Enter pays like holding the pointer, the pulse starts at the atom's center. */
	function keyPress(event: KeyboardEvent) {
		if (event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		if (event.repeat) return;
		const { x, y } = center();
		press(x, y);
	}

	function release() {
		holding = false;
		cancelAnimationFrame(frame);
		frame = 0;
	}
</script>

<button
	bind:this={host}
	class={[
		'stage group relative flex items-center justify-center rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
		kind === 'ready' && 'cursor-pointer',
		kind === 'ready' && payable && 'transition-transform hover:scale-105',
		className,
	]}
	aria-disabled={kind === 'ready' && !payable ? true : undefined}
	aria-label={kind === 'ready' ? `Hold to read ${ELEMENTS[z - 1].name}` : 'Element atom'}
	onblur={release}
	onkeydown={keyPress}
	onkeyup={release}
	onlostpointercapture={release}
	onpointercancel={release}
	onpointerdown={event => {
		if (event.button !== 0) return;
		press(event.clientX, event.clientY);
		host?.setPointerCapture(event.pointerId);
	}}
	onpointerup={release}
>
	<!-- A waiting element has no nucleus yet, so no renderer runs for it. -->
	{#if kind !== 'waiting'}
		<canvas
			class="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2"
			style:height="{100 * CANVAS_OVERFLOW}%"
			style:width="{100 * CANVAS_OVERFLOW}%"
			{@attach mount}
		></canvas>
	{/if}
	{#if kind === 'waiting'}
		<span class="absolute inset-[22%] rounded-full border-2 border-dashed border-amber-300/40"></span>
		<span class="pointer-events-none text-4xl font-black text-amber-200/70 lg:text-7xl">?</span>
	{:else if kind === 'ready'}
		<span class={['absolute inset-[6%] rounded-full', payable && paid === 0 && !holding ? 'calling border-2 border-white/40 group-hover:border-white/80' : 'border border-white/10']}></span>
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
				stroke-dashoffset={2 * Math.PI * 49 * (1 - paid)}
				stroke-linecap="round"
				stroke-width="1.5"
			/>
		</svg>
		{#if !holding}
			<span
				class={[
					'pointer-events-none absolute bottom-[3%] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#05070f]/85 px-2.5 py-1 text-xs font-bold whitespace-nowrap ring-1 ring-white/20',
					payable ? 'text-white group-hover:ring-white/60' : 'text-white/45',
				]}
			>
				<Hand size={12} />
				{paid > 0 ? 'Hold to continue' : 'Hold to read'}
			</span>
		{/if}
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
