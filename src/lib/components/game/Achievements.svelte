<script lang="ts">
	import type { Achievement, AchievementGroup } from '#lib/types.js';
	import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS } from '#data/achievements.js';
	import { isQuarkAchievement } from '#data/quarkAchievements.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
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
	const PARTICLE_COUNT = 10;

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

	interface ClaimParticle {
		size: number;
		x: number;
		y: number;
	}

	interface ClaimBurst {
		duration: number;
		id: number;
		particles: ClaimParticle[];
	}

	let bursts = $state<Record<string, ClaimBurst>>({});
	let claimAllBurst = $state<ClaimBurst | null>(null);
	let nextBurstId = 0;

	function createParticles(count: number, distance: number): ClaimParticle[] {
		return Array.from({ length: count }, () => {
			const angle = Math.random() * Math.PI * 2;
			const radius = (10 + Math.random() * 14) * distance;
			return { size: 4 + Math.random() * 3, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
		});
	}

	function startBurst(achievementId: string, duration = 540) {
		const burst = { duration, id: ++nextBurstId, particles: createParticles(PARTICLE_COUNT, 1) };
		bursts = { ...bursts, [achievementId]: burst };
		setTimeout(() => {
			if (bursts[achievementId]?.id !== burst.id) return;
			const { [achievementId]: _, ...remainingBursts } = bursts;
			bursts = remainingBursts;
		}, duration + (PARTICLE_COUNT - 1) * 25);
	}

	function claimAchievement(achievementId: string) {
		if (!quarksManager.hasSynced) return;
		startBurst(achievementId);
		quarksManager.claimAchievement(achievementId);
	}

	function claimAllAchievements() {
		if (!canClaimAchievements) return;
		const duration = Math.min(1350, 700 + Math.log10(Math.max(gameManager.atoms, 1)) * 75);
		const burst = { duration, id: ++nextBurstId, particles: createParticles(PARTICLE_COUNT * 6, 1.35) };
		claimAllBurst = burst;
		setTimeout(() => {
			if (claimAllBurst?.id === burst.id) claimAllBurst = null;
		}, duration + (PARTICLE_COUNT * 6 - 1) * 22);
		quarksManager.claimAchievements(claimableAchievementIds);
	}
</script>

<div class="backdrop-blur-xs bg-black/10 p-3 rounded-lg h-150 lg:h-[calc(100dvh-204px)] flex flex-col">
	<div class="flex items-center gap-1.5">
		<h2 class="font-semibold text-lg">Achievements</h2>
		<span class="text-xs tabular-nums text-white/50">{gameManager.achievements.length}/{TOTAL_ACHIEVEMENTS}</span>
		{#if canClaimAchievements}
			<div class="relative ml-auto">
				<button
					class="rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer"
					onclick={claimAllAchievements}
				>
					Claim all
				</button>
				{#if claimAllBurst}
					<span class="claim-burst pointer-events-none" style:--duration={`${claimAllBurst.duration}ms`}>
						{#each claimAllBurst.particles as particle, index (index)}
							<span class="claim-particle" style:--delay={`${index * 22}ms`} style:--size={`${particle.size}px`} style:--x={`${particle.x}px`} style:--y={`${particle.y}px`}></span>
						{/each}
					</span>
				{/if}
			</div>
		{/if}
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
							<div class="relative ml-auto shrink-0">
								{#if claimable.has(achievement.id)}
									<button
										class="flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20 cursor-pointer"
										onclick={() => claimAchievement(achievement.id)}
										aria-label="Claim 1 Quark for {achievement.name}"
										title="Claim 1 Quark"
									>
										+1 <Quark size={14} />
									</button>
								{/if}
								{#if bursts[achievement.id]}
									<span class="claim-burst pointer-events-none" style:--duration={`${bursts[achievement.id].duration}ms`}>
										{#each bursts[achievement.id].particles as particle, index (index)}
											<span class="claim-particle" style:--delay={`${index * 25}ms`} style:--size={`${particle.size}px`} style:--x={`${particle.x}px`} style:--y={`${particle.y}px`}></span>
										{/each}
									</span>
								{/if}
							</div>
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

<style>
	.claim-burst {
		position: absolute;
		left: calc(50% - 13px);
		top: 50%;
		z-index: 10;
		display: block;
		width: 0;
		height: 0;
	}

	.claim-particle {
		position: absolute;
		width: var(--size);
		height: var(--size);
		border-radius: 999px;
		background: #ffffff;
		box-shadow: 0 0 7px currentColor;
		animation: quark-claim-burst var(--duration) cubic-bezier(0.2, 0.05, 0.25, 1) both;
		animation-delay: var(--delay);
	}

	.claim-particle:nth-child(3n + 1) {
		background: #4a9eff;
		color: #4a9eff;
	}

	.claim-particle:nth-child(3n + 2) {
		background: #3ddc84;
		color: #3ddc84;
	}

	.claim-particle:nth-child(3n) {
		background: #ff5d73;
		color: #ff5d73;
	}

	@keyframes quark-claim-burst {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.2);
		}
		18% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
		68% {
			opacity: 0.9;
			transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(0.75);
		}
		100% {
			opacity: 0;
			transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(0.3);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.claim-particle {
			animation-duration: 1ms;
		}
	}
</style>
