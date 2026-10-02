<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = 'currentColor', size = 24, ...props }: Props = $props();
</script>

<!-- The atom collapses inward into a proton, the "+" nucleus. -->
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
	<path d="M6.5 2.5v4h-4M17.5 2.5v4h4M6.5 21.5v-4h-4M17.5 21.5v-4h4" />
	<circle cx="12" cy="12" r="5" fill={color} fill-opacity="0.15" />
	<path d="M12 9.5v5M9.5 12h5" />
</svg>
