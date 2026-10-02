<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = '#f5f7ff', size = 18, ...props }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	viewBox="0 0 24 24"
	fill="none"
	width={size}
	height={size}
	stroke={color}
	{...props}
>
	<circle cx="12" cy="12" r="10" fill={color} fill-opacity="0.14" stroke-width="1" />
	<circle cx="12" cy="6.5" r="2" fill="#ff4d5e" stroke="none" />
	<circle cx="16.76" cy="14.75" r="2" fill="#2ee6a0" stroke="none" />
	<circle cx="7.24" cy="14.75" r="2" fill="#4d8dff" stroke="none" />
	<circle cx="12" cy="12" r="2.5" fill={color} stroke="none" />
</svg>
