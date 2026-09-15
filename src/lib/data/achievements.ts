import type { Achievement } from '$lib/types';
import type { GameManager } from '$helpers/GameManager.svelte';
import { tierIconStack } from '$helpers/iconStacks';
import { radiationManager } from '$helpers/RadiationManager.svelte';
import { formatNumber } from '$lib/utils';
import { BUILDING_TYPES, BUILDINGS, type BuildingType } from '$data/buildings';
import { CURRENCIES, CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { BUILDING_ICON_NAMES, CURRENCY_ICON_NAMES } from '$data/icons';
import { SKILL_UPGRADES } from '$data/skillTree';

export const SPECIAL_ACHIEVEMENTS: Achievement[] = [
	{
		id: 'hidden_atom_clicked',
		name: 'Atomic Discoverer',
		description: 'Found the hidden atom in the credits',
		iconStack: { count: 1, icon: 'atom' },
		hiddenCondition: (manager: GameManager) => !manager.unlockedAchievementIds.has('hidden_atom_clicked'),
		condition: (manager: GameManager) => manager.unlockedAchievementIds.has('hidden_atom_clicked'),
	},
	{
		id: 'skill_tree_master',
		name: 'Skill Tree Master',
		description: 'Master of the atomic realm',
		iconStack: { count: 3, icon: 'skillTreeMaster' },
		hiddenCondition: (manager: GameManager) => manager.skillUpgrades.length === 0,
		condition: (manager: GameManager) => {
			const totalSkillUpgrades = Object.keys(SKILL_UPGRADES).length;
			return manager.skillUpgrades.length >= totalSkillUpgrades;
		},
	},
	{
		id: 'reset_modal_opener',
		name: 'Curious Explorer',
		description: 'Found the reset button... but decided not to press it',
		iconStack: { count: 1, icon: 'trophy' },
		hiddenCondition: (manager: GameManager) => !manager.unlockedAchievementIds.has('reset_modal_opener'),
		condition: (manager: GameManager) => manager.unlockedAchievementIds.has('reset_modal_opener'),
	},
	{
		id: 'play_time_10min',
		name: 'Getting Started',
		description: 'Play for 10 minutes',
		iconStack: { count: 1, icon: 'award' },
		condition: (manager: GameManager) => manager.inGameTime >= 600000, // 10 minutes in ms
	},
	{
		id: 'play_time_2h',
		name: 'Dedicated Player',
		description: 'Play for 2 hours',
		iconStack: { count: 2, icon: 'award' },
		condition: (manager: GameManager) => manager.inGameTime >= 7200000, // 2 hours in ms
	},
	{
		id: 'play_time_30h',
		name: 'Atomic Addict',
		description: 'Play for 30 hours',
		iconStack: { count: 3, icon: 'award' },
		condition: (manager: GameManager) => manager.inGameTime >= 108000000, // 30 hours in ms
	},
	{
		id: 'play_time_123h',
		name: 'Time Lord',
		description: 'Play for 123 hours',
		iconStack: { count: 3, icon: 'award', label: '123h' },
		condition: (manager: GameManager) => manager.inGameTime >= 442800000, // 123 hours in ms
	},
	{
		id: 'time_since_start_10d',
		name: 'Decade Player',
		description: 'Play for 10 days total',
		iconStack: { count: 3, icon: 'award', label: '10d' },
		condition: (manager: GameManager) => Date.now() - manager.startDate >= 864000000, // 10 days in ms
	},
	{
		id: 'time_since_start_123d',
		name: 'Century Gamer',
		description: 'Play for 123 days total',
		iconStack: { count: 3, icon: 'award', label: '123d' },
		condition: (manager: GameManager) => Date.now() - manager.startDate >= 10627200000, // 123 days in ms
	},
	{
		id: 'website_click',
		name: 'Website Visitor',
		description: "Visited the creator's website",
		iconStack: { count: 1, icon: 'globe' },
		hiddenCondition: (manager: GameManager) => !manager.unlockedAchievementIds.has('website_click'),
		condition: (manager: GameManager) => manager.unlockedAchievementIds.has('website_click'),
	},
	{
		id: 'coffee_click',
		name: 'Coffee Supporter',
		description: 'Clicked on the Buy me a coffee link',
		iconStack: { count: 1, icon: 'coffee' },
		hiddenCondition: (manager: GameManager) => !manager.unlockedAchievementIds.has('coffee_click'),
		condition: (manager: GameManager) => manager.unlockedAchievementIds.has('coffee_click'),
	},
	{
		id: 'discord_click',
		name: 'Community Member',
		description: 'Joined the Discord community',
		iconStack: { count: 1, icon: 'discord' },
		hiddenCondition: (manager: GameManager) => !manager.unlockedAchievementIds.has('discord_click'),
		condition: (manager: GameManager) => manager.unlockedAchievementIds.has('discord_click'),
	},
	{
		id: 'github_click',
		name: 'Open Source Contributor',
		description: 'Visited the GitHub repository',
		iconStack: { count: 1, icon: 'github' },
		hiddenCondition: (manager: GameManager) => !manager.unlockedAchievementIds.has('github_click'),
		condition: (manager: GameManager) => manager.unlockedAchievementIds.has('github_click'),
	},
	{
		id: 'changelog_modal_opener',
		name: 'Changelog Reader',
		description: "Checked what's new in the game",
		iconStack: { count: 1, icon: 'changelog' },
		hiddenCondition: (manager: GameManager) => !manager.unlockedAchievementIds.has('changelog_modal_opener'),
		condition: (manager: GameManager) => manager.unlockedAchievementIds.has('changelog_modal_opener'),
	},
	{
		id: 'higgs_no_atoms',
		name: 'Pure Luck',
		description: 'Click a Higgs Boson without ever earning an atom',
		iconStack: { count: 1, icon: 'higgsBoson' },
		condition: (manager: GameManager) => {
			const higgsEarned = manager.currencies[CurrenciesTypes.HIGGS_BOSON]?.earnedAllTime || 0;
			const atomsEarned = manager.currencies[CurrenciesTypes.ATOMS]?.earnedAllTime || 0;
			return higgsEarned > 0 && atomsEarned === 0;
		},
	},
	{
		id: 'atoms_1000_no_upgrades',
		name: 'Minimalist',
		description: 'Reach 1,000 atoms without ever buying an upgrade',
		iconStack: { count: 3, icon: 'atom', label: '1K' },
		condition: (manager: GameManager) => {
			const atoms = manager.currencies[CurrenciesTypes.ATOMS]?.amount || 0;
			const hasUpgrades = manager.upgrades.length > 0 || manager.skillUpgrades.length > 0;
			return atoms >= 1000 && !hasUpgrades;
		},
	},
];

function createBuildingAchievements(buildingId: BuildingType): Achievement[] {
	const name = BUILDINGS[buildingId].name;

	function createBuildingCountAchievement(
		countName: string,
		number: number,
		tierIndex: number,
		description = `Own ${number} ${name} buildings`,
	): Achievement {
		return {
			id: `${number}_${buildingId}`,
			name: `${countName} ${name}`,
			description,
			iconStack: tierIconStack(BUILDING_ICON_NAMES[buildingId], tierIndex, number),
			hiddenCondition: (manager: GameManager) =>
				manager.buildings[buildingId] === undefined || manager.buildings[buildingId].count === 0,
			condition: (manager: GameManager) =>
				manager.buildings[buildingId] !== undefined && manager.buildings[buildingId].count >= number,
		};
	}

	const tiers: { count: number; description?: string; name: string }[] = [
		{ count: 1, description: `Buy your first ${name} building`, name: 'One' },
		{ count: 10, name: 'Ten' },
		{ count: 50, name: 'Fifty' },
		{ count: 100, name: 'Hundred' },
		{ count: 200, name: 'Two hundred' },
		{ count: 300, name: 'Three hundred' },
		{ count: 500, name: 'Five hundred' },
		{ count: 1000, name: 'One thousand' },
		{ count: 2000, name: 'Two thousand' },
	];

	return tiers.map((tier, index) => createBuildingCountAchievement(tier.name, tier.count, index, tier.description));
}

function createBuildingTotalAchievements(): Achievement[] {
	function createBuildingTotalAchievement(count: number, tierIndex: number): Achievement {
		return {
			id: `total_${count}`,
			name: `${count} Buildings`,
			description: `Own a total of ${count} buildings`,
			iconStack: tierIconStack('layers', tierIndex, count),
			hiddenCondition: (manager: GameManager) => manager.buildingTotals.count === 0,
			condition: (manager: GameManager) => manager.buildingTotals.count >= count,
		};
	}

	return [50, 100, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1500, 2000, 2500, 3000].map(createBuildingTotalAchievement);
}

function createBuildingLevelsAchievements(): Achievement[] {
	function createBuildingLevelAchievement(level: number, tierIndex: number): Achievement {
		return {
			id: `buildings_levels_${level}`,
			name: `Levels ${level}`,
			description: `Have a total of ${level} buildings levels`,
			iconStack: tierIconStack('buildingLevel', tierIndex, level),
			hiddenCondition: (manager: GameManager) => manager.buildingTotals.levels === 0,
			condition: (manager: GameManager) => manager.buildingTotals.levels >= level,
		};
	}

	return [1, 2, 3, 5, 7, 10, 15, 20, 30, 50].map(createBuildingLevelAchievement);
}

function createAtomsPerSecondAchievements(): Achievement[] {
	function createAtomsPerSecondAchievement(count: number, tierIndex: number): Achievement {
		const formattedCount = formatNumber(count);
		return {
			id: `aps_${formattedCount.toLowerCase()}`,
			name: `${formattedCount} Atoms per Second`,
			description: `Produce ${formattedCount} atoms per second`,
			iconStack: tierIconStack('speed', tierIndex, count),
			condition: (manager: GameManager) => manager.atomsPerSecond >= count,
		};
	}
	const numbers = Array(10)
		.fill(0)
		.map((_, i) => 10 ** (i * 2) * 10);

	return numbers.map(createAtomsPerSecondAchievement);
}

function createTotalClicksAchievements(): Achievement[] {
	function createTotalClicksAchievement(count: number, tierIndex: number): Achievement {
		return {
			id: `clicks_${count}`,
			name: `${formatNumber(count)} Clicks`,
			description: `Click ${formatNumber(count)} times`,
			iconStack: tierIconStack('click', tierIndex, count),
			hiddenCondition: (manager: GameManager) => manager.totalClicksAllTime === 0,
			condition: (manager: GameManager) => manager.totalClicksAllTime >= count,
		};
	}

	return [1, 100, 500, 1000, 5000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000].map(
		createTotalClicksAchievement,
	);
}

function createTotalLevelsAchievements(): Achievement[] {
	function createTotalLevelsAchievement(count: number, tierIndex: number): Achievement {
		return {
			id: `levels_${count}`,
			name: `Level ${formatNumber(count, 0)}`,
			description: `Be at least ${formatNumber(count, 0)} xp level`,
			iconStack: tierIconStack('level', tierIndex, count),
			condition: (manager: GameManager) => manager.playerLevel >= count,
		};
	}

	return [1, 10, 25, 50, 100, 250, 500, 727, 1000, 2500, 5000, 10_000].map(createTotalLevelsAchievement);
}

function createProtoniseAchievements(): Achievement[] {
	const tiers = [1, 2, 3, 5, 10, 20, 50, 100, 250, 500, 1000];
	return tiers.map((tier, index) => ({
		id: `protonises_${tier}`,
		name: `${tier} Protonises`,
		description: `Protonise ${tier} times`,
		iconStack: tierIconStack('proton', index, tier),
		condition: (manager: GameManager) => manager.currencies[CurrenciesTypes.PROTONS].earnedAllTime >= tier,
		hiddenCondition: (manager: GameManager) => manager.currencies[CurrenciesTypes.PROTONS].earnedAllTime === 0,
	}));
}

function createElectronizeAchievements(): Achievement[] {
	const tiers = [1, 2, 3, 5, 10, 20, 50, 100, 250, 500, 1000];
	return tiers.map((tier, index) => ({
		id: `electronizes_${tier}`,
		name: `${tier} Electronizes`,
		description: `Electronize ${tier} times`,
		iconStack: tierIconStack('electron', index, tier),
		condition: (manager: GameManager) => manager.currencies[CurrenciesTypes.ELECTRONS].earnedAllTime >= tier,
		hiddenCondition: (manager: GameManager) => manager.currencies[CurrenciesTypes.ELECTRONS].earnedAllTime === 0,
	}));
}

function createCurrencyAchievements(): Achievement[] {
	return Object.values(CURRENCIES)
		.filter(c => c.achievementTiers && c.stat)
		.flatMap(currency => {
			return currency.achievementTiers!.map((tier, index) => {
				let name = `${formatNumber(tier)} ${currency.name}`;
				let description = `Collect ${formatNumber(tier)} ${currency.name.toLowerCase()}`;

				if (currency.name === CurrenciesTypes.HIGGS_BOSON) {
					const countNames: Record<number, string> = {
						1: 'First',
						10: 'Ten',
						64: '64',
						512: '512',
						4096: '4096',
					};
					name = `${countNames[tier] || tier} Bonus Higgs Boson`;
					description = `Click ${formatNumber(tier, 0)} bonus higgs boson${tier === 1 ? '' : 's'}`;
				} else if (currency.name === CurrenciesTypes.EXCITED_PHOTONS) {
					name = `Excited ${
						tier >= 1000 ?
							tier >= 400000 ?
								'4'
							:	'3'
						: tier >= 20 ? '2'
						: ''
					}`;
					description = `Earn ${formatNumber(tier)} Excited Photon${tier > 1 ? 's' : ''}`;
				}

				// Prefix mapping for backward compatibility and cleanliness
				let prefix = currency.id;
				if (currency.name === CurrenciesTypes.ATOMS) prefix = 'atoms';
				if (currency.name === CurrenciesTypes.EXCITED_PHOTONS) prefix = 'excited_photons';
				if (currency.name === CurrenciesTypes.HIGGS_BOSON) prefix = 'bonus_higgs_boson_clicked';
				if (currency.name === CurrenciesTypes.PHOTONS) prefix = 'photons';

				return {
					id: `${prefix}_${tier}`,
					name,
					description,
					iconStack: tierIconStack(CURRENCY_ICON_NAMES[currency.name as CurrencyName], index, tier),
					condition: (manager: GameManager) => {
						const currencyData = manager.currencies[currency.stat as CurrencyName];
						return (currencyData?.earnedAllTime || 0) >= tier;
					},
					hiddenCondition: (manager: GameManager) => {
						const currencyData = manager.currencies[currency.stat as CurrencyName];
						return (currencyData?.earnedAllTime || 0) === 0;
					},
				};
			});
		});
}

function createPhotonUpgradeAchievements(): Achievement[] {
	const achievements: Achievement[] = [];

	// Achievement for total photon upgrades
	achievements.push({
		id: 'photon_collector',
		name: 'Photon Collector',
		description: 'Purchase 50 total photon upgrade levels',
		iconStack: { count: 3, icon: 'photon', label: '50' },
		condition: (manager: GameManager) => {
			const totalUpgrades = Object.values(manager.photonUpgrades || {}).reduce((sum, level) => sum + level, 0);
			return totalUpgrades >= 50;
		},
		hiddenCondition: (manager: GameManager) => {
			const totalUpgrades = Object.values(manager.photonUpgrades || {}).reduce((sum, level) => sum + level, 0);
			return totalUpgrades < 10;
		},
	});

	return achievements;
}

function createCurrencyBoostAchievements(): Achievement[] {
	return [
		{
			id: 'first_boost',
			name: 'Power Amplifier',
			description: 'Allocate your first skill point to a currency boost',
			iconStack: { count: 1, icon: 'upgrade' },
			condition: (manager: GameManager) => {
				const totalBoosts = Object.values(manager.skillPointBoosts || {}).reduce((sum, points) => sum + (points ?? 0), 0);
				return totalBoosts >= 1;
			},
			hiddenCondition: (manager: GameManager) => manager.totalProtonisesAllTime < 1,
		},
		{
			id: 'max_single_boost',
			name: 'Laser Focus',
			description: 'Maximize a single currency boost (20 points)',
			iconStack: { count: 3, icon: 'upgrade', label: '20' },
			condition: (manager: GameManager) => {
				const boosts = Object.values(manager.skillPointBoosts || {});
				return boosts.some(points => (points ?? 0) >= 20);
			},
			hiddenCondition: (manager: GameManager) => manager.skillPointsTotal < 5,
		},
	];
}
function createRadiationAchievements(): Achievement[] {
	return [
		{
			id: 'radiation_mass_500',
			name: 'Critical Mass',
			description: 'Accumulate 500 mass in the reactor',
			iconStack: { count: 3, icon: 'radiation', label: '500' },
			condition: () => radiationManager.mass >= 500,
			hiddenCondition: () => !radiationManager.unlocked,
		},
		{
			id: 'radiation_power_100',
			name: 'Maximum Power',
			description: 'Reach 100% power level',
			iconStack: { count: 2, icon: 'radiation', label: '100%' },
			condition: () => radiationManager.controlRodLevel >= 1,
			hiddenCondition: () => radiationManager.controlRodLevel < 0.1,
		},
		{
			id: 'radiation_cpm_1000',
			name: 'Radioactive',
			description: 'Reach 1000 CPM',
			iconStack: { count: 3, icon: 'radiation', label: '1K' },
			condition: () => radiationManager.currentCpm >= 1000,
			hiddenCondition: () => !radiationManager.unlocked,
		},
		{
			id: 'radiation_upgrades_20',
			name: 'Nuclear Engineer',
			description: 'Purchase 20 radiation upgrades',
			iconStack: { count: 3, icon: 'upgrade', label: '20' },
			condition: (manager: GameManager) => {
				const upgrades = manager.radiationUpgrades || {};
				const count = Object.values(upgrades).reduce((a, b) => a + b, 0);
				return count >= 20;
			},
			hiddenCondition: () => !radiationManager.unlocked,
		},
	];
}

const achievementsArray: Achievement[] = [
	...BUILDING_TYPES.map(createBuildingAchievements).flat(),
	...createBuildingTotalAchievements(),
	...createBuildingLevelsAchievements(),
	...createAtomsPerSecondAchievements(),
	...createTotalClicksAchievements(),
	...createTotalLevelsAchievements(),
	...createProtoniseAchievements(),
	...createElectronizeAchievements(),
	...createCurrencyAchievements(),
	...createCurrencyBoostAchievements(),
	...createPhotonUpgradeAchievements(),
	...createRadiationAchievements(),
	...SPECIAL_ACHIEVEMENTS,
];

export const ACHIEVEMENTS = Object.fromEntries(achievementsArray.map(achievement => [achievement.id, achievement]));

/** Pre-built so the per-tick achievement sweep does not rebuild an entries array every second. */
export const ACHIEVEMENT_ENTRIES = Object.entries(ACHIEVEMENTS);
