<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Tooltip from '@components/ui/Tooltip.svelte';
	import Value from '@components/ui/Value.svelte';
	import type { CurrencyName } from '$data/currencies';
	import { FEATURES, type FeatureType } from '$data/features';
	import type { SkillUpgrade } from '$lib/types';
	import { formatNumber } from '$lib/utils';
	import { Info, Sparkles } from '@lucide/svelte';

	interface EffectBreakdownItem {
		description: string;
		percentChange: number;
		type: string;
	}

	interface SkillNodeData extends SkillUpgrade {
		affordable: boolean;
		available: boolean;
		conditionMet: boolean;
		currencyUnlocked: boolean;
		effectBreakdown: EffectBreakdownItem[] | null;
		onClick?: () => void;
		sourceHandles: Position[];
		targetHandles: Position[];
		unlocked: boolean;
	}

	let { data, id }: NodeProps = $props();

	const skillData = $derived(data as unknown as SkillNodeData);
	const isFeature = $derived(!!skillData.feature);
	const featureInfo = $derived(skillData.feature ? FEATURES[skillData.feature as FeatureType] : null);
	const isContentVisible = $derived(skillData.currencyUnlocked || skillData.unlocked);
</script>

{#each skillData.sourceHandles as pos}
	<Handle id="{id}-src-{pos}" type="source" position={pos} class="opacity-0" style="inset: 50%; transform: none;" />
{/each}
{#each skillData.targetHandles as pos}
	<Handle id="{id}-tgt-{pos}" type="target" position={pos} class="opacity-0" style="inset: 50%; transform: none;" />
{/each}

<div
	aria-label="Unlock {isContentVisible ? skillData.name : '?????'}"
	class="skill-node relative flex h-40 w-80 flex-col justify-center rounded-lg p-5 shadow-md transition {isFeature ? 'border-2' : ''} {(
		isFeature && !skillData.unlocked
	) ?
		'border-purple-400/50'
	:	''} {isFeature && skillData.unlocked ? 'border-purple-300' : ''}"
	class:locked={!skillData.unlocked && !skillData.available}
	class:available={skillData.available && !skillData.unlocked}
	class:unlocked={skillData.unlocked && !isFeature}
	class:unlocked-feature={skillData.unlocked && isFeature}
	class:pointer-events-none={!skillData.available || !isContentVisible}
	class:cursor-pointer={skillData.available && isContentVisible}
	onclick={() => isContentVisible && skillData.onClick?.()}
	onkeydown={e => {
		if (isContentVisible && (e.key === 'Enter' || e.key === ' ')) {
			skillData.onClick?.();
		}
	}}
	tabindex="0"
	role="button"
>
	<!-- Feature badge -->
	{#if isFeature && isContentVisible}
		<div
			class="absolute -top-2 left-3 flex items-center gap-1 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md"
		>
			<Sparkles size={10} />
			Feature
		</div>
	{/if}

	<!-- Effect tooltip -->
	{#if skillData.unlocked && skillData.effectBreakdown && skillData.effectBreakdown.length > 0 && isContentVisible}
		<div
			class="absolute right-2 top-2 z-10 pointer-events-auto"
			onclick={e => e.stopPropagation()}
			onkeydown={e => e.stopPropagation()}
			onmouseenter={e => e.stopPropagation()}
			onmouseleave={e => e.stopPropagation()}
			role="presentation"
		>
			<Tooltip
				position="left"
				size="sm"
			>
				{#snippet children()}
					<Info
						size={16}
						class="text-white/80 hover:text-white transition-colors cursor-help"
					/>
				{/snippet}
				{#snippet content()}
					<div class="flex flex-col gap-1.5">
						<span class="text-sm font-bold uppercase tracking-wider text-accent-300">Active Effects</span>
						{#each skillData.effectBreakdown as effect}
							<div class="flex flex-col">
								<span class="text-xs text-white/80">{effect.description}</span>
								<span class="font-mono text-[11px] text-white/50">
									{effect.percentChange >= 0 ? '+' : ''}{formatNumber(effect.percentChange, 1)}%
								</span>
							</div>
						{/each}
					</div>
				{/snippet}
			</Tooltip>
		</div>
	{/if}

	<div class="flex flex-col gap-1.5">
		<h3 class="text-xl font-semibold leading-tight">{isContentVisible ? skillData.name : '?????'}</h3>
		<p class="text-base leading-snug opacity-90">
			{#if !isContentVisible}
				????? ????? ????? ????? ?????
			{:else if isFeature && featureInfo}
				{featureInfo.description}
			{:else}
				{skillData.description}
			{/if}
		</p>
		{#if skillData.cost}
			<div
				class="mt-1 inline-flex items-center gap-1.5 text-base font-medium"
				class:opacity-60={skillData.unlocked}
				class:text-red-300={isContentVisible && !skillData.unlocked && !skillData.affordable}
			>
				{#if isContentVisible}
					<Value
						value={skillData.cost.amount}
						currency={skillData.cost.currency as CurrencyName}
						currencyClass="h-5 w-5"
					/>
					{#if skillData.unlocked}
						<span class="text-[10px] uppercase text-white/70">(owned)</span>
					{:else if !skillData.conditionMet && skillData.requirement}
						<span class="text-xs text-amber-300">Requires: {skillData.requirement}</span>
					{/if}
				{:else}
					<span class="text-white/40">Cost: ?????</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.skill-node.locked {
		background-color: var(--color-accent-800);
		color: var(--color-gray-400);
	}

	.skill-node.available {
		background-color: var(--color-neutral-700);
		color: white;
	}

	.skill-node.available:hover {
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -4px rgb(0 0 0 / 0.1);
	}

	.skill-node.unlocked {
		background: linear-gradient(135deg, var(--color-accent-500) 0%, var(--color-accent-700) 100%);
		color: white;
	}

	.skill-node.unlocked-feature {
		background: linear-gradient(135deg, var(--color-purple-500) 0%, var(--color-purple-700) 100%);
		color: white;
	}
</style>
