import type { ActivityPattern, BenchmarkConfig, QuestBehavior } from './types';

export const ACTIVITY_PRESETS = {
	always: {
		id: 'always',
		name: 'Always active',
	},
	afk_5: {
		activityPattern: { activeMinutes: 5, inactiveMinutes: 55 },
		id: 'afk_5',
		name: 'AFK (5 min/h)',
	},
	afk_15: {
		activityPattern: { activeMinutes: 15, inactiveMinutes: 45 },
		id: 'afk_15',
		name: 'AFK (15 min/h)',
	},
} as const;

export type ActivityPresetId = keyof typeof ACTIVITY_PRESETS;

/** How the bot plays when active: strategy, knowledge, limits. Automated = no limits. */
export const PLAYSTYLE_PRESETS = {
	afk: {
		autoBuy: true,
		autoBuyBuildings: true,
		autoBuyPhotonUpgrades: false,
		autoBuySkills: true,
		autoBuyUpgrades: true,
		buyStrategy: 'cheapest' as const,
		clicksPerSecond: 2,
		gameKnowledge: 0.3,
		id: 'afk',
		maxActionsPerTick: 2,
		maxPrestigesPerActiveWindow: 1,
		name: 'AFK-style',
		questBehavior: 'passive' as const,
		snapshotInterval: 300,
		tickRate: 1000,
	},
	automated: {
		autoBuy: true,
		autoBuyBuildings: true,
		autoBuyPhotonUpgrades: true,
		autoBuySkills: true,
		autoBuyUpgrades: true,
		buyStrategy: 'mostEfficient' as const,
		clicksPerSecond: 15,
		gameKnowledge: 1.0,
		id: 'automated',
		maxActionsPerTick: undefined,
		maxPrestigesPerActiveWindow: undefined,
		name: 'Automated (no limits)',
		questBehavior: 'dedicated' as const,
		snapshotInterval: 60,
		tickRate: 100,
	},
	balanced: {
		autoBuy: true,
		autoBuyBuildings: true,
		autoBuyPhotonUpgrades: true,
		autoBuySkills: true,
		autoBuyUpgrades: true,
		buyStrategy: 'balanced' as const,
		clicksPerSecond: 3,
		gameKnowledge: 0.6,
		id: 'balanced',
		maxActionsPerTick: 5,
		maxPrestigesPerActiveWindow: 2,
		name: 'Balanced',
		questBehavior: 'passive' as const,
		snapshotInterval: 120,
		tickRate: 500,
	},
	tryhard: {
		autoBuy: true,
		autoBuyBuildings: true,
		autoBuyPhotonUpgrades: true,
		autoBuySkills: true,
		autoBuyUpgrades: true,
		buyStrategy: 'mostEfficient' as const,
		clicksPerSecond: 8,
		gameKnowledge: 0.9,
		id: 'tryhard',
		maxActionsPerTick: 10,
		maxPrestigesPerActiveWindow: 3,
		name: 'Tryhard',
		questBehavior: 'dedicated' as const,
		snapshotInterval: 60,
		tickRate: 250,
	},
} as const;

export type PlaystylePresetId = keyof typeof PLAYSTYLE_PRESETS;

/** When to prestige, as a multiple of the previous run's gain. Higher threshold = fewer prestiges, each more impactful. */
export const PRESTIGE_PRESETS = {
	early: {
		autoElectronize: true,
		autoProtonise: true,
		electronizeThreshold: 1,
		id: 'early',
		name: 'Early (1x)',
		protoniseThreshold: 1,
	},
	balanced: {
		autoElectronize: true,
		autoProtonise: true,
		electronizeThreshold: 5,
		id: 'balanced',
		name: 'Balanced (5x)',
		protoniseThreshold: 5,
	},
	late: {
		autoElectronize: true,
		autoProtonise: true,
		electronizeThreshold: 15,
		id: 'late',
		name: 'Late (15x)',
		protoniseThreshold: 15,
	},
	patient: {
		autoElectronize: true,
		autoProtonise: true,
		electronizeThreshold: 50,
		id: 'patient',
		name: 'Patient (50x)',
		protoniseThreshold: 50,
	},
	ultra: {
		autoElectronize: true,
		autoProtonise: true,
		electronizeThreshold: 100,
		id: 'ultra',
		name: 'Ultra (100x)',
		protoniseThreshold: 100,
	},
} as const;

export type PrestigePresetId = keyof typeof PRESTIGE_PRESETS;

/** Infer preset IDs from a saved config so the form (selects, target hours) can be updated. */
export function configToPresets(config: BenchmarkConfig): {
	activityId: ActivityPresetId;
	playstyleId: PlaystylePresetId;
	prestigeId: PrestigePresetId;
	questBehavior: QuestBehavior;
	targetHours: number;
} {
	const { botBehavior, prestigeStrategy, snapshotInterval, targetHours, tickRate } = config;

	const activityId: ActivityPresetId = (() => {
		const ap = botBehavior.activityPattern;
		if (!ap) return 'always';
		const key = Object.entries(ACTIVITY_PRESETS).find(
			([_, a]) =>
				'activityPattern' in a &&
				a.activityPattern?.activeMinutes === ap.activeMinutes &&
				a.activityPattern?.inactiveMinutes === ap.inactiveMinutes,
		)?.[0];
		return (key as ActivityPresetId) ?? 'always';
	})();

	const prestigeId: PrestigePresetId = (() => {
		const key = Object.entries(PRESTIGE_PRESETS).find(
			([_, p]) =>
				p.protoniseThreshold === prestigeStrategy.protoniseThreshold &&
				p.electronizeThreshold === prestigeStrategy.electronizeThreshold,
		)?.[0];
		return (key as PrestigePresetId) ?? 'balanced';
	})();

	const playstyleId: PlaystylePresetId = (() => {
		const key = Object.entries(PLAYSTYLE_PRESETS).find(
			([_, p]) =>
				p.tickRate === tickRate &&
				p.snapshotInterval === snapshotInterval &&
				p.buyStrategy === botBehavior.buyStrategy &&
				p.clicksPerSecond === botBehavior.clicksPerSecond,
		)?.[0];
		return (key as PlaystylePresetId) ?? 'balanced';
	})();

	// Reports saved before questBehavior existed have no value to read.
	const questBehavior: QuestBehavior = botBehavior.questBehavior ?? 'passive';

	return { activityId, playstyleId, prestigeId, questBehavior, targetHours };
}

export function buildBenchmarkConfig(
	activityId: ActivityPresetId,
	playstyleId: PlaystylePresetId,
	prestigeId: PrestigePresetId,
	targetHours: number,
	snapshotIntervalOverride?: number,
	questBehaviorOverride?: QuestBehavior,
): BenchmarkConfig {
	const activity = ACTIVITY_PRESETS[activityId];
	const playstyle = PLAYSTYLE_PRESETS[playstyleId];
	const prestige = PRESTIGE_PRESETS[prestigeId];
	const activityPattern = 'activityPattern' in activity ? activity.activityPattern : undefined;
	return {
		botBehavior: {
			...(activityPattern && { activityPattern }),
			autoBuy: playstyle.autoBuy,
			autoBuyBuildings: playstyle.autoBuyBuildings,
			autoBuyPhotonUpgrades: playstyle.autoBuyPhotonUpgrades,
			autoBuySkills: playstyle.autoBuySkills,
			autoBuyUpgrades: playstyle.autoBuyUpgrades,
			buyStrategy: playstyle.buyStrategy,
			clicksPerSecond: playstyle.clicksPerSecond,
			gameKnowledge: playstyle.gameKnowledge,
			...(playstyle.maxActionsPerTick !== undefined && { maxActionsPerTick: playstyle.maxActionsPerTick }),
			...(playstyle.maxPrestigesPerActiveWindow !== undefined && {
				maxPrestigesPerActiveWindow: playstyle.maxPrestigesPerActiveWindow,
			}),
			questBehavior: questBehaviorOverride ?? playstyle.questBehavior,
		},
		name: `${activity.name} · ${playstyle.name} · ${prestige.name}`,
		prestigeStrategy: {
			autoElectronize: prestige.autoElectronize,
			autoProtonise: prestige.autoProtonise,
			electronizeThreshold: prestige.electronizeThreshold,
			protoniseThreshold: prestige.protoniseThreshold,
		},
		snapshotInterval: snapshotIntervalOverride ?? playstyle.snapshotInterval,
		targetHours,
		tickRate: playstyle.tickRate,
	};
}

export const BOT_PROFILES = {
	afk: {
		activityId: 'afk_15' as const,
		playstyleId: 'afk' as const,
		prestigeId: 'balanced' as const,
	},
	automated: {
		activityId: 'always' as const,
		playstyleId: 'automated' as const,
		prestigeId: 'ultra' as const,
	},
	balanced: {
		activityId: 'always' as const,
		playstyleId: 'balanced' as const,
		prestigeId: 'balanced' as const,
	},
	tryhard: {
		activityId: 'always' as const,
		playstyleId: 'tryhard' as const,
		prestigeId: 'patient' as const,
	},
} as const;

export type BotProfileName = keyof typeof BOT_PROFILES;
