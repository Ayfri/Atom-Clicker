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
	<circle cx="12" cy="16" r="3" fill={color} stroke="none" />
	<circle cx="12" cy="16" r="6" stroke-width="1.5" stroke-dasharray="3 2.3" opacity=".7" />
	<path stroke-width="2.2" d="m7.5 6.2 4.5-4.2 4.5 4.2" />
	<path stroke-width="1.8" d="m9 9.4 3-2.8 3 2.8" opacity=".75" />
</svg>
