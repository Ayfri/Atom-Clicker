import { CurrenciesTypes } from '$data/currencies';
import { GENERATOR_TYPES, type GeneratorType, getGeneratorLevelMultiplier } from '$data/generators';
import { SKILL_UPGRADES } from '$data/skillTree';
import { UPGRADES } from '$data/upgrades';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { foldEffects } from '$helpers/effects';
import { gameManager } from '$helpers/GameManager.svelte';
import type { QuestTracker } from './quests';
import type { MilestoneCheckData, SimulationAction, SimulationActionType, SimulationSnapshot } from './types';

const DAY_MS = 24 * 3600 * 1000;

export interface RunState {
	actionCounts: Partial<Record<SimulationActionType, number>>;
	actions: SimulationAction[];
	everPurchasedGenerators: Set<string>;
	peakAtomsPerSecond: number;
	photonsExpired: number;
	quarksFromAchievements: number;
	quests: QuestTracker;
}

/**
 * Milestone predicates read a handful of counters, so between-snapshot checks skip the full snapshot build.
 * The engine checks every tick, so the target object is written in place instead of allocated per call.
 */
export function fillMilestoneData(run: RunState, target: MilestoneCheckData): MilestoneCheckData {
	let totalGenerators = 0;
	for (const type of GENERATOR_TYPES) totalGenerators += gameManager.generators[type]?.count ?? 0;

	target.achievements = gameManager.achievements.length;
	target.atoms = currenciesManager.getAmount(CurrenciesTypes.ATOMS);
	target.atomsPerSecond = gameManager.atomsPerSecond;
	target.generatorsEverPurchased = run.everPurchasedGenerators;
	target.dayNumber = gameManager.inGameTime / DAY_MS;
	target.electronizes = gameManager.totalElectronizesAllTime;
	target.electrons = currenciesManager.getAmount(CurrenciesTypes.ELECTRONS);
	target.excitedPhotons = currenciesManager.getAmount(CurrenciesTypes.EXCITED_PHOTONS);
	target.photonUpgradeLevels = gameManager.photonUpgradeLevels;
	target.playerLevel = gameManager.playerLevel;
	target.protonises = gameManager.totalProtonisesAllTime;
	target.protons = currenciesManager.getAmount(CurrenciesTypes.PROTONS);
	target.quarks = run.quarksFromAchievements + run.quests.quarks;
	target.boostPointsUsed = gameManager.boostPointsUsed;
	target.skills = gameManager.skillUpgrades.length;
	target.timestamp = gameManager.inGameTime;
	target.totalGenerators = totalGenerators;
	target.upgrades = gameManager.upgrades.length;
	return target;
}

export function createSnapshotData(run: RunState): SimulationSnapshot {
	const effectSources = gameManager.allEffectSources;
	const generators = {} as Record<GeneratorType, number>;
	const generatorLevelFactors: Partial<Record<GeneratorType, number>> = {};
	const generatorUpgradeFactors: Partial<Record<GeneratorType, number>> = {};
	let totalGenerators = 0;
	let generatorLevels = 0;

	for (const type of GENERATOR_TYPES) {
		const generator = gameManager.generators[type];
		const count = generator?.count ?? 0;
		generators[type] = count;
		totalGenerators += count;
		generatorLevels += generator?.level ?? 0;

		if (generator && count > 0) {
			const effectiveRate = foldEffects(effectSources, gameManager, generator.rate, { target: type, type: 'generator' });
			generatorUpgradeFactors[type] = effectiveRate / generator.rate;
			generatorLevelFactors[type] = getGeneratorLevelMultiplier(count, generator.level);
		}
	}

	// One pass over the effect sources; each group used to filter the whole list on its own.
	const skillSources: typeof effectSources = [];
	const flatSources: typeof effectSources = [];
	const achievementSources: typeof effectSources = [];
	const levelSources: typeof effectSources = [];
	const protonBoostSources: typeof effectSources = [];
	const protoniseSources: typeof effectSources = [];

	for (const source of effectSources) {
		const id = source.id;
		if (id in SKILL_UPGRADES) skillSources.push(source);
		if (id.startsWith('global_boost_')) flatSources.push(source);
		else if (id.startsWith('global_achievements_mul_')) achievementSources.push(source);
		else if (id.startsWith('level_boost_')) levelSources.push(source);
		else if (id.startsWith('proton_boost_')) protonBoostSources.push(source);
		else if (id.startsWith('protonise_boost_')) protoniseSources.push(source);
	}

	const globalOptions = { type: 'global' as const };
	const fold = (sources: typeof effectSources) => foldEffects(sources, gameManager, 1, globalOptions);

	const ownedUpgrades = new Set<string>(gameManager.upgrades);
	const contributionOf = (id: string): number => {
		if (!ownedUpgrades.has(id)) return 1;
		const globalEffect = UPGRADES[id]?.effects.find(effect => effect.type === 'global');
		return globalEffect ? globalEffect.apply(1, gameManager) : 1;
	};
	const contributions = (prefix: string, count: number): number[] =>
		Array.from({ length: count }, (_, i) => contributionOf(`${prefix}_${i + 1}`));

	const globalBoostRaw = contributions('global_boost', 50);

	return {
		achievements: gameManager.achievements.length,
		actionCounts: { ...run.actionCounts },
		actions: [...run.actions],
		atoms: currenciesManager.getAmount(CurrenciesTypes.ATOMS),
		atomsCurrencyBoost: gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.ATOMS),
		atomsEarnedAllTime: currenciesManager.getEarnedAllTime(CurrenciesTypes.ATOMS),
		atomsPerClick: gameManager.clickPower,
		atomsPerSecond: gameManager.atomsPerSecond,
		atomsPerSecondRaw: gameManager.atomsPerSecond / (gameManager.bonusMultiplier || 1),
		bonusMultiplier: gameManager.bonusMultiplier,
		generatorLevelFactors,
		generatorLevels,
		generatorProductions: { ...gameManager.generatorProductions },
		generatorUpgradeFactors,
		generators,
		generatorsEverPurchased: [...run.everPurchasedGenerators],
		generatorsPurchased: gameManager.totalGeneratorsPurchasedAllTime,
		clicks: gameManager.totalClicksAllTime,
		dayNumber: gameManager.inGameTime / DAY_MS,
		electrons: currenciesManager.getAmount(CurrenciesTypes.ELECTRONS),
		electronizes: gameManager.totalElectronizesAllTime,
		excitedPhotons: currenciesManager.getAmount(CurrenciesTypes.EXCITED_PHOTONS),
		excitedPhotonsEarned: currenciesManager.getEarnedAllTime(CurrenciesTypes.EXCITED_PHOTONS),
		globalAchievementMultiplier: fold(achievementSources),
		globalFlatMultiplier: fold(flatSources),
		globalLevelMultiplier: fold(levelSources),
		globalMultiplier: gameManager.globalMultiplier,
		globalProtonBoostMultiplier: fold(protonBoostSources),
		globalProtoniseMultiplier: fold(protoniseSources),
		globalSkillsMultiplier: fold(skillSources),
		groupContributions: {
			achievementMul: contributions('global_achievements_mul', 11),
			globalBoostTiers: Array.from({ length: 5 }, (_, tier) =>
				globalBoostRaw.slice(tier * 10, tier * 10 + 10).reduce((acc, value) => acc * value, 1),
			),
			levelBoost: contributions('level_boost', 10),
			protonBoost: contributions('proton_boost', 10),
			protoniseBoost: contributions('protonise_boost', 5),
		},
		peakAtomsPerSecond: run.peakAtomsPerSecond,
		photons: currenciesManager.getAmount(CurrenciesTypes.PHOTONS),
		photonsEarned: currenciesManager.getEarnedAllTime(CurrenciesTypes.PHOTONS),
		photonsExpired: run.photonsExpired,
		photonUpgradeLevels: gameManager.photonUpgradeLevels,
		playerLevel: gameManager.playerLevel,
		protons: currenciesManager.getAmount(CurrenciesTypes.PROTONS),
		protonises: gameManager.totalProtonisesAllTime,
		quarks: run.quarksFromAchievements + run.quests.quarks,
		quarksFromAchievements: run.quarksFromAchievements,
		quarksFromQuests: run.quests.quarks,
		questsCompletedToday: run.quests.completedToday,
		questsCompletedTotal: run.quests.completedTotal,
		questsOfferedTotal: run.quests.offeredTotal,
		radiationMultiplier: gameManager.radiationMultiplier,
		boostPointsUsed: gameManager.boostPointsUsed,
		skills: gameManager.skillUpgrades.length,
		stabilityMultiplier: gameManager.stabilityMultiplier,
		timestamp: gameManager.inGameTime,
		totalGenerators,
		totalUpgrades: gameManager.totalUpgradesPurchasedAllTime,
		totalXP: gameManager.totalXP,
		upgrades: gameManager.upgrades.length,
	};
}
