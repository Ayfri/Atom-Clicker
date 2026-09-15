import { BUILDINGS, BUILDING_TYPES } from '$data/buildings';
import type { MilestoneCheckData, MilestoneDefinition } from './types';

type NumericField = {
	[K in keyof MilestoneCheckData]: MilestoneCheckData[K] extends number ? K : never;
}[keyof MilestoneCheckData];

/**
 * Definition and predicate live in one entry so an id can never exist in one list and be missing from the other.
 * The predicate stays beside the definition rather than on it: MilestoneHit carries the definition across the
 * worker boundary, and a function on it would fail structured cloning.
 */
export interface MilestoneEntry {
	check: (snapshot: MilestoneCheckData) => boolean;
	milestone: MilestoneDefinition;
}

const at = (field: NumericField, value: number, id: string, name: string, description: string): MilestoneEntry => ({
	check: snapshot => snapshot[field] >= value,
	milestone: { description, id, name },
});

const firstPurchase = (type: (typeof BUILDING_TYPES)[number]): MilestoneEntry => ({
	check: snapshot => snapshot.buildingsEverPurchased.has(type),
	milestone: {
		description: `Purchased first ${BUILDINGS[type].name}`,
		id: `first_building_${type}`,
		name: `First ${BUILDINGS[type].name}`,
	},
});

export const MILESTONE_ENTRIES: MilestoneEntry[] = [
	at('atoms', 1e3, 'atoms_1k', '1K Atoms', 'Reached 1K Atoms'),
	at('atoms', 1e6, 'atoms_1m', '1M Atoms', 'Reached 1M Atoms'),
	at('atoms', 1e9, 'atoms_1b', '1B Atoms', 'Reached 1B Atoms'),
	at('atoms', 1e15, 'atoms_1qa', '1Qa Atoms', 'Reached 1Qa Atoms'),
	at('atoms', 1e21, 'atoms_1sx', '1Sx Atoms', 'Reached 1Sx Atoms'),
	at('atoms', 1e30, 'atoms_1no', '1No Atoms', 'Reached 1No Atoms'),

	at('atomsPerSecond', 1e3, 'aps_1k', '1K APS', 'Producing 1K atoms/s'),
	at('atomsPerSecond', 1e15, 'aps_1qa', '1Qa APS', 'Producing 1Qa atoms/s'),
	at('atomsPerSecond', 1e21, 'aps_1sx', '1Sx APS', 'Producing 1Sx atoms/s'),

	at('totalBuildings', 25, 'buildings_25', '25 Buildings', 'Owns 25 buildings'),
	at('totalBuildings', 100, 'buildings_100', '100 Buildings', 'Owns 100 buildings'),
	at('totalBuildings', 500, 'buildings_500', '500 Buildings', 'Owns 500 buildings'),
	at('totalBuildings', 1000, 'buildings_1k', '1K Buildings', 'Owns 1000 buildings'),

	at('protonises', 1, 'first_protonise', '1st Protonise', 'First Protonise'),
	at('protonises', 10, 'protonises_10', '10 Protonises', '10 Protonises'),
	at('protons', 100, 'protons_100', '100 Protons', 'Earned 100 Protons'),
	at('protons', 1000, 'protons_1k', '1K Protons', 'Earned 1K Protons'),
	at('electronizes', 1, 'first_electronize', '1st Electronize', 'First Electronize'),
	at('electrons', 100, 'electrons_100', '100 Electrons', 'Earned 100 Electrons'),

	at('excitedPhotons', 1, 'excited_1', '1st Excited Photon', 'Collected an excited photon'),
	at('excitedPhotons', 100, 'excited_100', '100 Excited Photons', 'Earned 100 excited photons'),

	at('upgrades', 10, 'upgrades_10', '10 Upgrades', 'Bought 10 upgrades'),
	at('upgrades', 50, 'upgrades_50', '50 Upgrades', 'Bought 50 upgrades'),
	at('upgrades', 100, 'upgrades_100', '100 Upgrades', 'Bought 100 upgrades'),

	at('skills', 1, 'skills_1', '1 Skill', 'Unlocked 1 skill'),
	at('skills', 15, 'skills_15', '15 Skills', 'Unlocked 15 skills'),
	at('skills', 30, 'skills_30', '30 Skills', 'Unlocked 30 skills'),

	at('photonUpgradeLevels', 10, 'photon_10', '10 Photon Lvls', '10 Photon Upgrade Levels'),
	at('photonUpgradeLevels', 50, 'photon_50', '50 Photon Lvls', '50 Photon Upgrade Levels'),

	at('achievements', 10, 'achievements_10', '10 Achievements', 'Earned 10 achievements'),
	at('achievements', 50, 'achievements_50', '50 Achievements', 'Earned 50 achievements'),
	at('achievements', 100, 'achievements_100', '100 Achievements', 'Earned 100 achievements'),

	at('skillPointsUsed', 1, 'currency_boost_1', '1st Currency Boost', 'First currency boost upgrade'),
	at('skillPointsUsed', 10, 'currency_boost_10', '10 Currency Boosts', '10 total currency boost upgrades'),
	at('skillPointsUsed', 50, 'currency_boost_50', '50 Currency Boosts', '50 total currency boost upgrades'),

	at('playerLevel', 1, 'player_level_1', 'Level 1', 'Reached player level 1'),
	at('playerLevel', 10, 'player_level_10', 'Level 10', 'Reached player level 10'),
	at('playerLevel', 50, 'player_level_50', 'Level 50', 'Reached player level 50'),
	at('playerLevel', 200, 'player_level_200', 'Level 200', 'Reached player level 200'),

	...BUILDING_TYPES.map(firstPurchase),

	at('quarks', 10, 'quarks_10', '10 Quark', 'Earned 10 Quark'),
	at('quarks', 50, 'quarks_50', '50 Quarks', 'Earned 100 Quarks'),
	at('quarks', 100, 'quarks_100', '100 Quarks', 'Earned 200 Quarks'),
];

export const MILESTONES: MilestoneDefinition[] = MILESTONE_ENTRIES.map(entry => entry.milestone);
