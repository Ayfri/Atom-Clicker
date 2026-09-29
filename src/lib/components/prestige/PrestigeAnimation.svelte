<script lang="ts">
	import { CHROMATIC, CHROMATIC_COLORS } from '$data/chromatic';
	import { CURRENCIES } from '$data/currencies';
	import type { PrestigeAnimationType as AnimationType } from '$stores/prestige.svelte';
	import Electron from '@components/icons/Electron.svelte';
	import Light from '@components/icons/Light.svelte';
	import Proton from '@components/icons/Proton.svelte';
	import { Radiation } from '@lucide/svelte';
	import { untrack } from 'svelte';

	/** Each Light starts the Ionize symbol offset along its own direction, the three merge back into white. */
	const LIGHTS = CHROMATIC_COLORS.map((color, i) => ({
		color: CURRENCIES[CHROMATIC[color].currency].color,
		dx: Math.round(14 * Math.cos((i * 2 * Math.PI) / 3 - Math.PI / 2)),
		dy: Math.round(14 * Math.sin((i * 2 * Math.PI) / 3 - Math.PI / 2)),
		facets: CHROMATIC[color].facets,
	}));

	interface Props {
		animation: AnimationType | null;
		onComplete?: () => void;
	}

	let { animation, onComplete }: Props = $props();

	let isPlaying = $state(false);
	let currentAnimation = $state<AnimationType | null>(null);

	$effect(() => {
		if (animation) {
			untrack(() => {
				currentAnimation = animation;
				isPlaying = true;
				setTimeout(() => {
					isPlaying = false;
					currentAnimation = null;
					onComplete?.();
				}, 4500);
			});
		}
	});
</script>

{#if isPlaying && currentAnimation}
	<div
		class="prestige-overlay"
		data-type={currentAnimation}
	>
		<!-- Core flash -->
		<div class="core-flash"></div>

		<!-- Expanding rings -->
		{#each Array(5) as _, i}
			<div
				class="ring"
				style="--delay: {i * 0.2}s; --scale: {1 + i * 0.4}"
			></div>
		{/each}

		<!-- Energy beam rays -->
		{#each Array(12) as _, i}
			<div
				class="beam"
				style="--rotation: {i * 30}deg; --delay: {i * 0.07}s"
			></div>
		{/each}

		<!-- Background Dust Particles -->
		{#each Array(40) as _, i}
			<div
				class="particle"
				style="
					--angle: {(i / 40) * 360}deg;
					--distance: {50 + Math.random() * 50}vmax;
					--size: {8 + Math.random() * 12}px;
					--delay: {Math.random() * 0.7}s;
					--duration: {2 + Math.random() * 1.5}s;
				"
			></div>
		{/each}

		<!-- Hexagonal grid for protonise -->
		{#if currentAnimation === 'protonise'}
			<div class="hex-grid">
				{#each Array(20) as _, i}
					<div
						class="hex"
						style="
							--x: {Math.random() * 100}%;
							--y: {Math.random() * 100}%;
							--delay: {Math.random() * 1}s;
							--size: {40 + Math.random() * 60}px;
						"
					></div>
				{/each}
			</div>

			<!-- Proton Splash -->
			<div class="currency-splash">
				{#each Array(60) as _, i}
					<div
						class="currency-particle proton-motion"
						style="
							--angle: {i * 6 + Math.random() * 10}deg;
							--dist: {30 + Math.random() * 20}vmax;
							--delay: {0.1 + Math.random() * 0.2}s;
							--duration: {3 + Math.random() * 2}s;
							--spin: {Math.random() * 360}deg;
						"
					>
						<Proton size={32 + Math.random() * 32} />
					</div>
				{/each}
			</div>
		{/if}

		<!-- Lightning for electronize -->
		{#if currentAnimation === 'electronize'}
			<svg
				class="lightning-container"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
			>
				{#each Array(8) as _, i}
					<path
						class="lightning-bolt"
						style="--delay: {i * 0.25}s; --duration: {1 + Math.random() * 0.5}s"
					></path>
				{/each}
			</svg>
			<div class="electron-orbits fade-out-early">
				{#each Array(4) as _, i}
					<div
						class="orbit"
						style="--size: {30 + i * 20}vmin; --duration: {1.5 + i * 0.4}s; --delay: {i * 0.1}s"
					>
						<div class="electron"></div>
					</div>
				{/each}
			</div>

			<!-- Electron Splash -->
			<div class="currency-splash">
				{#each Array(80) as _, i}
					<div
						class="currency-particle electron-motion"
						style="
							--angle: {Math.random() * 360}deg;
							--dist: {40 + Math.random() * 30}vmax;
							--delay: {Math.random() * 0.4}s;
							--duration: {2.5 + Math.random() * 1.5}s;
							--spin: {Math.random() * 360}deg;
						"
					>
						<Electron size={96 + Math.random() * 96} />
					</div>
				{/each}
			</div>
		{/if}

		<!-- Ionize: electrons torn off their orbits, then a white beam split into the three Lights by the Prism -->
		{#if currentAnimation === 'ionize'}
			{#each Array(3) as _, i}
				<div
					class="ion-orbit"
					style="--tilt: {i * 60}deg; --delay: {i * 0.08}s"
				>
					<div
						class="ion-orbit-spin"
						style="--duration: {0.5 + i * 0.12}s"
					>
						<div class="ion-electron"></div>
					</div>
				</div>
			{/each}

			<div class="white-ray"></div>
			{#each LIGHTS as light, i (light.color)}
				<div
					class="color-ray"
					style="--color: {light.color}; --angle: {(1 - i) * 7}deg; --delay: {1.6 + i * 0.08}s"
				></div>
			{/each}
			<svg
				class="prism"
				viewBox="0 0 100 100"
			>
				<polygon points="50,8 94,86 6,86" />
			</svg>

			<div class="currency-splash">
				{#each Array(45) as _, i}
					{@const light = LIGHTS[i % LIGHTS.length]}
					<div
						class="currency-particle light-motion"
						style="
							--angle: {i * 8 + Math.random() * 8}deg;
							--dist: {35 + Math.random() * 30}vmax;
							--delay: {1.7 + Math.random() * 0.4}s;
							--duration: {2 + Math.random() * 1}s;
						"
					>
						<Light
							color={light.color}
							facets={light.facets}
							size={28 + Math.random() * 28}
						/>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Shockwave -->
		<div class="shockwave"></div>
		<div class="shockwave shockwave-2"></div>

		<!-- Vignette -->
		<div class="vignette"></div>

		<!-- Central symbol -->
		<div class="central-symbol">
			{#if currentAnimation === 'protonise'}
				<Proton
					size={160}
					class="symbol-icon"
				/>
			{:else if currentAnimation === 'ionize'}
				<div class="chroma">
					{#each LIGHTS as light (light.color)}
						<span
							class="chroma-layer"
							style="--dx: {light.dx}px; --dy: {light.dy}px"
						>
							<Radiation
								color={light.color}
								size={160}
							/>
						</span>
					{/each}
				</div>
			{:else}
				<Electron
					size={160}
					class="symbol-icon"
				/>
			{/if}
		</div>
	</div>
{/if}

<style>
	.prestige-overlay {
		align-items: center;
		contain: layout paint style;
		display: flex;
		height: 100%;
		justify-content: center;
		left: 0;
		overflow: hidden;
		pointer-events: none;
		position: fixed;
		top: 0;
		width: 100%;
		z-index: 9999;
	}

	/* Protonise color scheme */
	.prestige-overlay[data-type='protonise'] {
		--primary: #fbbf24;
		--secondary: #f59e0b;
		--accent: #fef3c7;
		--glow: rgba(251, 191, 36, 0.6);
		--bg-tint: rgba(251, 191, 36, 0.1);
	}

	/* Electronize color scheme */
	.prestige-overlay[data-type='electronize'] {
		--primary: #34d399;
		--secondary: #10b981;
		--accent: #d1fae5;
		--glow: rgba(52, 211, 153, 0.6);
		--bg-tint: rgba(52, 211, 153, 0.1);
	}

	/* Ionize color scheme: the reactor green burning out to white */
	.prestige-overlay[data-type='ionize'] {
		--primary: #39ff14;
		--secondary: #22c55e;
		--accent: #f5f7ff;
		--glow: rgba(57, 255, 20, 0.6);
		--bg-tint: rgba(57, 255, 20, 0.1);
	}

	.currency-splash {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		z-index: 5;
	}

	.currency-particle {
		left: 0;
		opacity: 0;
		position: absolute;
		top: 0;
	}

	/* Proton Motion: Heavy, explosive radial burst with rotation */
	.proton-motion {
		animation: proton-splash var(--duration) cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
		animation-delay: var(--delay);
	}

	@keyframes proton-splash {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
		}
		10% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1) rotate(var(--spin));
		}
		100% {
			opacity: 0;
			transform: translate(calc(cos(var(--angle)) * var(--dist) - 50%), calc(sin(var(--angle)) * var(--dist) - 50%)) scale(0.5)
				rotate(calc(var(--spin) + 180deg));
		}
	}

	/* Electron Motion: Fast, erratic zig-zag/chaotic burst */
	.electron-motion {
		animation: electron-splash var(--duration) ease-out forwards;
		animation-delay: var(--delay);
	}

	@keyframes electron-splash {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.2) rotate(var(--spin));
		}
		15% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(calc(cos(var(--angle)) * var(--dist) - 50%), calc(sin(var(--angle)) * var(--dist) - 50%)) scale(0)
				rotate(calc(var(--spin) + 720deg));
		}
	}

	/** Rasterised at 100vmax and composited up to 3x: same visual as a 300vmax layer for a ninth of the blurred pixels. */
	.core-flash {
		animation: core-flash 0.8s ease-out forwards;
		background: radial-gradient(circle, var(--accent) 0%, var(--primary) 30%, transparent 70%);
		border-radius: 50%;
		filter: blur(7px);
		height: 100vmax;
		opacity: 0;
		position: absolute;
		width: 100vmax;
	}

	@keyframes core-flash {
		0% {
			opacity: 0;
			transform: scale(0);
		}
		30% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(3);
		}
	}

	.ring {
		animation: ring-expand 2s ease-out forwards;
		animation-delay: var(--delay);
		border: 3px solid var(--primary);
		border-radius: 50%;
		box-shadow:
			0 0 30px var(--glow),
			inset 0 0 20px var(--glow);
		height: 50vmin;
		opacity: 0;
		position: absolute;
		width: 50vmin;
	}

	@keyframes ring-expand {
		0% {
			opacity: 0;
			transform: scale(0);
		}
		20% {
			opacity: 0.8;
		}
		100% {
			opacity: 0;
			transform: scale(var(--scale, 3));
		}
	}

	/** Grown with scaleX rather than width: the layer is rastered once instead of relaying out 12 full-viewport bars every frame. */
	.beam {
		animation: beam-flash 1s ease-out forwards;
		animation-delay: var(--delay);
		background: linear-gradient(90deg, transparent 0%, var(--accent) 20%, var(--primary) 50%, var(--accent) 80%, transparent 100%);
		height: 4px;
		left: 50%;
		opacity: 0;
		position: absolute;
		top: 50%;
		transform: rotate(var(--rotation)) scaleX(0);
		transform-origin: left center;
		width: 80vmax;
	}

	@keyframes beam-flash {
		0% {
			opacity: 0;
			transform: rotate(var(--rotation)) scaleX(0);
		}
		30% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: rotate(var(--rotation)) scaleX(1);
		}
	}

	.particle {
		animation: particle-burst var(--duration) ease-out forwards;
		animation-delay: var(--delay);
		background: var(--primary);
		border-radius: 50%;
		box-shadow: 0 0 10px var(--glow);
		height: var(--size);
		left: 50%;
		opacity: 0;
		position: absolute;
		top: 50%;
		width: var(--size);
	}

	@keyframes particle-burst {
		0% {
			opacity: 1;
			transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance));
		}
	}

	.hex-grid {
		height: 100%;
		left: 0;
		position: absolute;
		top: 0;
		width: 100%;
	}

	.hex {
		animation: hex-appear 1.3s ease-out forwards;
		animation-delay: var(--delay);
		border: 2px solid var(--primary);
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		height: var(--size);
		left: var(--x);
		opacity: 0;
		position: absolute;
		top: var(--y);
		width: var(--size);
	}

	@keyframes hex-appear {
		0% {
			opacity: 0;
			transform: scale(0) rotate(0deg);
		}
		50% {
			opacity: 0.6;
		}
		100% {
			opacity: 0;
			transform: scale(2) rotate(60deg);
		}
	}

	/** One filter pass over the whole SVG instead of two drop-shadow subtrees per bolt, which re-filtered 8 viewport-sized regions each frame. */
	.lightning-container {
		filter: drop-shadow(0 0 10px var(--primary));
		height: 100%;
		left: 0;
		position: absolute;
		top: 0;
		width: 100%;
	}

	.lightning-bolt {
		animation: lightning-strike var(--duration) ease-out forwards;
		animation-delay: var(--delay);
		fill: none;
		opacity: 0;
		stroke: var(--accent);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 0.5;
	}

	.lightning-bolt:nth-child(1) {
		d: path('M50 0 L45 25 L55 30 L40 55 L60 60 L30 100');
	}
	.lightning-bolt:nth-child(2) {
		d: path('M0 30 L25 35 L20 45 L50 50 L45 60 L80 70');
	}
	.lightning-bolt:nth-child(3) {
		d: path('M100 20 L75 30 L80 40 L55 50 L60 65 L40 80');
	}
	.lightning-bolt:nth-child(4) {
		d: path('M20 0 L30 20 L15 35 L40 50 L25 70 L50 100');
	}
	.lightning-bolt:nth-child(5) {
		d: path('M80 0 L70 25 L85 40 L60 55 L75 75 L50 100');
	}
	.lightning-bolt:nth-child(6) {
		d: path('M0 60 L20 55 L15 70 L45 65 L40 80 L70 90');
	}
	.lightning-bolt:nth-child(7) {
		d: path('M100 70 L80 65 L85 50 L60 55 L65 40 L40 30');
	}
	.lightning-bolt:nth-child(8) {
		d: path('M30 100 L35 80 L20 70 L40 55 L30 40 L50 20');
	}

	@keyframes lightning-strike {
		0% {
			opacity: 0;
			stroke-dasharray: 0 500;
		}
		10% {
			opacity: 1;
		}
		50% {
			opacity: 1;
			stroke-dasharray: 500 0;
		}
		100% {
			opacity: 0;
			stroke-dasharray: 500 0;
		}
	}

	.electron-orbits {
		align-items: center;
		display: flex;
		height: 100%;
		justify-content: center;
		left: 0;
		position: absolute;
		top: 0;
		width: 100%;
	}

	.orbit {
		animation: orbit-spin var(--duration) linear infinite;
		animation-delay: var(--delay);
		border: 1px solid var(--primary);
		border-radius: 50%;
		height: var(--size);
		opacity: 0.5;
		position: absolute;
		width: var(--size);
	}

	.orbit:nth-child(odd) {
		animation-direction: reverse;
		transform: rotateX(60deg);
	}

	.orbit:nth-child(even) {
		transform: rotateY(60deg);
	}

	.electron {
		animation: electron-pulse 0.6s ease-in-out infinite alternate;
		background: var(--accent);
		border-radius: 50%;
		box-shadow:
			0 0 20px var(--glow),
			0 0 40px var(--glow);
		height: 12px;
		left: -6px;
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 12px;
	}

	@keyframes orbit-spin {
		from {
			rotate: 0deg;
		}
		to {
			rotate: 360deg;
		}
	}

	.fade-out-early {
		animation: fade-out 1s ease-out forwards;
		animation-delay: 1.5s;
	}

	@keyframes fade-out {
		to {
			opacity: 0;
		}
	}

	@keyframes electron-pulse {
		from {
			transform: translateY(-50%) scale(1);
		}
		to {
			transform: translateY(-50%) scale(1.5);
		}
	}

	/** Circles flattened into ellipses by rotateX, the inner spin runs in their plane so each electron follows its ellipse. */
	.ion-orbit {
		animation: ion-orbit-fling 1.8s ease-in forwards;
		animation-delay: var(--delay);
		height: 44vmin;
		opacity: 0;
		position: absolute;
		transform: rotate(var(--tilt)) rotateX(72deg);
		width: 44vmin;
	}

	@keyframes ion-orbit-fling {
		0% {
			opacity: 0;
			scale: 0.4;
		}
		15%,
		55% {
			opacity: 1;
			scale: 1;
		}
		100% {
			opacity: 0;
			scale: 4;
		}
	}

	.ion-orbit-spin {
		animation: orbit-spin var(--duration) linear infinite;
		border: 1px solid var(--primary);
		border-radius: 50%;
		height: 100%;
		position: relative;
		width: 100%;
	}

	.ion-electron {
		background: var(--accent);
		border-radius: 50%;
		box-shadow:
			0 0 16px var(--glow),
			0 0 32px var(--glow);
		height: 14px;
		left: -7px;
		position: absolute;
		top: calc(50% - 7px);
		width: 14px;
	}

	.white-ray {
		animation: white-ray 1.4s ease-out 1.2s forwards;
		background: linear-gradient(90deg, transparent, var(--accent));
		height: 4px;
		left: 0;
		opacity: 0;
		position: absolute;
		top: calc(50% - 2px);
		transform: scaleX(0);
		transform-origin: left center;
		width: 50%;
	}

	@keyframes white-ray {
		0% {
			opacity: 1;
			transform: scaleX(0);
		}
		30% {
			opacity: 1;
			transform: scaleX(1);
		}
		100% {
			opacity: 0;
			transform: scaleX(1);
		}
	}

	/** A wedge widening away from the prism, grown with scaleX like the beams. */
	.color-ray {
		animation: color-ray 1.9s ease-out forwards;
		animation-delay: var(--delay);
		background: linear-gradient(90deg, var(--color), transparent);
		clip-path: polygon(0 46%, 100% 0, 100% 100%, 0 54%);
		height: 16vmin;
		left: 50%;
		opacity: 0;
		position: absolute;
		top: calc(50% - 8vmin);
		transform: rotate(var(--angle)) scaleX(0);
		transform-origin: left center;
		width: 60vmax;
	}

	@keyframes color-ray {
		0% {
			opacity: 0.9;
			transform: rotate(var(--angle)) scaleX(0);
		}
		30% {
			opacity: 0.9;
			transform: rotate(var(--angle)) scaleX(1);
		}
		100% {
			opacity: 0;
			transform: rotate(var(--angle)) scaleX(1);
		}
	}

	.prism {
		animation: prism-appear 2.4s ease-out 1.2s forwards;
		fill: color-mix(in srgb, var(--accent) 10%, transparent);
		height: 20vmin;
		opacity: 0;
		position: absolute;
		stroke: var(--accent);
		stroke-linejoin: round;
		stroke-width: 2.5;
		width: 20vmin;
		z-index: 6;
	}

	@keyframes prism-appear {
		0% {
			opacity: 0;
			transform: scale(0.5) rotate(-60deg);
		}
		20% {
			opacity: 1;
			transform: scale(1) rotate(0deg);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.15);
		}
	}

	.light-motion {
		animation: light-splash var(--duration) cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
		animation-delay: var(--delay);
	}

	@keyframes light-splash {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.3);
		}
		10% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(calc(cos(var(--angle)) * var(--dist) - 50%), calc(sin(var(--angle)) * var(--dist) - 50%)) scale(0.6);
		}
	}

	/** The Ionize symbol is short-lived so the Prism takes the center right after it. */
	.prestige-overlay[data-type='ionize'] .central-symbol {
		animation: ionize-symbol 1.8s ease-out forwards;
	}

	@keyframes ionize-symbol {
		0% {
			opacity: 0;
			transform: scale(0) rotate(-120deg);
		}
		25% {
			opacity: 1;
			transform: scale(1.15) rotate(0deg);
		}
		45% {
			transform: scale(1);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.8);
		}
	}

	/** Screen-blended inside the symbol's filter group, the three colored copies add up to white once they overlap. */
	.chroma {
		display: grid;
	}

	.chroma-layer {
		animation: chroma-merge 1.6s ease-out forwards;
		grid-area: 1 / 1;
		mix-blend-mode: screen;
	}

	@keyframes chroma-merge {
		0% {
			translate: calc(var(--dx) * 3) calc(var(--dy) * 3);
		}
		20% {
			translate: var(--dx) var(--dy);
		}
		55%,
		100% {
			translate: 0 0;
		}
	}

	.shockwave {
		animation: shockwave-expand 2.5s ease-out forwards;
		border: 2px solid var(--primary);
		border-radius: 50%;
		height: 10vmin;
		opacity: 0;
		position: absolute;
		width: 10vmin;
	}

	.shockwave-2 {
		animation-delay: 0.4s;
		border-width: 4px;
	}

	@keyframes shockwave-expand {
		0% {
			opacity: 0.8;
			transform: scale(0);
		}
		100% {
			opacity: 0;
			transform: scale(15);
		}
	}

	.vignette {
		animation: vignette-pulse 4s ease-out forwards;
		background: radial-gradient(ellipse at center, transparent 0%, transparent 40%, var(--bg-tint) 70%, rgba(0, 0, 0, 0.5) 100%);
		height: 100%;
		left: 0;
		pointer-events: none;
		position: absolute;
		top: 0;
		width: 100%;
	}

	@keyframes vignette-pulse {
		0% {
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		80% {
			opacity: 0.5;
		}
		100% {
			opacity: 0;
		}
	}

	.central-symbol {
		animation: symbol-reveal 4s ease-out forwards;
		filter: drop-shadow(0 0 20px var(--glow)) drop-shadow(0 0 40px var(--glow));
		opacity: 0;
		position: absolute;
		z-index: 10;
	}

	/* Removed .symbol-text class as it's no longer used, replaced with direct styling if needed or using Lucide default */
	:global(.symbol-icon) {
		color: var(--accent);
		filter: drop-shadow(0 0 10px var(--primary));
	}

	@keyframes symbol-reveal {
		0% {
			opacity: 0;
			transform: scale(0) rotate(-180deg);
		}
		30% {
			opacity: 1;
			transform: scale(1.2) rotate(0deg);
		}
		50% {
			transform: scale(1) rotate(0deg);
		}
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.5) rotate(15deg);
		}
	}
</style>
