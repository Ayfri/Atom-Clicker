<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = 'currentColor', size = 24, ...props }: Props = $props();
</script>

<!-- A "−" electron breaks out through the gap of its orbit. -->
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
	stroke-width="2"
	{...props}
>
	<path d="M10 7a7 7 0 1 0 7 7" />
	<circle cx="10" cy="14" r="2" fill={color} stroke="none" />
	<circle cx="18" cy="6" r="3.5" fill={color} fill-opacity="0.15" />
	<path d="M16.5 6h3" />
</svg>
