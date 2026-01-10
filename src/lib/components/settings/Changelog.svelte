<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import { changelog } from '$stores/changelog';
	import { gameManager } from '$helpers/GameManager.svelte';

	// Check if achievement is already unlocked
	let isAlreadyUnlocked = $derived(gameManager.achievements.includes('changelog_modal_opener'));

	// Unlock achievement when component mounts (since it replaces the modal opening)
	$effect(() => {
		if (!isAlreadyUnlocked) {
			gameManager.unlockAchievement('changelog_modal_opener');
		}
	});

	let changelogContent = $state('');

	function parseChangelogDate(title: string): Date | null {
		const dateMatch = title.match(/(\d{2})-(\d{2})-(\d{4})/);
		if (!dateMatch) return null;

		const [_, day, month, year] = dateMatch;
		return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
	}

	onMount(async () => {
		try {
			const response = await fetch('/Changelog.md');
			changelogContent = await response.text();

			// Get the first date from the changelog
			const firstDateMatch = changelogContent.match(/# What's new (\d{2}-\d{2}-\d{4})/);
			if (firstDateMatch) {
				const lastChangelogDate = parseChangelogDate(firstDateMatch[0]);
				if (lastChangelogDate) {
					changelog.checkForUpdates(lastChangelogDate);
				}
			}
		} catch (error) {
			console.error('Failed to load changelog:', error);
		}

		changelog.markAsRead();
	});
</script>

{#if changelogContent}
    <div class="prose prose-invert max-w-none h-full overflow-y-auto custom-scrollbar pr-4">
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
