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
}

export const statsConfig = {
	achievements: { defaultValue: [], layer: LAYERS.NEVER },
	activePowerUps: { defaultValue: [], layer: LAYERS.PROTONIZER },
	balanceVersion: { defaultValue: 0, layer: LAYERS.SPECIAL },
	chromatic: { defaultValue: { kills: { blue: 0, green: 0, red: 0 } } satisfies ChromaticState, layer: LAYERS.NEVER },
	chromaticUpgrades: { defaultValue: {}, layer: LAYERS.NEVER },
	currencies: { defaultValue: {}, layer: LAYERS.NEVER }, // Handled by CurrenciesManager
	currencyBoosts: { defaultValue: {}, layer: LAYERS.PROTONIZER },
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
	},
	generators: { defaultValue: {}, layer: LAYERS.PROTONIZER },
	highestAPS: { defaultValue: 0, layer: LAYERS.NEVER },
	highestAPSRun: { defaultValue: 0, layer: LAYERS.ELECTRONIZE },
	inGameTime: { defaultValue: 0, layer: LAYERS.NEVER },
	integrityFlagged: { defaultValue: false, layer: LAYERS.NEVER },
	lastSave: { defaultValue: Date.now(), layer: LAYERS.SPECIAL },
	photonUpgrades: { defaultValue: {}, layer: LAYERS.PHOTON_REALM },
	powerUpsCollected: { defaultValue: 0, layer: LAYERS.NEVER },
	radiation: { defaultValue: { controlRodLevel: 0.5, lastTick: Date.now(), mass: 0, unlocked: false }, layer: LAYERS.NEVER },
	radiationUpgrades: { defaultValue: {}, layer: LAYERS.RADIATION_REALM },
	realms: {
		defaultValue: {
			[RealmTypes.ATOMS]: { unlocked: true },
			[RealmTypes.PHOTONS]: { unlocked: false },
			[RealmTypes.RADIATION]: { unlocked: false },
		} satisfies Record<string, RealmState>,
		layer: LAYERS.NEVER,
	},
	settings: {
		defaultValue: {
			automation: { autoClick: false, autoClickPhotons: false, generators: [], upgrades: false },
			display: { notation: 'suffix' },
			gameplay: { offlineProgressEnabled: true },
			upgrades: { displayAlreadyBought: false },
		} satisfies Settings,
		layer: LAYERS.NEVER,
	},
	runStartedAt: { defaultValue: 0, layer: LAYERS.SPECIAL },
	selectedRealmId: { defaultValue: RealmTypes.ATOMS, layer: LAYERS.NEVER },
	skillUpgrades: { defaultValue: [], layer: LAYERS.NEVER },
	startDate: { defaultValue: Date.now(), layer: LAYERS.NEVER },
	totalClicksAllTime: { defaultValue: 0, layer: LAYERS.NEVER },
	totalClicksRun: { defaultValue: 0, layer: LAYERS.PROTONIZER },
	totalElectronizesAllTime: { defaultValue: 0, layer: LAYERS.SPECIAL },
	totalElectronizesRun: { defaultValue: 0, layer: LAYERS.SPECIAL },
	totalGeneratorsPurchasedAllTime: { defaultValue: 0, layer: LAYERS.NEVER },
	totalIonizesAllTime: { defaultValue: 0, layer: LAYERS.NEVER },
	totalProtonisesAllTime: { defaultValue: 0, layer: LAYERS.NEVER },
	totalProtonisesRun: { defaultValue: 0, layer: LAYERS.ELECTRONIZE },
	totalUpgradesPurchasedAllTime: { defaultValue: 0, layer: LAYERS.NEVER },
	totalUsers: { defaultValue: 0, layer: LAYERS.NEVER },
	totalXP: { defaultValue: 0, layer: LAYERS.PROTONIZER },
	tutorial: { defaultValue: { enabled: true, seen: [] }, layer: LAYERS.NEVER },
	upgrades: { defaultValue: [], layer: LAYERS.PROTONIZER },
} satisfies Record<string, StatConfig>;
