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
	<!-- Hexagonal lattice structure -->
	<g opacity="0.4">
		<polygon
			points="12,3 17,6 17,12 12,15 7,12 7,6"
			fill={color}
		></polygon>
		<polygon
			points="12,9 17,12 17,18 12,21 7,18 7,12"
			fill={color}
		></polygon>
	</g>

	<!-- Top hexagon outline -->
	<polygon points="12,3 17,6 17,12 12,15 7,12 7,6"></polygon>

	<!-- Bottom hexagon outline -->
	<polygon points="12,9 17,12 17,18 12,21 7,18 7,12"></polygon>

	<!-- Connection nodes -->
	<circle
		cx="12"
		cy="3"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="17"
		cy="6"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="7"
		cy="6"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="12"
		cy="9"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="17"
		cy="12"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="7"
		cy="12"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="12"
		cy="15"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="17"
		cy="18"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="7"
		cy="18"
		r="1"
		fill={color}
	></circle>
	<circle
		cx="12"
		cy="21"
		r="1"
		fill={color}
	></circle>
</svg>
