<script lang="ts">
	import type { Achievement, AchievementGroup } from '#lib/types.js';
	import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS } from '#data/achievements.js';
	import { isQuarkAchievement } from '#data/quarkAchievements.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { quarkFlight } from '#helpers/quarkFlight.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import { reveal } from '#helpers/reveals.svelte.js';
	import Quark from '#components/icons/Quark.svelte';
	import HelpIcon from '#components/ui/HelpIcon.svelte';
	import IconStack from '#components/ui/IconStack.svelte';
	import QuarkLabel from '#components/ui/QuarkLabel.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	const TOTAL_ACHIEVEMENTS = Object.keys(ACHIEVEMENTS).length;

	const claimableAchievementIds = $derived(
		gameManager.achievements.filter(id => isQuarkAchievement(id) && !quarksManager.claimedAchievementIds.includes(id)),
	);
	const canClaimAchievements = $derived(quarksManager.hasSynced && claimableAchievementIds.length > 0);
	const claimable = $derived(new Set(canClaimAchievements ? claimableAchievementIds : []));
	const expandedGroups = new SvelteSet<string>();
	/** Series the player has not discovered yet fold into a single line instead of a list of "???" sections. */
	const visibleGroups = $derived(
		ACHIEVEMENT_GROUPS.filter(group =>
			group.achievements.some(achievement => gameManager.unlockedAchievementIds.has(achievement.id) || achievement.hiddenCondition?.(gameManager) !== true),
		),
	);
	const undiscoveredCount = $derived(
		ACHIEVEMENT_GROUPS.reduce((count, group) => (visibleGroups.includes(group) ? count : count + group.achievements.length), 0),
	);
	const claimingAll = $derived(quarksManager.isActionPending('claim-achievements'));

	/** A collapsed series only keeps its latest unlocked tier and its next target, the rest waits behind "Show all". */
	function shownAchievements(group: AchievementGroup, unlocked: ReadonlySet<string>): Achievement[] {
		if (!group.tiered || expandedGroups.has(group.name)) return group.achievements;
		const next = group.achievements.findIndex(achievement => !unlocked.has(achievement.id));
		const last = group.achievements.findLastIndex(achievement => unlocked.has(achievement.id));
		return group.achievements.filter((_, index) => index === next || index === last);
	}

	function toggleGroup(name: string) {
		if (!expandedGroups.delete(name)) expandedGroups.add(name);
	}

	/** The Quarks only fly to the nav once the server granted them, a failed claim shows its error toast instead. */
	async function claim(event: MouseEvent & { currentTarget: HTMLButtonElement }, achievementId?: string) {
		if (!canClaimAchievements) return;
		const launch = quarkFlight(event.currentTarget);
		launch(await (achievementId ? quarksManager.claimAchievement(achievementId) : quarksManager.claimAchievements(claimableAchievementIds)));
	}
</script>

<div class="backdrop-blur-xs bg-black/10 p-3 rounded-lg h-150 lg:h-[calc(100dvh-204px)] flex flex-col">
	<div class="flex items-center gap-1.5">
		<h2 class="font-semibold text-lg">Achievements</h2>
		<span class="text-xs tabular-nums text-white/50">{gameManager.achievements.length}/{TOTAL_ACHIEVEMENTS}</span>
		<HelpIcon position="bottom">
			{#snippet content()}
				<p class="text-xs text-white/80">
					Each achievement awards 1 <QuarkLabel /> the first time you unlock it. Hidden achievements stay secret until you find them.
				</p>
			{/snippet}
		</HelpIcon>
	</div>
	<div class="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
		<div class="h-full bg-accent-400" style:width="{(gameManager.achievements.length / TOTAL_ACHIEVEMENTS) * 100}%"></div>
	</div>
	{#if canClaimAchievements}
		{const count = $derived(claimableAchievementIds.length)}
		<div class="mt-2 flex items-center gap-2 border-b border-white/5 pb-2 text-xs" in:reveal={{ y: 0 }}>
			<Quark class="shrink-0" size={18} />
			<p class="min-w-0 flex-1 leading-tight text-white/60">
				<span class="font-semibold text-white">{count} achievement {count === 1 ? 'reward' : 'rewards'}</span> ready, 1 Quark each
			</p>
			<button
				class="flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-accent-600 px-2 py-1 font-semibold text-white transition-colors hover:bg-accent-500 disabled:cursor-wait disabled:opacity-60"
				disabled={claimingAll}
				onclick={event => claim(event)}
			>
				Claim +{count}
				<Quark size={14} />
			</button>
		</div>
	{/if}
	<!-- Collapsed series render two rows each instead of every tier, which keeps the always-mounted panel light. -->
	<div class="mt-1 flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar px-1 pb-1">
		{#each visibleGroups as group (group.name)}
			{const unlockedIds = $derived(gameManager.unlockedAchievementIds)}
			{const unlockedCount = $derived(group.achievements.filter(achievement => unlockedIds.has(achievement.id)).length)}
			{const shown = $derived(shownAchievements(group, unlockedIds))}
			<section class="mt-2">
				<div class="flex items-baseline gap-2 px-1 pb-1 text-[11px] font-semibold tracking-wide text-white/45 uppercase">
					<h3 class="truncate">{group.name}</h3>
					<span class="ml-auto tabular-nums {unlockedCount === group.achievements.length ? 'text-accent-300' : ''}">
						{unlockedCount}/{group.achievements.length}
					</span>
				</div>
				<div class="flex flex-col gap-1">
					{#each shown as achievement (achievement.id)}
						{const unlocked = $derived(unlockedIds.has(achievement.id))}
						{const hidden = $derived(!unlocked && achievement.hiddenCondition?.(gameManager) === true)}
						<div class="flex items-center gap-2.5 rounded-md px-2 py-1.5 {unlocked ? 'bg-accent-500/20' : 'bg-white/3'}">
							<!-- Hidden achievements fall back to a neutral icon, otherwise the stack would spoil what they are about. -->
							{#if hidden}
								<IconStack class="opacity-40" color="#ffffff" icon="trophy" label="?" size={30} />
							{:else if achievement.iconStack}
								<IconStack
									class={unlocked ? '' : 'opacity-40'}
									color={achievement.iconStack.color}
									count={achievement.iconStack.count}
									icon={achievement.iconStack.icon}
									label={achievement.iconStack.label}
									size={30}
								/>
							{/if}
							<div class="min-w-0">
								<h4 class="text-[13px] font-semibold {unlocked ? '' : 'text-white/60'}">{hidden ? '???' : achievement.name}</h4>
								<p class="mt-0.5 text-[11px] leading-snug text-white/50">{hidden ? '???' : achievement.description}</p>
							</div>
							<div class="ml-auto shrink-0">
								{#if claimable.has(achievement.id)}
									<button
										class="flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20 cursor-pointer"
										onclick={event => claim(event, achievement.id)}
										aria-label="Claim 1 Quark for {achievement.name}"
										title="Claim 1 Quark"
									>
										+1 <Quark size={14} />
									</button>
								{/if}							</div>
						</div>
					{/each}
				</div>
				{#if shown.length < group.achievements.length || expandedGroups.has(group.name)}
					<button
						class="mt-0.5 w-full px-1 py-1.5 text-left text-[11px] text-white/40 transition-colors hover:text-white/75"
						onclick={() => toggleGroup(group.name)}
					>
						{expandedGroups.has(group.name) ? 'Show less' : `Show all ${group.achievements.length} tiers`}
					</button>
				{/if}
			</section>
		{/each}
		{#if undiscoveredCount > 0}
			<p class="mt-3 px-1 text-[11px] text-white/35">{undiscoveredCount} more achievements are waiting to be discovered.</p>
		{/if}
	</div>
</div>
