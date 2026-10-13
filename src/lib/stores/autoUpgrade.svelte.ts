import { gameManager } from '#helpers/GameManager.svelte.js';
import { perfTracker } from '#helpers/perfTracker.js';
import { browser } from '$app/env';
import { SvelteSet } from 'svelte/reactivity';

class AutoUpgradeManager {
	recentlyAutoPurchased = new SvelteSet<string>();
	nextFireTime = $state<number | null>(null);

	purchaseAvailableUpgrades() {
		if (!gameManager.settings.automation.upgrades) return;

		const bought = gameManager.purchaseAffordableUpgrades();
		if (bought.length === 0) return;
		for (const id of bought) this.recentlyAutoPurchased.add(id);
		/** One timer per batch: its ids leave together, so a "+3" never counts down to "+1" on the way out. */
		setTimeout(() => {
			for (const id of bought) this.recentlyAutoPurchased.delete(id);
		}, 2000);
	}

	init() {
		if (!browser) return;
		/** `autoUpgradeInterval` is a derived number, so the timer only restarts when the period itself changes, not on every purchase. */
		$effect(() => {
			const interval = gameManager.autoUpgradeInterval;
			if (interval <= 0) {
				this.nextFireTime = null;
				return;
			}

			this.nextFireTime = Date.now() + interval;
			const timer = setInterval(() => {
				const start = performance.now();
				this.purchaseAvailableUpgrades();
				this.nextFireTime = Date.now() + interval;
				perfTracker.track('auto:upgrade', start);
			}, interval);
			return () => clearInterval(timer);
		});
	}
}

export const autoUpgradeManager = new AutoUpgradeManager();
