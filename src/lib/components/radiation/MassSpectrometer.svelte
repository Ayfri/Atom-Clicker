<script lang="ts">
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { formatNumber } from '$lib/utils';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import { Check, TrendingDown, TrendingUp } from '@lucide/svelte';

	interface Props {
		previewMass?: number;
	}

	let { previewMass = 0 }: Props = $props();

	const mass = $derived(radiationManager.mass);
	const decayRate = $derived(radiationManager.decayRate);
	const regenRate = $derived(radiationManager.regenRate);
	const netChange = $derived(radiationManager.netMassChange);
	const timeToEmpty = $derived(radiationManager.timeToEmpty);

	// Progress bar percentage (out of 500 max visual)
	const maxVisualMass = 500;
	const fillPercent = $derived(Math.min(100, (mass / maxVisualMass) * 100));
	const previewPercent = $derived(Math.min(100, ((mass + previewMass) / maxVisualMass) * 100));

	// Stability status
	const isStable = $derived(netChange >= 0);
	const isCritical = $derived(netChange < -1 && timeToEmpty < 60);

	function formatTime(seconds: number): string {
		if (!isFinite(seconds)) return '∞';
		if (seconds < 60) return `${seconds.toFixed(0)}s`;
		if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
		return `${(seconds / 3600).toFixed(1)}h`;
	}
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
				<circle
					cx="12"
					cy="12"
					r="3"
				></circle>
				<path d="M12 2v4m0 12v4m-7.07-2.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4m-2.93 7.07-2.83-2.83M6.34 6.34 3.51 3.51"
				></path>
			</svg>
			Core Fuel
			<HelpIcon position="top">
				{#snippet content()}
					<p class="text-white/70"><strong>Core Fuel (mass)</strong> powers the reactor.</p>
					<p class="text-white/60 mt-1 text-xs">Raising the power burns it (Burn). Only the Breeder Reactor upgrade puts mass back (Regen).</p>
					<p class="text-white/60 mt-1 text-xs">If Burn outpaces Regen the core empties and the bonus drops back to x1.</p>
				{/snippet}
			</HelpIcon>
		</h3>
		<!-- Stability indicator -->
		{#if mass > 0}
			{#if isStable}
				<div class="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
					<Check class="w-3 h-3" />
					Stable
				</div>
			{:else if isCritical}
				<div class="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full animate-pulse">
					<TrendingDown class="w-3 h-3" />
					Critical
				</div>
			{:else}
				<div class="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
					<TrendingUp class="w-3 h-3 rotate-180" />
					Draining
				</div>
			{/if}
		{/if}
	</div>

	<!-- Mass bar with preview -->
	<div class="relative h-6 bg-black/40 rounded-full overflow-hidden border border-radiation/20 mb-2">
		<!-- Preview overlay (shows what will be added) -->
		{#if previewMass > 0}
			<div
				class="absolute inset-y-0 left-0 bg-radiation/25 transition-all duration-150"
				style="width: {previewPercent}%"
			></div>
		{/if}
		<!-- Current mass -->
		<div
			class="absolute inset-y-0 left-0 transition-all duration-300
				{isStable ? 'bg-linear-to-r from-radiation/60 to-radiation'
			: isCritical ? 'bg-linear-to-r from-red-600 to-red-400'
			: 'bg-linear-to-r from-yellow-600 to-yellow-400'}"
			style="width: {fillPercent}%"
		></div>
		<!-- Text -->
		<div class="absolute inset-0 flex items-center justify-center">
			<span class="text-sm font-mono font-bold text-white drop-shadow-lg">
				{formatNumber(mass, 1)} u
				{#if previewMass > 0}
					<span class="text-radiation/80">+{previewMass.toFixed(1)}</span>
				{/if}
			</span>
		</div>
	</div>

	<!-- Stats row -->
	<div class="grid grid-cols-3 gap-2 text-xs">
		<div class="text-center">
			<div class="text-white/40">Burn</div>
			<div class="text-red-400 font-mono">-{decayRate.toFixed(2)}/s</div>
		</div>
		<div class="text-center">
			<div class="text-white/40">Regen</div>
			<div class="text-green-400 font-mono">+{regenRate.toFixed(2)}/s</div>
		</div>
		<div class="text-center">
			<div class="text-white/40">{isStable ? 'Status' : 'Time Left'}</div>
			<div
				class="{isStable ? 'text-green-400'
				: isCritical ? 'text-red-400'
				: 'text-yellow-400'} font-mono"
			>
				{isStable ? '∞' : formatTime(timeToEmpty)}
			</div>
		</div>
	</div>
</div>
