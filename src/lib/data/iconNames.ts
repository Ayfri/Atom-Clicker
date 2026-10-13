import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
import { GeneratorTypes, type GeneratorType } from '#data/generators.js';

/** Names of every icon in the `ICONS` registry of `icons.ts`, kept here so data files and the Worker never import a Svelte component. */
export type IconName =
	| 'atom'
	| 'balance'
	| 'blackHole'
	| 'blueLight'
	| 'boostMax'
	| 'changelog'
	| 'click'
	| 'coffee'
	| 'collider'
	| 'crystal'
	| 'currencyBoost'
	| 'discord'
	| 'electron'
	| 'excitedPhoton'
	| 'generator'
	| 'github'
	| 'globe'
	| 'greenLight'
	| 'higgsBoson'
	| 'ionize'
	| 'level'
	| 'magnet'
	| 'microorganism'
	| 'milestone'
	| 'molecule'
	| 'moon'
	| 'moonStar'
	| 'nanostructure'
	| 'neutronStar'
	| 'offline'
	| 'photon'
	| 'planet'
	| 'playTime'
	| 'players'
	| 'proton'
	| 'quark'
	| 'radiation'
	| 'redLight'
	| 'rock'
	| 'shieldCheck'
	| 'shieldCog'
	| 'shieldPlus'
	| 'skillTreeMaster'
	| 'speed'
	| 'stabilityField'
	| 'star'
	| 'trendingUp'
	| 'trophy'
	| 'upgrade'
	| 'website'
	| 'whiteLight';

export const CURRENCY_ICON_NAMES: Record<CurrencyName, IconName> = {
	[CurrenciesTypes.ATOMS]: 'atom',
	[CurrenciesTypes.BLUE_LIGHT]: 'blueLight',
	[CurrenciesTypes.ELECTRONS]: 'electron',
	[CurrenciesTypes.EXCITED_PHOTONS]: 'excitedPhoton',
	[CurrenciesTypes.GREEN_LIGHT]: 'greenLight',
	[CurrenciesTypes.HIGGS_BOSON]: 'higgsBoson',
	[CurrenciesTypes.PHOTONS]: 'photon',
	[CurrenciesTypes.PROTONS]: 'proton',
	[CurrenciesTypes.RED_LIGHT]: 'redLight',
	[CurrenciesTypes.WHITE_LIGHT]: 'whiteLight',
};

export const GENERATOR_ICON_NAMES: Record<GeneratorType, IconName> = {
	[GeneratorTypes.BLACK_HOLE]: 'blackHole',
	[GeneratorTypes.CRYSTAL]: 'crystal',
	[GeneratorTypes.MICROORGANISM]: 'microorganism',
	[GeneratorTypes.MOLECULE]: 'molecule',
	[GeneratorTypes.NANOSTRUCTURE]: 'nanostructure',
	[GeneratorTypes.NEUTRON_STAR]: 'neutronStar',
	[GeneratorTypes.PLANET]: 'planet',
	[GeneratorTypes.ROCK]: 'rock',
	[GeneratorTypes.STAR]: 'star',
};
