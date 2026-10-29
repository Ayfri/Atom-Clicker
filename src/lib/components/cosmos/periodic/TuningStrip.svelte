<script lang="ts">
	import { type Element, TUNING, tuneX, wavelengthColor } from '#data/elements.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';

	interface Props {
		element: Element;
	}

	const HALF = TUNING.width / 2;
	/** Color samples every 50 nm across the strip, the same 350 to 900 nm axis as the bars. */
	const SPECTRUM = `linear-gradient(90deg, ${Array.from({ length: 12 }, (_, i) => 350 + i * 50)
		.map(nm => `${wavelengthColor(nm)} ${tuneX(nm)}%`)
		.join(', ')})`;
	const TICKS = [400, 500, 600, 700, 800];
	const windowWidth = tuneX(350 + TUNING.width);

	let { element }: Props = $props();

	const center = $derived(periodicManager.tuning);
</script>

<!-- The input is invisible on top of the strip and spans exactly the window's travel, so a finger or the arrow keys move it natively. -->
<div
	class="w-full max-w-60"
	data-hint="table-tuning"
>
	<div class="relative h-8 rounded bg-[#0b0f1c]">
		<input
			class="peer absolute -top-2 z-10 h-12 cursor-pointer touch-pan-y appearance-none opacity-0 [&::-moz-range-thumb]:size-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none"
			style:left="{tuneX(TUNING.min)}%"
			style:width="{tuneX(TUNING.max) - tuneX(TUNING.min)}%"
			aria-label="Tuning window center in nanometers"
			max={TUNING.max}
			min={TUNING.min}
			oninput={event => periodicManager.setTuning(event.currentTarget.valueAsNumber)}
			step="1"
			type="range"
			value={center}
		/>
		<span
			class="absolute inset-0 rounded opacity-20"
			style:background-image={SPECTRUM}
		></span>
		{#each element.lines as nm (nm)}
			<span
				class={['absolute inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full', Math.abs(nm - center) > HALF && 'opacity-35']}
				style:background={wavelengthColor(nm)}
				style:left="{tuneX(nm)}%"
			></span>
		{/each}
		<span
			class="pointer-events-none absolute inset-y-0 rounded bg-white/20 ring-1 ring-white/60 peer-focus-visible:ring-2 peer-focus-visible:ring-white"
			style:left="{tuneX(center - HALF)}%"
			style:width="{windowWidth}%"
		></span>
	</div>
	<div class="relative h-3.5 text-[9px] text-white/35">
		{#each TICKS as nm (nm)}
			<span
				class="absolute -translate-x-1/2"
				style:left="{tuneX(nm)}%"
			>
				{nm} nm
			</span>
		{/each}
	</div>
	<p class="text-center text-[10px] text-white/50">Lines inside ×{TUNING.factorIn}, outside ×{TUNING.factorOut}</p>
</div>
