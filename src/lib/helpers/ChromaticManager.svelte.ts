import {
	CHROMATIC,
	CHROMATIC_AUTO_DAMAGE,
	CHROMATIC_BASE_SPAWN_INTERVAL,
	CHROMATIC_UPGRADES,
	type ChromaticColor,
	type ChromaticUpgrade,
	getChromaticUpgradeCost,
	KILLS_PER_SPECTRUM_LEVEL,
	SPECTRUM_DROP_GROWTH,
	SPECTRUM_HP_GROWTH,
} from '$data/chromatic';
import type { ChromaticBreak } from '$helpers/chromaticField';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import type { ChromaticState } from '$lib/types';

const EMPTY_KILLS: Record<ChromaticColor, number> = { blue: 0, green: 0, red: 0 };

/** Colored photons of the Photon Realm: breaks per color and Prism upgrade levels, all kept through every prestige. */
class ChromaticManager {
	kills = $state.raw<Record<ChromaticColor, number>>({ ...EMPTY_KILLS });
	upgradeLevels = $state.raw<Record<string, number>>({});

	/** Chance that collecting an Excited Photon releases a colored photon where it was. */
	excitationChance = $derived(0.01 * this.level('prism_excitation'));
	lifetimeBonus = $derived(1000 * this.level('prism_persistence'));
	spawnInterval = $derived(CHROMATIC_BASE_SPAWN_INTERVAL * 0.92 ** this.level('prism_frequency'));

	level(upgradeId: string): number {
		return this.upgradeLevels[upgradeId] ?? 0;
	}

	spectrumLevel(color: ChromaticColor): number {
		return Math.floor(this.kills[color] / KILLS_PER_SPECTRUM_LEVEL);
	}

	maxHp(color: ChromaticColor): number {
		return CHROMATIC[color].hp * SPECTRUM_HP_GROWTH ** this.spectrumLevel(color);
	}

	tapDamage(color: ChromaticColor, auto: boolean): number {
		const damage = 1 + this.level(`${color}_focus`);
		return auto ? damage * (CHROMATIC_AUTO_DAMAGE + 0.15 * this.level('prism_autofocus')) : damage;
	}

	/** Light for one break at a given base drop, every Ionize adds half of the base on top. */
	lightFor(color: ChromaticColor, drop: number, ionizes: number): number {
		return drop * SPECTRUM_DROP_GROWTH ** this.spectrumLevel(color) * (1 + 0.25 * this.level(`${color}_yield`)) * (1 + 0.5 * ionizes);
	}

	/** Pays the Light of one break and counts it toward the color's spectrum level, unless it is a Blue half. */
	collect({ color, drop, half }: ChromaticBreak, ionizes: number) {
		currenciesManager.add(CHROMATIC[color].currency, this.lightFor(color, drop, ionizes));
		if (!half) this.kills = { ...this.kills, [color]: this.kills[color] + 1 };
	}

	canAfford(upgrade: ChromaticUpgrade): boolean {
		const level = this.level(upgrade.id);
		const cost = getChromaticUpgradeCost(upgrade, level);
		return level < upgrade.maxLevel && upgrade.currencies.every(currency => currenciesManager.getAmount(currency) >= cost);
	}

	purchaseUpgrade(upgradeId: string): boolean {
		const upgrade = CHROMATIC_UPGRADES[upgradeId];
		if (!upgrade || !this.canAfford(upgrade)) return false;

		const level = this.level(upgradeId);
		const cost = getChromaticUpgradeCost(upgrade, level);
		for (const currency of upgrade.currencies) currenciesManager.remove(currency, cost);
		this.upgradeLevels = { ...this.upgradeLevels, [upgradeId]: level + 1 };
		return true;
	}

	getState(): ChromaticState {
		return { kills: this.kills };
	}

	loadState(state: ChromaticState) {
		this.kills = { ...EMPTY_KILLS, ...state.kills };
	}
}

export const chromaticManager = new ChromaticManager();
