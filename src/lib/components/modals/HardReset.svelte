<script lang="ts">
	import Modal from '@components/ui/Modal.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { info } from '$stores/toasts';
	import { Trash2, Trophy, X } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	// Check if achievement is already unlocked
	let isAlreadyUnlocked = $derived(gameManager.achievements.includes('reset_modal_opener'));

	// Unlock achievement when modal opens
	$effect(() => {
		if (!isAlreadyUnlocked) {
			gameManager.unlockAchievement('reset_modal_opener');
		}
	});

	function handleReset() {
		gameManager.reset();
		onClose();
	}
</script>

<Modal {onClose} width="sm" title="Hard Reset">
	<div class="flex flex-col gap-6 text-center">
		<div>
			<h2 class="text-2xl font-bold mb-2">Are you sure?</h2>
			<p class="text-gray-300">
				This will completely reset your game progress.
				<br />
				<span class="text-yellow-400">Your highest score on the leaderboard will be preserved.</span>
			</p>
		</div>

		<div class="flex justify-center gap-4">
			<button
				class="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/50 text-red-200 font-semibold transition-colors duration-500"
				onclick={handleReset}
			>
				<Trash2 size={16} />
				Reset Game
			</button>
			<button
				class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition-colors"
				onclick={onClose}
			>
				<X size={16} />
				Cancel
			</button>
		</div>
	</div>
</Modal>
