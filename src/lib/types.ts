import type { BuildingType } from '$data/buildings';
import type { CurrencyName } from '$data/currencies';
import type { DailyStats } from '$data/dailyQuests';
import type { IconName } from '$data/icons';
import type { RealmType } from '$data/realms';
import type { GameManager } from '$helpers/GameManager.svelte';
import type { IconStackSpec } from '$helpers/iconStacks';
import type { LayerType } from '$helpers/statConstants';
import type { ToastIcon } from '$stores/toasts.svelte';

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

export interface Building {
	cost: Price;
	count: number;
	level: number;
	rate: number;
	unlocked: boolean;
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

export type BuildingCountMap = Partial<Record<BuildingType, number>>;

export type CurrencyAmountMap = Partial<Record<CurrencyName, number>>;

export type CurrencyStateMap = Record<CurrencyName, CurrencyState>;

export interface Effect {
	apply: (currentValue: number, manager: GameManager) => number;
	description: string;
	/** Effects sharing a group have their contributions summed, then applied once as a single multiplier, instead of stacking multiplicatively. */
	group?: string;
	target?: BuildingType;
	type:
		| 'auto_buy'
		| 'auto_click'
		| 'auto_speed'
		| 'auto_upgrade'
		| 'building'
		| 'click'
		| 'electron_gain'
		| 'excited_auto_click'
		| 'excited_photon_chance'
		| 'excited_photon_double'
		| 'excited_photon_duration'
		| 'excited_photon_from_max'
		| 'excited_photon_stability'
		| 'global'
		| 'photon_auto_click'
		| 'photon_double_chance'
		| 'photon_duration'
		| 'photon_size'
		| 'photon_spawn_interval'
		| 'photon_stability'
		| 'power_up_duration'
		| 'power_up_interval'
		| 'power_up_multiplier'
		| 'proton_gain'
		| 'radiation_control_precision'
		| 'radiation_critical_chance'
		| 'radiation_enrichment'
		| 'radiation_mass_preservation'
		| 'radiation_mass_regen'
		| 'radiation_max_cpm'
		| 'stability_boost'
		| 'stability_capacity'
		| 'stability_speed'
		| 'xp_gain';
}

export type FeatureState = Record<string, boolean>;

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
	active: boolean;
	completed: boolean;
	/** Composite `${realmId}:${stepId}` keys of realm-tutorial steps already dismissed. */
	seenRealmSteps: string[];
	step: number;
}

export interface GameState {
	achievements: string[];
	activePowerUps: PowerUp[];
	buildings: Partial<Record<BuildingType, Building>>;
	currencies: CurrencyStateMap;
	currencyBoosts: CurrencyBoosts;
	dailyStats: DailyStats;
	features: FeatureState;
	highestAPS: number;
	inGameTime: number;
	lastInteractionTime: number;
	lastSave: number;
	photonUpgrades: Record<string, number>;
	powerUpsCollected: number;
	radiation: RadiationState;
	radiationUpgrades: Record<string, number>;
	realms: Record<RealmType, RealmState>;
	selectedRealmId?: RealmType;
	settings: Settings;
	skillUpgrades: string[];
	startDate: number;
	totalBuildingsPurchasedAllTime: number;
	totalClicksAllTime: number;
	totalClicksRun: number;
	totalElectronizesAllTime: number;
	totalElectronizesRun: number;
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
	autoBuyCounts: BuildingCountMap;
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

export interface Price {
	amount: number;
	currency: CurrencyName;
}

export interface RealmState {
	unlocked: boolean;
}

export interface Settings {
	automation: {
		autoClick: boolean;
		autoClickPhotons: boolean;
		buildings: BuildingType[];
		upgrades: boolean;
	};
	gameplay: {
		offlineProgressEnabled: boolean;
	};
	upgrades: {
		displayAlreadyBought: boolean;
	};
}

export interface SkillUpgrade {
	condition?: (manager: GameManager) => boolean;
	cost: Price;
	description: string;
	effects: Effect[];
	feature?: string;
	id: string;
	name: string;
	position: { x: number; y: number };
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
