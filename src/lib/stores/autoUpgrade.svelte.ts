import { gameManager } from '$helpers/GameManager.svelte';
import { UPGRADES } from '$data/upgrades';
import { browser } from '$app/environment';
import { SvelteSet } from 'svelte/reactivity';

class AutoUpgradeManager {
	recentlyAutoPurchased = new SvelteSet<string>();
	nextFireTime = $state<number | null>(null);

	purchaseAvailableUpgrades() {
		if (!gameManager.settings.automation.upgrades) return;

		const availableUpgrades = Object.values(UPGRADES)
			.filter((upgrade) => {
				const meetsCondition = upgrade.condition?.(gameManager) ?? true;
				const notPurchased = !gameManager.upgrades.includes(upgrade.id);
				return meetsCondition && notPurchased;
			})
			.sort((a, b) => a.cost.amount - b.cost.amount);

		for (const upgrade of availableUpgrades) {
			if (!gameManager.canAfford(upgrade.cost)) continue;

			gameManager.purchaseUpgrade(upgrade.id);

			// Add visual feedback
			this.recentlyAutoPurchased.add(upgrade.id);
			setTimeout(() => {
				this.recentlyAutoPurchased.delete(upgrade.id);
			}, 2000);
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
