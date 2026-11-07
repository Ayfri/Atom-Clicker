<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		size?: number;
	}

	let { color = '#cfe8ff', size = 18, ...props }: Props = $props();
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
	<circle cx="12" cy="12" r="10" fill={color} fill-opacity="0.12" stroke-width="1" />
	<path d="M12 3.5 13.6 10.4 20.5 12 13.6 13.6 12 20.5 10.4 13.6 3.5 12 10.4 10.4Z" fill={color} stroke="none" />
	<circle cx="18" cy="6" r="1" fill={color} fill-opacity="0.7" stroke="none" />
</svg>
