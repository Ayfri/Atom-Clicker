<script lang="ts">
	import { facetPoints } from '#helpers/photonCanvas.js';
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color: string;
		/** 3 for Red, 4 for Green, 6 for Blue, so the colors also read by shape. */
		facets: number;
		size?: number;
	}

	let { color, facets, size = 18, ...props }: Props = $props();

	const points = $derived(facetPoints(facets).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '));
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	viewBox="0 0 24 24"
	fill="none"
	width={size}
	height={size}
	stroke={color}
	stroke-linejoin="round"
	{...props}
>
	<circle cx="12" cy="12" r="10" fill={color} fill-opacity="0.14" stroke-width="1" />
	<polygon {points} fill={color} fill-opacity="0.25" stroke-width="1.75" />
</svg>
