<script lang="ts">
	import { CURRENCIES } from '#lib/data/currencies.js';
	import SvgIcon, { type IconProps } from './SvgIcon.svelte';

	let { color = CURRENCIES['Protons'].color, size = 18, ...props }: IconProps = $props();
</script>

<SvgIcon {color} {size} {...props}>
	<circle cx="12" cy="12" r="10" fill={color} fill-opacity="0.1" stroke-width="1" />

	<path d="M12 7V17M7 12H17" stroke-width="2" />

	<g fill={color} stroke="none" opacity="0.4" filter="blur(1px)" transform="rotate(22.5, 12, 12)">
		<circle cx="12" cy="8" r="2" />
		<circle cx="7.5" cy="16" r="2" />
		<circle cx="16.5" cy="16" r="2" />
	</g>
</SvgIcon>
