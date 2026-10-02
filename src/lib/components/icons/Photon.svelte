<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { CURRENCIES } from '#lib/data/currencies.js';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = CURRENCIES['Photons'].color, size = 18, ...props }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
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

	<path d="M3 12C3 12 5 9 7.5 9C10 9 12 15 14.5 15C17 15 19 12 21 12" stroke-width="2" />

	<circle cx="12" cy="12" r="2" fill={color} stroke="none" opacity="0.3" />
</svg>
