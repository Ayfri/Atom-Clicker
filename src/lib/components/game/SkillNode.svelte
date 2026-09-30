<script lang="ts" module>
	/** What the player can see and do with a skill, snapshotted once a second rather than following every currency tick. */
	export interface SkillStatus {
		affordable: boolean;
		/** Purchasable right now: requirements owned, condition met and affordable. */
		available: boolean;
		conditionMet: boolean;
		/** The cost currency was earned before, otherwise the node stays a mystery. */
		currencyKnown: boolean;
		owned: boolean;
		/** Share of the cost the player holds, drawn as the ring around the icon. */
		progress: number;
		visible: boolean;
	}

	const SPARKS = Array.from({ length: 14 }, (_, i) => ({
		angle: i * (360 / 14) + Math.random() * 16,
		distance: 70 + Math.random() * 60,
		size: 3 + Math.random() * 4,
	}));

	const MOTES = Array.from({ length: 3 }, (_, i) => ({ delay: i * 0.8, x: 18 + Math.random() * 64 }));
</script>

<script lang="ts">
	import { Check, Lock } from '@lucide/svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { untrack } from 'svelte';
	import { FILL_MS } from '@components/game/SkillEdge.svelte';
	import Value from '@components/ui/Value.svelte';
	import { ICONS } from '$data/icons';
	import { SKILL_BRANCH_COLORS, SKILL_NODE_SIZE } from '$data/skillTree';
	import type { SkillUpgrade } from '$lib/types';

	interface Props {
		/** Delay before the node pops in, only read when it mounts. */
		enterDelay: number;
		onUnlock: () => void;
		skill: SkillUpgrade;
		status: SkillStatus;
	}

	let { enterDelay, onUnlock, skill, status }: Props = $props();

	const Icon = $derived(ICONS[skill.icon]);
	const isContentVisible = $derived(status.currencyKnown || status.owned);
	const owned = $derived(status.owned);
	const ownedAtMount = untrack(() => owned);
	/** Bought while the tree is open: the node charges up while the liquid flows in, then bursts at `--burst`. */
	const justUnlocked = $derived(owned && !ownedAtMount);
	const available = $derived(status.available && isContentVisible);
	const ringProgress = $derived(owned || available ? 1 : isContentVisible ? status.progress : 0);
	const animated = $derived(!prefersReducedMotion.current);
</script>

<div
	aria-label="Unlock {isContentVisible ? skill.name : '?????'}"
	class={[
		'absolute flex items-center gap-4 rounded-2xl border px-4 transition-[background-color,border-color,translate] duration-500 delay-(--burst) motion-safe:animate-[skill-node-in_550ms_cubic-bezier(0.2,0.9,0.3,1.25)_var(--delay)_backwards]',
		!isContentVisible && 'border-white/5 bg-[#0d1117] text-white/35',
		isContentVisible && !available && !owned && 'border-white/10 bg-[#0d1117] text-white',
		available && 'cursor-pointer border-(color:--c)/55 bg-[#0d1117] text-white hover:-translate-y-1 hover:delay-0 hover:duration-200',
		owned && 'border-(color:--c)/35 bg-[color-mix(in_oklab,var(--c)_12%,#0d1117)] text-white',
		!available && 'pointer-events-none',
	]}
	onclick={() => available && onUnlock()}
	onkeydown={e => {
		if (available && (e.key === 'Enter' || e.key === ' ')) onUnlock();
	}}
	role="button"
	style:--burst="{justUnlocked ? FILL_MS : 0}ms"
	style:--c={SKILL_BRANCH_COLORS[skill.branch]}
	style:--delay="{enterDelay}ms"
	style:--fill="{FILL_MS}ms"
	style:height="{SKILL_NODE_SIZE.height}px"
	style:left="{skill.position.x}px"
	style:top="{skill.position.y}px"
	style:width="{SKILL_NODE_SIZE.width}px"
	tabindex={available ? 0 : -1}
>
	{#if available || owned}
		<span
			class={[
				'pointer-events-none absolute -inset-px rounded-2xl opacity-35 shadow-[0_0_28px_2px_color-mix(in_oklab,var(--c)_55%,transparent)]',
				available ? 'motion-safe:animate-[skill-breathe_2.2s_ease-in-out_infinite]' : 'animate-[skill-appear_500ms_var(--burst)_backwards]',
			]}
		></span>
	{/if}

	<div
		class={[
			'relative size-20 shrink-0',
			justUnlocked && 'motion-safe:animate-[skill-charge_var(--fill)_ease-in,skill-pop_500ms_cubic-bezier(0.2,0.9,0.3,1.4)_var(--fill)]',
		]}
	>
		{#if available && animated}
			<div
				class="absolute -inset-2.5 animate-[skill-spin_3.5s_linear_infinite] rounded-full border-2 border-transparent border-t-(color:--c) border-b-(color:--c)/40"
			></div>
			{#each MOTES as { delay, x }, i (i)}
				<span
					class="absolute bottom-1/2 size-1.5 animate-[skill-rise_2.5s_ease-out_infinite_backwards] rounded-full bg-[color-mix(in_oklab,var(--c)_40%,white)]"
					style:animation-delay="{delay}s"
					style:left="{x}%"
				></span>
			{/each}
		{/if}

		<svg class={['absolute inset-0 -rotate-90', justUnlocked && 'motion-safe:animate-[skill-spin_var(--fill)_cubic-bezier(0.5,0,0.9,0.6)]']} viewBox="0 0 100 100">
			<circle class="fill-none stroke-white/8 stroke-5" cx="50" cy="50" r="46" />
			<circle
				class={[
					'fill-none stroke-5 transition-[stroke-dashoffset] duration-600 ease-out',
					available || owned ? 'stroke-(color:--c)' : 'stroke-[color-mix(in_oklab,var(--c)_55%,#6b7280)]',
				]}
				cx="50"
				cy="50"
				pathLength="1"
				r="46"
				stroke-dasharray="1"
				stroke-dashoffset={1 - ringProgress}
				stroke-linecap="round"
			/>
		</svg>

		<div
			class={[
				'absolute inset-2 grid place-items-center rounded-full transition-colors duration-400',
				!isContentVisible && 'bg-white/4 text-white/30',
				isContentVisible && !available && !owned && 'bg-white/4 text-[color-mix(in_oklab,var(--c)_55%,#6b7280)]',
				available && 'bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklab,var(--c)_35%,#0d1117),#0d1117_75%)] text-(--c)',
				owned && 'bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklab,var(--c)_70%,white),var(--c)_45%,color-mix(in_oklab,var(--c)_45%,black))] text-white',
			]}
		>
			{#if isContentVisible}
				<Icon color="currentColor" size={34} />
			{:else}
				<Lock size={24} />
			{/if}
		</div>

		{#if owned && animated}
			<div class="absolute -inset-1.5 animate-[skill-spin_6s_linear_infinite,skill-appear_400ms_var(--burst)_backwards]">
				<span
					class="absolute top-0 left-1/2 size-2 -translate-1/2 rounded-full bg-[color-mix(in_oklab,var(--c)_30%,white)] shadow-[0_0_8px_var(--c)]"
				></span>
			</div>
		{/if}

		{#if owned}
			<span
				class="absolute -right-0.5 -bottom-0.5 grid size-6 animate-[skill-badge-in_400ms_cubic-bezier(0.2,0.9,0.3,1.5)_var(--burst)_backwards] place-items-center rounded-full bg-(--c) text-accent-950"
			>
				<Check size={14} strokeWidth={3.5} />
			</span>
		{/if}

		{#if justUnlocked}
			<span class="absolute inset-0 animate-[skill-shockwave_700ms_ease-out_var(--fill)_forwards] rounded-full border-3 border-(--c) opacity-0"></span>
			{#each SPARKS as { angle, distance, size }, i (i)}
				<span
					class="absolute top-1/2 left-1/2 -translate-1/2 animate-[skill-spark_850ms_cubic-bezier(0.15,0.7,0.3,1)_var(--fill)_forwards] rounded-full bg-[color-mix(in_oklab,var(--c)_40%,white)] opacity-0 shadow-[0_0_6px_var(--c)]"
					style:--a="{angle}deg"
					style:--d="{distance}px"
					style:height="{size}px"
					style:width="{size}px"
				></span>
			{/each}
		{/if}
	</div>

	<div class="flex min-w-0 flex-col gap-1">
		<h3 class="text-lg leading-tight font-bold">{isContentVisible ? skill.name : '?????'}</h3>
		<p class="line-clamp-3 text-[13px] leading-snug opacity-70">
			{isContentVisible ? skill.description : '????? ????? ????? ????? ?????'}
		</p>
		<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base font-semibold">
			{#if !isContentVisible}
				<span class="text-white/40">Cost: ?????</span>
			{:else if owned}
				<span class="animate-[skill-appear_300ms_var(--burst)_backwards] text-sm tracking-wide text-(--c) uppercase">Unlocked</span>
			{:else}
				<span class={{ 'text-red-300': !status.affordable }}>
					<Value currency={skill.cost.currency} currencyClass="h-5 w-5" value={skill.cost.amount} />
				</span>
				{#if !status.conditionMet && skill.requirement}
					<span class="text-xs text-amber-300">Requires: {skill.requirement}</span>
				{/if}
			{/if}
		</div>
	</div>

	{#if justUnlocked}
		<span
			class="pointer-events-none absolute inset-0 animate-[skill-flash_600ms_ease-out_var(--fill)_forwards] rounded-2xl bg-[radial-gradient(circle_at_60px_50%,color-mix(in_oklab,var(--c)_50%,white),transparent_70%)] opacity-0"
		></span>
	{/if}
</div>
