<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Tooltip from '@components/ui/Tooltip.svelte';
	import Value from '@components/ui/Value.svelte';
	import type { CurrencyName } from '$data/currencies';
	import { FEATURES, type FeatureType } from '$data/features';
	import { gameManager } from '$helpers/GameManager.svelte';
	import type { SkillUpgrade } from '$lib/types';
	import { formatNumber } from '$lib/utils';
	import { Info, Sparkles } from 'lucide-svelte';

	interface SkillNodeData extends SkillUpgrade {
		available: boolean;
		currencyUnlocked: boolean;
		onClick?: () => void;
		unlocked: boolean;
	}

	let { data, id }: NodeProps = $props();

	const skillData = $derived(data as unknown as SkillNodeData);
	const isFeature = $derived(!!skillData.feature);
	const featureInfo = $derived(skillData.feature ? FEATURES[skillData.feature as FeatureType] : null);

	const isCurrencyUnlocked = $derived(skillData.currencyUnlocked);

	// Calculate current effect values for tooltip
	const effectBreakdown = $derived.by(() => {
		if (!skillData.unlocked || skillData.effects.length === 0 || !isCurrencyUnlocked) return null;

		return skillData.effects.map(effect => {
			const baseValue = 1;
			const result = effect.apply(baseValue, gameManager);
			// Percentage change: if result is 1.045, that's +4.5%
			const percentChange = (result - baseValue) * 100;
			return {
				description: effect.description,
				percentChange,
				type: effect.type,
			};
		});
	});
</script>

<Handle
	id="{id}-{Position.Bottom}"
	type="source"
	position={Position.Bottom}
	class="opacity-0"
	style="inset: 50%; transform: none;"
/>
<Handle
	id="{id}-{Position.Bottom}"
	type="target"
	position={Position.Bottom}
	class="opacity-0"
	style="inset: 50%; transform: none;"
/>
<Handle
	id="{id}-{Position.Top}"
	type="source"
	position={Position.Top}
	class="opacity-0"
	style="inset: 50%; transform: none;"
/>
<Handle
	id="{id}-{Position.Top}"
	type="target"
	position={Position.Top}
	class="opacity-0"
	style="inset: 50%; transform: none;"
/>
<Handle
	id="{id}-{Position.Left}"
	type="source"
	position={Position.Left}
	class="opacity-0"
	style="inset: 50%; transform: none;"
/>
<Handle
	id="{id}-{Position.Left}"
	type="target"
	position={Position.Left}
	class="opacity-0"
	style="inset: 50%; transform: none;"
/>
<Handle
	id="{id}-{Position.Right}"
	type="source"
	position={Position.Right}
	class="opacity-0"
	style="inset: 50%; transform: none;"
/>
<Handle
	id="{id}-{Position.Right}"
	type="target"
	position={Position.Right}
	class="opacity-0"
	style="inset: 50%; transform: none;"
/>

<div
	aria-label="Unlock {isCurrencyUnlocked ? skillData.name : '?????'}"
	class="skill-node relative flex h-36 w-72 flex-col justify-center rounded-lg p-5 shadow-md transition {isFeature ? 'border-2' : ''} {(
		isFeature && !skillData.unlocked
	) ?
		'border-purple-400/50'
	:	''} {isFeature && skillData.unlocked ? 'border-purple-300' : ''}"
	class:locked={!skillData.unlocked && !skillData.available}
	class:available={skillData.available && !skillData.unlocked}
	class:unlocked={skillData.unlocked && !isFeature}
	class:unlocked-feature={skillData.unlocked && isFeature}
	class:pointer-events-none={!skillData.available || !isCurrencyUnlocked}
	class:cursor-pointer={skillData.available && isCurrencyUnlocked}
	onclick={() => isCurrencyUnlocked && skillData.onClick?.()}
	onkeydown={e => {
		if (isCurrencyUnlocked && (e.key === 'Enter' || e.key === ' ')) {
			skillData.onClick?.();
		}
	}}
	tabindex="0"
	role="button"
>
	<!-- Feature badge -->
	{#if isFeature && isCurrencyUnlocked}
		<div
			class="absolute -top-2 left-3 flex items-center gap-1 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md"
		>
			<Sparkles size={10} />
			Feature
		</div>
	{/if}

	<!-- Effect tooltip -->
	{#if skillData.unlocked && effectBreakdown && effectBreakdown.length > 0 && isCurrencyUnlocked}
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
						{#each effectBreakdown as effect}
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
		<h3 class="text-lg font-semibold leading-tight">{isCurrencyUnlocked ? skillData.name : '?????'}</h3>
		<p class="text-sm leading-snug opacity-90">
			{#if !isCurrencyUnlocked}
				????? ????? ????? ????? ?????
			{:else if isFeature && featureInfo}
				{featureInfo.description}
			{:else}
				{skillData.description}
			{/if}
		</p>
		{#if skillData.cost}
			<div
				class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium"
				class:opacity-60={skillData.unlocked}
			>
				{#if isCurrencyUnlocked}
					<Value
						value={skillData.cost.amount}
						currency={skillData.cost.currency as CurrencyName}
						currencyClass="h-5 w-5"
					/>
					{#if skillData.unlocked}
						<span class="text-[10px] uppercase text-white/70">(owned)</span>
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
