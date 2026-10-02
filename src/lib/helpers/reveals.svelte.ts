import { GENERATOR_TYPES, GENERATORS } from '#data/generators.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { cubicInOut, cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

const FIRST_GENERATOR_COST = GENERATORS[GENERATOR_TYPES[0]].cost.amount;

/**
 * Interface pieces that appear as the player progresses. Each one is derived from all-time stats, so it never hides
 * again after a prestige, and short-circuits on them so it stops tracking atoms once revealed.
 */
class Reveals {
	boughtUpgradesToggle = $derived(gameManager.totalUpgradesPurchasedAllTime > 0);
	generators = $derived(gameManager.totalGeneratorsPurchasedAllTime > 0 || gameManager.atoms >= FIRST_GENERATOR_COST / 2);
	leaderboard = $derived(gameManager.totalGeneratorsPurchasedAllTime >= 25 || gameManager.totalProtonisesAllTime > 0);
	production = $derived(gameManager.totalGeneratorsPurchasedAllTime > 0);
	purchaseModes = $derived(gameManager.totalGeneratorsPurchasedAllTime >= 10);
	upgrades = $derived(gameManager.totalGeneratorsPurchasedAllTime > 0 || gameManager.totalUpgradesPurchasedAllTime > 0);
	/** The first click already unlocks one, a wall of locked entries next to a bare atom would bury the Generators panel. */
	achievements = $derived(this.upgrades && gameManager.achievements.length > 0);

	/** Loading a save flips every reveal at once, animations only play for what appears after this moment. */
	#animateAfter = Infinity;

	arm(delayMs = 1000) {
		this.#animateAfter = performance.now() + delayMs;
	}

	get animating() {
		return performance.now() >= this.#animateAfter;
	}
}

export const reveals = new Reveals();

/**
 * Slides an element in and pulses an accent glow around it, so a panel or button appearing mid-game catches the eye.
 * @example <div in:reveal>...</div>
 */
export function reveal(_node: Element, { delay = 0, y = 16 }: { delay?: number; y?: number } = {}): TransitionConfig {
	if (!reveals.animating) return { duration: 0 };
	return {
		css: t => {
			const enter = cubicOut(Math.min(1, t / 0.35));
			const glow = Math.sin(Math.PI * t);
			return `opacity: ${enter}; transform: translateY(${(1 - enter) * y}px) scale(${0.94 + 0.06 * enter}); box-shadow: 0 0 ${28 * glow}px ${4 * glow}px color-mix(in srgb, var(--color-accent-400) ${70 * glow}%, transparent);`;
		},
		delay,
		duration: 1600,
	};
}

/**
 * Unfolds a panel along its flex container's direction so its neighbours glide aside, its content keeps its final width under the clip.
 * @example <aside in:unfold>...</aside>
 */
export function unfold(node: HTMLElement, { duration = 900 }: { duration?: number } = {}): TransitionConfig {
	if (!reveals.animating) return { duration: 0 };
	const parent = getComputedStyle(node.parentElement ?? node);
	const row = parent.flexDirection.startsWith('row');
	const [axis, edge] = row ? ['width', 'left'] : ['height', 'top'];
	const size = row ? node.offsetWidth : node.offsetHeight;
	const gap = parseFloat(row ? parent.columnGap : parent.rowGap) || 0;
	const content = node.firstElementChild;
	if (row && content instanceof HTMLElement) {
		content.style.width = `${content.offsetWidth}px`;
		node.addEventListener('introend', () => content.style.removeProperty('width'), { once: true });
	}
	return {
		css: t => `overflow: hidden; ${axis}: ${t * size}px; min-${axis}: 0; margin-${edge}: ${(t - 1) * gap}px; opacity: ${Math.min(1, t * 3)};`,
		duration,
		easing: cubicInOut,
	};
}
