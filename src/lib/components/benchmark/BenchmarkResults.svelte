<script lang="ts">
	import { Award, ChevronDown, ChevronUp, Clock, Layers, Sparkles, Star, Target, TrendingUp, Zap } from '@lucide/svelte';
	import { formatDuration, formatNumber, formatSimTimePrecise } from '$lib/utils';
	import { MILESTONES } from '$lib/simulation/milestones';
	import type { SimulationResult } from '$lib/simulation/types';
	import SpikeBreakdown from './SpikeBreakdown.svelte';

	type ResultWithCount = SimulationResult & { milestoneCount?: number };
	let { result }: { result: ResultWithCount } = $props();

	const milestoneCount = $derived(result.milestoneCount ?? result.milestones.length);

	let showRemainingMilestones = $state(false);

	const remainingMilestones = $derived.by(() => {
		if (!result) return [];
		const reachedIds = new Set(result.milestones.map(m => m.milestone.id));
		return MILESTONES.filter(m => !reachedIds.has(m.id));
	});

	const spikes = $derived(result.spikes ?? []);
</script>

<section class="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-2xl">
	<div class="flex gap-3 items-center mb-6 text-gray-400">
		<TrendingUp size={20} />
		<h2 class="font-semibold text-gray-200 text-xl">
			Simulation Results {result.cancelled ? '(Cancelled)' : ''}
		</h2>
	</div>

	<div class="gap-4 grid grid-cols-2 md:grid-cols-6">
		<div class="bg-black/20 flex gap-4 items-center p-4 rounded-xl text-green-400">
			<Clock size={24} />
			<div class="flex flex-col">
				<span class="font-bold text-xl">{formatDuration(result.durationMs)}</span>
				<span class="text-gray-500 text-xs">Real Time</span>
			</div>
		</div>

		<div class="bg-black/20 flex gap-4 items-center p-4 rounded-xl text-green-400">
			<Zap size={24} />
			<div class="flex flex-col">
				<span class="font-bold text-xl">{formatNumber(result.snapshots.at(-1)?.atomsPerSecond ?? 0)}/s</span>
				<span class="text-gray-500 text-xs">Final APS</span>
			</div>
		</div>

		<div class="bg-black/20 flex gap-4 items-center p-4 rounded-xl text-amber-400">
			<Star size={24} />
			<div class="flex flex-col">
				<span class="font-bold text-xl">Lv.{result.snapshots.at(-1)?.playerLevel ?? 0}</span>
				<span class="text-gray-500 text-xs">Player Level</span>
			</div>
		</div>

		<div class="bg-black/20 flex gap-4 items-center p-4 rounded-xl text-green-400">
			<Target size={24} />
			<div class="flex flex-col">
				<span class="font-bold text-xl">{milestoneCount}</span>
				<span class="text-gray-500 text-xs">Milestones</span>
			</div>
		</div>

		<div class="bg-black/20 flex gap-4 items-center p-4 rounded-xl text-cyan-400">
			<Sparkles size={24} />
			<div class="flex flex-col">
				<span class="font-bold text-xl">{result.snapshots.at(-1)?.skills ?? 0}</span>
				<span class="text-gray-500 text-xs">Skills</span>
			</div>
		</div>

		<div class="bg-black/20 flex gap-4 items-center p-4 rounded-xl text-purple-400">
			<Award size={24} />
			<div class="flex flex-col">
				<span class="font-bold text-xl">{result.snapshots.at(-1)?.achievements ?? 0}</span>
				<span class="text-gray-500 text-xs">Achievements</span>
			</div>
		</div>
	</div>

	<!-- Secondary stats row -->
	<div class="gap-3 grid grid-cols-2 mt-4 md:grid-cols-6 text-sm">
		<div class="bg-black/10 flex gap-2 items-center justify-between p-3 rounded-lg">
			<span class="text-gray-500">Protonises</span>
			<span class="font-mono text-amber-400">{result.snapshots.at(-1)?.protonises ?? 0}</span>
		</div>
		<div class="bg-black/10 flex gap-2 items-center justify-between p-3 rounded-lg">
			<span class="text-gray-500">Electronizes</span>
			<span class="font-mono text-blue-400">{result.snapshots.at(-1)?.electronizes ?? 0}</span>
		</div>
		<div class="bg-black/10 flex gap-2 items-center justify-between p-3 rounded-lg">
			<span class="text-gray-500">Photon Lvls</span>
			<span class="font-mono text-yellow-400">{result.snapshots.at(-1)?.photonUpgradeLevels ?? 0}</span>
		</div>
		<div class="bg-black/10 flex gap-2 items-center justify-between p-3 rounded-lg">
			<span class="text-gray-500 flex gap-1 items-center"><Layers size={14} /> Boosts</span>
			<span class="font-mono text-purple-400">{result.snapshots.at(-1)?.skillPointsUsed ?? 0}</span>
		</div>
		<div class="bg-black/10 flex gap-2 items-center justify-between p-3 rounded-lg">
			<span class="text-gray-500">Total XP</span>
			<span class="font-mono text-orange-400">{formatNumber(result.snapshots.at(-1)?.totalXP ?? 0)}</span>
		</div>
		<div class="bg-black/10 flex gap-2 items-center justify-between p-3 rounded-lg">
			<span class="text-gray-500">Buildings</span>
			<span class="font-mono text-green-400">{formatNumber(result.snapshots.at(-1)?.totalBuildings ?? 0)}</span>
		</div>
	</div>

	<div class="bg-black/30 h-px my-6 w-full"></div>

	<!-- Runtime action-rate spikes -->
	{#if spikes.length > 0}
		<div class="flex flex-col gap-2 mb-6">
			<div class="flex gap-2 items-center mb-2 text-amber-400 text-xs uppercase tracking-wider">
				<span>Action Rate Spikes ({spikes.length})</span>
			</div>
			{#each spikes as spike, i (spike.timestamp)}
				<SpikeBreakdown index={i} {spike} />
			{/each}
		</div>
	{/if}

	<!-- Milestones List -->
	<div class="gap-8 grid grid-cols-1 md:grid-cols-2">
		<div class="flex flex-col gap-2">
			<div class="flex gap-4">
				<span class="text-gray-500 text-sm">
					<span class="text-green-400">{milestoneCount}</span> reached
				</span>
				<span class="text-gray-500 text-sm">
					<span class="text-red-400">{MILESTONES.length - milestoneCount}</span> remaining
				</span>
			</div>
		</div>

		<div class="flex flex-col gap-6">
			<!-- Reached Milestones -->
			<div class="flex flex-col gap-2">
				<h3 class="font-medium mb-1 text-gray-400 text-xs uppercase tracking-wider">Reached</h3>
				{#if result.milestones.length > 0}
					<div class="flex flex-col gap-2 max-h-72 overflow-y-auto pr-2">
						{#each result.milestones as hit (hit.milestone.id)}
							<div
								class="bg-black/20 border-green-500/50 border-l-[3px] gap-4 grid grid-cols-[1fr_auto] px-4 py-2 rounded-lg text-sm"
							>
								<span class="font-medium">{hit.milestone.name}</span>
								<span class="font-mono text-cyan-400 text-xs">{formatSimTimePrecise(hit.timeReached)}</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="py-4 text-center text-gray-500 text-sm italic">No milestones reached yet</p>
				{/if}
			</div>

			<!-- Unreached Milestones (Collapsible) -->
			{#if MILESTONES.length - milestoneCount > 0}
				<div class="flex flex-col gap-2">
					<button
						class="flex gap-2 hover:text-white items-center text-gray-400 text-xs transition-colors uppercase"
						onclick={() => (showRemainingMilestones = !showRemainingMilestones)}
					>
						{#if showRemainingMilestones}
							<ChevronUp size={14} />
						{:else}
							<ChevronDown size={14} />
						{/if}
						Remaining Milestones ({MILESTONES.length - milestoneCount})
					</button>

					{#if showRemainingMilestones}
						<div class="flex flex-col gap-2 mt-2 pr-2">
							{#each remainingMilestones as m (m.id)}
								<div
									class="bg-black/10 border-gray-700 border-l-[3px] flex items-center justify-between px-4 py-2 rounded-lg text-sm"
								>
									<span class="text-gray-400">{m.name}</span>
									<span class="text-gray-600 text-xs italic">{m.description}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</section>
