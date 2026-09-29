import { CurrenciesTypes } from '$data/currencies';
import { FeatureTypes } from '$data/features';
import { GENERATORS, GENERATOR_TYPES, type GeneratorType } from '$data/generators';
import { add } from '$helpers/effects';
import type { SkillUpgrade } from '$lib/types';

export const SKILL_GRID = {
	x: 550,
	y: 264,
};

function gridPos(x: number, y: number) {
	return {
		x: x * SKILL_GRID.x,
		y: y * SKILL_GRID.y,
	};
}

/** Lays out the i-th node in tight rows of 3 that alternate direction like bricks, odd rows shifted half a node right. */
function brickPos(startX: number, startY: number, i: number) {
	const row = Math.floor(i / 3);
	const column = row % 2 === 0 ? i % 3 : 2 - (i % 3);
	return gridPos(startX + column * 0.7 + (row % 2) * 0.35, startY + row * 0.75);
}

/**
 * Every skill unlocks a mechanic, stat boosts live in `UPGRADES` and the photon shops.
 * Branches leave Unlock Levels by theme: currency boosts north, realms west, automation south, idle play (offline, stability) east.
 */
export const SKILL_UPGRADES: Record<string, SkillUpgrade> = {
	unlockLevels: {
		cost: { amount: 10_000, currency: CurrenciesTypes.ATOMS },
		description: 'Unlock the leveling system',
		effects: [],
		feature: FeatureTypes.LEVELS,
		id: 'unlockLevels',
		name: 'Unlock Levels',
		position: gridPos(0, 0),
	},

	// CURRENCY BOOSTS (north)

	boostAssignAll: {
		cost: { amount: 100, currency: CurrenciesTypes.PROTONS },
		description: 'Adds a Max button to each currency boost that assigns every free point at once',
		effects: [],
		feature: FeatureTypes.BOOST_ASSIGN_ALL,
		id: 'boostAssignAll',
		name: 'Boost Dump',
		position: gridPos(-0.35, -1.1),
		requires: ['unlockLevels'],
	},

	boostEvenSplit: {
		cost: { amount: 500, currency: CurrenciesTypes.PROTONS },
		description: 'Adds a Balance button that spreads your boost points evenly across every currency you have earned',
		effects: [],
		feature: FeatureTypes.BOOST_EVEN_SPLIT,
		id: 'boostEvenSplit',
		name: 'Boost Balancer',
		position: gridPos(0.35, -1.1),
		requires: ['boostAssignAll'],
	},

	// REALMS (west)

	purpleRealm: {
		cost: { amount: 10_000_000_000, currency: CurrenciesTypes.ATOMS },
		description: 'Unlock the mysterious purple realm',
		effects: [],
		feature: FeatureTypes.PURPLE_REALM,
		id: 'purpleRealm',
		name: 'Purple Realm',
		position: gridPos(-1.2, 0.2),
		requires: ['unlockLevels'],
	},

	hoverCollection: {
		condition: manager => Object.keys(manager.photonUpgrades).length >= 1,
		cost: { amount: 1_000, currency: CurrenciesTypes.PHOTONS },
		description: 'Collect photons by hovering over them or touching them',
		effects: [],
		feature: FeatureTypes.HOVER_COLLECTION,
		id: 'hoverCollection',
		name: 'Quantum Magnetism',
		position: gridPos(-1.2, -0.55),
		requirement: 'Own 1 photon upgrade',
		requires: ['purpleRealm'],
	},

	radiationRealm: {
		cost: { amount: 100, currency: CurrenciesTypes.ELECTRONS },
		description: 'Unlock the Radiation Realm and harness nuclear decay',
		effects: [],
		feature: FeatureTypes.RADIATION_REALM,
		id: 'radiationRealm',
		name: 'Radiation Realm',
		position: gridPos(-2.3, 0.5),
		requires: ['purpleRealm'],
	},

	// AUTOMATION (south)

	autoClicker: {
		cost: { amount: 31, currency: CurrenciesTypes.PROTONS },
		description: 'Automatically clicks the atom once per second',
		effects: [add('auto_click', 1)],
		id: 'autoClicker',
		name: 'Auto Clicker',
		position: gridPos(0, 1.1),
		requires: ['unlockLevels'],
	},

	autoUpgrade: {
		cost: { amount: 25, currency: CurrenciesTypes.ELECTRONS },
		description: 'Automatically buys the cheapest available upgrade every 30 seconds',
		effects: [add('auto_upgrade', 0)],
		id: 'autoUpgrade',
		name: 'Auto Upgrade',
		position: gridPos(-0.7, 1.1),
		requires: ['autoClicker'],
	},

	...Object.fromEntries(
		GENERATOR_TYPES.map((generatorType: GeneratorType, i): [string, SkillUpgrade] => {
			const { name } = GENERATORS[generatorType];
			const id = `${generatorType}AutoBuy`;
			return [
				id,
				{
					cost: { amount: 2 + i, currency: CurrenciesTypes.ELECTRONS },
					description: `Automatically buys 1 ${name} every 30 seconds`,
					effects: [add('auto_buy', 0, generatorType)],
					id,
					name: `Auto ${name}`,
					position: brickPos(-0.35, 2.05, i),
					requires: [i === 0 ? 'autoClicker' : `${GENERATOR_TYPES[i - 1]}AutoBuy`],
				},
			];
		}),
	),

	// IDLE PLAY (east)

	offlineProgress: {
		cost: { amount: 2_000_000, currency: CurrenciesTypes.ATOMS },
		description: 'Keep producing atoms while you are away',
		effects: [],
		feature: FeatureTypes.OFFLINE_PROGRESS,
		id: 'offlineProgress',
		name: 'Offline Progress',
		position: gridPos(1.2, -0.1),
		requires: ['unlockLevels'],
	},

	offlineAutoUpgrades: {
		cost: { amount: 120, currency: CurrenciesTypes.PROTONS },
		description: 'Auto-upgrade keeps buying while you are away, at 1/120 speed',
		effects: [],
		feature: FeatureTypes.OFFLINE_AUTO_UPGRADE,
		id: 'offlineAutoUpgrades',
		name: 'Offline Auto-upgrades',
		position: gridPos(2.2, -0.45),
		requires: ['offlineProgress'],
	},

	offlineAutoClick: {
		cost: { amount: 250, currency: CurrenciesTypes.PROTONS },
		description: 'The auto-clicker keeps clicking while you are away, at 1/120 speed',
		effects: [],
		feature: FeatureTypes.OFFLINE_AUTO_CLICK,
		id: 'offlineAutoClick',
		name: 'Offline Auto-click',
		position: gridPos(1.2, 0.75),
		requires: ['autoClicker', 'offlineProgress'],
	},

	stabilityField: {
		cost: { amount: 250, currency: CurrenciesTypes.PROTONS },
		description: 'Unlock the Stability Meter, a production bonus that grows while you do not interact',
		effects: [],
		feature: FeatureTypes.STABILITY_FIELD,
		id: 'stabilityField',
		name: 'Stability Field',
		position: gridPos(1.3, -1.1),
		requires: ['offlineProgress'],
	},

	stableAutomation: {
		cost: { amount: 50, currency: CurrenciesTypes.ELECTRONS },
		description: 'The Atom Realm auto-clicker no longer destabilizes the field',
		effects: [],
		feature: FeatureTypes.STABLE_ATOM_AUTO_CLICK,
		id: 'stableAutomation',
		name: 'Stable Automation',
		position: gridPos(0.95, -1.95),
		requires: ['stabilityField'],
	},

	stableManipulation: {
		cost: { amount: 400, currency: CurrenciesTypes.ELECTRONS },
		description: 'Clicking the atom no longer destabilizes the field',
		effects: [],
		feature: FeatureTypes.STABLE_ATOM_CLICK,
		id: 'stableManipulation',
		name: 'Stable Manipulation',
		position: gridPos(0.95, -2.7),
		requires: ['stableAutomation'],
	},

	stableQuantumFlux: {
		cost: { amount: 100, currency: CurrenciesTypes.ELECTRONS },
		description: 'The Photon Realm auto-clicker no longer destabilizes the field',
		effects: [],
		feature: FeatureTypes.STABLE_PHOTON_AUTO_CLICK,
		id: 'stableQuantumFlux',
		name: 'Stable Quantum Flux',
		position: gridPos(2, -1.8),
		requires: ['stabilityField'],
	},

	stableInteraction: {
		cost: { amount: 250, currency: CurrenciesTypes.ELECTRONS },
		description: 'Clicking in the Photon Realm no longer destabilizes the field',
		effects: [],
		feature: FeatureTypes.STABLE_PHOTON_CLICK,
		id: 'stableInteraction',
		name: 'Stable Interaction',
		position: gridPos(2, -2.55),
		requires: ['stableQuantumFlux'],
	},

	stableAnomalies: {
		cost: { amount: 500, currency: CurrenciesTypes.ELECTRONS },
		description: 'Clicking bonuses no longer destabilizes the field',
		effects: [],
		feature: FeatureTypes.STABLE_BONUS_CLICK,
		id: 'stableAnomalies',
		name: 'Stable Anomalies',
		position: gridPos(1.475, -3.5),
		requires: ['stableInteraction', 'stableManipulation'],
	},
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
