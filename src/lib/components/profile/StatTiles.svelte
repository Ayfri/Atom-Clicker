<script lang="ts" module>
	import type { Component } from 'svelte';

	export interface StatTile {
		icon: Component<{ size?: number }>;
		label: string;
		value: string;
	}
</script>

<script lang="ts">
	interface Props {
		tiles: StatTile[];
	}

	let { tiles }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
	{#each tiles as tile (tile.label)}
		<div class="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
			<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
				<tile.icon size={18} />
			</span>
			<span class="flex min-w-0 flex-col">
				<span class="truncate font-bold text-white">{tile.value}</span>
				<span class="text-xs text-white/50">{tile.label}</span>
			</span>
		</div>
	{/each}
</div>
