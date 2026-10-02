<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { CURRENCIES } from '#lib/data/currencies.js';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = CURRENCIES['Electrons'].color, size = 18, ...props }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 19 19"
	fill="none"
	width={size}
	height={size}
	stroke={color}
	stroke-linecap="round"
	stroke-linejoin="round"
	{...props}
>
	<circle cx="9.5" cy="9.5" r="9" fill={color} fill-opacity=".1" stroke-width="1"/>

	<path stroke-width="2.5" d="M5.5 9.5h8"/>

	<path stroke-width=".5" d="m12.866 2.446-1.5 1.5h2l-1.5 1.5M10.63 12.71l-1.5 1.5h2l-1.5 1.5M3.64 6.321l-1.5 1.5h2l-1.5 1.5" opacity=".4"/>
</svg>
