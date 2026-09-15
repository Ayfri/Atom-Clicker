import {CurrenciesTypes} from '$data/currencies';
import type {Price} from '$lib/types';

export const BuildingTypes = {
	MOLECULE: 'molecule',
	CRYSTAL: 'crystal',
	NANOSTRUCTURE: 'nanostructure',
	MICROORGANISM: 'microorganism',
	ROCK: 'rock',
	PLANET: 'planet',
	STAR: 'star',
	NEUTRON_STAR: 'neutronStar',
	BLACK_HOLE: 'blackHole'
} as const;

export type BuildingType = typeof BuildingTypes[keyof typeof BuildingTypes];

export interface BuildingData {
	name: string;
	description: string;
	cost: Price;
	rate: number;
}

export const BUILDINGS: Record<BuildingType, BuildingData> = {
	[BuildingTypes.MOLECULE]: {
		name: 'Molecule',
		description: 'Basic building block of matter',
		cost: {
			amount: 20,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 0.1,
	},
	[BuildingTypes.CRYSTAL]: {
		name: 'Crystal',
		description: 'Organized structure of molecules',
		cost: {
			amount: 300,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 1.5,
	},
	[BuildingTypes.NANOSTRUCTURE]: {
		name: 'Nanostructure',
		description: 'Engineered atomic arrangements',
		cost: {
			amount: 9000,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 16,
	},
	[BuildingTypes.MICROORGANISM]: {
		name: 'Micro-organism',
		description: 'Living atomic factories',
		cost: {
			amount: 251_000,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 100,
	},
	[BuildingTypes.ROCK]: {
		name: 'Rock',
		description: 'Solid mass of atoms',
		cost: {
			amount: 8_808_080,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 4000,
	},
	[BuildingTypes.PLANET]: {
		name: 'Planet',
		description: 'Celestial body of atoms',
		cost: {
			amount: 450_200_000,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 35_000,
	},
	[BuildingTypes.STAR]: {
		name: 'Star',
		description: 'Cosmic atom forge',
		cost: {
			amount: 9_850_000_000,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 245_000,
	},
	[BuildingTypes.NEUTRON_STAR]: {
		name: 'Neutron Star',
		description: 'Ultra-dense atomic core',
		cost: {
			amount: 77_700_000_000,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 1_700_000,
	},
	[BuildingTypes.BLACK_HOLE]: {
		name: 'Black Hole',
		description: 'Cosmic atom collector',
		cost: {
			amount: 1_000_000_000_000,
			currency: CurrenciesTypes.ATOMS
		},
		rate: 12_000_000,
	}
};

export const BUILDING_LEVEL_UP_COST = 100;

/** Production multiplier granted by a building's level. Single source of truth for the game, the simulation and the charts. */
export function getBuildingLevelMultiplier(count: number, level: number): number {
	return Math.pow(2, count / BUILDING_LEVEL_UP_COST) * Math.pow(1.5, level);
}

export const BUILDING_COLORS = [
	"#4a90e2", // Blue
	"#e34b4b", // Red
	"#f9c80e", // Yellow
	"#6b4ae2", // Purple
	"#45d945", // Green
	"#4ae2c6", // Teal
	"#b441ae", // Magenta
	"#4a4ae2", // Blue Purple
	"#e36d31", // Orange
	"#ff6b9d", // Pink
	"#00d4aa", // Turquoise
	"#ff8c42", // Orange Red
	"#8e44ad", // Dark Purple
	"#2ecc71", // Emerald Green
	"#e74c3c", // Crimson Red
	"#3498db", // Sky Blue
	"#f39c12", // Golden Orange
	"#9b59b6", // Amethyst Purple
	"#1abc9c", // Mint Green
	"#e67e22", // Carrot Orange
	"#34495e", // Dark Gray Blue
] as const;

export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];
