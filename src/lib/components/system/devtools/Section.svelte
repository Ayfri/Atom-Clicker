<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		actions?: Snippet;
		children: Snippet;
		collapsed?: boolean;
		title: string;
	}

	let { actions, children, collapsed = false, title }: Props = $props();
</script>

<details class="group/section border-b border-white/5 last:border-b-0" open={!collapsed}>
	<summary class="flex cursor-pointer list-none items-center gap-2 py-3 select-none [&::-webkit-details-marker]:hidden">
		<ChevronRight class="text-white/30 transition-transform group-open/section:rotate-90" size={15} />
		<h3 class="flex-1 text-xs font-bold tracking-wider text-white/60 uppercase">{title}</h3>
		{#if actions}
			<div class="flex items-center gap-1">{@render actions()}</div>
		{/if}
	</summary>
	<div class="pb-4">{@render children()}</div>
</details>
