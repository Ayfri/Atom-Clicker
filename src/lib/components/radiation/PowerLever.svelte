<script lang="ts">
	import { radiationManager } from '#helpers/RadiationManager.svelte.js';

	interface Props {
		/** Phones get a horizontal throttle, the fixed realm switcher covers the right edge of the reactor where the vertical one sits. */
		vertical: boolean;
	}

	let { vertical }: Props = $props();

	/** Matches the thumb thickness below, markers sit on the thumb's travel rather than on the full track. */
	const THUMB_PX = 22;

	const level = $derived(radiationManager.controlRodLevel);
	const stableLevel = $derived(radiationManager.stableControlLevel);
	const draining = $derived(radiationManager.mass > 0 && level > 0 && radiationManager.netMassChange < 0);
	const travel = (value: number) => `calc(${THUMB_PX / 2}px + (100% - ${THUMB_PX}px) * ${value})`;
</script>

<div class="flex items-center gap-2 {vertical ? 'h-full w-14 flex-col py-2' : 'w-full'}">
	<span class="text-[10px] font-bold uppercase tracking-[0.2em] {vertical ? 'text-red-400/70' : 'text-sky-400/70'}">
		{vertical ? 'Max' : 'Off'}
	</span>
	<div class="relative flex-1 {vertical ? 'w-full' : 'h-12'}">
		<div
			class="absolute rounded-full {vertical ? 'inset-y-0 left-1/2 w-2.5 -translate-x-1/2' : 'inset-x-0 top-1/2 h-2.5 -translate-y-1/2'}"
			style:background="linear-gradient(to {vertical ? 'top' : 'right'}, #60a5fa, #22c55e 30%, #eab308 65%, #ef4444)"
		></div>
		<div
			class="absolute bg-black/70 {vertical ? 'left-1/2 top-0 w-2.5 -translate-x-1/2 rounded-t-full' : 'right-0 top-1/2 h-2.5 -translate-y-1/2 rounded-r-full'}"
			style:height={vertical ? travel(1 - level) : undefined}
			style:width={vertical ? undefined : travel(1 - level)}
		></div>
		{#if stableLevel > 0}
			<div
				class="pointer-events-none absolute flex items-center justify-center {vertical ? 'inset-x-1 translate-y-1/2' : 'inset-y-2 -translate-x-1/2'}"
				style:bottom={vertical ? travel(stableLevel) : undefined}
				style:left={vertical ? undefined : travel(stableLevel)}
				title="Sustainable up to {(stableLevel * 100).toFixed(0)}%"
			>
				<span class="rounded-full bg-white/90 {vertical ? 'h-0.5 w-full' : 'h-full w-0.5'}"></span>
				<span class="absolute text-xs font-bold leading-none text-white/90 {vertical ? '-left-3' : '-top-2'}">∞</span>
			</div>
		{/if}
		<input
			aria-label="Reactor power"
			aria-valuetext="{(level * 100).toFixed(0)}%"
			class={['lever absolute inset-0 size-full cursor-grab active:cursor-grabbing', { vertical }]}
			max="1"
			min="0"
			oninput={event => radiationManager.setControlRodLevel(event.currentTarget.valueAsNumber)}
			step="0.01"
			type="range"
			value={level}
		/>
	</div>
	<span class="text-[10px] font-bold uppercase tracking-[0.2em] {vertical ? 'text-sky-400/70' : 'text-red-400/70'}">{vertical ? 'Off' : 'Max'}</span>
	<span class="flex items-center leading-none {vertical ? 'flex-col gap-1.5' : 'order-first w-14 flex-col gap-1'}">
		<span class="font-mono text-lg font-bold tabular-nums {draining ? 'text-yellow-300' : 'text-white'}">{(level * 100).toFixed(0)}%</span>
		<span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Power</span>
	</span>
</div>

<style>
	.lever {
		appearance: none;
		background: transparent;
		touch-action: pan-y;
	}

	.lever.vertical {
		direction: rtl;
		touch-action: none;
		writing-mode: vertical-lr;
	}

	.lever::-webkit-slider-runnable-track {
		background: transparent;
	}

	.lever::-moz-range-track {
		background: transparent;
	}

	.lever::-webkit-slider-thumb {
		appearance: none;
		background: linear-gradient(#f4f6f8, #9aa3ad);
		border: 2px solid var(--color-radiation);
		border-radius: 6px;
		box-shadow:
			0 0 12px color-mix(in srgb, var(--color-radiation) 60%, transparent),
			0 3px 0 #0008;
		box-sizing: border-box;
		height: 44px;
		width: 22px;
	}

	.lever::-moz-range-thumb {
		background: linear-gradient(#f4f6f8, #9aa3ad);
		border: 2px solid var(--color-radiation);
		border-radius: 6px;
		box-shadow:
			0 0 12px color-mix(in srgb, var(--color-radiation) 60%, transparent),
			0 3px 0 #0008;
		box-sizing: border-box;
		height: 44px;
		width: 22px;
	}

	.lever.vertical::-webkit-slider-thumb {
		height: 22px;
		width: 44px;
	}

	.lever.vertical::-moz-range-thumb {
		height: 22px;
		width: 44px;
	}

	.lever:focus-visible::-webkit-slider-thumb {
		outline: 2px solid white;
		outline-offset: 2px;
	}
</style>
