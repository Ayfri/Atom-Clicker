import type { ChromaticColor } from '#data/chromatic.js';
import type { CurrencyName } from '#data/currencies.js';
import type { DailyStats } from '#data/dailyQuests.js';
import type { FeatureType } from '#data/features.js';
import type { GeneratorType } from '#data/generators.js';
import type { IconName } from '#data/icons.js';
import type { RealmType } from '#data/realms.js';
import type { GameManager } from '#helpers/GameManager.svelte.js';
import type { IconStackSpec } from '#helpers/iconStacks.js';
import type { LayerType } from '#helpers/statConstants.js';
import type { ToastIcon } from '#stores/toasts.svelte.js';

export interface Achievement {
	condition: (manager: GameManager) => boolean;
	description: string;
	hiddenCondition?: (manager: GameManager) => boolean;
	/** Toast icon shown when the achievement unlocks. */
	icon?: ToastIcon;
	/** Composed icon shown in the achievements list, see `IconStack.svelte`. */
	iconStack?: IconStackSpec;
	id: string;
	name: string;
}

export interface AchievementGroup {
	achievements: Achievement[];
	name: string;
	/** Ordered tiers of one goal, the list only shows the unlocked ones and the next target until expanded. */
	tiered: boolean;
}

export interface ChromaticState {
	kills: Record<ChromaticColor, number>;
}

/** `injections` and `readyInMs` stay at 0 for a signed-out player. */
export interface ColliderState {
	injections: number;
	readyInMs: number;
	total: number;
}

export interface Currency {
	achievementTiers?: number[];
	color: string;
	id: string;
	layer?: LayerType;
	name: CurrencyName;
	stat?: CurrencyName;
}

export interface CurrencyState {
	amount: number;
	earnedAllTime: number;
	earnedRun: number;
}

export type CurrencyAmountMap = Partial<Record<CurrencyName, number>>;

export type CurrencyStateMap = Record<CurrencyName, CurrencyState>;

export type EffectStat =
	| 'auto_buy'
	| 'auto_click'
	| 'auto_speed'
	| 'auto_upgrade'
	| 'click'
	| 'click_aps'
	| 'electron_gain'
	| 'excited_photon_chance'
	| 'excited_photon_double'
	| 'excited_photon_duration'
	| 'excited_photon_from_max'
	| 'excited_photon_stability'
	| 'generator'
	| 'global'
	| 'photon_auto_click'
	| 'photon_double_chance'
	| 'photon_duration'
	| 'photon_size'
	| 'photon_spawn_interval'
	| 'photon_stability'
	| 'photon_value'
	| 'power_up_duration'
	| 'power_up_interval'
	| 'power_up_multiplier'
	| 'proton_gain'
	| 'stability_boost'
	| 'stability_capacity'
	| 'stability_speed'
	| 'start_atoms'
	| 'xp_gain';

export type EffectAmount = number | ((manager: GameManager) => number);

/** Built with `add`, `mul` and `sum` from `#helpers/effects.js`, a stat resolves to `(base + adds) × muls × Π(1 + per × Σsum)`. */
export type Effect =
	| { amount: EffectAmount; kind: 'add' | 'mul'; stat: EffectStat; target?: GeneratorType }
	| { amount: number; kind: 'sum'; per: (manager: GameManager) => number; stat: EffectStat };

export interface EffectSource {
	effects: readonly Effect[];
	id: string;
	name: string;
}

export type FeatureState = Record<FeatureType, boolean>;

/** Base rate and cost always come from `GENERATORS`, so a rebalance reaches existing saves. */
export interface Generator {
	count: number;
	level: number;
	unlocked: boolean;
}

export type GeneratorCountMap = Partial<Record<GeneratorType, number>>;

export interface PhotonUpgrade {
	baseCost: number;
	condition?: (manager: GameManager) => boolean;
	costMultiplier: number;
	currency?: CurrencyName;
	description: (level: number) => string;
	effects: (level: number) => Effect[];
	id: string;
	maxLevel: number;
	name: string;
}

export type CurrencyBoosts = Partial<Record<CurrencyName, number>>;

export interface RadiationState {
	controlRodLevel: number;
	lastTick: number;
	mass: number;
	unlocked: boolean;
}

export interface TutorialState {
	enabled: boolean;
	/** `realm:name` ids of the hints already completed or dismissed. */
	seen: string[];
}

export interface GameState {
	achievements: string[];
	activePowerUps: PowerUp[];
	/** `BALANCE_VERSION` the current run was last checked against, see runBounds.ts. */
	balanceVersion: number;
	chromatic: ChromaticState;
	chromaticUpgrades: Record<string, number>;
	currencies: CurrencyStateMap;
	currencyBoosts: CurrencyBoosts;
	dailyStats: DailyStats;
	generators: Partial<Record<GeneratorType, Generator>>;
	highestAPS: number;
	highestAPSRun: number;
	inGameTime: number;
	integrityFlagged: boolean;
	lastInteractionTime: number;
	lastSave: number;
	photonUpgrades: Record<string, number>;
	powerUpsCollected: number;
	radiation: RadiationState;
	radiationUpgrades: Record<string, number>;
	realms: Record<RealmType, RealmState>;
	/** Wall clock of the last prestige, 0 when unknown (a run carried over from before it was tracked). */
	runStartedAt: number;
	selectedRealmId?: RealmType;
	settings: Settings;
	skillUpgrades: string[];
	startDate: number;
	totalClicksAllTime: number;
	totalClicksRun: number;
	totalElectronizesAllTime: number;
	totalElectronizesRun: number;
	totalGeneratorsPurchasedAllTime: number;
	totalIonizesAllTime: number;
	totalProtonisesAllTime: number;
	totalProtonisesRun: number;
	totalUpgradesPurchasedAllTime: number;
	totalUsers: number;
	totalXP: number;
	tutorial: TutorialState;
	upgrades: string[];
	version: number;
}

export interface OfflineProgressSummary {
	appliedMs: number;
	atomAutoClickEnabled: boolean;
	atomAutoClicks: number;
	autoBuyCounts: GeneratorCountMap;
	autoBuyEnabled: boolean;
	autoBuyFactor: number;
	autoUpgradeEnabled: boolean;
	autoUpgradePurchases: number;
	awayMs: number;
	capMs: number;
	currencyGains: CurrencyAmountMap;
	incomeMultiplier: number;
	levelsGained: number;
	photonAutoClickEnabled: boolean;
	photonAutoClickFactor: number;
	photonAutoClicks: number;
	photonAutoClicksPerSecond: number;
	photonClickExpectedExcited: number;
	photonClickExpectedNormal: number;
	photonClickExpectedTotal: number;
	radiationActive: boolean;
	radiationAvgMultiplier: number;
	radiationMassGained: number;
	radiationMassLost: number;
	radiationTimeToEmpty: number;
	xpGained: number;
}

export interface PowerUp {
	description: string;
	duration: number;
	id: string;
	multiplier: number;
	name: string;
	startTime: number;
}

/** One line of a prestige modal's Resets, Keeps or Next run lists, led by the icons of the currencies it concerns. */
export interface PrestigeListItem {
	currencies?: CurrencyName[];
	label: string;
}

export interface Price {
	amount: number;
	currency: CurrencyName;
}

export interface RealmState {
	unlocked: boolean;
}

export type NumberNotation = 'scientific' | 'suffix';

export interface Settings {
	automation: {
		autoClick: boolean;
		autoClickPhotons: boolean;
		generators: GeneratorType[];
		upgrades: boolean;
	};
	display: {
		notation: NumberNotation;
	};
	gameplay: {
		offlineProgressEnabled: boolean;
	};
	upgrades: {
		displayAlreadyBought: boolean;
	};
}

export type SkillBranch = 'automation' | 'boosts' | 'core' | 'idle' | 'realms';

export interface SkillUpgrade {
	branch: SkillBranch;
	condition?: (manager: GameManager) => boolean;
	cost: Price;
	description: string;
	effects: Effect[];
	feature?: FeatureType;
	icon: IconName;
	id: string;
	name: string;
	position: { x: number; y: number };
	/** Player-facing text for `condition`, shown on the node while the condition is not met. */
	requirement?: string;
	requires?: string[];
}

export interface Upgrade {
	condition?: (state: GameManager) => boolean;
	cost: Price;
	description: string;
	effects: Effect[];
	icon?: IconName;
	id: string;
	name: string;
}

export type Range = [number, number];
