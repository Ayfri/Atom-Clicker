import { CurrenciesTypes } from '$data/currencies';
import { FeatureTypes } from '$data/features';
import { GENERATORS, GENERATOR_TYPES, type GeneratorData, type GeneratorType } from '$data/generators';
import { mul } from '$helpers/effects';
import type { SkillUpgrade } from '$lib/types';

export const SKILL_GRID = {
	x: 440,
	y: 240,
};

function gridPos(x: number, y: number) {
	return {
		x: x * SKILL_GRID.x,
		y: y * SKILL_GRID.y,
	};
}

/** Lays out the i-th node of a 3-tall block column by column, alternating direction so consecutive nodes stay adjacent, odd columns sit half a cell lower. */
function snakePos(startX: number, startY: number, i: number, direction: 1 | -1) {
	const column = Math.floor(i / 3);
	const row = column % 2 === 0 ? i % 3 : 2.5 - (i % 3);
	return gridPos(startX + column * direction, startY + row);
}

function createGeneratorsSkillUpgrades(
	skillData: (generatorType: GeneratorType, generator: GeneratorData, i: number) => SkillUpgrade,
): Record<string, SkillUpgrade> {
	return Object.fromEntries(
		Object.entries(GENERATORS).map(([generatorType, generator], i) => {
			const builtSkillData = skillData?.(generatorType as GeneratorType, generator, i);
			return [builtSkillData.id, builtSkillData];
		}),
	);
}

export const SKILL_UPGRADES: Record<string, SkillUpgrade> = {
	// TIER 1 - FOUNDATION (Atoms, cheap)

	globalMultiplier: {
		cost: { amount: 5_000, currency: CurrenciesTypes.ATOMS },
		description: '2x atoms production',
		effects: [mul('global', 2)],
		id: 'globalMultiplier',
		name: 'Global Multiplier',
		position: gridPos(0, 0),
	},

	unlockLevels: {
		cost: { amount: 10_000, currency: CurrenciesTypes.ATOMS },
		description: 'Unlock the leveling system',
		effects: [],
		feature: FeatureTypes.LEVELS,
		id: 'unlockLevels',
		name: 'Unlock Levels',
		position: gridPos(1, 0),
		requires: ['globalMultiplier'],
	},

	// TIER 2 - EARLY PROGRESSION (Atoms, medium)

	atomicStability: {
		cost: { amount: 100_000, currency: CurrenciesTypes.ATOMS },
		description: '1.5x production for first 3 generator types',
		effects: [mul('generator', 1.5, 'molecule'), mul('generator', 1.5, 'crystal'), mul('generator', 1.5, 'nanostructure')],
		id: 'atomicStability',
		name: 'Atomic Stability',
		position: gridPos(-1, 0),
		requires: ['globalMultiplier'],
	},

	clickMastery: {
		cost: { amount: 250_000, currency: CurrenciesTypes.ATOMS },
		description: '+10% production per 100 total clicks',
		effects: [mul('global', manager => 1 + Math.floor(manager.totalClicksRun / 100) * 0.1)],
		id: 'clickMastery',
		name: 'Click Mastery',
		position: gridPos(1, 1),
		requires: ['unlockLevels'],
	},

	levelMastery: {
		cost: { amount: 500_000, currency: CurrenciesTypes.ATOMS },
		description: '+20% atoms production per 10 levels',
		effects: [mul('global', manager => 1 + Math.floor(manager.playerLevel / 10) * 0.2)],
		id: 'levelMastery',
		name: 'Level Mastery',
		position: gridPos(2, 0),
		requires: ['unlockLevels'],
	},

	molecularBoost: {
		cost: { amount: 1_000_000, currency: CurrenciesTypes.ATOMS },
		description: '3x Molecule and Crystal production',
		effects: [mul('generator', 3, 'molecule'), mul('generator', 3, 'crystal')],
		id: 'molecularBoost',
		name: 'Molecular Boost',
		position: gridPos(-2, 0),
		requires: ['atomicStability'],
	},

	// TIER 3 - MID GAME (Atoms expensive / Protons cheap)

	nanoEnhancement: {
		cost: { amount: 2_500_000, currency: CurrenciesTypes.ATOMS },
		description: '2.5x Nanostructure production',
		effects: [mul('generator', 2.5, 'nanostructure')],
		id: 'nanoEnhancement',
		name: 'Nano Enhancement',
		position: gridPos(-2, 1),
		requires: ['molecularBoost'],
	},

	offlineProgress: {
		cost: { amount: 2_000_000, currency: CurrenciesTypes.ATOMS },
		description: 'Enable offline progress when you are away',
		effects: [],
		feature: FeatureTypes.OFFLINE_PROGRESS,
		id: 'offlineProgress',
		name: 'Offline Progress',
		position: gridPos(2, 1),
		requires: ['clickMastery'],
	},

	biologicalAmplifier: {
		cost: { amount: 5_000_000, currency: CurrenciesTypes.ATOMS },
		description: '2.5x Micro-organism production',
		effects: [mul('generator', 2.5, 'microorganism')],
		id: 'biologicalAmplifier',
		name: 'Biological Amplifier',
		position: gridPos(-1, 1),
		requires: ['nanoEnhancement'],
	},

	geologicalForce: {
		cost: { amount: 15_000_000, currency: CurrenciesTypes.ATOMS },
		description: '2x Rock and Planet production',
		effects: [mul('generator', 2, 'rock'), mul('generator', 2, 'planet')],
		id: 'geologicalForce',
		name: 'Geological Force',
		position: gridPos(-1, 2),
		requires: ['biologicalAmplifier'],
	},

	powerUpMastery: {
		cost: { amount: 10_000_000, currency: CurrenciesTypes.ATOMS },
		description: '0.9x power-up interval, 1.1x duration',
		effects: [mul('power_up_interval', 0.9), mul('power_up_duration', 1.1)],
		id: 'powerUpMastery',
		name: 'Power-up Mastery',
		position: gridPos(2, 2),
		requires: ['offlineProgress'],
	},

	purpleRealm: {
		cost: { amount: 10_000_000_000, currency: CurrenciesTypes.ATOMS },
		description: 'Unlock the mysterious purple realm',
		effects: [],
		feature: FeatureTypes.PURPLE_REALM,
		id: 'purpleRealm',
		name: 'Purple Realm',
		position: gridPos(1, 2.5),
		requires: ['powerUpMastery'],
	},

	// TIER 4 - PROTON BRANCH (Protons) - Snakes UP on the left (negative y)

	stabilityField: {
		cost: { amount: 250, currency: CurrenciesTypes.PROTONS },
		description: 'Unlock the Stability Meter (Passive Idle Bonus)',
		effects: [],
		feature: FeatureTypes.STABILITY_FIELD,
		id: 'stabilityField',
		name: 'Stability Field',
		position: gridPos(0, -1),
		requires: ['globalMultiplier'],
	},

	boostAssignAll: {
		cost: { amount: 100, currency: CurrenciesTypes.PROTONS },
		description: 'Adds a Max button to each currency boost that assigns every free point at once',
		effects: [],
		feature: FeatureTypes.BOOST_ASSIGN_ALL,
		id: 'boostAssignAll',
		name: 'Boost Dump',
		position: gridPos(0, -2),
		requires: ['stabilityField'],
	},

	boostEvenSplit: {
		cost: { amount: 500, currency: CurrenciesTypes.PROTONS },
		description: 'Adds a Balance button that spreads your boost points evenly across every currency you have earned',
		effects: [],
		feature: FeatureTypes.BOOST_EVEN_SPLIT,
		id: 'boostEvenSplit',
		name: 'Boost Balancer',
		position: gridPos(0, -3),
		requires: ['boostAssignAll'],
	},

	electronHarvester: {
		cost: { amount: 2_500, currency: CurrenciesTypes.PROTONS },
		description: '2x electron gain',
		effects: [mul('electron_gain', 2)],
		id: 'electronHarvester',
		name: 'Electron Harvester',
		position: gridPos(-1, -1),
		requires: ['stabilityField'],
	},

	protonCollector: {
		cost: { amount: 25_000, currency: CurrenciesTypes.PROTONS },
		description: '1.5x proton gain',
		effects: [mul('proton_gain', 1.5)],
		id: 'protonCollector',
		name: 'Proton Collector',
		position: gridPos(-2, -1.5),
		requires: ['electronHarvester'],
	},

	prestigeBonus: {
		cost: { amount: 250_000, currency: CurrenciesTypes.PROTONS },
		description: '+1% production per Electronize',
		effects: [mul('global', manager => 1 + manager.totalElectronizesAllTime * 0.01)],
		id: 'prestigeBonus',
		name: 'Prestige Bonus',
		position: gridPos(-2, -2.5),
		requires: ['protonCollector'],
	},

	quantumResonance: {
		cost: { amount: 2_500_000, currency: CurrenciesTypes.PROTONS },
		description: '+20% production per 100 generators owned',
		effects: [mul('global', manager => 1 + Math.floor(manager.generatorTotals.count / 100) * 0.2)],
		id: 'quantumResonance',
		name: 'Quantum Resonance',
		position: gridPos(-1, -2),
		requires: ['prestigeBonus'],
	},

	stellarCore: {
		condition: state => (state.generators.star?.count ?? 0) >= 5,
		cost: { amount: 25_000_000, currency: CurrenciesTypes.PROTONS },
		requirement: 'Own 5 Stars',
		description: '2x production for Star and higher generators',
		effects: [mul('generator', 2, 'star'), mul('generator', 2, 'neutronStar'), mul('generator', 2, 'blackHole')],
		id: 'stellarCore',
		name: 'Stellar Core',
		position: gridPos(-1, -3),
		requires: ['quantumResonance'],
	},

	particleAccelerator: {
		cost: { amount: 250_000_000, currency: CurrenciesTypes.PROTONS },
		description: '+25% production per Protonise',
		effects: [mul('global', manager => 1 + manager.totalProtonisesRun * 0.25)],
		id: 'particleAccelerator',
		name: 'Particle Accelerator',
		position: gridPos(-2, -3.5),
		requires: ['stellarCore'],
	},

	// TIER 5 - ELECTRON/PHOTON BRANCH (Snakes UP on the right)

	communityPower: {
		cost: { amount: 1_000, currency: CurrenciesTypes.PROTONS },
		description: '1% atom boost per thousand registered players',
		effects: [mul('global', manager => 1 + manager.totalUsers / 100_000)],
		id: 'communityPower',
		name: 'Community Power',
		position: gridPos(1, -1),
		requires: ['stabilityField'],
	},

	cosmicSynergy: {
		cost: { amount: 10, currency: CurrenciesTypes.ELECTRONS },
		description: '+5% production per generator type owned',
		effects: [mul('global', manager => 1 + GENERATOR_TYPES.filter(type => (manager.generators[type]?.count ?? 0) > 0).length * 0.05)],
		id: 'cosmicSynergy',
		name: 'Cosmic Synergy',
		position: gridPos(2, -1.5),
		requires: ['communityPower'],
	},

	hoverCollection: {
		condition: manager => Object.keys(manager.photonUpgrades || {}).length >= 1,
		cost: { amount: 1_000, currency: CurrenciesTypes.PHOTONS },
		requirement: 'Own 1 photon upgrade',
		description: 'Collect photons by hovering over them',
		effects: [],
		feature: FeatureTypes.HOVER_COLLECTION,
		id: 'hoverCollection',
		name: 'Quantum Magnetism',
		position: gridPos(2, -2.5),
		requires: ['cosmicSynergy'],
	},

	photonEfficiency: {
		condition: state => Object.keys(state.photonUpgrades || {}).length >= 3,
		cost: { amount: 5_000, currency: CurrenciesTypes.PHOTONS },
		requirement: 'Own 3 photon upgrades',
		description: '+1% all production per photon upgrade owned',
		effects: [mul('global', manager => 1 + manager.photonUpgradeLevels * 0.01)],
		id: 'photonEfficiency',
		name: 'Photon Efficiency',
		position: gridPos(1, -2),
		requires: ['hoverCollection'],
	},

	photonProtonBoost: {
		cost: { amount: 10_000, currency: CurrenciesTypes.PHOTONS },
		description: 'Add 1% protons per photon upgrade owned',
		effects: [mul('proton_gain', manager => 1 + manager.photonUpgradeLevels * 0.01)],
		id: 'photonProtonBoost',
		name: 'Photon Proton Boost',
		position: gridPos(1, -3),
		requires: ['photonEfficiency'],
	},

	radiationRealm: {
		cost: { amount: 100, currency: CurrenciesTypes.ELECTRONS },
		description: 'Unlock the Radiation Realm - harness nuclear decay',
		effects: [],
		feature: FeatureTypes.RADIATION_REALM,
		id: 'radiationRealm',
		name: 'Radiation Realm',
		position: gridPos(2, -3.5),
		requires: ['photonProtonBoost'],
	},

	// GENERATOR MULTIPLIER BRANCH (Left side, requires 100 of each generator)

	...createGeneratorsSkillUpgrades((generatorType, generator, i) => {
		const previousGeneratorType = GENERATOR_TYPES[i - 1];
		const baseCost = 1_000_000 * Math.pow(10, i);

		return {
			condition: manager => (manager.generators[generatorType]?.count ?? 0) >= 100,
			cost: { amount: baseCost, currency: CurrenciesTypes.ATOMS },
			requirement: `Own 100 ${generator.name}`,
			description: `2x ${generator.name} production`,
			effects: [mul('generator', 2, generatorType)],
			id: `${generatorType}Multiplier`,
			name: `${generator.name} Multiplier`,
			position: snakePos(-2, 2, i, -1),
			requires: previousGeneratorType ? [`${previousGeneratorType}Multiplier`] : ['geologicalForce'],
		} satisfies SkillUpgrade;
	}),

	// GENERATOR LEVEL MASTERY BRANCH (Right side, generator level-based bonuses)

	...createGeneratorsSkillUpgrades((generatorType, generator, i) => {
		const previousGeneratorType = GENERATOR_TYPES[i - 1];
		// 30x per node so the branch spans several protonise runs instead of being fully bought at 5e14 atoms in the first one.
		const baseCost = 5_000_000 * Math.pow(30, i);

		return {
			cost: { amount: baseCost, currency: CurrenciesTypes.ATOMS },
			description: `+10% ${generator.name} production per 25 ${generator.name} levels`,
			effects: [mul('generator', manager => 1 + Math.floor((manager.generators[generatorType]?.level ?? 0) / 25) * 0.1, generatorType)],
			id: `${generatorType}LevelMastery`,
			name: `${generator.name} Level Mastery`,
			position: snakePos(3, 0, i, 1),
			requires: previousGeneratorType ? [`${previousGeneratorType}LevelMastery`] : ['levelMastery'],
		} satisfies SkillUpgrade;
	}),
};

// Check for duplicate positions in dev mode
if (import.meta.env.DEV) {
	const positionMap = new Map<string, string[]>();
	for (const [id, skill] of Object.entries(SKILL_UPGRADES)) {
		const posKey = `${skill.position.x},${skill.position.y}`;
		if (!positionMap.has(posKey)) {
			positionMap.set(posKey, []);
		}
		positionMap.get(posKey)!.push(id);
	}
	for (const [pos, ids] of positionMap) {
		if (ids.length > 1) {
			console.warn(`[SkillTree] Duplicate position at ${pos}: ${ids.join(', ')}`);
		}
	}
}
