import { RealmTypes, type RealmType } from '$data/realms';
import { mul } from '$helpers/effects';
import type { IconStackSpec } from '$helpers/iconStacks';
import type { Effect } from '$lib/types';

export interface ThemeDefinition {
	/** Optional secondary accent, e.g. for buttons/borders. Falls back to `accent` when unset. */
	accent: string;
	accentSecondary?: string;
	/** CSS `background-image` value, replacing the realm's default gradient. */
	background: string;
	realmId: RealmType;
}

export type BannerPattern =
	| 'aurora'
	| 'beam'
	| 'cells'
	| 'chevrons'
	| 'cloud'
	| 'constellation'
	| 'facets'
	| 'hazard'
	| 'lattice'
	| 'nucleus'
	| 'orbitals'
	| 'rays'
	| 'rings'
	| 'split'
	| 'stripes'
	| 'waves'
	| 'weave';

export interface BannerDefinition {
	/** 2-3 hex colors forming a CSS linear-gradient, rendered behind the leaderboard row. */
	gradient: string[];
	/** Decorative treatment layered over the banner gradient. */
	pattern: BannerPattern;
}

export interface QuarkShopItem {
	banner?: BannerDefinition; // banners only
	cost: number;
	description: string;
	effects?: Effect[]; // boosts and convenience items only
	iconStack?: IconStackSpec; // boosts and convenience items only
	id: string;
	name: string;
	theme?: ThemeDefinition; // themes only
	type: 'banner' | 'boost' | 'convenience' | 'theme';
}

export const QUARK_SHOP: Record<string, QuarkShopItem> = {
	convenience_third_daily_quest: {
		cost: 100,
		description: 'Adds a third daily quest while owned.',
		iconStack: { icon: 'milestone' },
		id: 'convenience_third_daily_quest',
		name: 'Third Daily Quest',
		type: 'convenience',
	},
	boost_click_power: {
		cost: 60,
		description: 'Permanently doubles click power.',
		effects: [mul('click', 2), mul('click_aps', 2)],
		iconStack: { icon: 'click' },
		id: 'boost_click_power',
		name: 'Heavy Click Boost',
		type: 'boost',
	},
	boost_global_production: {
		cost: 120,
		description: 'Permanently increases all production by 10%.',
		effects: [mul('global', 1.1)],
		iconStack: { icon: 'trendingUp' },
		id: 'boost_global_production',
		name: 'Global Production Boost',
		type: 'boost',
	},
	boost_xp_gain: {
		cost: 50,
		description: 'Permanently increases XP gain by 25%.',
		effects: [mul('xp_gain', 1.25)],
		iconStack: { icon: 'level' },
		id: 'boost_xp_gain',
		name: 'Experience Boost',
		type: 'boost',
	},
	convenience_auto_buy_speed: {
		cost: 80,
		description: 'Permanently increases auto-buyer speed by 20%.',
		effects: [mul('auto_speed', 1.2)],
		iconStack: { icon: 'speed' },
		id: 'convenience_auto_buy_speed',
		name: 'Faster Auto-Buyers',
		type: 'convenience',
	},
	convenience_power_up_duration: {
		cost: 70,
		description: 'Permanently increases power-up duration by 20%.',
		effects: [mul('power_up_duration', 1.2)],
		iconStack: { icon: 'offline' },
		id: 'convenience_power_up_duration',
		name: 'Extended Power-Ups',
		type: 'convenience',
	},
	convenience_keep_currency_boosts: {
		cost: 60,
		description: 'Keeps your Currency Boosts through Protonise and Electronize.',
		iconStack: { icon: 'stabilityMeter' },
		id: 'convenience_keep_currency_boosts',
		name: 'Stable Currency Boosts',
		type: 'convenience',
	},
	theme_atoms_amethyst: {
		cost: 25,
		description: 'Recolors the Atoms Realm with a violet accent.',
		id: 'theme_atoms_amethyst',
		name: 'Amethyst',
		theme: {
			accent: '#8b5cf6',
			accentSecondary: '#c4b5fd',
			background:
				'radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.14) 0%, rgba(139, 92, 246, 0.06) 30%, transparent 60%), radial-gradient(circle at 95% 90%, rgba(196, 181, 253, 0.12) 0%, rgba(196, 181, 253, 0.05) 25%, transparent 50%)',
			realmId: RealmTypes.ATOMS,
		},
		type: 'theme',
	},
	theme_atoms_ember: {
		cost: 25,
		description: 'Recolors the Atoms Realm with a warm ember accent.',
		id: 'theme_atoms_ember',
		name: 'Ember',
		theme: {
			accent: '#ff7849',
			accentSecondary: '#ffb347',
			background:
				'radial-gradient(circle at 10% 20%, rgba(255, 120, 73, 0.14) 0%, rgba(255, 120, 73, 0.06) 30%, transparent 60%), radial-gradient(circle at 95% 90%, rgba(255, 179, 71, 0.12) 0%, rgba(255, 179, 71, 0.05) 25%, transparent 50%)',
			realmId: RealmTypes.ATOMS,
		},
		type: 'theme',
	},
	theme_atoms_emerald: {
		cost: 25,
		description: 'Recolors the Atoms Realm with a stable emerald accent.',
		id: 'theme_atoms_emerald',
		name: 'Emerald',
		theme: {
			accent: '#3ddc84',
			accentSecondary: '#1fae63',
			background:
				'radial-gradient(circle at 10% 20%, rgba(61, 220, 132, 0.14) 0%, rgba(61, 220, 132, 0.06) 30%, transparent 60%), radial-gradient(circle at 95% 90%, rgba(31, 174, 99, 0.12) 0%, rgba(31, 174, 99, 0.05) 25%, transparent 50%)',
			realmId: RealmTypes.ATOMS,
		},
		type: 'theme',
	},
	theme_atoms_frost: {
		cost: 25,
		description: 'Recolors the Atoms Realm with an icy frost accent.',
		id: 'theme_atoms_frost',
		name: 'Frost',
		theme: {
			accent: '#67e8f9',
			accentSecondary: '#a5f3fc',
			background:
				'radial-gradient(circle at 10% 20%, rgba(103, 232, 249, 0.14) 0%, rgba(103, 232, 249, 0.06) 30%, transparent 60%), radial-gradient(circle at 95% 90%, rgba(165, 243, 252, 0.12) 0%, rgba(165, 243, 252, 0.05) 25%, transparent 50%)',
			realmId: RealmTypes.ATOMS,
		},
		type: 'theme',
	},
	theme_photons_gold: {
		cost: 25,
		description: 'Recolors the Photon Realm with a golden accent.',
		id: 'theme_photons_gold',
		name: 'Golden Photon',
		theme: {
			accent: '#fbbf24',
			accentSecondary: '#f59e0b',
			background:
				'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(15, 15, 15, 0.1) 50%, rgba(245, 158, 11, 0.1) 100%)',
			realmId: RealmTypes.PHOTONS,
		},
		type: 'theme',
	},
	theme_photons_crimson: {
		cost: 25,
		description: 'Recolors the Photon Realm with a crimson accent.',
		id: 'theme_photons_crimson',
		name: 'Crimson Flare',
		theme: {
			accent: '#ff4d6d',
			accentSecondary: '#c81d4f',
			background:
				'linear-gradient(135deg, rgba(255, 77, 109, 0.1) 0%, rgba(15, 15, 15, 0.1) 50%, rgba(200, 29, 79, 0.1) 100%)',
			realmId: RealmTypes.PHOTONS,
		},
		type: 'theme',
	},
	theme_photons_teal: {
		cost: 25,
		description: 'Recolors the Photon Realm with a teal accent.',
		id: 'theme_photons_teal',
		name: 'Teal Drift',
		theme: {
			accent: '#2dd4bf',
			accentSecondary: '#14b8a6',
			background:
				'linear-gradient(135deg, rgba(45, 212, 191, 0.1) 0%, rgba(15, 15, 15, 0.1) 50%, rgba(20, 184, 166, 0.1) 100%)',
			realmId: RealmTypes.PHOTONS,
		},
		type: 'theme',
	},
	theme_photons_silver: {
		cost: 25,
		description: 'Recolors the Photon Realm with a silver accent.',
		id: 'theme_photons_silver',
		name: 'Silver Halo',
		theme: {
			accent: '#e2e8f0',
			accentSecondary: '#94a3b8',
			background:
				'linear-gradient(135deg, rgba(226, 232, 240, 0.1) 0%, rgba(15, 15, 15, 0.1) 50%, rgba(148, 163, 184, 0.1) 100%)',
			realmId: RealmTypes.PHOTONS,
		},
		type: 'theme',
	},
	theme_photons_prism: {
		cost: 40,
		description: 'Splits the Photon Realm into Red, Green and Blue light.',
		id: 'theme_photons_prism',
		name: 'Prism',
		theme: {
			accent: '#7dd3fc',
			accentSecondary: '#f472b6',
			background:
				'radial-gradient(circle at 15% 20%, rgba(255, 77, 94, 0.12) 0%, transparent 45%), radial-gradient(circle at 85% 30%, rgba(46, 230, 160, 0.1) 0%, transparent 45%), radial-gradient(circle at 50% 90%, rgba(77, 141, 255, 0.12) 0%, transparent 50%)',
			realmId: RealmTypes.PHOTONS,
		},
		type: 'theme',
	},
	theme_radiation_cherenkov: {
		cost: 25,
		description: 'Recolors the Radiation Realm with the blue glow of Cherenkov radiation.',
		id: 'theme_radiation_cherenkov',
		name: 'Cherenkov Blue',
		theme: {
			accent: '#38bdf8',
			accentSecondary: '#0ea5e9',
			background:
				'radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(14, 165, 233, 0.1) 0%, transparent 40%)',
			realmId: RealmTypes.RADIATION,
		},
		type: 'theme',
	},
	theme_radiation_amber: {
		cost: 25,
		description: 'Recolors the Radiation Realm with an amber accent.',
		id: 'theme_radiation_amber',
		name: 'Amber Core',
		theme: {
			accent: '#f59e0b',
			accentSecondary: '#d97706',
			background:
				'radial-gradient(circle at 30% 30%, rgba(245, 158, 11, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(217, 119, 6, 0.1) 0%, transparent 40%)',
			realmId: RealmTypes.RADIATION,
		},
		type: 'theme',
	},
	theme_radiation_crimson: {
		cost: 25,
		description: 'Recolors the Radiation Realm with a crimson accent.',
		id: 'theme_radiation_crimson',
		name: 'Crimson Core',
		theme: {
			accent: '#ef4444',
			accentSecondary: '#b91c1c',
			background:
				'radial-gradient(circle at 30% 30%, rgba(239, 68, 68, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(185, 28, 28, 0.1) 0%, transparent 40%)',
			realmId: RealmTypes.RADIATION,
		},
		type: 'theme',
	},
	theme_radiation_violet: {
		cost: 25,
		description: 'Recolors the Radiation Realm with a violet accent.',
		id: 'theme_radiation_violet',
		name: 'Violet Core',
		theme: {
			accent: '#a78bfa',
			accentSecondary: '#7c3aed',
			background:
				'radial-gradient(circle at 30% 30%, rgba(167, 139, 250, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(124, 58, 237, 0.1) 0%, transparent 40%)',
			realmId: RealmTypes.RADIATION,
		},
		type: 'theme',
	},
	banner_up: {
		banner: { gradient: ['#0c4a6e', '#082f49', '#07111f'], pattern: 'rays' },
		cost: 40,
		description: 'A light, energetic banner for the Up quark.',
		id: 'banner_up',
		name: 'Up Quark',
		type: 'banner',
	},
	banner_down: {
		banner: { gradient: ['#713f12', '#3f2d16', '#17120c'], pattern: 'cells' },
		cost: 40,
		description: 'An earthy banner for the Down quark.',
		id: 'banner_down',
		name: 'Down Quark',
		type: 'banner',
	},
	banner_charm: {
		banner: { gradient: ['#831843', '#4a1232', '#160b14'], pattern: 'waves' },
		cost: 40,
		description: 'A vivid banner for the Charm quark.',
		id: 'banner_charm',
		name: 'Charm Quark',
		type: 'banner',
	},
	banner_strange: {
		banner: { gradient: ['#4c1d95', '#25134f', '#0d0a18'], pattern: 'constellation' },
		cost: 40,
		description: 'A mysterious banner for the Strange quark.',
		id: 'banner_strange',
		name: 'Strange Quark',
		type: 'banner',
	},
	banner_top: {
		banner: { gradient: ['#854d0e', '#422006', '#130f08'], pattern: 'chevrons' },
		cost: 40,
		description: 'A heavyweight golden banner for the Top quark.',
		id: 'banner_top',
		name: 'Top Quark',
		type: 'banner',
	},
	banner_bottom: {
		banner: { gradient: ['#5f1418', '#2a0b0d', '#0b0708'], pattern: 'hazard' },
		cost: 40,
		description: 'A deep maroon banner for the Bottom quark.',
		id: 'banner_bottom',
		name: 'Bottom Quark',
		type: 'banner',
	},
	banner_gluon: {
		banner: { gradient: ['#5b1822', '#123f2c', '#152b52'], pattern: 'lattice' },
		cost: 40,
		description: 'A color-charge banner carrying red, green and blue like a gluon.',
		id: 'banner_gluon',
		name: 'Gluon',
		type: 'banner',
	},
	banner_boson: {
		banner: { gradient: ['#4b5563', '#292524', '#6b4f18'], pattern: 'rings' },
		cost: 40,
		description: 'A prestigious white-and-gold banner for the Higgs Boson.',
		id: 'banner_boson',
		name: 'Higgs Boson',
		type: 'banner',
	},
	banner_neutrino: {
		banner: { gradient: ['#164e63', '#19364d', '#09131a'], pattern: 'aurora' },
		cost: 40,
		description: 'A pale, ghostly banner for the elusive Neutrino.',
		id: 'banner_neutrino',
		name: 'Neutrino',
		type: 'banner',
	},
	banner_hadron: {
		banner: { gradient: ['#292524', '#7c2d12', '#11100f'], pattern: 'stripes' },
		cost: 40,
		description: 'A dark, composite banner for a Hadron jet.',
		id: 'banner_hadron',
		name: 'Hadron Jet',
		type: 'banner',
	},
	banner_atom: {
		banner: { gradient: ['#1d4ed8', '#132a5e', '#080c18'], pattern: 'orbitals' },
		cost: 40,
		description: 'A blue banner tracing the electron shells of a whole atom.',
		id: 'banner_atom',
		name: 'Atom',
		type: 'banner',
	},
	banner_proton: {
		banner: { gradient: ['#a16207', '#533a06', '#141005'], pattern: 'nucleus' },
		cost: 40,
		description: 'A golden banner showing the three quarks bound inside a proton.',
		id: 'banner_proton',
		name: 'Proton',
		type: 'banner',
	},
	banner_electron: {
		banner: { gradient: ['#166534', '#0b3320', '#06120c'], pattern: 'cloud' },
		cost: 40,
		description: 'A green banner made of the probability cloud of an electron.',
		id: 'banner_electron',
		name: 'Electron',
		type: 'banner',
	},
	banner_photon: {
		banner: { gradient: ['#7e22ce', '#3f1470', '#0d0818'], pattern: 'beam' },
		cost: 40,
		description: 'A violet banner carrying a photon travelling as a wave.',
		id: 'banner_photon',
		name: 'Photon',
		type: 'banner',
	},
	banner_red_light: {
		banner: { gradient: ['#b4232f', '#5a1219', '#14070a'], pattern: 'facets' },
		cost: 40,
		description: 'A red banner glowing like the Light of a tough Red photon.',
		id: 'banner_red_light',
		name: 'Red Light',
		type: 'banner',
	},
	banner_green_light: {
		banner: { gradient: ['#0f8a5f', '#08452f', '#04140e'], pattern: 'weave' },
		cost: 40,
		description: 'A green banner weaving like a darting Green photon.',
		id: 'banner_green_light',
		name: 'Green Light',
		type: 'banner',
	},
	banner_blue_light: {
		banner: { gradient: ['#1f4fb8', '#11285c', '#070c1a'], pattern: 'split' },
		cost: 40,
		description: 'A blue banner rippling like a Blue photon splitting in two.',
		id: 'banner_blue_light',
		name: 'Blue Light',
		type: 'banner',
	},
};

export function getQuarkShopItem(itemId: string): QuarkShopItem | undefined {
	return QUARK_SHOP[itemId];
}
