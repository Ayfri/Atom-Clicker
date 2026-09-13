<script lang="ts">
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { ChevronRight, Fuel, Gauge, Radiation, Sparkles } from '@lucide/svelte';

	const mass = $derived(radiationManager.mass);
	const controlLevel = $derived(radiationManager.controlRodLevel);
	const stableLevel = $derived(radiationManager.stableControlLevel);
	const cpm = $derived(radiationManager.currentCpm);
	const maxCpm = $derived(radiationManager.maxCpm);
	const multiplier = $derived(radiationManager.radiationMultiplier);
	const netChange = $derived(radiationManager.netMassChange);
	const timeToEmpty = $derived(radiationManager.timeToEmpty);

	const capped = $derived(cpm >= maxCpm);
	const cpmPercent = $derived(Math.min(100, (cpm / maxCpm) * 100));

	function formatTime(seconds: number): string {
		if (seconds < 60) return `${seconds.toFixed(0)}s`;
		if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
		return `${(seconds / 3600).toFixed(1)}h`;
	}
</script>

<div class="bg-linear-to-r from-radiation/10 to-transparent backdrop-blur-sm rounded-xl p-3 border border-radiation/30">
	<div class="flex items-center gap-2 mb-2">
		<h3 class="text-xs font-semibold text-radiation flex items-center gap-2">
			<Radiation class="w-3.5 h-3.5" />
			Reactor
		</h3>
		<HelpIcon position="bottom">
			{#snippet content()}
				<div class="text-left text-xs">
					<p class="text-white/70">Fuel and power make output, output makes the bonus.</p>
					<p class="text-white/60 mt-1 font-mono">output = fuel x power x 10</p>
					<p class="text-white/60 font-mono">bonus = 1 + output / 50</p>
					<p class="text-white/50 mt-2">Output is measured in CPM and has a cap. Coolant Pumps raise it.</p>
				</div>
			{/snippet}
		</HelpIcon>
	</div>

	<div class="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-1 text-xs">
		<div class="text-center min-w-0">
			<div class="text-white/40 flex items-center justify-center gap-1">
				<Fuel class="w-3 h-3" />
				Fuel
			</div>
			<div class="font-mono text-white font-semibold truncate">{formatNumber(mass, 1)} u</div>
			<div
				class="font-mono truncate {netChange >= 0 ? 'text-radiation/80'
				: timeToEmpty < 60 ? 'text-red-400'
				: 'text-yellow-400'}"
			>
				{#if mass <= 0}
					empty
				{:else if netChange >= 0}
					{netChange > 0 ? `+${netChange.toFixed(2)}/s` : 'stable'}
				{:else}
					{netChange.toFixed(2)}/s, {formatTime(timeToEmpty)}
				{/if}
			</div>
		</div>

		<ChevronRight class="w-4 h-4 text-white/20" />

		<div class="text-center min-w-0">
			<div class="text-white/40 flex items-center justify-center gap-1">
				<Gauge class="w-3 h-3" />
				Power
			</div>
			<div class="font-mono text-white font-semibold">{(controlLevel * 100).toFixed(0)}%</div>
			<div class="text-white/30 truncate">{controlLevel <= 0 ? 'idle' : controlLevel > stableLevel ? 'draining' : 'sustainable'}</div>
		</div>

		<ChevronRight class="w-4 h-4 text-white/20" />

		<div class="text-center min-w-0">
			<div class="text-white/40">Output</div>
			<div class="font-mono font-semibold {capped ? 'text-orange-400' : 'text-white'}">
				{formatNumber(cpm, 0)} <span class="text-white/30 font-normal">/ {formatNumber(maxCpm, 0)}</span>
			</div>
			<div class="relative mx-auto mt-1 h-1 w-full max-w-24 rounded-full bg-black/40 overflow-hidden">
				<div
					class="absolute inset-y-0 left-0 rounded-full transition-all duration-300 {capped ? 'bg-orange-400' : 'bg-radiation'}"
					style="width: {cpmPercent}%"
				></div>
			</div>
			<div class="{capped ? 'text-orange-400' : 'text-white/30'} truncate">{capped ? 'capped' : 'CPM'}</div>
		</div>

		<ChevronRight class="w-4 h-4 text-white/20" />

		<div class="text-center min-w-0">
			<div class="text-white/40 flex items-center justify-center gap-1">
				<Sparkles class="w-3 h-3" />
				Bonus
			</div>
			<div class="font-mono text-2xl font-bold text-radiation leading-tight">x{multiplier.toFixed(2)}</div>
			<div class="text-white/30 truncate">production</div>
		</div>
	</div>
</div>
