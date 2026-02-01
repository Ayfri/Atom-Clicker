import { BUILDINGS, BUILDING_TYPES, type BuildingData, type BuildingType } from '$data/buildings';
import { CurrenciesTypes } from '$data/currencies';
import { type FeatureType, FeatureTypes, PERSISTENT_FEATURE_IDS } from '$data/features';
import type { SkillUpgrade } from '$lib/types';

export const GRID_SIZE = {
	x: 400,
	y: 200
};

function gridPos(x: number, y: number) {
	return {
		x: x * GRID_SIZE.x,
		y: y * GRID_SIZE.y
	};
}

function createBuildingsSkillUpgrades(
	skillData: (buildingType: BuildingType, building: BuildingData, i: number) => SkillUpgrade
): Record<string, SkillUpgrade> {
	return Object.fromEntries(
		Object.entries(BUILDINGS).map(([buildingType, building], i) => {
			const builtSkillData = skillData?.(buildingType as BuildingType, building, i);
			return [builtSkillData.id, builtSkillData];
		})
	);
}

export const SKILL_UPGRADES: Record<string, SkillUpgrade> = {
	// ═══════════════════════════════════════════════════════════════════════════
	// TIER 1 - FOUNDATION (Atoms, cheap)
	// ═══════════════════════════════════════════════════════════════════════════

	globalMultiplier: {
		cost: { amount: 5_000, currency: CurrenciesTypes.ATOMS },
		description: '2x atoms production',
		effects: [
			{
				apply: (currentValue) => currentValue * 2,
				description: 'Multiply all production by 2',
				type: 'global'
			}
		],
		id: 'globalMultiplier',
		name: 'Global Multiplier',
		position: gridPos(0, 0)
	},

	unlockLevels: {
		cost: { amount: 10_000, currency: CurrenciesTypes.ATOMS },
		description: 'Unlock the leveling system',
		effects: [],
		feature: FeatureTypes.LEVELS,
		id: 'unlockLevels',
		name: 'Unlock Levels',
		position: gridPos(1, 0),
		requires: ['globalMultiplier']
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// TIER 2 - EARLY PROGRESSION (Atoms, medium)
	// ═══════════════════════════════════════════════════════════════════════════

	atomicStability: {
		cost: { amount: 100_000, currency: CurrenciesTypes.ATOMS },
		description: '1.5x production for first 3 building types',
		effects: [
			{
				apply: (currentValue) => currentValue * 1.5,
				description: 'Multiply Molecule production by 1.5',
				target: 'molecule',
				type: 'building'
			},
			{
				apply: (currentValue) => currentValue * 1.5,
				description: 'Multiply Crystal production by 1.5',
				target: 'crystal',
				type: 'building'
			},
			{
				apply: (currentValue) => currentValue * 1.5,
				description: 'Multiply Nanostructure production by 1.5',
				target: 'nanostructure',
				type: 'building'
			}
		],
		id: 'atomicStability',
		name: 'Atomic Stability',
		position: gridPos(-1, 1),
		requires: ['globalMultiplier']
	},

	clickMastery: {
		cost: { amount: 250_000, currency: CurrenciesTypes.ATOMS },
		description: '+10% production per 100 total clicks',
		effects: [
			{
				apply: (currentValue, state) => {
					const clickBonus = Math.floor((state.totalClicksRun || 0) / 100) * 0.1;
					return currentValue * (1 + clickBonus);
				},
				description: 'Add 10% production per 100 total clicks',
				type: 'global'
			}
		],
		id: 'clickMastery',
		name: 'Click Mastery',
		position: gridPos(1, 1),
		requires: ['unlockLevels']
	},

	levelMastery: {
		cost: { amount: 500_000, currency: CurrenciesTypes.ATOMS },
		description: '+20% atoms production per 10 levels',
		effects: [
			{
				apply: (currentValue, state) => {
					const levelBonus = Math.floor((state.playerLevel || 0) / 10) * 0.2;
					return currentValue * (1 + levelBonus);
				},
				description: 'Add 20% atoms production per 10 levels',
				type: 'global'
			}
		],
		id: 'levelMastery',
		name: 'Level Mastery',
		position: gridPos(2, 0),
		requires: ['unlockLevels']
	},

	molecularBoost: {
		cost: { amount: 1_000_000, currency: CurrenciesTypes.ATOMS },
		description: '3x Molecule and Crystal production',
		effects: [
			{
				apply: (currentValue) => currentValue * 3,
				description: 'Multiply Molecule production by 3',
				target: 'molecule',
				type: 'building'
			},
			{
				apply: (currentValue) => currentValue * 3,
				description: 'Multiply Crystal production by 3',
				target: 'crystal',
				type: 'building'
			}
		],
		id: 'molecularBoost',
		name: 'Molecular Boost',
		position: gridPos(-2, 1),
		requires: ['atomicStability']
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// TIER 3 - MID GAME (Atoms expensive / Protons cheap)
	// ═══════════════════════════════════════════════════════════════════════════

	nanoEnhancement: {
		cost: { amount: 2_500_000, currency: CurrenciesTypes.ATOMS },
		description: '2.5x Nanostructure production',
		effects: [
			{
				apply: (currentValue) => currentValue * 2.5,
				description: 'Multiply Nanostructure production by 2.5',
				target: 'nanostructure',
				type: 'building'
			}
		],
		id: 'nanoEnhancement',
		name: 'Nano Enhancement',
		position: gridPos(-3, 2),
		requires: ['molecularBoost']
	},

	offlineProgress: {
		cost: { amount: 2_000_000, currency: CurrenciesTypes.ATOMS },
		description: 'Enable offline progress when you are away',
		effects: [],
		feature: FeatureTypes.OFFLINE_PROGRESS,
		id: 'offlineProgress',
		name: 'Offline Progress',
		position: gridPos(2, 1),
		requires: ['clickMastery']
	},

	biologicalAmplifier: {
		cost: { amount: 5_000_000, currency: CurrenciesTypes.ATOMS },
		description: '2.5x Micro-organism production',
		effects: [
			{
				apply: (currentValue) => currentValue * 2.5,
				description: 'Multiply Micro-organism production by 2.5',
				target: 'microorganism',
				type: 'building'
			}
		],
		id: 'biologicalAmplifier',
		name: 'Biological Amplifier',
		position: gridPos(-4, 2),
		requires: ['nanoEnhancement']
	},

	powerUpMastery: {
		cost: { amount: 10_000_000, currency: CurrenciesTypes.ATOMS },
		description: '0.9x power-up interval, 1.1x duration',
		effects: [
			{
				apply: (currentValue) => currentValue * 0.9,
				description: 'Multiply power-up interval by 0.9',
				type: 'power_up_interval'
			},
			{
				apply: (currentValue) => currentValue * 1.1,
				description: 'Multiply power-up duration by 1.1',
				type: 'power_up_duration'
			}
		],
		id: 'powerUpMastery',
		name: 'Power-up Mastery',
		position: gridPos(3, 2),
		requires: ['offlineProgress']
	},

	geologicalForce: {
		cost: { amount: 15_000_000, currency: CurrenciesTypes.ATOMS },
		description: '2x Rock and Planet production',
		effects: [
			{
				apply: (currentValue) => currentValue * 2,
				description: 'Multiply Rock production by 2',
				target: 'rock',
				type: 'building'
			},
			{
				apply: (currentValue) => currentValue * 2,
				description: 'Multiply Planet production by 2',
				target: 'planet',
				type: 'building'
			}
		],
		id: 'geologicalForce',
		name: 'Geological Force',
		position: gridPos(-5, 3),
		requires: ['biologicalAmplifier']
	},

	purpleRealm: {
		cost: { amount: 10_000_000_000, currency: CurrenciesTypes.ATOMS },
		description: 'Unlock the mysterious purple realm',
		effects: [],
		feature: FeatureTypes.PURPLE_REALM,
		id: 'purpleRealm',
		name: 'Purple Realm',
		position: gridPos(4, 3),
		requires: ['powerUpMastery']
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// TIER 4 - PROTON BRANCH (Protons)
	// ═══════════════════════════════════════════════════════════════════════════

	stabilityField: {
		cost: { amount: 250, currency: CurrenciesTypes.PROTONS },
		description: 'Unlock the Stability Meter (Passive Idle Bonus)',
		effects: [],
		feature: FeatureTypes.STABILITY_FIELD,
		id: 'stabilityField',
		name: 'Stability Field',
		position: gridPos(0, -1),
		requires: ['globalMultiplier']
	},

	electronHarvester: {
		cost: { amount: 2_500, currency: CurrenciesTypes.PROTONS },
		description: '2x electron gain',
		effects: [
			{
				apply: (currentValue) => currentValue * 2,
				description: 'Multiply electron gain by 2',
				type: 'electron_gain'
			}
		],
		id: 'electronHarvester',
		name: 'Electron Harvester',
		position: gridPos(-1, -1),
		requires: ['stabilityField']
	},

	protonCollector: {
		cost: { amount: 25_000, currency: CurrenciesTypes.PROTONS },
		description: '1.5x proton gain',
		effects: [
			{
				apply: (currentValue) => currentValue * 1.5,
				description: 'Multiply proton gain by 1.5',
				type: 'proton_gain'
			}
		],
		id: 'protonCollector',
		name: 'Proton Collector',
		position: gridPos(-2, -2),
		requires: ['electronHarvester']
	},

	prestigeBonus: {
		cost: { amount: 250_000, currency: CurrenciesTypes.PROTONS },
		description: '+1% production per Electronize',
		effects: [
			{
				apply: (currentValue, state) => {
					const electronizeBonus = (state.totalElectronizesAllTime || 0) * 0.01;
					return currentValue * (1 + electronizeBonus);
				},
				description: 'Add 1% production per Electronize performed',
				type: 'global'
			}
		],
		id: 'prestigeBonus',
		name: 'Prestige Bonus',
		position: gridPos(-3, -2),
		requires: ['protonCollector']
	},

	quantumResonance: {
		cost: { amount: 2_500_000, currency: CurrenciesTypes.PROTONS },
		description: '+20% production per 100 buildings owned',
		effects: [
			{
				apply: (currentValue, state) => {
					const totalBuildings = Object.values(state.buildings || {}).reduce(
						(sum, building) => sum + (building?.count || 0),
						0
					);
					const bonus = Math.floor(totalBuildings / 100) * 0.2;
					return currentValue * (1 + bonus);
				},
				description: 'Add 20% production per 100 buildings owned',
				type: 'global'
			}
		],
		id: 'quantumResonance',
		name: 'Quantum Resonance',
		position: gridPos(-4, -3),
		requires: ['prestigeBonus']
	},

	stellarCore: {
		cost: { amount: 25_000_000, currency: CurrenciesTypes.PROTONS },
		condition: (state) => (state.buildings.star?.count ?? 0) >= 5,
		description: '2x production for Star and higher buildings',
		effects: [
			{
				apply: (currentValue) => currentValue * 2,
				description: 'Multiply Star production by 2',
				target: 'star',
				type: 'building'
			},
			{
				apply: (currentValue) => currentValue * 2,
				description: 'Multiply Neutron Star production by 2',
				target: 'neutronStar',
				type: 'building'
			},
			{
				apply: (currentValue) => currentValue * 2,
				description: 'Multiply Black Hole production by 2',
				target: 'blackHole',
				type: 'building'
			}
		],
		id: 'stellarCore',
		name: 'Stellar Core',
		position: gridPos(-5, -3),
		requires: ['quantumResonance']
	},

	particleAccelerator: {
		cost: { amount: 250_000_000, currency: CurrenciesTypes.PROTONS },
		description: '+25% production per Protonise',
		effects: [
			{
				apply: (currentValue, state) => {
					const protoniseBonus = (state.totalProtonisesRun || 0) * 0.25;
					return currentValue * (1 + protoniseBonus);
				},
				description: 'Add 25% production per Protonise performed',
				type: 'global'
			}
		],
		id: 'particleAccelerator',
		name: 'Particle Accelerator',
		position: gridPos(-6, -4),
		requires: ['stellarCore']
	},

	communityPower: {
		cost: { amount: 1_000, currency: CurrenciesTypes.PROTONS },
		description: '1% atom boost per thousand registered players',
		effects: [
			{
				apply: (currentValue, manager) => {
					const boost = (manager.totalUsers / 1000) * 0.01;
					return currentValue * (1 + boost);
				},
				description: '1% atom boost per thousand players',
				type: 'global'
			}
		],
		id: 'communityPower',
		name: 'Community Power',
		position: gridPos(1, -1),
		requires: ['stabilityField']
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// TIER 5 - ELECTRON BRANCH (Electrons)
	// ═══════════════════════════════════════════════════════════════════════════

	cosmicSynergy: {
		cost: { amount: 10, currency: CurrenciesTypes.ELECTRONS },
		description: '+5% production per building type owned',
		effects: [
			{
				apply: (currentValue, state) => {
					const ownedBuildings = Object.values(state.buildings || {}).filter(
						(b) => b && b.count > 0
					).length;
					return currentValue * (1 + ownedBuildings * 0.05);
				},
				description: 'Add 5% production per building type owned',
				type: 'global'
			}
		],
		id: 'cosmicSynergy',
		name: 'Cosmic Synergy',
		position: gridPos(2, -1),
		requires: ['communityPower']
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// TIER 6 - PHOTON BRANCH (Photons / Excited Photons)
	// ═══════════════════════════════════════════════════════════════════════════

	hoverCollection: {
		condition: (manager) => Object.keys(manager.photonUpgrades || {}).length >= 1,
		cost: { amount: 1_000, currency: CurrenciesTypes.PHOTONS },
		description: 'Collect photons by hovering over them',
		effects: [],
		feature: FeatureTypes.HOVER_COLLECTION,
		id: 'hoverCollection',
		name: 'Quantum Magnetism',
		position: gridPos(3, -1),
		requires: ['cosmicSynergy']
	},

	photonEfficiency: {
		condition: (state) => Object.keys(state.photonUpgrades || {}).length >= 3,
		cost: { amount: 5_000, currency: CurrenciesTypes.PHOTONS },
		description: '+1% all production per photon upgrade owned',
		effects: [
			{
				apply: (currentValue, state) => {
					const photonUpgradeCount = Object.values(state.photonUpgrades || {}).reduce(
						(sum, level) => sum + level,
						0
					);
					return currentValue * (1 + photonUpgradeCount * 0.01);
				},
				description: 'Add 1% production per photon upgrade owned',
				type: 'global'
			}
		],
		id: 'photonEfficiency',
		name: 'Photon Efficiency',
		position: gridPos(4, -2),
		requires: ['hoverCollection']
	},

	photonProtonBoost: {
		cost: { amount: 2_500, currency: CurrenciesTypes.PHOTONS },
		description: 'Add 1% protons per photon upgrade owned',
		effects: [
			{
				apply: (currentValue, state) => {
					const photonUpgradeCount = Object.values(state.photonUpgrades || {}).reduce(
						(sum, level) => sum + level,
						0
					);
					return currentValue * (1 + photonUpgradeCount * 0.01);
				},
				description: 'Add 1% protons per photon upgrade owned',
				type: 'proton_gain'
			}
		],
		id: 'photonProtonBoost',
		name: 'Photon Proton Boost',
		position: gridPos(5, -2),
		requires: ['photonEfficiency']
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// BUILDING MULTIPLIER BRANCH (Building-specific, requires 100 of each)
	// ═══════════════════════════════════════════════════════════════════════════

	...createBuildingsSkillUpgrades((buildingType, building, i) => {
		const previousBuildingType = BUILDING_TYPES[i - 1];
		const baseCost = 1_000_000 * Math.pow(10, i);

		return {
			condition: (manager) => (manager.buildings[buildingType]?.count ?? 0) >= 100,
			cost: { amount: baseCost, currency: CurrenciesTypes.ATOMS },
			description: `2x ${building.name} production`,
			effects: [
				{
					apply: (currentValue) => currentValue * 2,
					description: `Multiply ${building.name} production by 2`,
					target: buildingType,
					type: 'building'
				}
			],
			id: `${buildingType}Multiplier`,
			name: `${building.name} Multiplier`,
			position: gridPos(-(i + 0.5), 3 + Math.floor(i / 3)),
			requires: previousBuildingType
				? [`${previousBuildingType}Multiplier`]
				: ['geologicalForce']
		} satisfies SkillUpgrade;
	})
};

// Skills that unlock persistent features (kept after prestige)
export const PERSISTENT_SKILL_IDS = Object.values(SKILL_UPGRADES)
	.filter((skill) => skill.feature && PERSISTENT_FEATURE_IDS.includes(skill.feature as FeatureType))
	.map((skill) => skill.id);
