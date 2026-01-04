<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type SpanAttributes = SvelteHTMLElements['span'];

	interface Props extends SpanAttributes {
		color?: string;
		hasNotification?: boolean;
		children?: Snippet;
	}

	let { color = 'var(--color-accent-400)', hasNotification = false, children, ...rest }: Props = $props();
</script>

<span
	class="relative"
	{...rest}
>
	{#if hasNotification}
		<span
			class="absolute -top-1 -right-1 size-2 rounded-full animate-pulse shadow-[0_0_10px]"
			style="background-color: {color}; shadow-color: {color};"
		></span>
	{/if}
	{@render children?.()}
</span>
