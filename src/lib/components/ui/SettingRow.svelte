<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		description: string;
		icon?: LucideIcon;
		title: string;
	}

	let { children, description, icon: Icon, title }: Props = $props();
</script>

<div class="relative flex items-center gap-4 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-4">
	{#if Icon}
		<Icon class="shrink-0 text-accent" size={24} />
	{/if}
	<div class="min-w-0 flex-1">
		<p class="font-semibold text-white">{title}</p>
		<p class="text-sm text-white/60">{description}</p>
	</div>
	{@render children()}
</div>
