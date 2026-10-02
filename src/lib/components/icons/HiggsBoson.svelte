<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = '#fbbf24', size = 48, ...props }: Props = $props();
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
	<circle cx="12" cy="12" r="4" fill={color} stroke-width="1" />

	<circle cx="12" cy="12" r="7" stroke-dasharray="3.65" stroke-dashoffset="1.8" stroke-width="1.5" opacity=".8" />
	<circle cx="12" cy="12" r="10" stroke-dasharray="3.92" stroke-dashoffset="5.8" opacity=".5" />
	<path stroke-width="2" d="M12 2v1m0 18v1M2 12h1m18 0h1" opacity=".5" />
</svg>
