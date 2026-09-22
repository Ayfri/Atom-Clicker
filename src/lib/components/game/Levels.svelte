<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatNumber } from '$lib/utils';
</script>

<div
	class="flex fixed left-1/2 z-10 w-full p-2 -translate-x-1/2 flex-col-reverse gap-1 md:w-3/5 md:flex-col transition-all duration-300"
	style="top: var(--banner-height)"
>
	<div class="flex items-center justify-between px-2 text-sm">
		<span class="font-bold text-accent-400">Level {gameManager.playerLevel}</span>
		<span class="text-gray-300">{formatNumber(gameManager.currentLevelXP, 0)} / {formatNumber(gameManager.nextLevelXP, 0)} XP</span>
	</div>
	<div class="h-2 w-full overflow-hidden bg-gray-700 md:rounded-full">
		<!-- XP moves on every 50 Hz production commit, which is already smooth. A transition here restarted 50 times a second, and each restart forced a style recalc. -->
		<div class="h-full w-full origin-left bg-linear-to-r from-accent-400 to-accent-500" style:transform="scaleX({gameManager.xpProgress / 100})"></div>
	</div>
</div>
