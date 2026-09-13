<script lang="ts">
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';

	const controlLevel = $derived(radiationManager.controlRodLevel);
	const stableLevel = $derived(radiationManager.stableControlLevel);

	function handleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		radiationManager.setControlRodLevel(parseFloat(target.value));
	}

	// Status based on control level
	const status = $derived(
		controlLevel < 0.1 ? { label: 'Idle', color: 'text-blue-400', desc: 'No output, no burn' }
		: controlLevel < 0.3 ? { label: 'Low', color: 'text-green-400', desc: 'Efficient, slow burn' }
		: controlLevel < 0.6 ? { label: 'Active', color: 'text-yellow-400', desc: 'Balanced output' }
		: controlLevel < 0.85 ? { label: 'High', color: 'text-orange-400', desc: 'High output, fast burn' }
		: { label: 'MAX', color: 'text-red-400', desc: 'Maximum output!' },
	);
</script>

<div class="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-radiation/20">
	<div class="flex items-center justify-between mb-2">
		<h3 class="text-xs font-semibold text-radiation flex items-center gap-2">
			<svg
				class="w-3.5 h-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect
					x="3"
					y="3"
					width="18"
					height="18"
					rx="2"
				></rect>
				<line
					x1="12"
					y1="3"
					x2="12"
					y2="21"
				></line>
			</svg>
			Power Level
			<HelpIcon position="top">
				{#snippet content()}
					<div class="text-left">
						<p class="text-white/70"><strong>Power</strong> is how hard the reactor runs.</p>
						<p class="text-white/60 mt-1 text-xs">Double the power: double the output (CPM).</p>
						<p class="text-white/60 mt-1 text-xs">Double the power: four times the fuel burn.</p>
						<p class="text-radiation/80 mt-1 text-xs">The white tick is the highest power your regen can keep up with forever.</p>
					</div>
				{/snippet}
			</HelpIcon>
		</h3>
	</div>

	<!-- Slider -->
	<div class="relative mb-2 py-1.5">
		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			value={controlLevel}
			oninput={handleChange}
			class="w-full h-2 rounded-lg appearance-none cursor-pointer"
			style="background: linear-gradient(to right, #3b82f6, #22c55e 33%, #eab308 66%, #ef4444)"
		/>
		{#if stableLevel > 0}
			<div
				class="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white/80 rounded-full pointer-events-none"
				style="left: calc(9px + (100% - 18px) * {stableLevel})"
				title="Stable up to {(stableLevel * 100).toFixed(0)}%"
			></div>
		{/if}
	</div>

	<!-- Stats row -->
	<div class="grid grid-cols-3 gap-2 text-xs">
		<div class="text-center">
			<div class="text-white/40">Level</div>
			<div class="font-mono text-white">{(controlLevel * 100).toFixed(0)}%</div>
		</div>
		<div class="text-center">
			<div class="text-white/40">Status</div>
			<div class={status.color + ' font-medium'}>{status.label}</div>
		</div>
		<div class="text-center">
			<div class="text-white/40">Stable up to</div>
			<div class="font-mono {stableLevel > 0 ? 'text-radiation' : 'text-white/40'}">{stableLevel > 0 ? `${(stableLevel * 100).toFixed(0)}%` : 'no regen'}</div>
		</div>
	</div>
</div>

<style>
	input[type='range']::-webkit-slider-thumb {
		box-sizing: border-box;
		appearance: none;
		background: white;
		border: 2px solid var(--color-radiation);
		border-radius: 50%;
		box-shadow: 0 0 8px color-mix(in srgb, var(--color-radiation) 50%, transparent);
		cursor: pointer;
		height: 18px;
		width: 18px;
	}

	input[type='range']::-moz-range-thumb {
		box-sizing: border-box;
		background: white;
		border: 2px solid var(--color-radiation);
		border-radius: 50%;
		box-shadow: 0 0 8px color-mix(in srgb, var(--color-radiation) 50%, transparent);
		cursor: pointer;
		height: 18px;
		width: 18px;
	}
</style>
