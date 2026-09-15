import type { BuildingType } from '$data/buildings';

export interface BenchmarkConfig {
	botBehavior: BotBehavior;
	name: string;
	prestigeStrategy: PrestigeStrategy;
	/** Seeds the engine's power-up draws. Two runs of the same config and seed are identical. */
	seed?: number;
	snapshotInterval: number;
	targetHours: number;
	tickRate: number;
}

/** When set, bot only clicks during active windows (e.g. 15 min active / 45 min inactive per hour). */
export interface ActivityPattern {
	activeMinutes: number;
	inactiveMinutes: number;
}

export interface BotBehavior {
	activityPattern?: ActivityPattern;
	autoBuy: boolean;
	autoBuyBuildings: boolean;
	autoBuyPhotonUpgrades: boolean;
	autoBuySkills: boolean;
	autoBuyUpgrades: boolean;
	buyStrategy: 'balanced' | 'cheapest' | 'mostEfficient';
	clicksPerSecond: number;
	/** Bot game knowledge 0-1. Blends the naive base-rate building ranking (0) with the real marginal gain per atom spent (1). */
	gameKnowledge: number;
	/** Max buy+prestige actions per tick. undefined = no limit (Automated). */
	maxActionsPerTick?: number;
	/** Max protonises+electronizes per active window. undefined = no limit. */
	maxPrestigesPerActiveWindow?: number;
	questBehavior: QuestBehavior;
}

/** How a bot engages with daily quests: never claims, claims whatever completes naturally, or steers toward targets. */
export type QuestBehavior = 'dedicated' | 'ignore' | 'passive';

/** Thresholds are ratios against the previous run's gain, not absolute counts: reset once the next run is worth Nx the last. */
export interface PrestigeStrategy {
	autoElectronize: boolean;
	autoProtonise: boolean;
	electronizeThreshold: number;
	protoniseThreshold: number;
}

export interface SimulationSnapshot {
	achievements: number;
	/** Only the types the report inspects by id (upgrade, skill, photon_upgrade). Volume types are counted in actionCounts. */
	actions: SimulationAction[];
	actionCounts: Partial<Record<SimulationActionType, number>>;
	atoms: number;
	atomsCurrencyBoost: number;
	atomsEarnedAllTime: number;
	atomsPerClick: number;
	atomsPerSecond: number;
	/** APS with the power-up bonus divided back out: a live power-up otherwise reads as a 5x jump in the growth curve. */
	atomsPerSecondRaw: number;
	bonusMultiplier: number;
	buildingLevels: number;
	buildingLevelFactors: Partial<Record<BuildingType, number>>;
	buildingProductions: Partial<Record<BuildingType, number>>;
	buildingUpgradeFactors: Partial<Record<BuildingType, number>>;
	buildings: Record<BuildingType, number>;
	buildingsEverPurchased: string[];
	buildingsPurchased: number;
	clicks: number;
	dayNumber: number;
	electrons: number;
	electronizes: number;
	excitedPhotons: number;
	excitedPhotonsEarned: number;
	globalAchievementMultiplier: number;
	globalFlatMultiplier: number;
	globalLevelMultiplier: number;
	globalMultiplier: number;
	groupContributions: {
		achievementMul: number[];
		globalBoostTiers: number[];
		levelBoost: number[];
		protonBoost: number[];
		protoniseBoost: number[];
	};
	globalProtonBoostMultiplier: number;
	globalProtoniseMultiplier: number;
	globalSkillsMultiplier: number;
	/** Peak APS with the power-up bonus divided out, tracked per tick. Monotonic, so a prestige reset cannot fake a stall. */
	peakAtomsPerSecond: number;
	photons: number;
	photonsEarned: number;
	photonsExpired: number;
	photonUpgradeLevels: number;
	playerLevel: number;
	protons: number;
	protonises: number;
	quarks: number;
	quarksFromAchievements: number;
	quarksFromQuests: number;
	questsCompletedToday: number;
	questsCompletedTotal: number;
	questsOfferedTotal: number;
	radiationMultiplier: number;
	skillPointsUsed: number;
	skills: number;
	stabilityMultiplier: number;
	timestamp: number;
	totalBuildings: number;
	totalUpgrades: number;
	totalXP: number;
	upgrades: number;
}

export type SimulationActionType =
	| 'achievement'
	| 'building'
	| 'electronize'
	| 'photon_upgrade'
	| 'power_up'
	| 'protonise'
	| 'skill'
	| 'upgrade';

/** Action types kept in full on a snapshot; the rest only survive as counts and inside spike windows. */
export const DETAILED_ACTION_TYPES: ReadonlySet<SimulationActionType> = new Set<SimulationActionType>([
	'photon_upgrade',
	'skill',
	'upgrade',
]);

export interface SimulationAction {
	apsDelta?: number;
	details?: string;
	isFirstPurchase?: boolean;
	timestamp: number;
	type: SimulationActionType;
}

export function totalActionCount(counts: SimulationSnapshot['actionCounts'] | undefined): number {
	if (!counts) return 0;
	let total = 0;
	for (const count of Object.values(counts)) total += count ?? 0;
	return total;
}

export interface MilestoneDefinition {
	description: string;
	id: string;
	name: string;
}

export interface MilestoneHit {
	dayReached: number;
	milestone: MilestoneDefinition;
	timeReached: number;
}

export interface SpikeEvent {
	actions: SimulationAction[];
	apsEnd: number;
	apsStart: number;
	avgRatePerMin: number;
	peakRatePerMin: number;
	timestamp: number;
}

export interface SimulationResult {
	cancelled: boolean;
	config: BenchmarkConfig;
	durationMs: number;
	milestones: MilestoneHit[];
	snapshots: SimulationSnapshot[];
	spikes: SpikeEvent[];
}

/**
 * Fields a milestone predicate may read. Checked on every tick, so this is a mutable scratch object the engine reuses
 * and `buildingsEverPurchased` is the engine's own set rather than a copy.
 */
export interface MilestoneCheckData {
	achievements: number;
	atoms: number;
	atomsPerSecond: number;
	buildingsEverPurchased: ReadonlySet<string>;
	dayNumber: number;
	electronizes: number;
	electrons: number;
	excitedPhotons: number;
	photonUpgradeLevels: number;
	playerLevel: number;
	protonises: number;
	protons: number;
	quarks: number;
	skillPointsUsed: number;
	skills: number;
	timestamp: number;
	totalBuildings: number;
	upgrades: number;
}
