<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number | string;
	}

	let { color = '#4a90e2', size = 24, ...props }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
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
	<g transform="rotate(35 12 12)">
		<!-- Axis -->
		<line x1="12" y1="1" x2="12" y2="23"></line>

		<!-- Magnetic field loops -->
		<g stroke-width="1" opacity="0.6">
			<ellipse cx="7" cy="12" rx="4.5" ry="8"></ellipse>
			<ellipse cx="8" cy="12" rx="3" ry="5"></ellipse>
			<ellipse cx="16.5" cy="12" rx="4.5" ry="8"></ellipse>
			<ellipse cx="16" cy="12" rx="3" ry="5"></ellipse>
		</g>

		<!-- Core -->
		<circle cx="12" cy="12" r="2.5" fill={color}></circle>
	</g>
</svg>
