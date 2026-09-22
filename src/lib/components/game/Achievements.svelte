<script lang="ts">
	import {gameManager} from '$helpers/GameManager.svelte';
	import {quarksManager} from '$helpers/QuarksManager.svelte';
	import {ACHIEVEMENT_ENTRIES} from '$data/achievements';
	import {isQuarkAchievement} from '$data/quarkAchievements';
	import Quark from '@components/icons/Quark.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import IconStack from '@components/ui/IconStack.svelte';
	import QuarkLabel from '@components/ui/QuarkLabel.svelte';

	const claimableAchievementIds = $derived(
		gameManager.achievements.filter(id => isQuarkAchievement(id) && !quarksManager.claimedAchievementIds.includes(id)),
	);
	const canClaimAchievements = $derived(quarksManager.hasSynced && claimableAchievementIds.length > 0);
	const PARTICLE_COUNT = 10;

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

<div class="backdrop-blur-xs bg-black/10 p-3 rounded-lg h-150 lg:h-[calc(100vh-180px)] flex flex-col">
	<div class="flex items-center gap-1.5">
		<h2 class="font-semibold text-lg">
		Achievements ({gameManager.achievements.length}/{ACHIEVEMENT_ENTRIES.length})
		</h2>
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
	<div class="achievement-grid mt-2 grid gap-1.5 overflow-x-hidden overflow-y-auto flex-1 custom-scrollbar px-1">
		<!-- Static entries keyed by id: rebuilding one object per achievement on every unlock re-rendered all ~200 icon stacks. -->
		{#each ACHIEVEMENT_ENTRIES as [id, achievement] (id)}
			{@const unlocked = gameManager.unlockedAchievementIds.has(id)}
			{@const hidden = !unlocked && achievement.hiddenCondition?.(gameManager) === true}
			<div
				class="duration-200 flex items-center gap-2 rounded-lg p-2 transition-all {unlocked
					? 'bg-[#486f9b]'
					: 'cursor-not-allowed bg-white/5 opacity-50'}"
			>
				<!-- Hidden achievements fall back to a neutral icon, otherwise the stack would spoil what they are about. -->
				{#if hidden}
					<IconStack color="rgba(255, 255, 255, 0.35)" icon="award" label="?" size={34} />
				{:else if achievement.iconStack}
					<IconStack
						color={achievement.iconStack.color}
						count={achievement.iconStack.count}
						icon={achievement.iconStack.icon}
						label={achievement.iconStack.label}
						size={34}
					/>
				{/if}
				<div class="min-w-0">
					<h3 class="m-0 font-semibold text-sm">
						{hidden ? '???' : achievement.name}
					</h3>
					<p class="m-0 mt-0.5 text-xs opacity-80">
						{hidden ? '???' : achievement.description}
					</p>
				</div>
				<div class="relative ml-auto shrink-0">
					{#if quarksManager.hasSynced && unlocked && !quarksManager.claimedAchievementIds.includes(id)}
						<button
							class="flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20 cursor-pointer"
							onclick={() => claimAchievement(id)}
							aria-label="Claim 1 Quark for {achievement.name}"
							title="Claim 1 Quark"
						>
							+1 <Quark size={14} />
						</button>
					{/if}
					{#if bursts[id]}
						<span class="claim-burst pointer-events-none" style:--duration={`${bursts[id].duration}ms`}>
							{#each bursts[id].particles as particle, index (index)}
								<span class="claim-particle" style:--delay={`${index * 25}ms`} style:--size={`${particle.size}px`} style:--x={`${particle.x}px`} style:--y={`${particle.y}px`}></span>
							{/each}
						</span>
					{/if}
				</div>
			</div>
		{/each}
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
