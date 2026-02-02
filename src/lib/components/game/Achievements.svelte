<script lang="ts">
	import {gameManager} from '$helpers/GameManager.svelte';
	import {ACHIEVEMENTS} from '$data/achievements';

	const unlockedAchievements = $derived(Object.entries(ACHIEVEMENTS).map(([name, achievement]) => ({
		...achievement,
		unlocked: gameManager.achievements.includes(name)
	})));
</script>

<div class="backdrop-blur-xs bg-black/10 p-3 rounded-lg h-[600px] lg:h-[calc(100vh-180px)] flex flex-col">
	<h2 class="font-semibold text-lg">
		Achievements ({gameManager.achievements.length}/{Object.keys(ACHIEVEMENTS).length})
	</h2>
	<div class="achievement-grid mt-2 grid gap-1.5 overflow-y-auto flex-1 custom-scrollbar px-1">
		{#each unlockedAchievements as achievement}
			{@const hidden = achievement.hiddenCondition?.(gameManager) === true}
			<div
				class="duration-200 flex items-center gap-2 rounded-lg p-2 transition-all {achievement.unlocked
					? 'bg-[#486f9b]'
					: 'cursor-not-allowed bg-white/5 opacity-50'}"
			>
				<!-- <div class="icon">{achievement.icon}</div> -->
				<div>
					<h3 class="m-0 font-semibold text-sm">
						{hidden && !achievement.unlocked ? '???' : achievement.name}
					</h3>
					<p class="m-0 mt-0.5 text-xs opacity-80">
						{hidden && !achievement.unlocked ? '???' : achievement.description}
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>
