<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		class?: string;
		disabled?: boolean;
		holdDuration?: number;
		onHoldComplete: () => void;
		style?: string;
	}

	let { children, class: className = '', disabled = false, holdDuration = 2000, onHoldComplete, style = '' }: Props = $props();

	let progress = $state(0);
	let holding = $state(false);
	let frame: number | null = null;
	let startTime = 0;

	const clipPath = $derived(`inset(0 ${100 - progress}% 0 0)`);
	const glowSpread = $derived(6 + (progress / 100) * 22);
	const glowBlur = $derived(16 + (progress / 100) * 40);
	const boxShadow = $derived(
		holding ? `0 0 ${glowBlur}px ${glowSpread}px var(--hold-glow, rgba(255, 255, 255, 0.5))` : ''
	);

	function tick() {
		const elapsed = performance.now() - startTime;
		progress = Math.min(elapsed / holdDuration, 1) * 100;

		if (progress >= 100) {
			frame = null;
			holding = false;
			progress = 0;
			onHoldComplete();
			return;
		}

		frame = requestAnimationFrame(tick);
	}

	function startHold(event: PointerEvent) {
		if (disabled || holding) return;
		// Capture keeps the hold alive when the finger drifts off the button, which touch devices do constantly.
		try {
			(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
		} catch {}
		holding = true;
		startTime = performance.now();
		frame = requestAnimationFrame(tick);
	}

	function cancelHold() {
		if (frame !== null) cancelAnimationFrame(frame);
		frame = null;
		holding = false;
		progress = 0;
	}
</script>

<button
	class="hold-button relative overflow-hidden {className}"
	class:holding
	{disabled}
	{style}
	style:box-shadow={boxShadow}
	onpointercancel={cancelHold}
	onpointerdown={startHold}
	onpointerleave={cancelHold}
	onpointerup={cancelHold}
>
	<div
		class="hold-button-fill absolute inset-0"
		style:clip-path={clipPath}
	>
		<div class="hold-button-shimmer absolute inset-0"></div>
	</div>

	{#if holding}
		<div class="hold-button-sparks absolute inset-0">
			{#each Array(10) as _, i}
				<span
					class="hold-spark"
					style="--i: {i}; --left: {8 + Math.random() * 84}%; --delay: {Math.random() * 0.6}s; --duration: {0.7 + Math.random() * 0.5}s;"
				></span>
			{/each}
		</div>
		<div class="hold-button-ring absolute inset-0"></div>
	{/if}

	<span class="contents">
		{@render children()}
	</span>
</button>

<style>
	.hold-button {
		transition: box-shadow 0.15s ease-out;
		touch-action: none;
	}

	.hold-button-fill {
		background: linear-gradient(90deg, var(--hold-color, #ffffff) 0%, var(--hold-color-2, var(--hold-color, #ffffff)) 100%);
		pointer-events: none;
		opacity: 0.55;
	}

	.hold-button:not(.holding) .hold-button-fill {
		transition: clip-path 0.2s ease-out;
	}

	.hold-button-shimmer {
		background: repeating-linear-gradient(
			115deg,
			transparent 0%,
			rgba(255, 255, 255, 0.35) 4%,
			transparent 9%,
			transparent 14%
		);
		background-size: 220% 100%;
	}

	.hold-button.holding .hold-button-shimmer {
		animation: shimmer-sweep 2.4s linear infinite;
	}

	@keyframes shimmer-sweep {
		0% {
			background-position: 0% 0;
		}
		100% {
			background-position: -220% 0;
		}
	}

	.hold-button-ring {
		border-radius: inherit;
		box-shadow: inset 0 0 0 2px var(--hold-color, #ffffff);
		animation: ring-pulse 0.9s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes ring-pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 0.9;
		}
	}

	.hold-button-sparks {
		pointer-events: none;
	}

	.hold-spark {
		position: absolute;
		bottom: 10%;
		left: var(--left);
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--hold-color, #ffffff);
		box-shadow: 0 0 8px 2px var(--hold-glow, rgba(255, 255, 255, 0.6));
		opacity: 0;
		animation: spark-rise var(--duration) ease-out var(--delay) infinite;
	}

	@keyframes spark-rise {
		0% {
			opacity: 0;
			transform: translateY(0) scale(0.6);
		}
		15% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-220%) scale(1.2);
		}
	}
</style>
