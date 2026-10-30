<script lang="ts">
	import { untrack } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		class?: ClassValue;
		/** Time the blades take to open, 0 shows the iris at rest, wide open. */
		durationMs?: number;
		/** Share of `durationMs` already elapsed when the opening starts, read once so a remount resumes mid-way. */
		progress?: number;
		size?: number;
	}

	let { class: className, durationMs = 0, progress = 0, size = 20 }: Props = $props();

	const BLADES = [0, 60, 120, 180, 240, 300];

	const delayMs = $derived(-untrack(() => progress) * durationMs);

	let flashing = $state(false);
	let wasOpening = false;

	$effect(() => {
		const opening = durationMs > 0;
		if (wasOpening && !opening) flashing = true;
		wasOpening = opening;
	});
</script>

<span
	style:height="{size}px"
	style:width="{size}px"
	class={['relative inline-grid shrink-0 place-items-center', className]}
>
	<svg
		style:--iris-delay="{delayMs}ms"
		style:--iris-duration="{durationMs}ms"
		class={['size-full [clip-path:circle(45%)]', durationMs > 0 && 'opening']}
		aria-hidden="true"
		viewBox="0 0 40 40"
	>
		<g class="spin">
			{#each BLADES as angle (angle)}
				<g transform="rotate({angle} 20 20)">
					<path
						class="blade fill-current stroke-cosmos-hud"
						d="M38 20Q27.5 22 17 20Q20 8 30 -2H38Z"
						stroke-width="1.1"
					/>
				</g>
			{/each}
		</g>
		<circle
			class="stroke-current"
			cx="20"
			cy="20"
			fill="none"
			r="17.2"
			stroke-width="1.6"
		/>
	</svg>
	{#if flashing}
		<span
			class="iris-flash pointer-events-none absolute inset-0 rounded-full ring-2 ring-white motion-reduce:hidden"
			onanimationend={() => (flashing = false)}
		></span>
	{/if}
</span>

<style>
	/** Each blade pivots on the rim, its edge sweeps from nearly shut to the rest angle (the end of the animation). */
	.blade {
		rotate: 36deg;
		transform-origin: 34px 20px;
	}

	.spin {
		transform-origin: 20px 20px;
	}

	@media (prefers-reduced-motion: no-preference) {
		.opening .blade {
			animation: iris-open var(--iris-duration) var(--iris-delay) ease-in-out forwards;
		}

		.opening .spin {
			animation: iris-spin var(--iris-duration) var(--iris-delay) ease-in-out forwards;
		}
	}

	.iris-flash {
		animation: iris-flash 0.4s ease-out forwards;
	}

	@keyframes iris-open {
		from {
			rotate: 8deg;
		}
	}

	@keyframes iris-spin {
		from {
			rotate: -90deg;
		}
	}

	@keyframes iris-flash {
		from {
			opacity: 0.9;
			scale: 1;
		}
		to {
			opacity: 0;
			scale: 1.7;
		}
	}
</style>
