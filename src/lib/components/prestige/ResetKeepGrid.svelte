<script lang="ts">
	import PrestigeEntry from '#components/prestige/PrestigeEntry.svelte';
	import type { PrestigeListItem } from '#lib/types.js';
	import { Check, RotateCcw, Vault, X } from '@lucide/svelte';

	interface Props {
		color: string;
		keeps: PrestigeListItem[];
		resets: PrestigeListItem[];
	}

	let { color, keeps, resets }: Props = $props();
</script>

<div class="grid grid-cols-2 text-sm">
	<div class="flex flex-col gap-2 pr-4">
		<h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-300/80">
			<RotateCcw size={13} />
			Resets
		</h3>
		<ul class="flex flex-col gap-1.5 text-white/55">
			{#each resets as item (item.label)}
				<li class="flex gap-2">
					<X
						class="mt-0.5 shrink-0 text-red-300/50"
						size={14}
					/>
					<PrestigeEntry {...item} />
				</li>
			{/each}
		</ul>
	</div>
	<div class="flex flex-col gap-2 border-l border-white/10 pl-4">
		<h3
			class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
			style:color
		>
			<Vault size={13} />
			Keeps
		</h3>
		<ul class="flex flex-col gap-1.5 text-white/85">
			{#each keeps as item (item.label)}
				<li class="flex gap-2">
					<Check
						class="mt-0.5 shrink-0"
						size={14}
						{color}
					/>
					<PrestigeEntry {...item} />
				</li>
			{/each}
		</ul>
	</div>
</div>
