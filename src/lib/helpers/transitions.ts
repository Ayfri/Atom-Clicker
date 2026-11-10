import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

/**
 * Drop-in `fade`, `fly` and `scale` that read no style. The ones in `svelte/transition` call `getComputedStyle` when the intro starts,
 * which forces a full-page style recalc inside the mount flush. These assume the element rests at opacity 1 with no transform of its own.
 */

export function fade(_node: Element, { duration = 400 }: { duration?: number } = {}): TransitionConfig {
	return { css: t => `opacity: ${t}`, duration };
}

export function fly(_node: Element, { duration = 400, opacity = 0, y = 0 }: { duration?: number; opacity?: number; y?: number } = {}): TransitionConfig {
	return {
		css: (t, u) => `opacity: ${1 - (1 - opacity) * u}; transform: translateY(${y * u}px)`,
		duration,
		easing: cubicOut,
	};
}

export function scale(_node: Element, { duration = 400, start = 0 }: { duration?: number; start?: number } = {}): TransitionConfig {
	return {
		css: (t, u) => `opacity: ${t}; transform: scale(${1 - (1 - start) * u})`,
		duration,
		easing: cubicOut,
	};
}
