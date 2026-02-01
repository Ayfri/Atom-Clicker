<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = '#4a90e2', size = 18, ...props }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	width={size}
	height={size}
	stroke={color}
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	{...props}
>
	<!-- Diamond/gem shape crystal -->
	<path
		d="M12 2 L19 9 L12 22 L5 9 Z"
		fill={color}
		opacity="0.2"
	></path>
	<path d="M12 2 L19 9 L12 22 L5 9 Z"></path>

	<!-- Top facet -->
	<path
		d="M5 9 L12 6 L19 9"
		opacity="0.7"
	></path>

	<!-- Center line -->
	<line
		x1="12"
		y1="6"
		x2="12"
		y2="22"
		opacity="0.5"
	></line>
</svg>
