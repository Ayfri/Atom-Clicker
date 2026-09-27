<script lang="ts">
	import { RotateCcw, Target } from '@lucide/svelte';
	import { formatDuration, formatNumber, formatSimTimePrecise } from '$lib/utils';
	import type { MilestoneHit, SimulationProgress } from '$lib/simulation/types';

	interface Props {
		elapsedTime: number;
		isRunning: boolean;
		milestones: MilestoneHit[];
		progress: SimulationProgress | null;
		targetHours: number;
	}

	let { elapsedTime, isRunning, milestones, progress, targetHours }: Props = $props();

	/** Milestones within 3% of the run share a marker, measured from the group's first item so chains cannot stretch forever. */
	const groupedMilestones = $derived.by(() => {
		const totalMs = targetHours * 3600 * 1000;
		const sorted = [...milestones].sort((a, b) => a.timeReached - b.timeReached);
		const threshold = totalMs * 0.03;

		const groups: { items: MilestoneHit[]; position: number }[] = [];

		for (const m of sorted) {
			const last = groups[groups.length - 1];
			if (last && m.timeReached - last.items[0].timeReached < threshold) {
				last.items.push(m);
				const avg = last.items.reduce((s, x) => s + x.timeReached, 0) / last.items.length;
				last.position = (avg / totalMs) * 100;
			} else {
				groups.push({ items: [m], position: (m.timeReached / totalMs) * 100 });
			}
		}

		return groups;
	});

	let hoveredIdx = $state<number | null>(null);
</script>

<section class="backdrop-blur-xl bg-white/5 border border-white/10 p-4 rounded-2xl">
	<div class="flex gap-3 items-center mb-4 text-gray-400">
		{#if isRunning}
			<RotateCcw
				class="animate-spin text-cyan-400"
				size={20}
			/>
			<div class="flex flex-col">
				<h2 class="font-semibold text-gray-200 text-xl tracking-tight">Simulating...</h2>
				<span class="font-mono text-cyan-400/80 text-xs">{formatDuration(elapsedTime)} elapsed</span>
			</div>
		{:else}
			<Target
				class="text-green-400"
				size={20}
			/>
			<h2 class="font-semibold text-gray-200 text-xl">Progress Timeline</h2>
		{/if}
	</div>

	<div class="mb-16 mt-8 relative">
		<div class="bg-black/30 h-6 overflow-visible relative rounded">
			<div
				class="bg-linear-to-r cyan-400 duration-100 from-green-400 h-full rounded to-cyan-400 transition-all"
				style="width: {isRunning ? (progress?.percent ?? 0) : 100}%"
			></div>

			{#each groupedMilestones as group, idx (group.items[0].milestone.id)}
				{@const isCluster = group.items.length > 1}
				{@const tooltipVisible = hoveredIdx === idx}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="-translate-x-1/2 absolute top-0 z-10 cursor-default"
					style="left: {group.position}%"
					onmouseenter={() => (hoveredIdx = idx)}
					onmouseleave={() => (hoveredIdx = null)}
				>
					<div
						class="h-6 w-0.5 {isCluster
							? 'bg-orange-400 shadow-[0_0_8px] shadow-orange-400/50'
							: 'bg-amber-400 shadow-[0_0_8px] shadow-amber-400/50'}"
					></div>

					{#if isCluster}
						<div
							class="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-full leading-none"
						>
							{group.items.length}
						</div>
					{/if}

					<div
						class="-translate-x-1/2 absolute font-semibold left-1/2 pointer-events-none text-[8.5px] whitespace-nowrap {isCluster
							? 'text-orange-400 opacity-80'
							: 'text-amber-400 opacity-90'}"
						style="bottom: calc(100% + 10px)"
					>
						{#if isCluster}
							{group.items.length} events
						{:else}
							{group.items[0].milestone.name}
						{/if}
					</div>

					{#if tooltipVisible}
						<div
							class="absolute z-50 bg-gray-900 border border-white/15 rounded-xl shadow-2xl p-3 pointer-events-none"
							style="min-width: 13rem; max-width: 18rem; bottom: calc(100% + 22px); left: 50%; transform: translateX(-50%)"
						>
							{#if isCluster}
								<p class="text-[10px] text-gray-400 mb-2 font-semibold">
									{group.items.length} milestones ~{formatSimTimePrecise(group.items[0].timeReached)}
								</p>
								<ol class="flex flex-col gap-1">
									{#each group.items as item, i (item.milestone.id)}
										<li class="flex gap-2 items-baseline text-[10px]">
											<span class="text-gray-600 font-mono shrink-0">{i + 1}.</span>
											<span class="text-gray-200 flex-1">{item.milestone.name}</span>
											<span class="text-gray-500 font-mono shrink-0 ml-2"
												>{formatSimTimePrecise(item.timeReached)}</span
											>
										</li>
									{/each}
								</ol>
							{:else}
								<p class="text-[10px] text-gray-200 font-semibold mb-0.5">
									{group.items[0].milestone.name}
								</p>
								<p class="text-[10px] text-gray-500 font-mono">
									{formatSimTimePrecise(group.items[0].timeReached)}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	{#if isRunning && progress}
		<div class="gap-4 grid grid-cols-2 md:grid-cols-5">
			<div class="flex flex-col items-center text-center">
				<span class="text-gray-500 text-xs">Progress</span>
				<span class="font-mono font-semibold text-cyan-400 text-lg">{progress.percent.toFixed(1)}%</span>
			</div>
			<div class="flex flex-col items-center text-center">
				<span class="text-gray-500 text-xs">Hour</span>
				<span class="font-mono font-semibold text-cyan-400 text-lg"
					>{progress.currentHour.toFixed(2)} / {progress.totalHours}</span
				>
			</div>
			<div class="flex flex-col items-center text-center">
				<span class="text-gray-500 text-xs">Speed</span>
				<span class="font-mono font-semibold text-cyan-400 text-lg"
					>{formatNumber(progress.ticksPerSecond, 0)} ticks/s</span
				>
			</div>
			<div class="flex flex-col items-center text-center">
				<span class="text-gray-500 text-xs">ETA</span>
				<span class="font-mono font-semibold text-cyan-400 text-lg"
					>{formatDuration(progress.estimatedTimeLeft)}</span
				>
			</div>
			<div class="flex flex-col items-center text-center">
				<span class="text-gray-500 text-xs">Milestones</span>
				<span class="font-mono font-semibold text-cyan-400 text-lg">{milestones.length}</span>
			</div>
		</div>
	{/if}
</section>
