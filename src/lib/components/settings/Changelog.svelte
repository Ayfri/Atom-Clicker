<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import { gameManager } from '$helpers/GameManager.svelte';

	let changelogContent = $state('');

	onMount(async () => {
		gameManager.unlockAchievement('changelog_modal_opener');
		try {
			const response = await fetch('/Changelog.md');
			changelogContent = await response.text();
		} catch (error) {
			console.error('Failed to load changelog:', error);
		}
	});
</script>

{#if changelogContent}
    <div class="prose prose-invert mx-auto max-w-3xl">
        {@html marked(changelogContent)}
    </div>
{/if}

<style lang="postcss">
	@reference '../../../app.css';

	:global(.prose) {
		@apply text-white/90;
	}

	:global(.prose *) {
		user-select: text;
	}

	:global(.prose h1) {
		@apply mb-4 text-3xl font-bold text-white border-b border-white/10 pb-4;
	}

	:global(.prose ul) {
		@apply flex flex-col gap-2 pl-5 pb-8 list-disc;
	}

	:global(.prose li) {
		@apply leading-relaxed;
	}

	:global(.prose li::marker) {
		@apply text-accent-200;
	}

	:global(.prose p) {
		@apply leading-relaxed;
	}

	:global(.prose a) {
		@apply text-accent-500 transition-colors;

		&:hover {
			@apply text-accent-400;
		}
	}

	:global(.prose strong) {
		@apply text-white font-bold;
	}

	:global(.prose em) {
		@apply text-white/80 italic;
	}

	:global(.prose code) {
		@apply bg-black/20 px-1.5 py-0.5 rounded text-sm font-mono text-white;
	}

	:global(.prose pre) {
		@apply bg-black/20 p-4 rounded-lg overflow-x-auto;
	}

	:global(.prose pre code) {
		@apply bg-transparent p-0 text-base;
	}
</style>
