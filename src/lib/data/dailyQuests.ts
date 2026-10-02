import { CHROMATIC_COLORS, type ChromaticColor } from '#data/chromatic.js';
import { formatNumber } from '#lib/utils.js';
import { simpleHash } from '#lib/utils/signing.js';

export type DailyStatMetric =
	| 'achievementsUnlocked'
	| 'atomsEarned'
	| 'chromaticBreaks'
	| 'chromaticColorBreaks'
	| 'clicks'
	| 'electronizes'
	| 'fuelInjected'
	| 'generatorsPurchased'
	| 'higgsBosonsCollected'
	| 'otherDailyQuestsCompleted'
	| 'powerUpsCollected'
	| 'protonises'
	| 'upgradesPurchased';

export interface DailyStats {
	achievementsUnlocked: number;
	atomsEarned: number;
	chromaticBreaks: number;
	/** Left out of the defaults so every day builds its own object, a shared nested default would carry counts over. */
	chromaticColorBreaks?: Record<ChromaticColor, number>;
	clicks: number;
	dayKey: string;
	electronizes: number;
	fuelInjected: number;
	generatorsPurchased: number;
	higgsBosonsCollected: number;
	otherDailyQuestsCompleted: number;
	powerUpsCollected: number;
	protonises: number;
	questIds: string[];
	/** Frozen at rollover, keyed by quest id, never recomputed live. */
	questTargets: Record<string, number>;
	upgradesPurchased: number;
}

export interface DailyQuestContext {
	/** How many times faster colored photons spawn than at the start, from Prism Frequency. */
	chromaticSpawnBoost: number;
	/** Fuel the electron bank and the next Electronize would buy. */
	fuelAffordable: number;
	hasElectronized: boolean;
	hasPhotonRealm: boolean;
	hasPrism: boolean;
	hasRadiationRealm: boolean;
	hasThirdQuestSlot: boolean;
	highestAPSRun: number;
	remainingAchievements: number;
}

export interface DailyQuest {
	description: (target: number) => string;
	/** Absolute floor, so a fresh or freshly-prestiged player never gets a trivial target. */
	floor: number;
	id: string;
	metric: DailyStatMetric;
	isAvailable?: (context: DailyQuestContext) => boolean;
	reward: number;
	/** Scales the target with progression, it never drops below `floor`. */
	target?: (context: DailyQuestContext) => number;
}

export const DAILY_QUEST_COUNT = 2;
const THIRD_DAILY_QUEST_ITEM_ID = 'convenience_third_daily_quest';

export const QUEST_POOL: DailyQuest[] = [
	{
		description: target => `Earn ${formatNumber(target)} atoms today.`,
		floor: 2_000,
		id: 'atoms_earned',
		metric: 'atomsEarned',
		reward: 1,
		target: context => context.highestAPSRun * 10_800, // three hours at the run's best rate
	},
	{
		description: target => `Purchase ${target} generators today.`,
		floor: 15,
		/** The id predates the generators rename, the server picks and stores daily claims under it. */
		id: 'buildings_purchased',
		metric: 'generatorsPurchased',
		reward: 1,
	},
	{
		description: target => `Break ${target} colored photons today.`,
		floor: 20,
		id: 'chromatic_breaks',
		isAvailable: context => context.hasPrism,
		metric: 'chromaticBreaks',
		reward: 1,
	},
	{
		description: target => `Break ${target} Red, Green and Blue photons each today.`,
		floor: 20,
		id: 'chromatic_each_color',
		isAvailable: context => context.hasPrism,
		metric: 'chromaticColorBreaks',
		reward: 1,
		/** Follows the spawn rate so it takes the same play time, 46 of each at max Prism Frequency. */
		target: context => 20 * context.chromaticSpawnBoost,
	},
	{
		description: target => `Click ${target} times today.`,
		floor: 500,
		id: 'clicks_100',
		metric: 'clicks',
		reward: 1,
	},
	{
		description: target => `Click ${target} times today.`,
		floor: 1_000,
		id: 'clicks_250',
		metric: 'clicks',
		reward: 1,
	},
	{
		description: target => `Collect ${target} power-ups today.`,
		floor: 3,
		id: 'power_ups_collected',
		metric: 'powerUpsCollected',
		reward: 1,
	},
	{
		description: target => `Unlock ${target} achievements today.`,
		floor: 10,
		id: 'achievements_ten',
		isAvailable: context => context.remainingAchievements > 10,
		metric: 'achievementsUnlocked',
		reward: 1,
	},
	{
		description: target => `Electronize ${target} times today.`,
		floor: 3,
		id: 'electronize_three_times',
		isAvailable: context => context.hasElectronized,
		metric: 'electronizes',
		reward: 1,
	},
	{
		description: target => `Inject ${formatNumber(target)} u of fuel into the reactor today.`,
		floor: 1,
		id: 'fuel_injected',
		isAvailable: context => context.hasRadiationRealm,
		metric: 'fuelInjected',
		reward: 1,
		/** Players hold fuel far above the CPM cap since a fuller core burns less at the same output, so only the bank bounds it. */
		target: context => context.fuelAffordable / 2,
	},
	{
		description: target => `Collect ${target} Higgs Bosons today.`,
		floor: 5,
		id: 'higgs_bosons_collected',
		isAvailable: context => context.hasPhotonRealm,
		metric: 'higgsBosonsCollected',
		reward: 1,
	},
	{
		description: () => `Complete the other 2 daily quests.`,
		floor: 2,
		id: 'complete_other_daily_quests',
		isAvailable: context => context.hasThirdQuestSlot,
		metric: 'otherDailyQuestsCompleted',
		reward: 1,
	},
	{
		description: () => `Protonize at least once today.`,
		floor: 1,
		id: 'protonise_once',
		metric: 'protonises',
		reward: 1,
	},
	{
		description: target => `Purchase ${target} upgrades today.`,
		floor: 8,
		id: 'upgrades_purchased',
		metric: 'upgradesPurchased',
		reward: 1,
	},
];

export function getQuestTarget(quest: DailyQuest, context: DailyQuestContext): number {
	return Math.max(quest.floor, Math.round(quest.target?.(context) ?? 0));
}

/** The day's progress on a metric, the color quest counts the color broken the least. */
export function getQuestProgress(metric: DailyStatMetric, stats: DailyStats): number {
	if (metric === 'chromaticColorBreaks') return Math.min(...CHROMATIC_COLORS.map(color => stats.chromaticColorBreaks?.[color] ?? 0));
	return stats[metric] ?? 0;
}

export function getDailyQuestCount(entitlements: readonly string[]): number {
	return entitlements.includes(THIRD_DAILY_QUEST_ITEM_ID) ? DAILY_QUEST_COUNT + 1 : DAILY_QUEST_COUNT;
}

/** Deterministic seeded shuffle so the client, the server and the benchmark always agree on a given UTC day. */
export function pickDailyQuests(dayKey: string, count = DAILY_QUEST_COUNT, context?: DailyQuestContext): DailyQuest[] {
	let seed = simpleHash(dayKey);
	const next = () => {
		// xorshift32, deterministic from the seed above
		seed ^= seed << 13;
		seed ^= seed >>> 17;
		seed ^= seed << 5;
		seed |= 0;
		return (seed >>> 0) / 0xffffffff;
	};

	const shuffled = context ? QUEST_POOL.filter(quest => quest.isAvailable?.(context) ?? true) : [...QUEST_POOL];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(next() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled.slice(0, count);
}

export function getDailyCap(quests: DailyQuest[]): number {
	return quests.reduce((sum, quest) => sum + quest.reward, 0);
}
