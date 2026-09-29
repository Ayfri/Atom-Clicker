import { CurrenciesTypes, type CurrencyName } from '$data/currencies';

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

export interface ChromaticUpgrade {
	baseCost: number;
	costMultiplier: number;
	/** The cost is paid in full in each of these. */
	currencies: CurrencyName[];
	description: (level: number) => string;
	id: string;
	maxLevel: number;
	name: string;
}

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
			currencies: CHROMATIC_COLORS.map(color => CHROMATIC[color].currency),
			description: (level: number) => `${level}% chance that an Excited Photon releases a colored photon`,
			id: 'prism_excitation',
			maxLevel: 10,
			name: 'Prism Excitation',
		},
	].map(upgrade => [upgrade.id, upgrade]),
);

export const getChromaticUpgradeCost = (upgrade: ChromaticUpgrade, level: number): number => Math.floor(upgrade.baseCost * upgrade.costMultiplier ** level);
