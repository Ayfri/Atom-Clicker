<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Value from '@components/ui/Value.svelte';
	import type { CurrencyName } from '$data/currencies';
	import type { SkillUpgrade } from '$lib/types';

	interface SkillNodeData extends SkillUpgrade {
		affordable: boolean;
		available: boolean;
		conditionMet: boolean;
		currencyUnlocked: boolean;
		onClick?: () => void;
		sourceHandles: Position[];
		targetHandles: Position[];
		unlocked: boolean;
	}

	let { data, id }: NodeProps = $props();

	const skillData = $derived(data as unknown as SkillNodeData);
	const isContentVisible = $derived(skillData.currencyUnlocked || skillData.unlocked);
</script>

{#each skillData.sourceHandles as pos (pos)}
	<Handle id="{id}-src-{pos}" type="source" position={pos} class="opacity-0" style="inset: 50%; transform: none;" />
{/each}
{#each skillData.targetHandles as pos (pos)}
	<Handle id="{id}-tgt-{pos}" type="target" position={pos} class="opacity-0" style="inset: 50%; transform: none;" />
{/each}

<div
	aria-label="Unlock {isContentVisible ? skillData.name : '?????'}"
	class="skill-node relative flex h-40 w-80 flex-col justify-center rounded-lg p-5 shadow-md transition"
	class:locked={!skillData.unlocked && !skillData.available}
	class:available={skillData.available && !skillData.unlocked}
	class:unlocked={skillData.unlocked}
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
	<div class="flex flex-col gap-1.5">
		<h3 class="text-xl font-semibold leading-tight">{isContentVisible ? skillData.name : '?????'}</h3>
		<p class="text-base leading-snug opacity-90">
			{isContentVisible ? skillData.description : '????? ????? ????? ????? ?????'}
		</p>
		{#if skillData.cost}
			<div
				class="mt-1 inline-flex items-center gap-1.5 text-lg font-medium"
				class:opacity-60={skillData.unlocked}
				class:text-red-300={isContentVisible && !skillData.unlocked && !skillData.affordable}
			>
				{#if isContentVisible}
					<Value
						value={skillData.cost.amount}
						currency={skillData.cost.currency as CurrencyName}
						currencyClass="h-6 w-6"
					/>
					{#if skillData.unlocked}
						<span class="text-sm uppercase text-white/70">(owned)</span>
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
</style>
