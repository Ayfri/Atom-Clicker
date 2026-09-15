<script lang="ts">
	import { Check, Copy, Download, FileText } from '@lucide/svelte';
	import { buildMarkdownReport } from '$lib/simulation/markdownReport';
	import type { SimulationResult } from '$lib/simulation/types';

	let { result }: { result: SimulationResult } = $props();

	let copied = $state(false);
	let showPreview = $state(false);

	const markdown = $derived(buildMarkdownReport(result));
	const sizeKb = $derived((new Blob([markdown]).size / 1024).toFixed(1));

	async function copyMarkdown() {
		await navigator.clipboard.writeText(markdown);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function downloadMarkdown() {
		const slug = result.config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
		const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
		const link = document.createElement('a');
		link.download = `benchmark-${slug}-${result.config.targetHours}h.md`;
		link.href = url;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<section class="backdrop-blur-xl bg-white/5 border border-white/10 p-6 rounded-2xl">
	<div class="flex flex-wrap gap-3 items-center justify-between">
		<div class="flex gap-3 items-center text-gray-400">
			<FileText size={20} />
			<div class="flex flex-col">
				<h2 class="font-semibold text-gray-200 text-xl">Markdown Report</h2>
				<span class="text-gray-500 text-xs">Compressed balance summary ready to paste into a chat ({sizeKb} KB)</span>
			</div>
		</div>

		<div class="flex gap-2 items-center">
			<button
				class="bg-white/5 border border-white/10 cursor-pointer flex gap-2 hover:bg-white/10 items-center px-3 py-1.5 rounded-lg text-gray-300 text-sm transition-colors"
				onclick={() => (showPreview = !showPreview)}
			>
				{showPreview ? 'Hide' : 'Preview'}
			</button>
			<button
				class="bg-white/5 border border-white/10 cursor-pointer flex gap-2 hover:bg-white/10 items-center px-3 py-1.5 rounded-lg text-gray-300 text-sm transition-colors"
				onclick={downloadMarkdown}
			>
				<Download size={14} />
				Download
			</button>
			<button
				class="bg-green-500/10 border border-green-500/30 cursor-pointer flex gap-2 hover:bg-green-500/20 items-center px-3 py-1.5 rounded-lg text-green-400 text-sm transition-colors"
				onclick={copyMarkdown}
			>
				{#if copied}
					<Check size={14} />
					Copied
				{:else}
					<Copy size={14} />
					Copy Markdown
				{/if}
			</button>
		</div>
	</div>

	{#if showPreview}
		<pre
			class="bg-black/40 border border-white/5 font-mono max-h-96 mt-4 overflow-auto p-4 rounded-lg text-[10px] text-gray-300 whitespace-pre">{markdown}</pre>
	{/if}
</section>
