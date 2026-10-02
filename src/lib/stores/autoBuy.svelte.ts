import { gameManager } from '#helpers/GameManager.svelte.js';
import type { GeneratorType } from '#data/generators.js';
import { browser } from '$app/env';
import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

/** Auto-buy periods are 1s at best, so a quarter-second check keeps every purchase within 250ms of its schedule. */
const CHECK_INTERVAL_MS = 250;

class AutoBuyManager {
	recentlyAutoPurchasedGenerators = new SvelteMap<GeneratorType, number>();
	nextFireTimes = new SvelteMap<GeneratorType, number>();

	purchaseGenerator(type: GeneratorType) {
		if (!gameManager.purchaseGenerator(type, 1)) return;

		this.recentlyAutoPurchasedGenerators.set(type, (this.recentlyAutoPurchasedGenerators.get(type) ?? 0) + 1);
		setTimeout(() => {
			const current = this.recentlyAutoPurchasedGenerators.get(type) ?? 0;
			if (current <= 1) this.recentlyAutoPurchasedGenerators.delete(type);
			else this.recentlyAutoPurchasedGenerators.set(type, current - 1);
		}, 2000);
	}

	/**
	 * Schedules live in `nextFireTimes` instead of one `setInterval` per generator: every upgrade purchase rebuilds the
	 * interval map, and restarting the timers on each rebuild pushed pending auto-buys back for as long as upgrades kept coming.
	 */
	private check() {
		const now = Date.now();
		const intervals = gameManager.autoBuyIntervals;

		for (const type of this.nextFireTimes.keys()) {
			if (!(type in intervals)) this.nextFireTimes.delete(type);
		}

		for (const [type, interval] of Object.entries(intervals) as [GeneratorType, number][]) {
			const next = this.nextFireTimes.get(type);
			if (next === undefined) {
				this.nextFireTimes.set(type, now + interval);
			} else if (now >= next) {
				this.purchaseGenerator(type);
				this.nextFireTimes.set(type, Math.max(next + interval, now));
			}
		}
	}

	init() {
		if (!browser) return;
		$effect(() => {
			if (Object.keys(gameManager.autoBuyIntervals).length === 0) {
				untrack(() => this.nextFireTimes.clear());
				return;
			}
			untrack(() => this.check());
			const timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
			return () => clearInterval(timer);
		});
	}
}

export const autoBuyManager = new AutoBuyManager();
