<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { QUARK_CHARGE_COLORS } from '#data/quarks.js';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		/** Renders the whole icon in `color` instead of the fixed QCD triplet, for contexts that need a single-tone icon (e.g. the nav bar, next to plain lucide icons). */
		mono?: boolean;
		size?: number;
	}

	// Unlike every other currency icon, `color` does NOT tint the whole icon by default: the
	// three circles are fixed to their QCD charge colours, and `color` only tints the bonds
	// (defaulting to a low-opacity white). This keeps the tri-colour identity intact while
	// still honouring the `color` prop signature every other icon exposes. Pass `mono` to
	// opt into a single-colour rendering instead, defaulting to `currentColor` so it behaves
	// like every lucide icon (dims/highlights with the surrounding text colour) unless overridden.
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
	<!-- Bonds stop short of the vertices (a gap of radius + 0.4 from each circle's centre) so they only
	     bridge the space between circles instead of drawing a complete triangle underneath them. -->
	<g stroke={bondColor} stroke-width="1.5">
		<line x1="10.29" y1="8.17" x2="7.21" y2="13.83" />
		<line x1="13.71" y1="8.17" x2="16.79" y2="13.83" />
		<line x1="9.1" y1="17" x2="14.9" y2="17" />
	</g>

	<!-- Vertex circles are outlined (Lucide's "Circle" style: stroke only, no fill) rather than flat dots, to match the app's icon language. -->
	<circle cx="12" cy="5" r="3.2" stroke={mono ? fillColor : QUARK_CHARGE_COLORS.blue} stroke-width="2" />
	<circle cx="5.5" cy="17" r="3.2" stroke={mono ? fillColor : QUARK_CHARGE_COLORS.green} stroke-width="2" />
	<circle cx="18.5" cy="17" r="3.2" stroke={mono ? fillColor : QUARK_CHARGE_COLORS.red} stroke-width="2" />
</svg>
