<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { CURRENCIES } from '#lib/data/currencies.js';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = CURRENCIES['Protons'].color, size = 18, ...props }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	width={size}
	height={size}
	stroke={color}
	stroke-linecap="round"
	stroke-linejoin="round"
	{...props}
>
	<circle cx="12" cy="12" r="10" fill={color} fill-opacity="0.1" stroke-width="1" />

	<path d="M12 7V17M7 12H17" stroke-width="2" />

	<g
    fill={color}
    stroke="none"
    opacity="0.4"
	filter="blur(1px)"
    transform="rotate(22.5, 12, 12)"
  >
    <circle cx="12" cy="8" r="2" />
    <circle cx="7.5" cy="16" r="2" />
    <circle cx="16.5" cy="16" r="2" />
  </g>
</svg>
