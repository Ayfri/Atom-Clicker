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
	<!-- Central atom -->
	<circle
		cx="12"
		cy="12"
		r="3"
		fill={color}
		opacity="0.3"
	></circle>
	<circle
		cx="12"
		cy="12"
		r="3"
	></circle>

	<!-- Outer atoms -->
	<circle
		cx="5"
		cy="8"
		r="2"
		fill={color}
		opacity="0.3"
	></circle>
	<circle
		cx="5"
		cy="8"
		r="2"
	></circle>

	<circle
		cx="19"
		cy="8"
		r="2"
		fill={color}
		opacity="0.3"
	></circle>
	<circle
		cx="19"
		cy="8"
		r="2"
	></circle>

	<circle
		cx="12"
		cy="20"
		r="2"
		fill={color}
		opacity="0.3"
	></circle>
	<circle
		cx="12"
		cy="20"
		r="2"
	></circle>

	<!-- Bonds -->
	<line
		x1="9"
		y1="10.5"
		x2="6.8"
		y2="9.2"
	></line>
	<line
		x1="15"
		y1="10.5"
		x2="17.2"
		y2="9.2"
	></line>
	<line
		x1="12"
		y1="15"
		x2="12"
		y2="18"
	></line>
</svg>
