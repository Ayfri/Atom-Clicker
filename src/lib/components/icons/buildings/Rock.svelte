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
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	{...props}
>
	<path
		d="M21 12.6 L18.4 20 L9.3 21 L3 15 L4.5 7 L12.6 3.5 L20 6.4 Z"
		fill={color}
		fill-opacity="0.2"
	></path>

	<path
		d="M12.6 3.5 L12 12 L3 15"
		opacity="0.5"
	></path>
	<path
		d="M12 12 L21 12.6"
		opacity="0.5"
	></path>
	<path
		d="M12 12 L18.4 20"
		opacity="0.5"
	></path>
</svg>
