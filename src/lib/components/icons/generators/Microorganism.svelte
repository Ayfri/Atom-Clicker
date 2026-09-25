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
	<!-- Cell body -->
	<ellipse
		cx="11"
		cy="12"
		rx="7"
		ry="5.5"
		fill={color}
		opacity="0.2"
	></ellipse>
	<ellipse
		cx="11"
		cy="12"
		rx="7"
		ry="5.5"
	></ellipse>

	<!-- Nucleus -->
	<ellipse
		cx="9"
		cy="11"
		rx="2"
		ry="1.5"
		fill={color}
		opacity="0.5"
	></ellipse>
	<ellipse
		cx="9"
		cy="11"
		rx="2"
		ry="1.5"
	></ellipse>

	<!-- Organelles -->
	<circle
		cx="13"
		cy="10"
		r="0.8"
		fill={color}
		opacity="0.6"
	></circle>
	<circle
		cx="12.5"
		cy="14"
		r="0.6"
		fill={color}
		opacity="0.6"
	></circle>
	<circle
		cx="6"
		cy="13"
		r="0.5"
		fill={color}
		opacity="0.6"
	></circle>

	<!-- Flagellum / tail - longer like before -->
	<path
		d="M18 12 Q20 10 19.5 7 Q19 5 21 4"
		stroke-width="1.2"
	></path>
</svg>
