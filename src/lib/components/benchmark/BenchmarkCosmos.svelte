<script lang="ts">
	import { COSMOS_DISCOVERABLE, COSMOS_INSTRUMENT_COUNT, cosmosSteps } from '#lib/simulation/cosmos.js';
	import { simTime } from '#lib/simulation/markdownReport.js';
	import type { CosmosBlocker, SimulationResult } from '#lib/simulation/types.js';
	import { formatNumber } from '#lib/utils.js';
	import { Telescope } from '@lucide/svelte';

	let { result }: { result: SimulationResult } = $props();

	const BLOCKERS: Record<CosmosBlocker, { color: string; label: string }> = {
		aperture: { color: '#a78bfa', label: 'Saving for Aperture' },
		instrument: { color: '#f59e0b', label: 'Saving for an instrument' },
		observe: { color: '#22d3ee', label: 'Observing the signal' },
		research: { color: '#f472b6', label: 'Instrument being built' },
		widening: { color: '#818cf8', label: 'Aperture widening' },
	};

	const cosmos = $derived(result.insights?.cosmos);
	const final = $derived(result.snapshots.at(-1)?.cosmos);
	const openedAt = $derived(cosmos?.openedAt ?? null);
	const steps = $derived(cosmos ? cosmosSteps(cosmos) : []);
	const blocked = $derived(Object.entries(cosmos?.blockedMs ?? {}).filter(([, ms]) => ms > 0) as [CosmosBlocker, number][]);
	const blockedTotal = $derived(blocked.reduce((total, [, ms]) => total + ms, 0));
	const longestWait = $derived(steps.filter(step => step.kind === 'discover').reduce((max, step) => Math.max(max, step.wait), 0));
	const skyDoneAt = $derived(final?.discovered === COSMOS_DISCOVERABLE ? steps.findLast(step => step.kind === 'discover')?.timestamp : undefined);
</script>

{#if cosmos}
	<section class="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-2xl">
		<div class="flex gap-3 items-center mb-6 text-gray-400">
			<Telescope size={20} />
			<h2 class="font-semibold text-gray-200 text-xl">Cosmos</h2>
			{#if openedAt !== null}
				<span class="text-gray-500 text-sm">opened at {simTime(openedAt)}</span>
			{/if}
		</div>

		{#if openedAt === null || !final}
			<p class="text-gray-500 text-sm">The run never reached the first Ionize, so the Cosmos stayed closed. Run longer or pick a stronger profile.</p>
		{:else}
			<div class="gap-3 grid grid-cols-2 md:grid-cols-6 text-sm">
				{#each [
					['Discovered', `${final.discovered}/${COSMOS_DISCOVERABLE}`],
					['Instruments', `${final.instruments}/${COSMOS_INSTRUMENT_COUNT}`],
					['Aperture', `${final.aperture}`],
					['Starlight/s', formatNumber(final.starlightPerSecond)],
					['Longest wait', simTime(longestWait)],
					['Sky complete', skyDoneAt === undefined ? 'no' : `+${simTime(skyDoneAt - openedAt)}`],
				] as [label, value] (label)}
					<div class="bg-black/20 flex flex-col gap-1 p-3 rounded-lg">
						<span class="text-gray-500 text-xs">{label}</span>
						<span class="font-mono text-cyan-300">{value}</span>
					</div>
				{/each}
			</div>

			{#if blockedTotal > 0}
				<div class="flex flex-col gap-2 mt-6">
					<h3 class="font-medium text-gray-400 text-xs tracking-wider uppercase">What the next discovery waited on ({simTime(blockedTotal)})</h3>
					<div class="flex h-3 overflow-hidden rounded-full">
						{#each blocked as [blocker, ms] (blocker)}
							<div
								style="background: {BLOCKERS[blocker].color}; width: {(ms / blockedTotal) * 100}%"
								title="{BLOCKERS[blocker].label}: {simTime(ms)}"
							></div>
						{/each}
					</div>
					<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
						{#each blocked as [blocker, ms] (blocker)}
							<span class="flex gap-1.5 items-center text-gray-400">
								<span class="rounded-full size-2" style="background: {BLOCKERS[blocker].color}"></span>
								{BLOCKERS[blocker].label}
								<span class="font-mono text-gray-500">{simTime(ms)} · {((ms / blockedTotal) * 100).toFixed(0)}%</span>
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<div class="gap-6 grid grid-cols-1 lg:grid-cols-[3fr_2fr] mt-6">
				<div class="flex flex-col gap-2">
					<h3 class="font-medium text-gray-400 text-xs tracking-wider uppercase">Ladder</h3>
					<div class="max-h-96 overflow-y-auto pr-2 text-sm">
						<div class="gap-x-4 grid grid-cols-[1fr_auto_auto_auto] px-2 py-1 text-gray-500 text-xs">
							<span>Step</span>
							<span class="text-right">Since open</span>
							<span class="text-right">Wait</span>
							<span class="text-right">Starlight/s</span>
						</div>
						{#each steps as step (step.kind + step.id)}
							<div class="gap-x-4 grid grid-cols-[1fr_auto_auto_auto] hover:bg-white/5 px-2 py-1 rounded {step.kind === 'instrument' ? 'mt-2 text-amber-300 font-semibold' : 'text-gray-300'}">
								<span class="truncate">{step.name}</span>
								<span class="font-mono text-right text-xs">{simTime(step.timestamp - openedAt)}</span>
								<span class="font-mono text-right text-xs {step.wait >= 3_600_000 ? 'text-red-400' : 'text-gray-500'}">{simTime(step.wait)}</span>
								<span class="font-mono text-right text-gray-500 text-xs">{formatNumber(step.starlightPerSecond)}</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<h3 class="font-medium text-gray-400 text-xs tracking-wider uppercase">Boosts at the end</h3>
					<div class="flex flex-col gap-1 text-sm">
						{#each Object.entries(final.boosts).toSorted(([, a], [, b]) => b - a) as [stat, value] (stat)}
							<div class="flex justify-between px-2 py-1">
								<span class="text-gray-400">{stat.replaceAll('_', ' ')}</span>
								<span class="font-mono text-cyan-300">×{value.toFixed(2)}</span>
							</div>
						{/each}
					</div>
					<p class="mt-2 text-gray-500 text-xs">{final.studyLevels} study levels, {final.ionizes} Ionizes, {formatNumber(final.starlightEarned)} Starlight earned.</p>
				</div>
			</div>
		{/if}
	</section>
{/if}
