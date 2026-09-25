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
	{...props}
>
	<!-- Outer accretion disk glow -->
	<ellipse
		cx="12"
		cy="12"
		rx="11.5"
		ry="3.5"
		fill={color}
		opacity="0.1"
	></ellipse>
	<ellipse
		cx="12"
		cy="12"
		rx="10"
		ry="2.8"
		fill={color}
		opacity="0.15"
	></ellipse>
	<ellipse
		cx="12"
		cy="12"
		rx="8.5"
		ry="2.2"
		fill={color}
		opacity="0.25"
	></ellipse>

	<!-- Gravitational lensing arc (top) -->
	<path
		d="M5 12 Q8 5 12 5 Q16 5 19 12"
		fill={color}
		opacity="0.12"
	></path>
	<path
		d="M6.5 12 Q9 6 12 6 Q15 6 17.5 12"
		fill={color}
		opacity="0.2"
	></path>
	<path
		d="M7.5 12 Q10 7 12 7 Q14 7 16.5 12"
		fill={color}
		opacity="0.3"
	></path>

	<!-- Event horizon -->
	<circle
		cx="12"
		cy="12"
		r="4"
		fill="black"
	></circle>
	<circle
		cx="12"
		cy="12"
		r="4"
		stroke={color}
		stroke-width="1"
		opacity="0.7"
	></circle>

	<!-- Inner dense disk -->
	<ellipse
		cx="12"
		cy="12"
		rx="7"
		ry="1.5"
		fill={color}
		opacity="0.5"
	></ellipse>
	<ellipse
		cx="12"
		cy="12.3"
		rx="9"
		ry="2.5"
		fill={color}
		opacity="0.3"
	></ellipse>
</svg>
