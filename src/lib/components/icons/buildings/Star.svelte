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
	<!-- Star body -->
	<circle
		cx="12"
		cy="12"
		r="5"
		fill={color}
		opacity="0.4"
	></circle>
	<circle
		cx="12"
		cy="12"
		r="5"
	></circle>

	<!-- Bright core -->
	<circle
		cx="12"
		cy="12"
		r="2"
		fill={color}
		opacity="0.8"
	></circle>

	<!-- Star rays - 8 pointed -->
	<line
		x1="12"
		y1="2"
		x2="12"
		y2="6"
	></line>
	<line
		x1="12"
		y1="18"
		x2="12"
		y2="22"
	></line>
	<line
		x1="2"
		y1="12"
		x2="6"
		y2="12"
	></line>
	<line
		x1="18"
		y1="12"
		x2="22"
		y2="12"
	></line>

	<!-- Diagonal rays (shorter) -->
	<line
		x1="5"
		y1="5"
		x2="7.5"
		y2="7.5"
		opacity="0.7"
	></line>
	<line
		x1="16.5"
		y1="16.5"
		x2="19"
		y2="19"
		opacity="0.7"
	></line>
	<line
		x1="19"
		y1="5"
		x2="16.5"
		y2="7.5"
		opacity="0.7"
	></line>
	<line
		x1="5"
		y1="19"
		x2="7.5"
		y2="16.5"
		opacity="0.7"
	></line>
</svg>
