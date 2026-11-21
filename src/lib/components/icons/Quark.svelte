<script lang="ts">
	import { QUARK_CHARGE_COLORS } from '#data/quarks.js';
	import type { SvelteHTMLElements } from 'svelte/elements';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		/** Renders the whole icon in `color` instead of the fixed QCD triplet, for contexts that need a single-tone icon (e.g. the nav bar, next to plain lucide icons). */
		mono?: boolean;
		size?: number;
	}

	/**
	 * Unlike every other currency icon, `color` tints only the bonds (low-opacity white by default) and the three circles keep their
	 * QCD charge colors, so the tri-color identity survives. `mono` renders one color instead, `currentColor` unless `color` is set,
	 * so it follows the surrounding text color like a Lucide icon.
	 */
	let { color, mono = false, size = 48, ...props }: Props = $props();
	const fillColor = $derived(color ?? (mono ? 'currentColor' : undefined));
	const bondColor = $derived(mono ? fillColor : (color ?? 'rgba(255, 255, 255, 0.4)'));
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	viewBox="0 0 24 24"
	fill="none"
	width={size}
	height={size}
	stroke-linecap="round"
	stroke-linejoin="round"
	{...props}
>
	<!-- Bonds stop at radius + 0.4 from each circle's center, so they bridge the gap instead of drawing a triangle under the circles. -->
	<g stroke={bondColor} stroke-width="1.5">
		<line x1="10.29" y1="8.17" x2="7.21" y2="13.83" />
		<line x1="13.71" y1="8.17" x2="16.79" y2="13.83" />
		<line x1="9.1" y1="17" x2="14.9" y2="17" />
	</g>

	<!-- Outlined circles, not flat dots, to match the Lucide icons around it. -->
	<circle cx="12" cy="5" r="3.2" stroke={mono ? fillColor : QUARK_CHARGE_COLORS.blue} stroke-width="2" />
	<circle cx="5.5" cy="17" r="3.2" stroke={mono ? fillColor : QUARK_CHARGE_COLORS.green} stroke-width="2" />
	<circle cx="18.5" cy="17" r="3.2" stroke={mono ? fillColor : QUARK_CHARGE_COLORS.red} stroke-width="2" />
</svg>
