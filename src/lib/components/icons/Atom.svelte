<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { CURRENCIES } from '#data/currencies.js';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = CURRENCIES['Atoms'].color, size = 18, ...props }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	viewBox="0 0 24 24"
	fill="none"
	width={size}
	height={size}
	stroke={color}
	stroke-width="1"
	stroke-linecap="round"
	stroke-linejoin="round"
	{...props}
>
	<circle cx="12" cy="12" r="1.5" fill={color} />

	<g opacity="0.8">
		<ellipse cx="12" cy="12" rx="10" ry="4" />
		<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
		<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
	</g>
	<g fill={color}>
		<circle cx="2" cy="12" r="0.8" />
		<circle cx="13" cy="6.5" r="0.8" />
		<circle cx="10" cy="20" r="1" />
	</g>
</svg>
