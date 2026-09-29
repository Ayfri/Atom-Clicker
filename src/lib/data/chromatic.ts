import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { add, mul } from '$helpers/effects';
import type { Effect } from '$lib/types';
import { formatNumber } from '$lib/utils';

export const ChromaticColors = {
	BLUE: 'blue',
	GREEN: 'green',
	RED: 'red',
} as const;

export type ChromaticColor = (typeof ChromaticColors)[keyof typeof ChromaticColors];

export const CHROMATIC_COLORS = Object.values(ChromaticColors);

export interface ChromaticDefinition {
	currency: CurrencyName;
	/** Light per break before levels and upgrades, 0 for Blue, whose two halves pay instead. */
	drop: number;
	/** Corners of the facet drawn inside the glyph, so the colors also differ by shape. */
	facets: number;
	hp: number;
	lifetime: number;
	name: string;
	size: number;
	/** Drift speed in px per second, 0 for a photon that sits still. */
	speed: number;
}

export const CHROMATIC: Record<ChromaticColor, ChromaticDefinition> = {
	[ChromaticColors.BLUE]: { currency: CurrenciesTypes.BLUE_LIGHT, drop: 0, facets: 6, hp: 12, lifetime: 8000, name: 'Blue', size: 56, speed: 0 },
	[ChromaticColors.GREEN]: { currency: CurrenciesTypes.GREEN_LIGHT, drop: 1, facets: 4, hp: 6, lifetime: 3000, name: 'Green', size: 48, speed: 140 },
	[ChromaticColors.RED]: { currency: CurrenciesTypes.RED_LIGHT, drop: 3, facets: 3, hp: 30, lifetime: 12_000, name: 'Red', size: 68, speed: 0 },
};

/** A broken Blue photon splits into two halves, each with this share of its HP and paying one base drop. */
export const BLUE_HALF = { drop: 1, hp: 0.4, lifetime: 5000, size: 0.65 };
export const CHROMATIC_BASE_SPAWN_INTERVAL = 8000;
export const CHROMATIC_MAX_ON_SCREEN = 5;
/** The photon auto-clicker hits colored photons for this share of a tap. */
export const CHROMATIC_AUTO_DAMAGE = 0.25;
/** Breaks of one color that raise its spectrum level, which scales that color's HP faster than its drop. */
export const KILLS_PER_SPECTRUM_LEVEL = 10;
export const SPECTRUM_HP_GROWTH = 1.18;
export const SPECTRUM_DROP_GROWTH = 1.12;
/** Ionize counts that raise colored Light, each one sets the bonus to 2% per Ionize: +10% at 5, +100% at 50. */
export const IONIZE_LIGHT_MILESTONES = [5, 10, 20, 30, 50];

export const ionizeMilestoneBonus = (ionizes: number): number => 0.02 * (IONIZE_LIGHT_MILESTONES.findLast(count => ionizes >= count) ?? 0);

/** Every Ionize adds half the base Light, and the milestones multiply that. */
export const ionizeLightMultiplier = (ionizes: number): number => (1 + 0.5 * ionizes) * (1 + ionizeMilestoneBonus(ionizes));

export interface ChromaticUpgrade {
	baseCost: number;
	costMultiplier: number;
	/** The cost is paid in full in each of these. */
	currencies: CurrencyName[];
	description: (level: number) => string;
	/** Stat boosts for the rest of the game, folded into `gameManager.effects` like photon upgrades. */
	effects?: (level: number) => Effect[];
	id: string;
	maxLevel: number;
	name: string;
	/** Hidden until this color reaches the spectrum level, the phase 2 boosts wait for a color to be farmed first. */
	unlock?: { color: ChromaticColor; spectrum: number };
}

/** Recombine turns this much of each color into one White Light. */
export const WHITE_RECIPE = 10;
export const BOOST_SPECTRUM = 5;

/** A boost a color gives the rest of the game once its spectrum reaches BOOST_SPECTRUM, paid in that color. */
const colorBoost = (
	color: ChromaticColor,
	upgrade: Pick<ChromaticUpgrade, 'baseCost' | 'description' | 'effects' | 'id' | 'name'>,
): ChromaticUpgrade => ({
	...upgrade,
	costMultiplier: 1.6,
	currencies: [CHROMATIC[color].currency],
	maxLevel: 20,
	unlock: { color, spectrum: BOOST_SPECTRUM },
});

const colorUpgrades = (color: ChromaticColor): ChromaticUpgrade[] => {
	const { currency, name } = CHROMATIC[color];
	return [
		{
			baseCost: 10,
			costMultiplier: 1.35,
			currencies: [currency],
			description: level => `Taps deal ${1 + level} damage to ${name} photons`,
			id: `${color}_focus`,
			maxLevel: 25,
			name: `Focused ${name}`,
		},
		{
			baseCost: 25,
			costMultiplier: 1.5,
			currencies: [currency],
			description: level => `+${level * 25}% ${name} Light per break`,
			id: `${color}_yield`,
			maxLevel: 20,
			name: `${name} Yield`,
		},
	];
};

const ALL_LIGHTS = CHROMATIC_COLORS.map(color => CHROMATIC[color].currency);

/** Ids are saved as upgrade levels, so they never get renamed. */
export const CHROMATIC_UPGRADES: Record<string, ChromaticUpgrade> = Object.fromEntries(
	[
		...CHROMATIC_COLORS.flatMap(colorUpgrades),
		{
			baseCost: 40,
			costMultiplier: 1.6,
			currencies: [CurrenciesTypes.RED_LIGHT],
			description: (level: number) => `Colored photons appear ${Math.round((0.92 ** -level - 1) * 100)}% more often`,
			id: 'prism_frequency',
			maxLevel: 10,
			name: 'Prism Frequency',
		},
		{
			baseCost: 40,
			costMultiplier: 1.6,
			currencies: [CurrenciesTypes.GREEN_LIGHT],
			description: (level: number) => `Colored photons last ${level}s longer`,
			id: 'prism_persistence',
			maxLevel: 10,
			name: 'Prism Persistence',
		},
		{
			baseCost: 60,
			costMultiplier: 1.8,
			currencies: [CurrenciesTypes.BLUE_LIGHT],
			description: (level: number) => `The photon auto-clicker hits colored photons for ${Math.round((CHROMATIC_AUTO_DAMAGE + 0.15 * level) * 100)}% of a tap`,
			id: 'prism_autofocus',
			maxLevel: 5,
			name: 'Prism Autofocus',
		},
		{
			baseCost: 30,
			costMultiplier: 1.8,
			currencies: ALL_LIGHTS,
			description: (level: number) => `${level}% chance that an Excited Photon releases a colored photon`,
			id: 'prism_excitation',
			maxLevel: 20,
			name: 'Prism Excitation',
		},
		{
			baseCost: 80,
			costMultiplier: 1.8,
			currencies: ALL_LIGHTS,
			description: (level: number) => `+${level * 0.5}% chance for a photon to spawn excited`,
			effects: (level: number) => [add('excited_photon_chance', 0.005 * level)],
			id: 'prism_excited_chance',
			maxLevel: 10,
			name: 'Excited Spectrum',
		},
		{
			baseCost: 100,
			costMultiplier: 2,
			currencies: ALL_LIGHTS,
			description: (level: number) => `${level * 10}% chance that an Excited Photon strikes a colored photon on screen`,
			id: 'prism_resonance',
			maxLevel: 5,
			name: 'Prism Resonance',
		},
		colorBoost(ChromaticColors.RED, {
			baseCost: 100,
			description: level => `x${formatNumber(1 + 0.1 * level, 1)} atom production`,
			effects: level => [mul('global', 1 + 0.1 * level)],
			id: 'red_ember',
			name: 'Red Ember',
		}),
		colorBoost(ChromaticColors.RED, {
			baseCost: 150,
			description: level => `x${formatNumber(1 + 0.2 * level, 1)} click power`,
			effects: level => [mul('click', 1 + 0.2 * level)],
			id: 'red_spark',
			name: 'Red Spark',
		}),
		colorBoost(ChromaticColors.GREEN, {
			baseCost: 100,
			description: level => `x${formatNumber(1 + 0.1 * level, 1)} protons from Protonise`,
			effects: level => [mul('proton_gain', 1 + 0.1 * level)],
			id: 'green_bloom',
			name: 'Green Bloom',
		}),
		colorBoost(ChromaticColors.GREEN, {
			baseCost: 150,
			description: level => `x${formatNumber(1 + 0.1 * level, 1)} electrons from Electronize`,
			effects: level => [mul('electron_gain', 1 + 0.1 * level)],
			id: 'green_charge',
			name: 'Green Charge',
		}),
		/** The reactor reads these two levels itself, its formulas don't go through the effect system. */
		colorBoost(ChromaticColors.BLUE, {
			baseCost: 100,
			description: level => `+${level * 10}% reactor output`,
			id: 'blue_enrichment',
			name: 'Blue Enrichment',
		}),
		colorBoost(ChromaticColors.BLUE, {
			baseCost: 150,
			description: level => `Raises the reactor output cap by ${level * 10}%`,
			id: 'blue_coolant',
			name: 'Blue Coolant',
		}),
		{
			baseCost: 3,
			costMultiplier: 2,
			currencies: [CurrenciesTypes.WHITE_LIGHT],
			description: (level: number) => `+${level * 50}% Light of every color`,
			id: 'white_spectrum',
			maxLevel: 10,
			name: 'Full Spectrum',
		},
		{
			baseCost: 5,
			costMultiplier: 2.2,
			currencies: [CurrenciesTypes.WHITE_LIGHT],
			description: (level: number) => `x${formatNumber(1 + 0.5 * level, 1)} atom production`,
			effects: (level: number) => [mul('global', 1 + 0.5 * level)],
			id: 'white_radiance',
			maxLevel: 10,
			name: 'White Radiance',
		},
		{
			baseCost: 10,
			costMultiplier: 3,
			currencies: [CurrenciesTypes.WHITE_LIGHT],
			description: (level: number) => `${CHROMATIC_MAX_ON_SCREEN + level} colored photons can be on screen`,
			id: 'white_prism',
			maxLevel: 5,
			name: 'Wider Prism',
		},
	].map(upgrade => [upgrade.id, upgrade]),
);

export const getChromaticUpgradeCost = (upgrade: ChromaticUpgrade, level: number): number => Math.floor(upgrade.baseCost * upgrade.costMultiplier ** level);
