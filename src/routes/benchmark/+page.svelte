<script lang="ts">
	import BenchmarkCharts from '$lib/components/benchmark/BenchmarkCharts.svelte';
	import BenchmarkConfigPanel from '$lib/components/benchmark/BenchmarkConfigPanel.svelte';
	import BenchmarkExport from '$lib/components/benchmark/BenchmarkExport.svelte';
	import BenchmarkResults from '$lib/components/benchmark/BenchmarkResults.svelte';
	import BenchmarkTimeline from '$lib/components/benchmark/BenchmarkTimeline.svelte';
	import HistoryPanel from '$lib/components/benchmark/HistoryPanel.svelte';
	import { buildBenchmarkConfig, configToPresets, profileForm, type BenchmarkForm } from '$lib/simulation/presets';
	import SimulationWorker from '$lib/simulation/simulation.worker?worker';
	import type { MilestoneHit, SimulationProgress, SimulationResult, SimulationSnapshot, SpikeEvent } from '$lib/simulation/types';
	import { getReport, saveReport, type BenchmarkReport } from '$lib/stores/benchmarkHistory.svelte';
	import { ChartLine, GitCompare, History, Save, X } from '@lucide/svelte';

	interface LiveRun {
		milestones: MilestoneHit[];
		snapshots: SimulationSnapshot[];
		spikes: SpikeEvent[];
	}

	type WorkerMessage =
		| { payload: SimulationProgress; type: 'progress' }
		| { payload: SimulationResult; type: 'result' }
		| { payload: string; type: 'error' };

	/** Daily quests roll once per in-game day and the layers past protons need several of them, so a meaningful run is measured in days. */
	let form = $state<BenchmarkForm>(profileForm('balanced', 72));
	const config = $derived(buildBenchmarkConfig(form));

	let comparisonReport = $state.raw<BenchmarkReport | null>(null);
	let elapsedTime = $state(0);
	let elapsedTimer: ReturnType<typeof setInterval> | undefined;
	let live = $state.raw<LiveRun>({ milestones: [], snapshots: [], spikes: [] });
	let loadedReport = $state.raw<BenchmarkReport | null>(null);
	let progress = $state.raw<SimulationProgress | null>(null);
	let result = $state.raw<SimulationResult | null>(null);
	let saveState = $state<'failed' | 'saved' | 'saving' | null>(null);
	let showHistoryPanel = $state(false);
	let startTime = 0;
	let worker = $state.raw<Worker | null>(null);

	const isRunning = $derived(worker !== null);
	const shown = $derived<SimulationResult | null>(
		loadedReport ?
			{
				cancelled: !loadedReport.wasCompleted,
				config: loadedReport.config,
				durationMs: loadedReport.durationMs,
				milestones: loadedReport.milestones ?? [],
				snapshots: loadedReport.snapshots,
				spikes: loadedReport.spikes ?? [],
			}
		:	result,
	);
	const snapshots = $derived(shown?.snapshots ?? live.snapshots);
	const shownHours = $derived(Math.max(0.1, (snapshots.at(-1)?.timestamp ?? 0) / 3_600_000));

	async function save(run: SimulationResult) {
		saveState = 'saving';
		try {
			await saveReport(run);
			saveState = 'saved';
		} catch (error) {
			console.error('Failed to save benchmark:', error);
			saveState = 'failed';
		}
	}

	function finish(run: SimulationResult) {
		worker?.terminate();
		worker = null;
		clearInterval(elapsedTimer);
		elapsedTimer = undefined;
		result = run;
		save(run);
	}

	function runSimulation() {
		live = { milestones: [], snapshots: [], spikes: [] };
		loadedReport = null;
		progress = null;
		result = null;
		saveState = null;
		startTime = Date.now();
		elapsedTime = 0;
		elapsedTimer = setInterval(() => (elapsedTime = Date.now() - startTime), 100);

		const runWorker = new SimulationWorker();
		runWorker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
			if (data.type === 'progress') {
				const update = data.payload;
				progress = update;
				live = {
					milestones: update.newMilestones.length > 0 ? [...live.milestones, ...update.newMilestones] : live.milestones,
					snapshots: update.newSnapshots.length > 0 ? [...live.snapshots, ...update.newSnapshots] : live.snapshots,
					spikes: update.newSpikes.length > 0 ? [...live.spikes, ...update.newSpikes] : live.spikes,
				};
			} else if (data.type === 'result') {
				finish(data.payload);
			} else {
				console.error('Simulation Worker Error:', data.payload);
				stopSimulation();
			}
		};
		runWorker.onerror = error => {
			console.error('Simulation worker crashed:', error);
			stopSimulation();
		};
		runWorker.postMessage(config);
		worker = runWorker;
	}

	/** The engine never yields, so stopping terminates the worker and keeps what it streamed so far. */
	function stopSimulation() {
		if (!worker) return;
		finish({ cancelled: true, config, durationMs: Date.now() - startTime, ...live });
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
		event.preventDefault();
		if (isRunning) stopSimulation();
		else runSimulation();
	}
</script>

<svelte:head>
	<title>Benchmark | Atom Clicker</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="bg-linear-to-br from-gray-950 min-h-screen p-8 text-gray-200 to-slate-900 via-gray-900">
	<header class="mb-10">
		<div class="flex items-center justify-between max-w-7xl mx-auto">
			<div class="flex flex-col gap-2">
				<h1 class="bg-clip-text bg-linear-to-r flex font-bold from-green-400 gap-4 items-center text-4xl text-transparent to-cyan-400">
					<ChartLine
						class="text-green-400"
						size={32}
					/>
					Game Balance Benchmark
				</h1>
				<p class="text-gray-500">Headless simulation of the real game managers on a simulated clock</p>
			</div>

			<div class="flex gap-3 items-center">
				{#if comparisonReport}
					<div class="bg-cyan-500/10 border border-cyan-500/30 flex gap-2 items-center max-w-72 px-3 py-2 rounded-lg text-cyan-400 text-sm">
						<GitCompare
							class="shrink-0"
							size={16}
						/>
						<span class="truncate">Comparing with {comparisonReport.name}</span>
						<button
							aria-label="Stop comparing"
							class="cursor-pointer hover:bg-cyan-500/20 p-1 rounded shrink-0"
							onclick={() => (comparisonReport = null)}
						>
							<X size={12} />
						</button>
					</div>
				{/if}

				{#if saveState === 'failed' && result}
					<button
						class="bg-red-500/10 border border-red-500/30 cursor-pointer flex gap-1.5 hover:bg-red-500/20 items-center px-3 py-2 rounded-lg text-red-400 text-xs transition-colors"
						onclick={() => result && save(result)}
					>
						<Save size={14} />
						Save failed, retry
					</button>
				{:else if saveState === 'saved' && !loadedReport}
					<span class="flex gap-1.5 items-center px-3 py-2 text-green-400 text-xs">
						<Save size={14} />
						Saved to history
					</span>
				{/if}

				<button
					class="cursor-pointer flex gap-2 hover:bg-white/10 items-center px-4 py-2 rounded-xl text-gray-400 transition-colors {showHistoryPanel ? 'bg-white/10 text-white' : ''}"
					onclick={() => (showHistoryPanel = !showHistoryPanel)}
				>
					<History size={18} />
					<span class="hidden md:inline">History</span>
				</button>
			</div>
		</div>
	</header>

	<div class="flex gap-6 max-w-7xl mx-auto relative">
		<main class="flex flex-1 flex-col gap-8 min-w-0 {showHistoryPanel ? 'mr-96' : ''}">
			<BenchmarkConfigPanel
				bind:form
				{config}
				{isRunning}
				onRun={runSimulation}
				onStop={stopSimulation}
			/>

			{#if loadedReport}
				<div class="bg-amber-500/10 border border-amber-500/30 flex gap-2 items-center justify-between px-4 py-2 rounded-lg text-amber-400 text-sm">
					<span>Viewing saved run: <strong>{loadedReport.name}</strong></span>
					<button
						class="cursor-pointer hover:bg-amber-500/20 px-2 py-1 rounded text-xs transition-colors"
						onclick={() => (loadedReport = null)}
					>
						Close
					</button>
				</div>
			{/if}

			{#if isRunning || shown}
				<BenchmarkTimeline
					{elapsedTime}
					{isRunning}
					milestones={shown?.milestones ?? live.milestones}
					{progress}
					targetHours={shown?.config.targetHours ?? config.targetHours}
				/>
			{/if}

			{#if shown}
				<BenchmarkResults result={shown} />
				<BenchmarkExport result={shown} />
			{/if}

			{#if isRunning || shown || comparisonReport}
				<BenchmarkCharts
					comparisonName={comparisonReport?.name}
					comparisonSnapshots={comparisonReport?.snapshots ?? []}
					currentSnapshots={snapshots}
					simulationDurationHours={shownHours}
					snapshotInterval={shown?.config.snapshotInterval ?? config.snapshotInterval}
				/>
			{/if}
		</main>

		{#if showHistoryPanel}
			<aside class="fixed h-[calc(100vh-8rem)] right-8 top-28 w-96 z-20">
				<HistoryPanel
					comparisonId={comparisonReport?.id ?? null}
					loadedId={loadedReport?.id ?? null}
					onApplyConfig={saved => (form = configToPresets(saved))}
					onClose={() => (showHistoryPanel = false)}
					onCompare={async id => {
						comparisonReport = id ? await getReport(id) : null;
					}}
					onLoad={async id => {
						loadedReport = await getReport(id);
					}}
				/>
			</aside>
		{/if}
	</div>
</div>
