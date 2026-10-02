import { CurrenciesTypes } from '#data/currencies.js';
import { GENERATOR_TYPES, type GeneratorType, getGeneratorLevelMultiplier } from '#data/generators.js';
import { SKILL_UPGRADES } from '#data/skillTree.js';
import { UPGRADES } from '#data/upgrades.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { EffectTable, effectAmount } from '#helpers/effects.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { marginalProduction } from './purchases';
import type { QuestTracker } from './quests';
import type { SimulationAction, SimulationActionType, SimulationSnapshot } from './types';

const DAY_MS = 24 * 3600 * 1000;

/** Counters the engine accumulates over a run that the game managers do not track themselves. */
export interface RunState {
	/** Reset at every snapshot, so a snapshot holds what happened since the previous one. */
	actionCounts: Partial<Record<SimulationActionType, number>>;
	actions: SimulationAction[];
	everPurchasedGenerators: Set<string>;
	peakAtomsPerSecond: number;
	photonsExpired: number;
	quarksFromAchievements: number;
	quests: QuestTracker;
}

export function createSnapshotData(run: RunState): SimulationSnapshot {
	const effectSources = gameManager.allEffectSources;
	const generators = {} as Record<GeneratorType, number>;
	const generatorLevelFactors: Partial<Record<GeneratorType, number>> = {};
	const generatorPaybacks: Partial<Record<GeneratorType, number>> = {};
	const generatorUpgradeFactors: Partial<Record<GeneratorType, number>> = {};
	let totalGenerators = 0;
	let generatorLevels = 0;
	// The live bonus is divided out so a power-up running at sample time does not halve every payback for one row.
	const atoms = currenciesManager.getAmount(CurrenciesTypes.ATOMS);
	const bonus = gameManager.bonusMultiplier || 1;
	const rawAps = gameManager.atomsPerSecond / bonus;

	for (const type of GENERATOR_TYPES) {
		const generator = gameManager.generators[type];
		const count = generator?.count ?? 0;
		generators[type] = count;
		totalGenerators += count;
		generatorLevels += generator?.level ?? 0;
		const gain = marginalProduction(type, 1) / bonus;
		const cost = gameManager.getGeneratorCost(type, 1);
		const wait = cost <= atoms ? 0 : rawAps > 0 ? (cost - atoms) / rawAps : Infinity;
		if (gain > 0 && Number.isFinite(wait)) generatorPaybacks[type] = wait + cost / gain;

		if (generator && count > 0) {
			generatorUpgradeFactors[type] = gameManager.effects.value('generator', 1, gameManager, type);
			generatorLevelFactors[type] = getGeneratorLevelMultiplier(count, generator.level);
		}
	}

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

	const fold = (sources: typeof effectSources) => new EffectTable(sources).value('global', 1, gameManager);

	const ownedUpgrades = new Set<string>(gameManager.upgrades);
	const contributionOf = (id: string): number => {
		if (!ownedUpgrades.has(id)) return 1;
		const globalEffect = UPGRADES[id]?.effects.find(effect => effect.stat === 'global');
		return globalEffect ? effectAmount(globalEffect, gameManager) : 1;
	};
	const contributions = (prefix: string, count: number): number[] =>
		Array.from({ length: count }, (_, i) => contributionOf(`${prefix}_${i + 1}`));

	const globalBoostRaw = contributions('global_boost', 50);

	return {
		achievements: gameManager.achievements.length,
		actionCounts: { ...run.actionCounts },
		actions: [...run.actions],
		atoms,
		atomsCurrencyBoost: gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.ATOMS),
		atomsEarnedAllTime: currenciesManager.getEarnedAllTime(CurrenciesTypes.ATOMS),
		atomsPerClick: gameManager.clickPower,
		atomsPerSecond: gameManager.atomsPerSecond,
		atomsPerSecondRaw: rawAps,
		bonusMultiplier: gameManager.bonusMultiplier,
		generatorLevelFactors,
		generatorLevels,
		generatorPaybacks,
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
