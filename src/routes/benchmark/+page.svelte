<script lang="ts">
	import { tick } from 'svelte';
	import {
		buildBenchmarkConfig,
		configToPresets,
		PLAYSTYLE_PRESETS,
		type ActivityPresetId,
		type PlaystylePresetId,
		type PrestigePresetId,
	} from '$lib/simulation/presets';
	import type {
		BenchmarkConfig,
		MilestoneHit,
		QuestBehavior,
		SimulationResult,
		SimulationSnapshot,
		SpikeEvent,
	} from '$lib/simulation/types';
	import { type SimulationProgress } from '$lib/simulation/engine';
	import { ChartLine, GitCompare, History, Save } from '@lucide/svelte';

	import BenchmarkConfigPanel from '$lib/components/benchmark/BenchmarkConfigPanel.svelte';
	import BenchmarkTimeline from '$lib/components/benchmark/BenchmarkTimeline.svelte';
	import BenchmarkResults from '$lib/components/benchmark/BenchmarkResults.svelte';
	import BenchmarkCharts from '$lib/components/benchmark/BenchmarkCharts.svelte';
	import BenchmarkExport from '$lib/components/benchmark/BenchmarkExport.svelte';
	import HistoryPanel from '$lib/components/benchmark/HistoryPanel.svelte';

	import { getReport, saveReport, type BenchmarkReport } from '$lib/stores/benchmarkHistory.svelte';
	import SimulationWorker from '$lib/simulation/simulation.worker?worker';

	let worker = $state<Worker | null>(null);
	let isRunning = $state(false);
	let liveMilestones = $state<MilestoneHit[]>([]);
	let liveSpikes = $state<SpikeEvent[]>([]);
	// The worker streams snapshots incrementally, so the running view accumulates them here.
	let liveSnapshots = $state<SimulationSnapshot[]>([]);
	let progress = $state<SimulationProgress | null>(null);
	let result = $state<SimulationResult | null>(null);
	let loadedReport = $state<BenchmarkReport | null>(null);
	let activityId = $state<ActivityPresetId>('always');
	let playstyleId = $state<PlaystylePresetId>('balanced');
	let prestigeId = $state<PrestigePresetId>('balanced');
	let questBehavior = $state<QuestBehavior>(PLAYSTYLE_PRESETS.balanced.questBehavior);
	// Daily quests roll once per in-game day and the layers past protons need several of them, so a meaningful run is measured in days.
	let targetHours = $state(72);
	let snapshotInterval = $state<number>(PLAYSTYLE_PRESETS.balanced.snapshotInterval);

	$effect(() => {
		snapshotInterval = PLAYSTYLE_PRESETS[playstyleId].snapshotInterval;
	});
	let elapsedTime = $state(0);
	let startTime = 0;
	let showHistoryPanel = $state(false);
	let comparisonReportId = $state<string | null>(null);
	let comparisonReport = $state<BenchmarkReport | null>(null);
	let lastSavedId = $state<string | null>(null);

	function reportToDisplayResult(report: BenchmarkReport): SimulationResult & { milestoneCount: number } {
		const milestones = report.milestones ?? [];
		return {
			cancelled: !report.wasCompleted,
			config: report.config,
			durationMs: report.durationMs,
			milestoneCount: milestones.length || report.milestoneCount,
			milestones,
			snapshots: report.snapshots,
			spikes: report.spikes ?? [],
		};
	}

	const displayResult = $derived.by(() => {
		if (loadedReport) return reportToDisplayResult(loadedReport);
		if (result) return { ...result, milestoneCount: result.milestones.length };
		return null;
	});

	$effect(() => {
		let interval: ReturnType<typeof setInterval> | undefined;
		if (isRunning) {
			startTime = Date.now();
			elapsedTime = 0;
			interval = setInterval(() => {
				elapsedTime = Date.now() - startTime;
			}, 100);
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	});

	$effect(() => {
		if (comparisonReportId) {
			getReport(comparisonReportId).then(report => {
				comparisonReport = report;
			});
		} else {
			comparisonReport = null;
		}
	});

	$effect(() => {
		if (result && !lastSavedId) {
			saveReport(result)
				.then(id => {
					lastSavedId = id;
				})
				.catch(err => {
					console.error('Failed to auto-save benchmark:', err);
				});
		}
	});

	async function handleManualSave() {
		if (result && !lastSavedId) {
			try {
				const id = await saveReport(result);
				lastSavedId = id;
			} catch (err) {
				console.error('Failed to save benchmark manually:', err);
				alert('Failed to save benchmark');
			}
		}
	}

	const currentConfig = $derived<BenchmarkConfig>(
		buildBenchmarkConfig(activityId, playstyleId, prestigeId, targetHours, snapshotInterval, questBehavior),
	);

	const currentSnapshots = $derived(
		loadedReport?.snapshots ?? result?.snapshots ?? liveSnapshots,
	);
	const simulationDurationHours = $derived.by(() => {
		const snapshots = loadedReport?.snapshots ?? result?.snapshots;
		if (snapshots && snapshots.length > 0) {
			return snapshots[snapshots.length - 1].timestamp / 3600000;
		}
		if (isRunning && progress) {
			return progress.currentHour;
		}
		return 0.1;
	});
	const displaySnapshotInterval = $derived(
		loadedReport?.config.snapshotInterval ??
			result?.config.snapshotInterval ??
			currentConfig.snapshotInterval,
	);

	const comparisonSnapshots = $derived(comparisonReport?.snapshots ?? []);
	const hasComparison = $derived(comparisonSnapshots.length > 0);

	async function runSimulation() {
		isRunning = true;
		progress = null;
		result = null;
		loadedReport = null;
		liveMilestones = [];
		liveSnapshots = [];
		liveSpikes = [];
		lastSavedId = null;
		await tick();

		try {
			worker = new SimulationWorker();

			worker.onmessage = e => {
				const { type, payload } = e.data;
				if (type === 'progress') {
					progress = payload;
					if (payload.newSnapshots.length > 0) {
						liveSnapshots = [...liveSnapshots, ...payload.newSnapshots];
					}
					if (payload.recentMilestones.length > 0) {
						liveMilestones = [...liveMilestones, ...payload.recentMilestones];
					}
					if (payload.recentSpikes.length > 0) {
						liveSpikes = [...liveSpikes, ...payload.recentSpikes];
					}
				} else if (type === 'result') {
					result = payload;
					terminateWorker();
				} else if (type === 'error') {
					console.error('Simulation Worker Error:', payload);
					terminateWorker();
				}
			};

			worker.onerror = err => {
				console.error('Worker infrastructure error:', err);
				terminateWorker();
			};

			// Plain object for postMessage; $state.snapshot strips proxies so worker receives cloneable config.
			const configSnapshot = $state.snapshot(currentConfig);
			worker.postMessage({
				type: 'start',
				config: configSnapshot,
				initialState: null,
			});
		} catch (e) {
			console.error('Simulation failed to start:', e);
			terminateWorker();
		}
	}

	function terminateWorker() {
		worker?.terminate();
		worker = null;
		isRunning = false;
	}

	function stopSimulation() {
		if (!worker) return;
		const durationMs = Date.now() - startTime;
		result = {
			cancelled: true,
			config: currentConfig,
			durationMs,
			milestones: liveMilestones,
			snapshots: liveSnapshots,
			spikes: liveSpikes,
		};
		terminateWorker();
	}
</script>

<svelte:head>
	<title>Benchmark | Atom Clicker</title>
</svelte:head>

<div class="bg-linear-to-br from-gray-950 min-h-screen p-8 slate-900 text-gray-200 via-gray-900">
	<!-- Header Section -->
	<header class="mb-12">
		<div class="flex items-center justify-between max-w-7xl mx-auto">
			<div class="flex flex-col gap-2">
				<h1
					class="bg-clip-text bg-linear-to-r flex font-bold from-green-400 gap-4 items-center text-4xl text-transparent to-cyan-400"
				>
					<ChartLine
						class="text-green-400"
						size={32}
					/>
					Game Balance Benchmark
				</h1>
				<p class="text-gray-500">Headless simulation to test game progression speed</p>
			</div>

			<div class="flex gap-3 items-center">
				{#if hasComparison}
					<div
						class="bg-cyan-500/10 border border-cyan-500/30 flex gap-2 items-center px-3 py-2 rounded-lg text-cyan-400 text-sm"
					>
						<GitCompare size={16} />
						<span>Comparing with: {comparisonReport?.name?.slice(0, 24) ?? '...'}...</span>
						<button
							onclick={() => {
								comparisonReportId = null;
							}}
							class="cursor-pointer hover:bg-cyan-500/20 ml-1 p-1 rounded text-xs">✕</button
						>
					</div>
				{/if}

				{#if result && !lastSavedId && !loadedReport}
					<button
						onclick={handleManualSave}
						class="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 flex gap-1.5 items-center px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
					>
						<Save size={14} />
						<span>Save Result</span>
					</button>
				{:else if lastSavedId}
					<div class="flex gap-1.5 items-center text-green-400 text-xs px-3 py-2 border border-transparent">
						<Save size={14} />
						<span>Saved</span>
					</div>
				{/if}

				<button
					onclick={() => {
						showHistoryPanel = !showHistoryPanel;
					}}
					class="cursor-pointer flex gap-2 hover:bg-white/10 items-center px-4 py-2 rounded-xl text-gray-400 transition-colors {(
						showHistoryPanel
					) ?
						'bg-white/10 text-white'
					:	''}"
				>
					<History size={18} />
					<span class="hidden md:inline">History</span>
				</button>
			</div>
		</div>
	</header>

	<div class="flex gap-6 max-w-7xl mx-auto relative">
		<!-- Main Content -->
		<main class="flex flex-col flex-1 gap-8 {showHistoryPanel ? 'mr-96' : ''}">
			<BenchmarkConfigPanel
				bind:activityId
				bind:playstyleId
				bind:prestigeId
				bind:questBehavior
				bind:snapshotInterval
				bind:targetHours
				{isRunning}
				{runSimulation}
				{stopSimulation}
			/>

			{#if loadedReport}
				<div
					class="bg-amber-500/10 border border-amber-500/30 flex gap-2 items-center justify-between px-4 py-2 rounded-lg text-amber-400 text-sm"
				>
					<span>Viewing saved run: <strong>{loadedReport.name}</strong></span>
					<button
						class="cursor-pointer hover:bg-amber-500/20 px-2 py-1 rounded text-xs transition-colors"
						onclick={() => (loadedReport = null)}
					>
						Close
					</button>
				</div>
			{/if}

			{#if displayResult}
				<BenchmarkResults result={displayResult} />
			{/if}

			{#if isRunning || (result && !loadedReport)}
				<BenchmarkTimeline
					{isRunning}
					{elapsedTime}
					{progress}
					milestones={result?.milestones ?? liveMilestones}
					{targetHours}
				/>
			{/if}

			{#if isRunning || displayResult || hasComparison}
				<BenchmarkCharts
					{currentSnapshots}
					{comparisonSnapshots}
					{hasComparison}
					comparisonName={comparisonReport?.name}
					{simulationDurationHours}
					snapshotInterval={displaySnapshotInterval}
				/>
			{/if}

			{#if displayResult}
				<BenchmarkExport result={displayResult} />
			{/if}
		</main>

		<!-- History Panel Sidebar -->
		{#if showHistoryPanel}
			<aside class="fixed h-[calc(100vh-8rem)] right-8 top-28 w-96 z-20">
				<HistoryPanel
					comparisonId={comparisonReportId}
					loadedId={loadedReport?.id ?? null}
					onApplyConfig={config => {
						const { activityId: a, playstyleId: p, prestigeId: pr, questBehavior: q, targetHours: t } = configToPresets(config);
						activityId = a;
						playstyleId = p;
						prestigeId = pr;
						questBehavior = q;
						targetHours = t;
						snapshotInterval = config.snapshotInterval;
					}}
					onClose={() => {
						showHistoryPanel = false;
					}}
					onCompare={id => {
						comparisonReportId = id;
					}}
					onLoad={async id => {
						const report = await getReport(id);
						if (report) loadedReport = report;
					}}
				/>
			</aside>
		{/if}
	</div>
</div>
