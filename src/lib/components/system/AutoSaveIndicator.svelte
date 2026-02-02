<script lang="ts">
	import { CloudUpload } from 'lucide-svelte';
	import { autoSave } from '$stores/autoSave.svelte';

	const SAVE_ANIMATION_DURATION = 1000;
	let animationTimeout: ReturnType<typeof setTimeout>;
	let isSaving = $state(false);
	let saveStartTime = $state(0);

	function startSaveAnimation(startTime: number) {
		isSaving = true;
		saveStartTime = startTime;
		if (animationTimeout) clearTimeout(animationTimeout);
		animationTimeout = setTimeout(() => {
			isSaving = false;
		}, SAVE_ANIMATION_DURATION);
	}

	function stopSaveAnimation() {
		if (animationTimeout) clearTimeout(animationTimeout);
		const remaining = Math.max(0, SAVE_ANIMATION_DURATION - (Date.now() - saveStartTime));
		if (remaining > 0) {
			animationTimeout = setTimeout(() => {
				isSaving = false;
			}, remaining);
		} else {
			isSaving = false;
		}
	}

	$effect(() => {
		if (autoSave.isSaving && !isSaving) startSaveAnimation(Date.now());
		else if (!autoSave.isSaving && isSaving) stopSaveAnimation();
	});
</script>

{#if isSaving}
	<div class="fixed bottom-4 right-4 z-50">
		<div class="animate-bounce">
			<CloudUpload
				size={28}
				class="text-accent drop-shadow-lg"
			/>
		</div>
	</div>
{/if}
