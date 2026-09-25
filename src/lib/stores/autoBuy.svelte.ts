import { gameManager } from '$helpers/GameManager.svelte';
import { getUpgradesWithEffects } from '$helpers/effects';
import type { GeneratorType } from '$data/generators';
import { browser } from '$app/environment';
import { SvelteMap } from 'svelte/reactivity';

class AutoBuyManager {
	recentlyAutoPurchasedGenerators = new SvelteMap<GeneratorType, number>();
	nextFireTimes = new SvelteMap<GeneratorType, number>();
	private timers: Record<string, ReturnType<typeof setInterval>> = {};

	get autoBuyIntervals() {
		const autoBuyUpgrades = getUpgradesWithEffects(gameManager.currentUpgradesBought, { type: 'auto_buy' });
		const intervals: Partial<Record<GeneratorType, number>> = {};

		autoBuyUpgrades.forEach((upgrade) => {
			if (!upgrade.effects) return;

			upgrade.effects.forEach((effect) => {
				if (effect.type === 'auto_buy' && effect.target) {
					const generatorType = effect.target;
					// Only set up interval if automation is enabled for this generator
					if (gameManager.settings.automation.generators.includes(generatorType)) {
						intervals[generatorType] = effect.apply(intervals[generatorType] || 30000, gameManager);
					}
				}
			});
		});

		return intervals;
	}

	purchaseGenerator(type: GeneratorType) {
		try {
			const success = gameManager.purchaseGenerator(type, 1);

			if (success) {
				// Add visual feedback
				const current = this.recentlyAutoPurchasedGenerators.get(type) || 0;
				this.recentlyAutoPurchasedGenerators.set(type, current + 1);

				setTimeout(() => {
					const current = this.recentlyAutoPurchasedGenerators.get(type) || 0;
					if (current <= 1) {
						this.recentlyAutoPurchasedGenerators.delete(type);
					} else {
						this.recentlyAutoPurchasedGenerators.set(type, current - 1);
					}
				}, 2000);
			}
			return success;
		} catch (error) {
			return false;
		}
	}

	init() {
		if (browser) {
			$effect(() => {
				const intervals = this.autoBuyIntervals;

				// Clear existing timers
				Object.values(this.timers).forEach(clearInterval);
				this.timers = {};
				this.nextFireTimes.clear();

				Object.entries(intervals).forEach(([generatorType, interval]) => {
					const type = generatorType as GeneratorType;
					this.nextFireTimes.set(type, Date.now() + interval);
					this.timers[generatorType] = setInterval(() => {
						this.purchaseGenerator(type);
						this.nextFireTimes.set(type, Date.now() + interval);
					}, interval);
				});

				return () => {
					Object.values(this.timers).forEach(clearInterval);
				};
			});
		}
	}
}

export const autoBuyManager = new AutoBuyManager();
