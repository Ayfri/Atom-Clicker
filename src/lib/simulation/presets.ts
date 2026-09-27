import { DEFAULT_SEED } from './random';
import type { BenchmarkConfig, QuestBehavior } from './types';

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
		autoBuyGenerators: true,
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
		autoBuyGenerators: true,
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
		autoBuyGenerators: true,
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
		autoBuyGenerators: true,
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

/** Everything the benchmark page and the CLI pick; `buildBenchmarkConfig` expands it into a full config. */
export interface BenchmarkForm {
	activityId: ActivityPresetId;
	playstyleId: PlaystylePresetId;
	prestigeId: PrestigePresetId;
	questBehavior: QuestBehavior;
	seed: number;
	snapshotInterval: number;
	targetHours: number;
}

const findKey = <T extends Record<string, object>>(presets: T, match: (preset: T[keyof T]) => boolean): keyof T | undefined =>
	(Object.keys(presets) as (keyof T)[]).find(key => match(presets[key]));

/** Infers the preset ids back from a saved config so its settings can be reloaded into the form. */
export function configToPresets(config: BenchmarkConfig): BenchmarkForm {
	const { botBehavior, prestigeStrategy } = config;
	const pattern = botBehavior.activityPattern;
	return {
		activityId:
			findKey(
				ACTIVITY_PRESETS,
				preset =>
					'activityPattern' in preset &&
					preset.activityPattern.activeMinutes === pattern?.activeMinutes &&
					preset.activityPattern.inactiveMinutes === pattern.inactiveMinutes,
			) ?? 'always',
		playstyleId:
			findKey(
				PLAYSTYLE_PRESETS,
				preset =>
					preset.tickRate === config.tickRate &&
					preset.buyStrategy === botBehavior.buyStrategy &&
					preset.clicksPerSecond === botBehavior.clicksPerSecond,
			) ?? 'balanced',
		prestigeId:
			findKey(
				PRESTIGE_PRESETS,
				preset =>
					preset.protoniseThreshold === prestigeStrategy.protoniseThreshold &&
					preset.electronizeThreshold === prestigeStrategy.electronizeThreshold,
			) ?? 'balanced',
		/** Reports saved before quests were simulated have no value to read. */
		questBehavior: botBehavior.questBehavior ?? 'passive',
		seed: config.seed ?? DEFAULT_SEED,
		snapshotInterval: config.snapshotInterval,
		targetHours: config.targetHours,
	};
}

export function buildBenchmarkConfig(form: BenchmarkForm): BenchmarkConfig {
	const activity = ACTIVITY_PRESETS[form.activityId];
	const playstyle = PLAYSTYLE_PRESETS[form.playstyleId];
	const prestige = PRESTIGE_PRESETS[form.prestigeId];
	return {
		botBehavior: {
			...('activityPattern' in activity && { activityPattern: activity.activityPattern }),
			autoBuy: playstyle.autoBuy,
			autoBuyGenerators: playstyle.autoBuyGenerators,
			autoBuyPhotonUpgrades: playstyle.autoBuyPhotonUpgrades,
			autoBuySkills: playstyle.autoBuySkills,
			autoBuyUpgrades: playstyle.autoBuyUpgrades,
			buyStrategy: playstyle.buyStrategy,
			clicksPerSecond: playstyle.clicksPerSecond,
			gameKnowledge: playstyle.gameKnowledge,
			...(playstyle.maxActionsPerTick !== undefined && { maxActionsPerTick: playstyle.maxActionsPerTick }),
			...(playstyle.maxPrestigesPerActiveWindow !== undefined && { maxPrestigesPerActiveWindow: playstyle.maxPrestigesPerActiveWindow }),
			questBehavior: form.questBehavior,
		},
		name: `${activity.name} · ${playstyle.name} · ${prestige.name}`,
		prestigeStrategy: {
			autoElectronize: prestige.autoElectronize,
			autoProtonise: prestige.autoProtonise,
			electronizeThreshold: prestige.electronizeThreshold,
			protoniseThreshold: prestige.protoniseThreshold,
		},
		seed: form.seed,
		snapshotInterval: form.snapshotInterval,
		targetHours: form.targetHours,
		tickRate: playstyle.tickRate,
	};
}

export const BOT_PROFILES = {
	afk: { activityId: 'afk_15', name: 'AFK', playstyleId: 'afk', prestigeId: 'balanced' },
	automated: { activityId: 'always', name: 'Automated', playstyleId: 'automated', prestigeId: 'ultra' },
	balanced: { activityId: 'always', name: 'Balanced', playstyleId: 'balanced', prestigeId: 'balanced' },
	tryhard: { activityId: 'always', name: 'Tryhard', playstyleId: 'tryhard', prestigeId: 'patient' },
} as const satisfies Record<string, { activityId: ActivityPresetId; name: string; playstyleId: PlaystylePresetId; prestigeId: PrestigePresetId }>;

export type BotProfileId = keyof typeof BOT_PROFILES;

/** A named profile with its playstyle's default quest behavior and snapshot interval. */
export function profileForm(id: BotProfileId, targetHours: number, seed = DEFAULT_SEED): BenchmarkForm {
	const { activityId, playstyleId, prestigeId } = BOT_PROFILES[id];
	const { questBehavior, snapshotInterval } = PLAYSTYLE_PRESETS[playstyleId];
	return { activityId, playstyleId, prestigeId, questBehavior, seed, snapshotInterval, targetHours };
}
