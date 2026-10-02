import type { DailyStats } from '#data/dailyQuests.js';
import { RealmTypes } from '#data/realms.js';
import type { ChromaticState, RealmState, Settings } from '#lib/types.js';

/** `resetLayer(n)` resets every stat whose layer is 1 to n, NEVER stats always stay and SPECIAL ones are handled by their own code. */
export const LAYERS = {
	ELECTRONIZE: 2,
	NEVER: 0,
	PHOTON_REALM: 3,
	PROTONIZER: 1,
	RADIATION_REALM: 4,
	SPECIAL: -1,
} as const;

export type LayerType = (typeof LAYERS)[keyof typeof LAYERS];

interface StatConfig {
	defaultValue: unknown;
	layer: LayerType;
	minVersion: number;
}

export const statsConfig = {
	achievements: { defaultValue: [], layer: LAYERS.NEVER, minVersion: 1 },
	activePowerUps: { defaultValue: [], layer: LAYERS.PROTONIZER, minVersion: 1 },
	chromatic: { defaultValue: { kills: { blue: 0, green: 0, red: 0 } } satisfies ChromaticState, layer: LAYERS.NEVER, minVersion: 29 },
	chromaticUpgrades: { defaultValue: {}, layer: LAYERS.NEVER, minVersion: 29 },
	currencies: { defaultValue: {}, layer: LAYERS.NEVER, minVersion: 17 }, // Handled by CurrenciesManager
	currencyBoosts: { defaultValue: {}, layer: LAYERS.PROTONIZER, minVersion: 21 },
	dailyStats: {
		defaultValue: {
			achievementsUnlocked: 0,
			atomsEarned: 0,
			chromaticBreaks: 0,
			clicks: 0,
			dayKey: '',
			electronizes: 0,
			fuelInjected: 0,
			generatorsPurchased: 0,
			higgsBosonsCollected: 0,
			otherDailyQuestsCompleted: 0,
			powerUpsCollected: 0,
			protonises: 0,
			questIds: [],
			questTargets: {},
			upgradesPurchased: 0,
		} satisfies DailyStats,
		layer: LAYERS.NEVER,
		minVersion: 24,
	},
	features: { defaultValue: {}, layer: LAYERS.NEVER, minVersion: 21 },
	generators: { defaultValue: {}, layer: LAYERS.PROTONIZER, minVersion: 26 },
	highestAPS: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 14 },
	highestAPSRun: { defaultValue: 0, layer: LAYERS.ELECTRONIZE, minVersion: 31 },
	inGameTime: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 14 },
	integrityFlagged: { defaultValue: false, layer: LAYERS.NEVER, minVersion: 30 },
	lastSave: { defaultValue: Date.now(), layer: LAYERS.SPECIAL, minVersion: 1 },
	photonUpgrades: { defaultValue: {}, layer: LAYERS.PHOTON_REALM, minVersion: 12 },
	powerUpsCollected: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 14 },
	radiation: {
		defaultValue: { controlRodLevel: 0.5, lastTick: Date.now(), mass: 0, unlocked: false },
		layer: LAYERS.NEVER,
		minVersion: 22,
	},
	radiationUpgrades: { defaultValue: {}, layer: LAYERS.RADIATION_REALM, minVersion: 22 },
	realms: {
		defaultValue: {
			[RealmTypes.ATOMS]: { unlocked: true },
			[RealmTypes.PHOTONS]: { unlocked: false },
			[RealmTypes.RADIATION]: { unlocked: false },
		} satisfies Record<string, RealmState>,
		layer: LAYERS.NEVER,
		minVersion: 19,
	},
	settings: {
		defaultValue: {
			automation: { autoClick: false, autoClickPhotons: false, generators: [], upgrades: false },
			display: { notation: 'suffix' },
			gameplay: { offlineProgressEnabled: true },
			upgrades: { displayAlreadyBought: false },
		} satisfies Settings,
		layer: LAYERS.NEVER,
		minVersion: 8,
	},
	selectedRealmId: { defaultValue: RealmTypes.ATOMS, layer: LAYERS.NEVER, minVersion: 22 },
	skillUpgrades: { defaultValue: [], layer: LAYERS.NEVER, minVersion: 3 },
	startDate: { defaultValue: Date.now(), layer: LAYERS.NEVER, minVersion: 5 },
	totalClicksAllTime: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 14 },
	totalClicksRun: { defaultValue: 0, layer: LAYERS.PROTONIZER, minVersion: 16 },
	totalElectronizesAllTime: { defaultValue: 0, layer: LAYERS.SPECIAL, minVersion: 16 },
	totalElectronizesRun: { defaultValue: 0, layer: LAYERS.SPECIAL, minVersion: 16 },
	totalGeneratorsPurchasedAllTime: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 26 },
	totalIonizesAllTime: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 29 },
	totalProtonisesAllTime: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 16 },
	totalProtonisesRun: { defaultValue: 0, layer: LAYERS.ELECTRONIZE, minVersion: 16 },
	totalUpgradesPurchasedAllTime: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 16 },
	totalUsers: { defaultValue: 0, layer: LAYERS.NEVER, minVersion: 15 },
	totalXP: { defaultValue: 0, layer: LAYERS.PROTONIZER, minVersion: 3 },
	tutorial: { defaultValue: { enabled: true, seen: [] }, layer: LAYERS.NEVER, minVersion: 23 },
	upgrades: { defaultValue: [], layer: LAYERS.PROTONIZER, minVersion: 1 },
} satisfies Record<string, StatConfig>;
