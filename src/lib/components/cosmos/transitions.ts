import { quartOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import type { TransitionConfig } from 'svelte/transition';

interface LookUpOptions {
	duration?: number;
	easing?: (t: number) => number;
	/** Share of the frame height a layer moves back against the frame for depth, 0 for the frame itself. */
	lag?: number;
}

interface HorizonOptions {
	duration?: number;
	easing?: (t: number) => number;
}

/** The lower edge fades out through a mask while it slides, a gradient hung under it would show a seam against the lit horizon. */
export function lookUp(_node: Element, { duration = 950, easing = quartOut, lag = 0 }: LookUpOptions = {}): TransitionConfig {
	if (prefersReducedMotion.current) return lag ? { duration: 0 } : { css: t => `opacity: ${t}`, duration: 200 };
	if (lag) return { css: t => `transform: translateY(${(1 - t) * lag * 100}%)`, duration, easing };
	return {
		css: t => `transform: translateY(${(t - 1) * 100}%); mask-image: linear-gradient(to bottom, #000 calc(100% - 9rem), transparent)`,
		duration,
		easing,
	};
}

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
