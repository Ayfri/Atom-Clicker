import {
	BLUE_HALF,
	CHROMATIC,
	CHROMATIC_AUTO_DAMAGE,
	CHROMATIC_BASE_SPAWN_INTERVAL,
	CHROMATIC_COLORS,
	CHROMATIC_MAX_ON_SCREEN,
	CHROMATIC_UPGRADES,
	type ChromaticColor,
	ChromaticColors,
	type ChromaticUpgrade,
	getChromaticUpgradeCost,
	ionizeLightMultiplier,
	KILLS_PER_SPECTRUM_LEVEL,
	SPECTRUM_DROP_GROWTH,
	SPECTRUM_HP_GROWTH,
	WHITE_RECIPE,
} from '#data/chromatic.js';
import { CurrenciesTypes } from '#data/currencies.js';
import type { ChromaticBreak } from '#helpers/chromaticField.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import type { ChromaticState } from '#lib/types.js';

const EMPTY_KILLS: Record<ChromaticColor, number> = { blue: 0, green: 0, red: 0 };

/** Colored photons of the Photon Realm: breaks per color and Prism upgrade levels, all kept through every prestige. */
class ChromaticManager {
	kills = $state.raw<Record<ChromaticColor, number>>({ ...EMPTY_KILLS });
	upgradeLevels = $state.raw<Record<string, number>>({});

	/** Chance that collecting an Excited Photon releases a colored photon where it was. */
	excitationChance = $derived(0.01 * this.level('prism_excitation'));
	/** Chance that collecting an Excited Photon lands one tap on a colored photon already on screen. */
	resonanceChance = $derived(0.1 * this.level('prism_resonance'));
	lifetimeBonus = $derived(1000 * this.level('prism_persistence'));
	maxOnScreen = $derived(CHROMATIC_MAX_ON_SCREEN + this.level('white_prism'));
	/** Read by RadiationManager, the reactor formulas don't go through the effect system. */
	reactorCapBonus = $derived(1 + 0.1 * this.level('blue_coolant'));
	reactorOutputBonus = $derived(1 + 0.1 * this.level('blue_enrichment'));
	spawnInterval = $derived(CHROMATIC_BASE_SPAWN_INTERVAL * 0.92 ** this.level('prism_frequency'));

	/** White Light a Recombine would make right now, WHITE_RECIPE of each color per unit. */
	recombinable = $derived(
		Math.floor(Math.min(...CHROMATIC_COLORS.map(color => currenciesManager.getAmount(CHROMATIC[color].currency))) / WHITE_RECIPE),
	);

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

	lightFor(color: ChromaticColor, drop: number, ionizes: number): number {
		const upgrades = (1 + 0.25 * this.level(`${color}_yield`)) * (1 + 0.5 * this.level('white_spectrum'));
		return drop * SPECTRUM_DROP_GROWTH ** this.spectrumLevel(color) * upgrades * ionizeLightMultiplier(ionizes);
	}

	/**
	 * Light per second the photon auto-clicker earns on its own, for offline progress. Half its clicks land on colored photons,
	 * split evenly between the colors, and a color never breaks faster than it spawns. A Blue photon counts its two halves.
	 */
	autoLightPerSecond(autoClicksPerSecond: number, spawnFactor: number, ionizes: number): Record<ChromaticColor, number> {
		const spawnsPerColor = 1000 / this.spawnInterval / CHROMATIC_COLORS.length / spawnFactor;
		const clicksPerColor = autoClicksPerSecond / 2 / CHROMATIC_COLORS.length;
		const rates = { ...EMPTY_KILLS };
		for (const color of CHROMATIC_COLORS) {
			const blue = color === ChromaticColors.BLUE;
			const hp = this.maxHp(color) * (blue ? 1 + 2 * BLUE_HALF.hp : 1);
			const drop = blue ? 2 * BLUE_HALF.drop : CHROMATIC[color].drop;
			const breaks = Math.min(spawnsPerColor, (clicksPerColor * this.tapDamage(color, true)) / hp);
			rates[color] = breaks * this.lightFor(color, drop, ionizes);
		}
		return rates;
	}

	isUnlocked({ unlock }: ChromaticUpgrade): boolean {
		return !unlock || this.spectrumLevel(unlock.color) >= unlock.spectrum;
	}

	/** Turns every full set of WHITE_RECIPE Red, Green and Blue Light into White Light. */
	recombine(): number {
		const amount = this.recombinable;
		if (amount <= 0) return 0;
		for (const color of CHROMATIC_COLORS) currenciesManager.remove(CHROMATIC[color].currency, amount * WHITE_RECIPE);
		currenciesManager.add(CurrenciesTypes.WHITE_LIGHT, amount);
		return amount;
	}

	/** Pays the Light of one break and counts it toward the color's spectrum level, unless it is a Blue half. */
	collect({ color, drop, half }: ChromaticBreak, ionizes: number) {
		currenciesManager.add(CHROMATIC[color].currency, this.lightFor(color, drop, ionizes));
		if (!half) this.kills = { ...this.kills, [color]: this.kills[color] + 1 };
	}

	canAfford(upgrade: ChromaticUpgrade): boolean {
		const level = this.level(upgrade.id);
		const cost = getChromaticUpgradeCost(upgrade, level);
		return level < upgrade.maxLevel && this.isUnlocked(upgrade) && upgrade.currencies.every(currency => currenciesManager.getAmount(currency) >= cost);
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
