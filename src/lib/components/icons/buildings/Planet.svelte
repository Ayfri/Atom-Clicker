<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	interface Props extends SVGAttributes<SVGSVGElement> {
		color?: string;
		size?: number | string;
	}

	let { color = '#4a90e2', size = 24, ...props }: Props = $props();
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
	<circle
		cx="12"
		cy="12"
		r="6"
		fill={color}
		fill-opacity="0.2"
	></circle>

	<path
		d="M19.02 9.40C21.04 9.40 22.46 9.68 22.83 10.24C23.59 11.40 19.58 13.33 13.85 14.55C8.13 15.77 2.88 15.82 2.11 14.66C1.71 14.05 2.64 13.23 4.45 12.40"
		opacity="0.5"
	></path>
</svg>
