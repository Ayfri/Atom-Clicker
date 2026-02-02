<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	interface Props extends SVGAttributes<SVGSVGElement> {
		color?: string;
		size?: number | string;
	}

	let { color = '#000000', size = 24, ...props }: Props = $props();
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
	<!-- Everything rotated together -->
	<g transform="rotate(35 12 12)">
		<!-- Vertical axis line -->
		<line
			x1="12"
			y1="1"
			x2="12"
			y2="23"
		></line>

		<!-- Left magnetic field loops (2 concentric ellipses) -->
		<ellipse
			cx="7"
			cy="12"
			rx="4.5"
			ry="8"
			fill="none"
			stroke-width="1"
			opacity="0.6"
		></ellipse>
		<ellipse
			cx="8"
			cy="12"
			rx="3"
			ry="5"
			fill="none"
			stroke-width="1"
			opacity="0.6"
		></ellipse>

		<!-- Right magnetic field loops (2 concentric ellipses) -->
		<ellipse
			cx="16.5"
			cy="12"
			rx="4.5"
			ry="8"
			fill="none"
			stroke-width="1"
			opacity="0.6"
		></ellipse>
		<ellipse
			cx="16"
			cy="12"
			rx="3"
			ry="5"
			fill="none"
			stroke-width="1"
			opacity="0.6"
		></ellipse>

		<!-- Central neutron star core -->
		<circle
			cx="12"
			cy="12"
			r="2.5"
			fill={color}
		></circle>
	</g>
</svg>
