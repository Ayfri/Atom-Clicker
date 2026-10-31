<script lang="ts">
	import { cellCenter, GRID_AT, GRID_COLUMNS, GRID_ROWS, IntroGrid, symbolSize } from '#components/cosmos/periodic/IntroGrid.js';
	import { SKY, SPECTRUM } from '#components/cosmos/periodic/sky.js';
	import { TableParticles } from '#components/cosmos/periodic/TableParticles.js';
	import { elementBySymbol, ELEMENTS, FAMILIES, lineX } from '#data/elements.js';
	import { SITE_IDS, SITES } from '#data/sites.js';
	import { particlesEnabled } from '#helpers/CanvasLoop.js';
	import { cosmosFx } from '#helpers/cosmosFx.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { ui } from '#stores/ui.svelte.js';
	import { onMount, untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';

	interface Flight {
		color: string;
		dx: number;
		dy: number;
		scale: number;
		symbol: string;
		x: number;
		y: number;
		z: number;
	}

	interface Geometry {
		beam: { angle: number; length: number; x: number; y: number };
		flights: Flight[];
	}

	/** Fraunhofer lines of the Sun by wavelength in nm, in the order they drop into the band. */
	const SOLAR_LINES = [
		['H', 656],
		['Na', 589],
		['Mg', 517],
		['Fe', 527],
		['H', 486],
		['Ca', 397],
	] as const;
	/** A line only drops if the element's data has one this close to the solar one. */
	const LINE_TOLERANCE_NM = 15;
	/** Where each part starts, in ms. */
	const AT = { band: 900, fade: 3200, final: 5600, lines: 1800, prism: 800, sources: 4600 } as const;
	const ENTRIES = ['#nav-periodic-table', '[data-hint="cosmos-table"]'];
	const FLY_MS = 900;
	const FLY_STEP_MS = 90;
	const LABEL_PX = 14;
	const LAUNCH_DELAY_MS = 350;
	const LINE_STEP_MS = 200;
	const REDUCED_MS = 300;
	const SOURCE_STEP_MS = 90;
	const BOUNCE: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }];
	/** Wide as the screen allows, and short enough that the grid, the title and the buttons all fit under each other. */
	const GRID_WIDTH = 'max(16rem, min(44rem, 92vw, calc((100dvh - 21rem) * 1.915)))';

	const lines = SOLAR_LINES.flatMap(([symbol, target]) => {
		const element = elementBySymbol(symbol);
		const nm = element.lines.reduce((best, line) => (Math.abs(line - target) < Math.abs(best - target) ? line : best), Infinity);
		return Math.abs(nm - target) <= LINE_TOLERANCE_NM ? [{ color: FAMILIES[element.family].color, nm, symbol, z: element.z }] : [];
	}).map((line, i) => ({ ...line, at: AT.lines + i * LINE_STEP_MS }));

	/** What the Table is forging when the introduction starts, a snapshot: the sky it shows is the one the player had then. */
	const sources = untrack(() =>
		SITE_IDS.filter(id => periodicManager.open.has(id))
			.toSorted((a, b) => +(b === 'bigbang') - +(a === 'bigbang'))
			.map(id => ({ id, status: periodicManager.statuses[id] })),
	);
	const reduced = prefersReducedMotion.current;

	const landed = new SvelteSet<number>();
	let band = $state<HTMLElement>();
	let block = $state<HTMLElement>();
	let canvas = $state<HTMLCanvasElement>();
	let final = $state(reduced);
	let geometry = $state.raw<Geometry | null>(null);
	let grid: IntroGrid | undefined;
	let leaving = false;
	let openButton = $state<HTMLButtonElement>();
	let particleCanvas = $state<HTMLCanvasElement>();
	let root = $state<HTMLElement>();
	let timers: ReturnType<typeof setTimeout>[] = [];
	let title = $state<HTMLElement>();
	let veil = $state<HTMLElement>();

	$effect(() => ui.cover());

	$effect(() => {
		if (final) openButton?.focus({ preventScroll: true });
	});

	onMount(() => {
		if (!band || !canvas || !particleCanvas) return;
		const instance = new IntroGrid(canvas);
		grid = instance;
		const particles = particlesEnabled && !reduced ? new TableParticles(particleCanvas) : null;
		const cells = canvas.getBoundingClientRect();
		const bandRect = band.getBoundingClientRect();
		const center = { x: bandRect.left + bandRect.width / 2, y: bandRect.top + bandRect.height / 2 };
		const sun = cosmosFx.spot('sun') ?? { x: 0, y: 0 };
		const fontScale = symbolSize(cells.width) / LABEL_PX;

		geometry = {
			beam: { angle: Math.atan2(center.y - sun.y, center.x - sun.x), length: Math.hypot(center.x - sun.x, center.y - sun.y), x: sun.x, y: sun.y },
			flights: lines.map(({ color, nm, symbol, z }) => {
				const x = bandRect.left + (lineX(nm) / 100) * bandRect.width;
				const y = bandRect.top - LABEL_PX;
				const cell = cellCenter(z, cells.width);
				return { color, dx: cells.left + cell.x - x, dy: cells.top + cell.y - y, scale: fontScale, symbol, x, y, z };
			}),
		};

		sources.forEach(({ id, status }, i) => {
			if (status.kind !== 'forging') return;
			const { color } = SITES[id];
			const launchAt = AT.sources + i * SOURCE_STEP_MS + LAUNCH_DELAY_MS;
			const progress = status.progress / ELEMENTS[status.z - 1].need;
			instance.ring(status.z, color, progress, launchAt + 900);
			if (reduced) return;
			timers.push(
				setTimeout(() => {
					const disc = document.querySelector(`[data-intro-source="${id}"]`)?.getBoundingClientRect();
					if (!disc) return;
					const cell = cellCenter(status.z, cells.width);
					const to = { x: cells.left + cell.x, y: cells.top + cell.y };
					particles?.comet({ x: disc.left + disc.width / 2, y: disc.top + disc.height / 2 }, to, color);
					timers.push(setTimeout(() => particles?.burst(to, [color, '#ffffff'], 10, { speed: 90 }), 900));
				}, launchAt),
			);
		});

		if (reduced) {
			for (const { z } of lines) instance.land(z);
			instance.finish();
		} else {
			instance.start();
			timers.push(setTimeout(() => (final = true), AT.final));
		}

		return () => {
			for (const timer of timers) clearTimeout(timer);
			timers = [];
			particles?.destroy();
			instance.destroy();
			grid = undefined;
			/** Also unmounted by a save load that locks the Table mid-play, which must not leave the Cosmos paused. */
			realmManager.introPlaying = false;
		};
	});

	function skip() {
		if (final) return;
		final = true;
		for (const timer of timers) clearTimeout(timer);
		timers = [];
		for (const { z } of lines) grid?.land(z);
		grid?.finish();
	}

	function end(): number | null {
		leaving = true;
		periodicManager.introSeen = true;
		const focus = realmManager.introFocus;
		realmManager.introFocus = null;
		return focus;
	}

	/** An animation that never reports its end (a hidden tab) must not leave the veil on screen. */
	const ended = (animation: Animation) => Promise.race([animation.finished, new Promise(resolve => setTimeout(resolve, 1000))]);

	/** The introduction drops under the Table (z-47) at once: the Table slides in over the grid that scales up and fades, never behind the veil. */
	async function open() {
		if (leaving || !root || !block) return;
		const focus = end();
		root.style.pointerEvents = 'none';
		root.style.zIndex = '46';
		realmManager.openTable(focus ?? undefined);
		const fade = root.animate({ opacity: [1, 0] }, { duration: reduced ? REDUCED_MS : 450, easing: 'ease-in', fill: 'forwards' });
		if (!reduced) block.animate({ opacity: [1, 0], transform: ['scale(1)', 'scale(2.2)'] }, { duration: 450, easing: 'cubic-bezier(0.5, 0, 1, 0.5)', fill: 'forwards' });
		await ended(fade);
		realmManager.introPlaying = false;
	}

	/** The grid shrinks into the entry of the Table when one is on screen, and that entry bounces to say where the Table lives. */
	async function later() {
		if (leaving || !root || !block) return;
		end();
		const entry = ENTRIES.map(selector => document.querySelector(selector)).find(candidate => candidate && candidate.getBoundingClientRect().width > 0);
		const target = entry?.getBoundingClientRect();
		let motion: Animation;
		if (target && !reduced) {
			const from = block.getBoundingClientRect();
			const scale = Math.min(target.width / from.width, target.height / from.height);
			const dx = target.left + target.width / 2 - (from.left + from.width / 2);
			const dy = target.top + target.height / 2 - (from.top + from.height / 2);
			veil?.animate({ opacity: [1, 0] }, { duration: 500, fill: 'forwards' });
			title?.animate({ opacity: [1, 0] }, { duration: 200, fill: 'forwards' });
			motion = block.animate({ transform: ['none', `translate(${dx}px, ${dy}px) scale(${scale})`] }, { duration: 600, easing: 'cubic-bezier(0.6, 0, 0.3, 1)', fill: 'forwards' });
		} else motion = root.animate({ opacity: [1, 0] }, { duration: REDUCED_MS, fill: 'forwards' });
		await ended(motion);
		realmManager.introPlaying = false;
		entry?.animate(BOUNCE, { duration: 400, easing: 'ease-out' });
	}
</script>

<svelte:window
	onkeydown={event => {
		if (event.key !== 'Escape') return;
		if (final) later();
		else skip();
	}}
/>

<div
	bind:this={root}
	class={['fixed inset-0 z-48 overflow-hidden text-white select-none', final && 'settled']}
	aria-label="The Periodic Table"
	aria-modal="true"
	role="dialog"
>
	<div
		bind:this={veil}
		class="veil absolute inset-0 bg-[#05070f]/92"
		style:animation-duration={reduced ? `${REDUCED_MS}ms` : undefined}
	></div>

	{#if !final}
		<div class="light-out pointer-events-none absolute inset-0">
			{#if geometry}
				{@const { angle, length, x, y } = geometry.beam}
				<span
					style:height="2px"
					style:left="{x}px"
					style:rotate="{angle}rad"
					style:top="{y}px"
					style:width="{length}px"
					class="beam absolute origin-left bg-white shadow-[0_0_12px_2px_white]"
				></span>
			{/if}
			<svg
				style:animation-delay="{AT.prism}ms"
				class="pop absolute top-[40%] left-1/2 size-16 -translate-1/2"
				aria-hidden="true"
				viewBox="0 0 64 64"
			>
				<polygon
					fill="rgb(255 255 255 / 0.06)"
					points="32,6 58,54 6,54"
					stroke="white"
					stroke-linejoin="round"
					stroke-width="2"
				/>
			</svg>
			<div
				bind:this={band}
				class="absolute top-[40%] left-1/2 h-14 w-[min(36rem,90vw)] -translate-1/2"
			>
				<span
					style:animation-delay="{AT.band}ms"
					style:background-image={SPECTRUM}
					class="open absolute inset-0 rounded-sm"
				></span>
				{#each lines as { at, nm } (nm)}
					<span
						style:animation-delay="{at}ms"
						style:left="{lineX(nm)}%"
						class="drop absolute inset-y-0 w-0.75 origin-top -translate-x-1/2 bg-black"
					></span>
				{/each}
			</div>
		</div>

		{#if geometry}
			{#each geometry.flights as { color, dx, dy, scale, symbol, x, y, z }, i (i)}
				{#if !landed.has(i)}
					<span
						style:--dx="{dx}px"
						style:--dy="{dy}px"
						style:--scale={scale}
						style:animation-delay="{GRID_AT + i * FLY_STEP_MS}ms"
						style:animation-duration="{FLY_MS}ms"
						style:left="{x}px"
						style:top="{y}px"
						class="fly pointer-events-none absolute -translate-1/2"
						onanimationend={() => {
							landed.add(i);
							grid?.land(z);
						}}
					>
						<span
							style:animation-delay="{lines[i].at}ms"
							style:color
							style:font-size="{LABEL_PX}px"
							class="rise block font-black [text-shadow:0_0_6px_#05070f]"
						>
							{symbol}
						</span>
					</span>
				{/if}
			{/each}
		{/if}
	{/if}

	<div class="absolute inset-0 flex flex-col items-center justify-center gap-6 px-4 py-6">
		<div
			bind:this={block}
			class="flex flex-col items-center gap-3"
		>
			<div class="flex min-h-8 flex-wrap justify-center gap-1.5 sm:min-h-10">
				{#each sources as { id }, i (id)}
					<span
						style:--delay="{AT.sources + i * SOURCE_STEP_MS}ms"
						style:background={SKY[id]}
						class="source size-8 rounded-full ring-1 ring-white/15 sm:size-10"
						data-intro-source={id}
						title={SITES[id].name}
					></span>
				{/each}
			</div>
			<canvas
				bind:this={canvas}
				style:aspect-ratio="{GRID_COLUMNS} / {GRID_ROWS}"
				style:width={GRID_WIDTH}
				class="relative block"
				aria-hidden="true"
			></canvas>
		</div>

		<div
			bind:this={title}
			style:animation-duration={reduced ? `${REDUCED_MS}ms` : undefined}
			class={['flex flex-col items-center gap-3 text-center', final ? 'title' : 'pointer-events-none opacity-0']}
			inert={!final}
		>
			<h2 class="text-3xl font-black tracking-tight text-[#cfe8ff] sm:text-5xl">The Periodic Table</h2>
			<p class="max-w-md text-sm text-white/70 sm:text-base">Every element was forged somewhere in the sky. Read its light to make it yours.</p>
			<div class="mt-2 flex flex-wrap items-center justify-center gap-2">
				<button
					bind:this={openButton}
					class="min-h-11 rounded-xl bg-accent-500 px-5 font-bold text-white shadow-[0_0_20px_rgb(74_144_226/0.35)] transition-colors hover:bg-accent-400"
					onclick={open}
				>
					Open the Table
				</button>
				<button
					class="min-h-11 rounded-xl px-4 text-white/60 transition-colors hover:text-white"
					onclick={later}
				>
					Later
				</button>
			</div>
		</div>
	</div>

	<canvas
		bind:this={particleCanvas}
		class="pointer-events-none absolute inset-0 z-10 size-full"
		aria-hidden="true"
	></canvas>

	{#if !final}
		<button
			class="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 min-h-11 px-3 text-sm text-white/50 transition-colors hover:text-white"
			onclick={skip}
		>
			Skip
		</button>
	{/if}
</div>

<style>
	.veil {
		animation: veil 0.8s ease-out both;
	}

	.title {
		animation: veil 0.5s ease-out both;
	}

	.beam {
		animation: beam 0.8s ease-in both;
	}

	.pop {
		animation: pop 0.35s cubic-bezier(0.3, 1.6, 0.5, 1) both;
	}

	.open {
		animation: open 0.9s ease-out both;
	}

	.drop {
		animation: drop 0.35s cubic-bezier(0.3, 1.6, 0.5, 1) both;
	}

	.rise {
		animation: rise 0.35s ease-out both;
	}

	.fly {
		animation: fly ease-in-out both;
	}

	.light-out {
		animation: light-out 1.4s ease-in-out 3.2s both;
	}

	.source {
		animation: pop 0.35s cubic-bezier(0.3, 1.6, 0.5, 1) var(--delay) both;
	}

	.settled .source {
		animation: none;
	}

	@keyframes veil {
		from {
			opacity: 0;
		}
	}

	@keyframes beam {
		from {
			transform: scaleX(0);
		}
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
	}

	@keyframes open {
		from {
			opacity: 0;
			transform: scaleX(0);
		}
	}

	@keyframes drop {
		from {
			transform: scaleY(0);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}

	@keyframes fly {
		to {
			transform: translate(var(--dx), var(--dy)) scale(var(--scale));
		}
	}

	@keyframes light-out {
		to {
			opacity: 0;
		}
	}
</style>
