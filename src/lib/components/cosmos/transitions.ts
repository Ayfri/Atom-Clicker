import { quartOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import type { TransitionConfig } from 'svelte/transition';

interface LookUpOptions {
	duration?: number;
	easing?: (t: number) => number;
	/** Share of the frame height a layer moves back against the frame, 0 for the frame itself. */
	lag?: number;
}

interface HorizonOptions {
	duration?: number;
	easing?: (t: number) => number;
}

/**
 * The sky drops in from above like a look up, `lag` moves a layer back against it for depth. The frame's lower edge fades out while it
 * slides, a gradient hung under it would show a seam against the lit horizon. The mask only lives during the transition.
 */
export function lookUp(_node: Element, { duration = 950, easing = quartOut, lag = 0 }: LookUpOptions = {}): TransitionConfig {
	if (prefersReducedMotion.current) return lag ? { duration: 0 } : { css: t => `opacity: ${t}`, duration: 200 };
	if (lag) return { css: t => `transform: translateY(${(1 - t) * lag * 100}%)`, duration, easing };
	return {
		css: t => `transform: translateY(${(t - 1) * 100}%); mask-image: linear-gradient(to bottom, #000 calc(100% - 9rem), transparent)`,
		duration,
		easing,
	};
}

/** The lit atmosphere at the bottom edge of the sky, bright as the view leaves the ground, gone once it settles. */
export function horizon(_node: Element, { duration = 950, easing = quartOut }: HorizonOptions = {}): TransitionConfig {
	if (prefersReducedMotion.current) return { duration: 0 };
	return { css: t => `visibility: visible; opacity: ${1 - t}`, duration, easing };
}

export function rateFlash(_node: Element): TransitionConfig {
	if (prefersReducedMotion.current) return { duration: 0 };
	return {
		css: t => `display: inline-block; transform: scale(${1 + 0.15 * (1 - t)}); color: color-mix(in srgb, var(--color-cosmos-signal) ${(1 - t) * 100}%, rgb(255 255 255 / 0.5))`,
		duration: 700,
	};
}
