import { LAYERS } from '#helpers/statConstants.js';
import type { Currency } from '#lib/types.js';

export const CurrenciesTypes = {
	ATOMS: 'Atoms',
	BLUE_LIGHT: 'Blue Light',
	ELECTRONS: 'Electrons',
	EXCITED_PHOTONS: 'Excited Photons',
	GREEN_LIGHT: 'Green Light',
	HIGGS_BOSON: 'Higgs Boson',
	PHOTONS: 'Photons',
	PROTONS: 'Protons',
	RED_LIGHT: 'Red Light',
	WHITE_LIGHT: 'White Light',
} as const;

export type CurrencyName = typeof CurrenciesTypes[keyof typeof CurrenciesTypes];

export const CURRENCIES = {
	[CurrenciesTypes.ATOMS]: {
		achievementTiers: [100, 10_000, 1_000_000, 1_000_000_000, 1e12, 1e18, 1e25, 1e35, 1e50, 1e65, 1e80, 1e100],
		color: '#4a90e2',
		id: 'atom',
		layer: LAYERS.PROTONIZER,
		name: 'Atoms',
		stat: CurrenciesTypes.ATOMS,
	},
	[CurrenciesTypes.BLUE_LIGHT]: {
		achievementTiers: [100, 10_000, 1_000_000, 50_000_000],
		color: '#4d8dff',
		id: 'blue-light',
		layer: LAYERS.NEVER,
		name: 'Blue Light',
		stat: CurrenciesTypes.BLUE_LIGHT,
	},
	[CurrenciesTypes.ELECTRONS]: {
		color: '#45d945',
		id: 'electron',
		layer: LAYERS.SPECIAL,
		name: 'Electrons',
		stat: CurrenciesTypes.ELECTRONS,
	},
	[CurrenciesTypes.EXCITED_PHOTONS]: {
		achievementTiers: [1, 20, 1000, 400_000, 10_000_000],
		color: '#FFD700',
		id: 'excited-photon',
		layer: LAYERS.PHOTON_REALM,
		name: 'Excited Photons',
		stat: CurrenciesTypes.EXCITED_PHOTONS,
	},
	[CurrenciesTypes.GREEN_LIGHT]: {
		achievementTiers: [100, 10_000, 1_000_000, 50_000_000],
		color: '#2ee6a0',
		id: 'green-light',
		layer: LAYERS.NEVER,
		name: 'Green Light',
		stat: CurrenciesTypes.GREEN_LIGHT,
	},
	[CurrenciesTypes.HIGGS_BOSON]: {
		achievementTiers: [1, 10, 64, 512, 4096],
		color: '#fbbf24',
		id: 'higgs-boson',
		name: 'Higgs Boson',
		stat: CurrenciesTypes.HIGGS_BOSON,
	},
	[CurrenciesTypes.PHOTONS]: {
		achievementTiers: [1, 1000, 100_000, 1_000_000, 100_000_000, 1_000_000_000],
		color: '#9966cc',
		id: 'photon',
		layer: LAYERS.PHOTON_REALM,
		name: 'Photons',
		stat: CurrenciesTypes.PHOTONS,
	},
	[CurrenciesTypes.PROTONS]: {
		color: '#ffd700',
		id: 'proton',
		layer: LAYERS.ELECTRONIZE,
		name: 'Protons',
		stat: CurrenciesTypes.PROTONS,
	},
	[CurrenciesTypes.RED_LIGHT]: {
		achievementTiers: [100, 10_000, 1_000_000, 50_000_000],
		color: '#ff4d5e',
		id: 'red-light',
		layer: LAYERS.NEVER,
		name: 'Red Light',
		stat: CurrenciesTypes.RED_LIGHT,
	},
	[CurrenciesTypes.WHITE_LIGHT]: {
		achievementTiers: [1, 100, 10_000, 100_000],
		color: '#f5f7ff',
		id: 'white-light',
		layer: LAYERS.NEVER,
		name: 'White Light',
		stat: CurrenciesTypes.WHITE_LIGHT,
	},
} as Record<CurrencyName, Currency>;
