<script lang="ts">
	import { btn } from './shared.svelte';
	import NumberInput from './NumberInput.svelte';

	interface Item {
		description: (level: number) => string;
		id: string;
		maxLevel: number;
		name: string;
	}

	interface Props {
		items: Item[];
		levels: Record<string, number>;
		onChange: (levels: Record<string, number>) => void;
	}

	let { items, levels, onChange }: Props = $props();

	const setAll = (max: boolean) => onChange(Object.fromEntries(items.map(item => [item.id, max ? item.maxLevel : 0])));
</script>

<div class="flex flex-col gap-1">
	<div class="flex justify-end gap-1">
		<button class={btn} onclick={() => setAll(true)}>All max</button>
		<button class={btn} onclick={() => setAll(false)}>All 0</button>
	</div>
	{#each items as item (item.id)}
		{@const level = levels[item.id] ?? 0}
		<div class="grid grid-cols-[1fr_5rem_auto] items-center gap-2 rounded px-1 py-1 hover:bg-white/5" title={item.description(level)}>
			<span class="truncate text-xs {level > 0 ? 'text-white' : 'text-white/45'}">
				{item.name} <span class="font-mono text-[10px] text-white/25">{item.id}</span>
			</span>
			<NumberInput
				onCommit={value => onChange({ ...levels, [item.id]: Math.min(item.maxLevel, Math.max(0, Math.round(value))) })}
				value={level}
			/>
			<button
				class="{btn} w-12 font-mono"
				onclick={() => onChange({ ...levels, [item.id]: level >= item.maxLevel ? 0 : item.maxLevel })}
				title="Toggle between 0 and max"
			>
				/{item.maxLevel}
			</button>
		</div>
	{/each}
</div>
