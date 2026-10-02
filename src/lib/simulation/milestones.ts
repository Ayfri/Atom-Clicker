import { CurrenciesTypes } from '#data/currencies.js';
import { GENERATORS, GENERATOR_TYPES } from '#data/generators.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import type { RunState } from './snapshots';
import type { MilestoneDefinition, MilestoneHit } from './types';

const DAY_MS = 86_400_000;

type Reader = (run: RunState) => number;

/**
 * The predicate stays beside the definition rather than on it: MilestoneHit carries the definition across the worker
 * boundary, and a function on it would fail structured cloning.
 */
interface MilestoneEntry {
	milestone: MilestoneDefinition;
	read: Reader;
	value: number;
}

const READERS = {
	achievements: () => gameManager.achievements.length,
	atoms: () => currenciesManager.getAmount(CurrenciesTypes.ATOMS),
	atomsPerSecond: () => gameManager.atomsPerSecond,
	boostPointsUsed: () => gameManager.boostPointsUsed,
	electronizes: () => gameManager.totalElectronizesAllTime,
	electrons: () => currenciesManager.getAmount(CurrenciesTypes.ELECTRONS),
	excitedPhotons: () => currenciesManager.getAmount(CurrenciesTypes.EXCITED_PHOTONS),
	photonUpgradeLevels: () => gameManager.photonUpgradeLevels,
	playerLevel: () => gameManager.playerLevel,
	protonises: () => gameManager.totalProtonisesAllTime,
	protons: () => currenciesManager.getAmount(CurrenciesTypes.PROTONS),
	quarks: run => run.quarksFromAchievements + run.quests.quarks,
	skills: () => gameManager.skillUpgrades.length,
	totalGenerators: () => gameManager.generatorTotals.count,
	upgrades: () => gameManager.upgrades.length,
} satisfies Record<string, Reader>;

const at = (field: keyof typeof READERS, value: number, id: string, name: string, description: string): MilestoneEntry => ({
	milestone: { description, id, name },
	read: READERS[field],
	value,
});

const firstPurchase = (type: (typeof GENERATOR_TYPES)[number]): MilestoneEntry => ({
	milestone: {
		description: `Purchased first ${GENERATORS[type].name}`,
		id: `first_generator_${type}`,
		name: `First ${GENERATORS[type].name}`,
	},
	read: run => (run.everPurchasedGenerators.has(type) ? 1 : 0),
	value: 1,
});

const MILESTONE_ENTRIES: MilestoneEntry[] = [
	at('atoms', 1e3, 'atoms_1k', '1K Atoms', 'Reached 1K Atoms'),
	at('atoms', 1e6, 'atoms_1m', '1M Atoms', 'Reached 1M Atoms'),
	at('atoms', 1e9, 'atoms_1b', '1B Atoms', 'Reached 1B Atoms'),
	at('atoms', 1e15, 'atoms_1qa', '1Qa Atoms', 'Reached 1Qa Atoms'),
	at('atoms', 1e21, 'atoms_1sx', '1Sx Atoms', 'Reached 1Sx Atoms'),
	at('atoms', 1e30, 'atoms_1no', '1No Atoms', 'Reached 1No Atoms'),

	at('atomsPerSecond', 1e3, 'aps_1k', '1K APS', 'Producing 1K atoms/s'),
	at('atomsPerSecond', 1e15, 'aps_1qa', '1Qa APS', 'Producing 1Qa atoms/s'),
	at('atomsPerSecond', 1e21, 'aps_1sx', '1Sx APS', 'Producing 1Sx atoms/s'),

	at('totalGenerators', 25, 'generators_25', '25 Generators', 'Owns 25 generators'),
	at('totalGenerators', 100, 'generators_100', '100 Generators', 'Owns 100 generators'),
	at('totalGenerators', 500, 'generators_500', '500 Generators', 'Owns 500 generators'),
	at('totalGenerators', 1000, 'generators_1k', '1K Generators', 'Owns 1000 generators'),

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
	at('skills', 10, 'skills_10', '10 Skills', 'Unlocked 10 skills'),
	at('skills', 20, 'skills_20', '20 Skills', 'Unlocked 20 skills'),

	at('photonUpgradeLevels', 10, 'photon_10', '10 Photon Lvls', '10 Photon Upgrade Levels'),
	at('photonUpgradeLevels', 50, 'photon_50', '50 Photon Lvls', '50 Photon Upgrade Levels'),

	at('achievements', 10, 'achievements_10', '10 Achievements', 'Earned 10 achievements'),
	at('achievements', 50, 'achievements_50', '50 Achievements', 'Earned 50 achievements'),
	at('achievements', 100, 'achievements_100', '100 Achievements', 'Earned 100 achievements'),

	at('boostPointsUsed', 1, 'currency_boost_1', '1st Currency Boost', 'First currency boost upgrade'),
	at('boostPointsUsed', 10, 'currency_boost_10', '10 Currency Boosts', '10 total currency boost upgrades'),
	at('boostPointsUsed', 50, 'currency_boost_50', '50 Currency Boosts', '50 total currency boost upgrades'),

	at('playerLevel', 1, 'player_level_1', 'Level 1', 'Reached player level 1'),
	at('playerLevel', 10, 'player_level_10', 'Level 10', 'Reached player level 10'),
	at('playerLevel', 50, 'player_level_50', 'Level 50', 'Reached player level 50'),
	at('playerLevel', 200, 'player_level_200', 'Level 200', 'Reached player level 200'),

	...GENERATOR_TYPES.map(firstPurchase),

	at('quarks', 10, 'quarks_10', '10 Quarks', 'Earned 10 Quarks'),
	at('quarks', 50, 'quarks_50', '50 Quarks', 'Earned 50 Quarks'),
	at('quarks', 100, 'quarks_100', '100 Quarks', 'Earned 100 Quarks'),
];

export const MILESTONES: MilestoneDefinition[] = MILESTONE_ENTRIES.map(entry => entry.milestone);

interface Queue {
	entries: MilestoneEntry[];
	next: number;
	read: Reader;
}

/**
 * Entries sharing a reader are queued by threshold, so a tick reads each still-pending value once and stops at the first
 * unmet threshold. Checked every tick rather than per snapshot: a counter that rises and is spent in between still counts.
 */
export class MilestoneTracker {
	private queues: Queue[];

	constructor() {
		const byReader = new Map<Reader, MilestoneEntry[]>();
		for (const entry of MILESTONE_ENTRIES) byReader.set(entry.read, [...(byReader.get(entry.read) ?? []), entry]);
		this.queues = [...byReader].map(([read, entries]) => ({ entries: entries.sort((a, b) => a.value - b.value), next: 0, read }));
	}

	/** Appends the milestones reached this tick to `hits`, in definition order. */
	check(run: RunState, hits: MilestoneHit[]) {
		let exhausted = false;
		const firstHit = hits.length;
		const timeReached = gameManager.inGameTime;
		for (const queue of this.queues) {
			const value = queue.read(run);
			while (queue.next < queue.entries.length && value >= queue.entries[queue.next].value) {
				hits.push({ dayReached: timeReached / DAY_MS, milestone: queue.entries[queue.next++].milestone, timeReached });
			}
			if (queue.next === queue.entries.length) exhausted = true;
		}
		if (exhausted) this.queues = this.queues.filter(queue => queue.next < queue.entries.length);
		if (hits.length - firstHit > 1) {
			const sameTick = hits.splice(firstHit).sort((a, b) => MILESTONES.indexOf(a.milestone) - MILESTONES.indexOf(b.milestone));
			hits.push(...sameTick);
		}
	}
}
