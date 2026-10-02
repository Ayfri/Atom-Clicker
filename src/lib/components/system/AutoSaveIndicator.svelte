<script lang="ts">
	import { CloudUpload } from '@lucide/svelte';
	import { autoSave } from '#stores/autoSave.svelte.js';

	const MIN_DURATION = 1000;
	let shownAt = 0;
	let visible = $state(false);

	/** The icon stays up at least MIN_DURATION so a fast save is still noticeable. */
	$effect(() => {
		if (autoSave.isSaving) {
			shownAt = Date.now();
			visible = true;
			return;
		}
		if (!shownAt) return;
		const timeout = setTimeout(() => {
			shownAt = 0;
			visible = false;
		}, Math.max(0, MIN_DURATION - (Date.now() - shownAt)));
		return () => clearTimeout(timeout);
	});
</script>

<div class="sr-only" aria-live="polite" role="status">{visible ? 'Saving to the cloud' : ''}</div>

{#if visible}
	<div class="pointer-events-none fixed right-4 bottom-[calc(var(--mobile-nav-height,0px)+1rem)] z-50">
		<div class="animate-bounce">
			<CloudUpload aria-hidden="true" class="text-accent drop-shadow-lg" size={28} />
		</div>
	</div>
{/if}
