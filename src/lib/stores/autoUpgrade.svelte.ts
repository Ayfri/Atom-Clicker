import { gameManager } from '$helpers/GameManager.svelte';
import { browser } from '$app/environment';
import { SvelteSet } from 'svelte/reactivity';

class AutoUpgradeManager {
	recentlyAutoPurchased = new SvelteSet<string>();
	nextFireTime = $state<number | null>(null);

	purchaseAvailableUpgrades() {
		if (!gameManager.settings.automation.upgrades) return;

		for (const id of gameManager.purchaseAffordableUpgrades()) {
			this.recentlyAutoPurchased.add(id);
			setTimeout(() => this.recentlyAutoPurchased.delete(id), 2000);
		}
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
				this.purchaseAvailableUpgrades();
				this.nextFireTime = Date.now() + interval;
			}, interval);
			return () => clearInterval(timer);
		});
	}
}

export const autoUpgradeManager = new AutoUpgradeManager();
