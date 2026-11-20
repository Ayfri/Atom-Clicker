<script module lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	export interface IconProps extends SvgProps {
		color?: string;
		size?: number;
	}
</script>

<script lang="ts">
	let { children, color, size, ...props }: IconProps = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	viewBox="0 0 24 24"
	fill="none"
	width={size}
	height={size}
	stroke={color}
	stroke-linecap="round"
	stroke-linejoin="round"
	{...props}
>
	{@render children?.()}
</svg>
