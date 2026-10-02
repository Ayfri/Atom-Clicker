import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';

/** Both photon icons are authored in a 24x24 viewBox, see Photon.svelte / ExcitedPhoton.svelte. */
const ICON_VIEWBOX = 24;
const PULSE_DURATION = 2000;

/** Client center of the photon field, photon and prism purchases aim their background comets at it. */
export function photonFieldCenter() {
	const rect = document.querySelector('[data-photon-realm]')?.getBoundingClientRect();
	return rect && { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Tailwind's `animate-pulse` timing function: cubic-bezier(0.4, 0, 0.6, 1). */
function pulseEase(progress: number): number {
	const x1 = 0.4;
	const x2 = 0.6;
	const bezier = (t: number, a: number, b: number) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;

	// Newton-Raphson on x(t) = progress, the curve is monotonic so a few iterations are plenty.
	let t = progress;
	for (let i = 0; i < 5; i++) {
		const x = bezier(t, x1, x2);
		const slope = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
		if (Math.abs(slope) < 1e-6) break;
		t -= (x - progress) / slope;
	}

	return bezier(Math.min(Math.max(t, 0), 1), 0, 1);
}

/** Opacity of Tailwind's `animate-pulse` (1 -> 0.5 -> 1 over 2s) at a given age. */
export function pulseOpacity(elapsedMs: number): number {
	const progress = (elapsedMs % PULSE_DURATION) / PULSE_DURATION;
	return progress < 0.5 ? 1 - 0.5 * pulseEase(progress * 2) : 0.5 + 0.5 * pulseEase(progress * 2 - 1);
}

/** Corners of the facet inside a Light glyph, in the 24x24 icon space with a point facing up. */
export function facetPoints(facets: number, radius = 5.5): [number, number][] {
	return Array.from({ length: facets }, (_, i) => {
		const angle = -Math.PI / 2 + (i * Math.PI * 2) / facets;
		return [12 + Math.cos(angle) * radius, 12 + Math.sin(angle) * radius];
	});
}

/** Draws a Light glyph centered on the current origin, matching `@components/icons/Light.svelte`. */
export function drawLightIcon(ctx: CanvasRenderingContext2D, color: string, facets: number, size: number, alpha: number) {
	ctx.save();
	ctx.scale(size / ICON_VIEWBOX, size / ICON_VIEWBOX);
	ctx.translate(-ICON_VIEWBOX / 2, -ICON_VIEWBOX / 2);
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	ctx.lineJoin = 'round';

	ctx.beginPath();
	ctx.arc(12, 12, 10, 0, Math.PI * 2);
	ctx.globalAlpha = alpha * 0.14;
	ctx.fill();
	ctx.globalAlpha = alpha;
	ctx.lineWidth = 1;
	ctx.stroke();

	ctx.beginPath();
	for (const [x, y] of facetPoints(facets)) ctx.lineTo(x, y);
	ctx.closePath();
	ctx.globalAlpha = alpha * 0.25;
	ctx.fill();
	ctx.globalAlpha = alpha;
	ctx.lineWidth = 1.75;
	ctx.stroke();

	ctx.restore();
}

/**
 * Draws a photon icon centered on the current origin, matching the SVG markup of
 * `@components/icons/Photon.svelte` and `@components/icons/ExcitedPhoton.svelte`.
 */
export function drawPhotonIcon(ctx: CanvasRenderingContext2D, excited: boolean, size: number, alpha: number) {
	const color = excited ? CURRENCIES[CurrenciesTypes.EXCITED_PHOTONS].color : CURRENCIES[CurrenciesTypes.PHOTONS].color;

	ctx.save();
	ctx.scale(size / ICON_VIEWBOX, size / ICON_VIEWBOX);
	ctx.translate(-ICON_VIEWBOX / 2, -ICON_VIEWBOX / 2);
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	// Outer disc: fill-opacity 0.1 plus a 1px stroke.
	ctx.beginPath();
	ctx.arc(12, 12, 10, 0, Math.PI * 2);
	ctx.globalAlpha = alpha * 0.1;
	ctx.fill();
	ctx.globalAlpha = alpha;
	ctx.lineWidth = 1;
	ctx.stroke();

	if (excited) {
		// Core dot, then the two crossing waves.
		ctx.globalAlpha = alpha * 0.3;
		ctx.beginPath();
		ctx.arc(12, 12, 2, 0, Math.PI * 2);
		ctx.fill();

		ctx.globalAlpha = alpha;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(4, 9);
		ctx.bezierCurveTo(7, 9, 9, 15, 12, 15);
		ctx.bezierCurveTo(15, 15, 17, 9, 20, 9);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(4, 15);
		ctx.bezierCurveTo(7, 15, 9, 9, 12, 9);
		ctx.bezierCurveTo(15, 9, 17, 15, 20, 15);
		ctx.stroke();
	} else {
		// Single wave, then the core dot.
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(3, 12);
		ctx.bezierCurveTo(3, 12, 5, 9, 7.5, 9);
		ctx.bezierCurveTo(10, 9, 12, 15, 14.5, 15);
		ctx.bezierCurveTo(17, 15, 19, 12, 21, 12);
		ctx.stroke();

		ctx.globalAlpha = alpha * 0.3;
		ctx.beginPath();
		ctx.arc(12, 12, 2, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.restore();
}
