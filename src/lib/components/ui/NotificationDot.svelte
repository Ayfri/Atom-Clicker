<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SpanAttributes = SvelteHTMLElements['span'];

	interface Props extends SpanAttributes {
		children?: Snippet;
		color?: string;
		hasNotification?: boolean;
	}

	let { children, color = 'var(--color-accent-400)', hasNotification = false, ...rest }: Props = $props();
</script>

<span
	class="relative"
	{...rest}
>
	{#if hasNotification}
		<span
			aria-hidden="true"
			class="absolute -top-1 -right-1 size-2 rounded-full animate-pulse shadow-[0_0_10px]"
			style="background-color: {color}; --tw-shadow-color: {color};"
		></span>
	{/if}
	{@render children?.()}
</span>
