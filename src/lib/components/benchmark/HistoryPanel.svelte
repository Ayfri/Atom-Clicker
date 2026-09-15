<script lang="ts">
	import type { BenchmarkConfig } from '$lib/simulation/types';
	import { formatNumber } from '$lib/utils';
	import {
		clearAllReports,
		deleteReport,
		listReports,
		renameReport,
		type BenchmarkReportSummary,
	} from '$lib/stores/benchmarkHistory.svelte';
	import { Check, Eye, GitCompare, History, Pencil, Search, SlidersHorizontal, Trash2, X } from '@lucide/svelte';

	interface Props {
		comparisonId: string | null;
		loadedId: string | null;
		onApplyConfig: (config: BenchmarkConfig) => void;
		onClose: () => void;
		onCompare: (id: string | null) => void;
		onLoad: (id: string) => void | Promise<void>;
	}

	let { comparisonId, loadedId = null, onApplyConfig, onClose, onCompare, onLoad }: Props = $props();

	const SORT_OPTIONS = [
		{ id: 'date', label: 'Recent' },
		{ id: 'aps', label: 'APS' },
		{ id: 'milestones', label: 'Milestones' },
	] as const;

	type SortId = (typeof SORT_OPTIONS)[number]['id'];

	let reports = $state<BenchmarkReportSummary[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let sortBy = $state<SortId>('date');
	let editingId = $state<string | null>(null);
	let editingName = $state('');
	let deletingId = $state<string | null>(null);
	let clearConfirm = $state(false);

	$effect(() => {
		loadReports();
	});

	async function loadReports() {
		loading = true;
		try {
			reports = await listReports();
		} catch (e) {
			console.error('Failed to load reports:', e);
		}
		loading = false;
	}

	const filteredReports = $derived.by(() => {
		let list = reports;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(r => r.name.toLowerCase().includes(q));
		}
		if (sortBy === 'aps') return [...list].sort((a, b) => b.finalAPS - a.finalAPS);
		if (sortBy === 'milestones') return [...list].sort((a, b) => b.milestoneCount - a.milestoneCount);
		return list; // 'date' already newest-first from listReports
	});

	async function handleDelete(id: string) {
		if (deletingId !== id) {
			deletingId = id;
			return;
		}
		try {
			await deleteReport(id);
			if (comparisonId === id) onCompare(null);
			deletingId = null;
			await loadReports();
		} catch (e) {
			console.error('Failed to delete report:', e);
		}
	}

	async function handleClearAll() {
		if (!clearConfirm) {
			clearConfirm = true;
			return;
		}
		try {
			await clearAllReports();
			if (comparisonId) onCompare(null);
			clearConfirm = false;
			await loadReports();
		} catch (e) {
			console.error('Failed to clear all reports:', e);
		}
	}

	function startEdit(report: BenchmarkReportSummary) {
		editingId = report.id;
		editingName = report.name;
		deletingId = null;
	}

	async function commitEdit() {
		if (!editingId || !editingName.trim()) {
			editingId = null;
			return;
		}
		try {
			await renameReport(editingId, editingName.trim());
			await loadReports();
		} catch (e) {
			console.error('Failed to rename:', e);
		}
		editingId = null;
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitEdit();
		else if (e.key === 'Escape') editingId = null;
	}

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function formatRelativeTime(ts: number): string {
		const diff = ts - Date.now();
		const abs = Math.abs(diff);
		const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
		if (abs < 60_000) return rtf.format(Math.round(diff / 1000), 'second');
		if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
		if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
		return rtf.format(Math.round(diff / 86_400_000), 'day');
	}

	function formatAbsoluteDate(ts: number): string {
		return new Date(ts).toLocaleString('en-US', {
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			month: 'short',
			year: 'numeric',
		});
	}
</script>

<div class="backdrop-blur-xl bg-slate-900/95 border border-white/10 flex flex-col h-full overflow-hidden rounded-2xl">
	<!-- Header -->
	<div class="border-b border-white/10 flex items-center justify-between px-4 py-3 shrink-0">
		<div class="flex gap-2.5 items-center">
			<History
				class="text-gray-400"
				size={18}
			/>
			<h2 class="font-semibold text-gray-200">Saved Runs</h2>
			{#if reports.length > 0}
				<span class="bg-white/10 font-mono px-1.5 py-0.5 rounded text-gray-400 text-[10px]">{reports.length}</span>
			{/if}
		</div>
		<button
			onclick={() => {
				clearConfirm = false;
				onClose();
			}}
			class="cursor-pointer hover:bg-white/10 hover:text-white p-1.5 rounded-lg text-gray-500 transition-colors"
			aria-label="Close"
		>
			<X size={18} />
		</button>
	</div>

	<!-- Search + Sort -->
	{#if reports.length > 0}
		<div class="border-b border-white/5 flex flex-col gap-2 px-3 py-2.5 shrink-0">
			<div class="bg-white/5 flex gap-2 items-center px-2.5 py-1.5 rounded-lg">
				<Search
					class="shrink-0 text-gray-600"
					size={13}
				/>
				<input
					bind:value={searchQuery}
					placeholder="Search runs…"
					class="bg-transparent flex-1 min-w-0 outline-none placeholder-gray-600 text-gray-200 text-xs"
				/>
				{#if searchQuery}
					<button
						onclick={() => (searchQuery = '')}
						class="cursor-pointer shrink-0 text-gray-600 hover:text-gray-400"
						aria-label="Clear search"
					>
						<X size={12} />
					</button>
				{/if}
			</div>

			<div class="flex gap-2 items-center justify-between">
				<div class="bg-white/5 flex gap-0.5 p-0.5 rounded-lg">
					{#each SORT_OPTIONS as option (option.id)}
						<button
							onclick={() => (sortBy = option.id)}
							class="cursor-pointer px-2 py-1 rounded-md text-[11px] transition-colors {sortBy === option.id
								? 'bg-white/10 text-gray-100'
								: 'text-gray-500 hover:text-gray-300'}"
						>
							{option.label}
						</button>
					{/each}
				</div>

				<button
					onclick={handleClearAll}
					class="cursor-pointer px-2 py-1 rounded-md text-[11px] transition-colors {clearConfirm
						? 'bg-red-500/20 text-red-400'
						: 'hover:bg-white/10 text-gray-600 hover:text-gray-300'}"
				>
					{clearConfirm ? 'Delete everything?' : 'Delete all'}
				</button>
			</div>
		</div>
	{/if}

	<!-- List -->
	<div class="flex-1 overflow-y-auto px-3 py-3">
		{#if loading}
			<div class="flex flex-col gap-2 pt-2">
				{#each Array(3) as _}
					<div class="animate-pulse bg-white/5 h-28 rounded-xl"></div>
				{/each}
			</div>
		{:else if reports.length === 0}
			<div class="flex flex-col gap-2 items-center justify-center py-16 text-center text-gray-600">
				<History
					class="opacity-20"
					size={40}
				/>
				<p class="text-sm">No saved benchmarks yet.</p>
				<p class="text-xs">Every finished run is saved here automatically.</p>
			</div>
		{:else if filteredReports.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-center text-gray-600">
				<p class="text-sm">No runs match "<span class="text-gray-400">{searchQuery}</span>"</p>
			</div>
		{:else}
			<div class="flex flex-col gap-2">
				{#each filteredReports as report (report.id)}
					{@const isLoaded = loadedId === report.id}
					{@const isCompared = comparisonId === report.id}
					{@const isDeleting = deletingId === report.id}
					{@const isEditing = editingId === report.id}
					<div
						class="border flex flex-col gap-3 group/card p-3 rounded-xl transition-colors {isLoaded
							? 'bg-amber-500/8 border-amber-500/40'
							: isCompared
								? 'bg-cyan-500/8 border-cyan-500/40'
								: 'bg-white/4 border-white/8 hover:border-white/15'}"
					>
						<!-- Name + meta -->
						<div class="flex flex-col gap-1 min-w-0">
							{#if isEditing}
								<div class="flex gap-1.5 items-center">
									<input
										bind:value={editingName}
										onkeydown={onEditKeydown}
										onblur={commitEdit}
										use:focusOnMount
										class="bg-white/10 border border-white/20 flex-1 min-w-0 outline-none px-2 py-0.5 rounded text-gray-100 text-sm"
									/>
									<button
										onclick={commitEdit}
										class="cursor-pointer shrink-0 text-green-400 hover:text-green-300"
										aria-label="Save name"
									>
										<Check size={14} />
									</button>
								</div>
							{:else}
								<div class="flex gap-1.5 items-center min-w-0">
									<span
										class="leading-snug min-w-0 text-gray-200 text-sm truncate"
										title={report.name}>{report.name}</span
									>
									<button
										onclick={() => startEdit(report)}
										class="cursor-pointer group-hover/card:opacity-100 opacity-0 shrink-0 text-gray-600 hover:text-gray-300 transition-opacity"
										aria-label="Rename run"
									>
										<Pencil size={11} />
									</button>
								</div>
							{/if}

							<div class="flex flex-wrap gap-x-2 gap-y-1 items-center text-[10px] text-gray-600">
								<span title={formatAbsoluteDate(report.createdAt)}>{formatRelativeTime(report.createdAt)}</span>
								<span>·</span>
								<span>{report.config.targetHours}h simulated</span>
								{#if !report.wasCompleted}
									<span class="bg-amber-500/20 font-medium px-1.5 py-px rounded text-amber-400">Cancelled</span>
								{/if}
								{#if isLoaded}
									<span class="bg-amber-500/20 font-medium px-1.5 py-px rounded text-amber-400">Viewing</span>
								{/if}
								{#if isCompared}
									<span class="bg-cyan-500/20 font-medium px-1.5 py-px rounded text-cyan-400">Overlaid on charts</span>
								{/if}
							</div>
						</div>

						<!-- Result summary -->
						<div class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
							<span class="text-pink-400">{formatNumber(report.finalAPS)}/s</span>
							<span class="text-green-400">{formatNumber(report.finalAtoms)} atoms</span>
							<span class="text-amber-400">Lv.{report.finalLevel}</span>
							<span class="text-cyan-400">{report.milestoneCount} milestones</span>
						</div>

						<!-- Actions -->
						<div class="flex gap-1.5 items-center">
							<button
								onclick={() => onLoad(report.id)}
								class="border cursor-pointer flex gap-1.5 items-center justify-center px-2 py-1.5 rounded-lg text-[11px] transition-colors {isLoaded
									? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
									: 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}"
							>
								<Eye size={12} />
								{isLoaded ? 'Viewing' : 'Open'}
							</button>
							<button
								onclick={() => onCompare(isCompared ? null : report.id)}
								class="border cursor-pointer flex gap-1.5 items-center justify-center px-2 py-1.5 rounded-lg text-[11px] transition-colors {isCompared
									? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
									: 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}"
							>
								<GitCompare size={12} />
								{isCompared ? 'Stop comparing' : 'Compare'}
							</button>
							<button
								onclick={() => onApplyConfig(report.config)}
								class="bg-white/5 border border-white/10 cursor-pointer flex gap-1.5 hover:bg-white/10 items-center justify-center px-2 py-1.5 rounded-lg text-[11px] text-gray-300 transition-colors"
								title="Copy this run's settings into the config panel"
							>
								<SlidersHorizontal size={12} />
								Reuse config
							</button>

							{#if isDeleting}
								<button
									onclick={() => handleDelete(report.id)}
									class="bg-red-500/25 cursor-pointer font-medium hover:bg-red-500/40 ml-auto px-2 py-1.5 rounded-lg text-[11px] text-red-300 transition-colors"
								>
									Delete?
								</button>
								<button
									onclick={() => (deletingId = null)}
									class="cursor-pointer hover:bg-white/10 p-1.5 rounded-lg text-gray-500 transition-colors"
									aria-label="Cancel delete"
								>
									<X size={12} />
								</button>
							{:else}
								<button
									onclick={() => handleDelete(report.id)}
									class="cursor-pointer hover:bg-red-500/20 hover:text-red-400 ml-auto p-1.5 rounded-lg text-gray-600 transition-colors"
									aria-label="Delete run"
								>
									<Trash2 size={14} />
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
