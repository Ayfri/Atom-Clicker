<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { remoteMessage } from '$stores/remoteMessage.svelte';
</script>

<div
	class="flex fixed left-1/2 z-10 w-full p-2 -translate-x-1/2 flex-col-reverse gap-1 md:w-3/5 md:flex-col transition-all duration-300"
	style="top: {remoteMessage.message && remoteMessage.isVisible ? '1.5rem' : '0'}"
>
	<div class="flex items-center justify-between px-2 text-sm">
		<span class="font-bold text-accent-400">Level {gameManager.playerLevel}</span>
		<span class="text-gray-300">{formatNumber(gameManager.currentLevelXP, 0)} / {formatNumber(gameManager.nextLevelXP, 0)} XP</span>
	</div>
	<div class="h-2 w-full overflow-hidden bg-gray-700 md:rounded-full">
		<div class="h-full w-full transition-all duration-300 ease-out bg-linear-to-r from-accent-400 to-accent-500" style="clip-path: inset(0 {100 - gameManager.xpProgress}% 0 0);"></div>
	</div>
</div>
