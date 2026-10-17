<script lang="ts">
	interface Props {
		/** Blur radius in px of the disc the glow spreads like. */
		blur: number;
		/** Positions a `diameter` px box, the glow is centered on it. */
		class: string;
		color: string;
		diameter: number;
		opacity: number;
	}

	let { blur, class: className, color, diameter, opacity }: Props = $props();

	/** A big `filter: blur()` re-rasterizes on every WebKit repaint and freezes iOS Safari, this gradient spreads the same: σ' = √(σ² + r²/4). */
	const glow = $derived.by(() => {
		const radius = diameter / 2;
		const half = Math.round(3 * Math.sqrt(blur ** 2 + radius ** 2 / 4));
		const peak = opacity * (1 - Math.exp(-(radius ** 2) / (2 * blur ** 2)));
		const stops = Array.from({ length: 7 }, (_, i) => `color-mix(in oklab, ${color} ${(peak * Math.exp(-((i / 2) ** 2) / 2) * 100).toFixed(2)}%, transparent) ${((i / 6) * 100).toFixed(1)}%`);
		return { background: `radial-gradient(closest-side, ${stops.join(', ')})`, half };
	});
</script>

<div class={['absolute', className]} style:height="{diameter}px" style:width="{diameter}px">
	<div class="absolute left-1/2 top-1/2" style:background={glow.background} style:height="{glow.half * 2}px" style:margin="-{glow.half}px 0 0 -{glow.half}px" style:width="{glow.half * 2}px"></div>
</div>
