import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { FeatureTypes } from '$data/features';
import { GENERATOR_TYPES, GENERATORS, type GeneratorType } from '$data/generators';
import { GENERATOR_ICON_NAMES, type IconName } from '$data/icons';
import { add, mul, sum } from '$helpers/effects';
import type { GameManager } from '$helpers/GameManager.svelte';
import type { Effect, Upgrade } from '$lib/types';
import { capitalize, formatNumber, shortNumberText } from '$lib/utils';

interface CreateUpgradesOptions {
	condition?: (index: number, manager: GameManager) => boolean;
	cost: (index: number) => number;
	count: number;
	currency?: CurrencyName;
	description: (index: number) => string;
	effects: (index: number) => Effect[];
	icon?: IconName;
	id: string;
	idForIndex?: (index: number) => string;
	name: (index: number) => string;
}

function createUpgrades(options: CreateUpgradesOptions): Upgrade[] {
	const upgrades: Upgrade[] = [];
	for (let i = 1; i <= options.count; i++) {
		upgrades.push({
			condition: state => options.condition?.(i, state) !== false,
			cost: {
				amount: options.cost(i),
				currency: options.currency ?? CurrenciesTypes.ATOMS,
			},
			description: options.description(i),
			effects: options.effects(i),
			icon: options.icon,
			id: options.idForIndex?.(i) ?? `${options.id}_${i}`,
			name: options.name(i),
		});
	}
	return upgrades;
}

const achievementCount = (manager: GameManager) => manager.achievements.length;
const playerLevel = (manager: GameManager) => manager.playerLevel;

/** Boost tiers 6-10, 11-15 and 16-20 each need one more protonise, so a first run tops out near 1e15 atoms instead of 1e29. */
export const GENERATOR_BOOST_TIERS_PER_PROTONISE = 5;

export function boostTierProtonises(tier: number): number {
	return Math.floor((tier - 1) / GENERATOR_BOOST_TIERS_PER_PROTONISE);
}

/** Boost tiers of unlocked generators that the next protonise opens, so the panel can say why the atom list ran dry. */
export function boostTiersUnlockedByNextProtonise(manager: GameManager): number {
	const unlockedGenerators = GENERATOR_TYPES.filter(type => manager.generators[type]?.unlocked).length;
	return manager.totalProtonisesAllTime < 3 ? unlockedGenerators * GENERATOR_BOOST_TIERS_PER_PROTONISE : 0;
}

function createGeneratorUpgrades(generatorType: GeneratorType) {
	const generator = GENERATORS[generatorType];
	return createUpgrades({
		condition: (i, state) =>
			state.generators[generatorType]?.unlocked === true && state.totalProtonisesAllTime >= boostTierProtonises(i),
		count: 20,
		icon: GENERATOR_ICON_NAMES[generatorType],
		id: generatorType.toLowerCase(),
		name: i => `${generator.name} Boost ${i}`,
		description: i => `${capitalize(shortNumberText(1 + Math.ceil(i / 5)))} ${generator.name} production`,
		cost: i => generator.cost.amount * 2.5 ** (i * 2) * (i > 10 ? i ** 3 : 1),
		effects: i => [mul('generator', 1 + Math.ceil(i / 5), generatorType)],
	});
}

function createClickPowerUpgrades() {
	return [
		...createUpgrades({
			count: 20,
			icon: 'click',
			id: 'click_power_mul',
			name: i => `Click Power ${i}`,
			description: i => `${i < 6 ? '1.5x' : '2x'} click power`,
			cost: i => {
				const baseCost = 10 * 2 ** (i * 3);
				return i > 8 ? baseCost * i ** 6.5 : baseCost;
			},
			effects: i => [mul('click', i < 6 ? 1.5 : 2)],
		}),
		...createUpgrades({
			count: 15,
			icon: 'click',
			id: 'click_power_val',
			name: i => `Click Value ${i}`,
			description: i => `+${formatNumber(Math.ceil(10 ** i / 10))} base value per click`,
			cost: i => {
				const baseCost = 4 ** (i * 2) * 10;
				return i > 6 ? baseCost * i ** 3.5 * 1.1 : baseCost * 1.1;
			},
			effects: i => [add('click', Math.ceil(10 ** i / 10))],
		}),
		...createUpgrades({
			count: 7,
			icon: 'trendingUp',
			id: 'click_power_aps',
			name: i => `Global Click Power ${Math.ceil(i / 2)}`,
			description: i => `+${Math.ceil(i / 2)}% of your Atoms per second per click`,
			cost: i => {
				const baseCost = 10 * 2 ** (i * 10);
				return i > 3 ? baseCost * i ** 8 * 1.1 : baseCost * 1.1;
			},
			effects: i => [add('click_aps', Math.ceil(i / 2) / 100)],
		}),
	];
}

function createGlobalUpgrades() {
	return [
		...createUpgrades({
			id: 'global_boost',
			count: 50,
			icon: 'globe',
			name: i => `Global Boost ${i}`,
			description: i => `${formatNumber(1 + i / 100)}x all production`,
			cost: i => {
				const baseCost = 1.25 * 10 ** (i * 1.1);
				if (i > 40) {
					return baseCost * i ** 9.5;
				}
				if (i > 30) {
					return baseCost * i ** 7.5;
				}
				return i > 20 ? baseCost * i ** 5.5 : baseCost;
			},
			effects: i => [mul('global', 1 + i / 100)],
		}),
		...createUpgrades({
			id: 'global_achievements_mul',
			count: 11,
			condition: (i, state) => (i > 1 ? state.achievements.length > 10 * i : true),
			icon: 'trophy',
			name: i => `Atom Soup ${i}`,
			description: i => `+${Math.ceil(i / 5)}% production per achievement`,
			cost: i => Math.pow(10, i * 3 + 2),
			effects: i => [sum('global', achievementCount, Math.ceil(i / 5) / 100)],
		}),
	];
}

function createOfflineCapUpgrades() {
	const isUnlocked = (state: GameManager) => state.features[FeatureTypes.OFFLINE_PROGRESS] === true;
	const caps = [
		{
			cost: 50_000_000,
			description: 'Increase offline cap to 12 hours',
			id: 'offline_cap_12h',
			name: 'Offline Cap 12h',
		},
		{
			cost: 750_000_000,
			description: 'Increase offline cap to 1 day',
			id: 'offline_cap_1d',
			name: 'Offline Cap 1d',
		},
		{
			cost: 25_000_000_000,
			description: 'Increase offline cap to 1.5 days',
			id: 'offline_cap_1_5d',
			name: 'Offline Cap 1.5d',
		},
		{
			cost: 500_000_000_000,
			description: 'Increase offline cap to 2 days',
			id: 'offline_cap_2d',
			name: 'Offline Cap 2d',
		},
		{
			cost: 10_000_000_000_000,
			description: 'Increase offline cap to 3 days',
			id: 'offline_cap_3d',
			name: 'Offline Cap 3d',
		},
	];

	return createUpgrades({
		condition: (_, state) => isUnlocked(state),
		cost: (index) => caps[index - 1]?.cost ?? 0,
		count: caps.length,
		currency: CurrenciesTypes.ATOMS,
		description: (index) => caps[index - 1]?.description ?? '',
		effects: () => [],
		icon: 'offline',
		id: 'offline_cap',
		idForIndex: (index) => caps[index - 1]?.id ?? `offline_cap_${index}`,
		name: (index) => caps[index - 1]?.name ?? `Offline Cap ${index}`,
	});
}

function createPowerUpIntervalUpgrades() {
	return createUpgrades({
		condition: (_, state) => (state.currencies[CurrenciesTypes.HIGGS_BOSON]?.earnedAllTime ?? 0) > 0,
		icon: 'higgsBoson',
		id: 'power_up_interval',
		count: 15,
		name: i => `Power Up Interval ${i + 1}`,
		description: i => `${i > 5 ? '0.9x' : '0.8x'} power up interval`,
		cost: i => {
			const baseCost = 15_000 * 2 ** (i * 10);
			return i > 5 ? baseCost * i ** 3 * 1.1 : baseCost * 1.1;
		},
		effects: i => [mul('power_up_interval', i > 5 ? 0.9 : 0.8)],
	});
}

function createLevelBoostUpgrades() {
	return createUpgrades({
		condition: (_, state) => state.features[FeatureTypes.LEVELS] === true,
		cost: i => 1e5 * 2_500_000 ** (i - 1),
		count: 10,
		description: i => `+${1 + Math.ceil(i / 2)}% production per level`,
		effects: i => [sum('global', playerLevel, (1 + Math.ceil(i / 2)) / 100)],
		icon: 'level',
		id: 'level_boost',
		name: i => `Level Boost ${i}`,
	});
}

function createProtonUpgrades(): Upgrade[] {
	const isStabilityUnlocked = (_: number, state: GameManager) => state.features[FeatureTypes.STABILITY_FIELD] === true;
	const isOfflineUnlocked = (state: GameManager) => state.features[FeatureTypes.OFFLINE_PROGRESS] === true;

	return [
		...createUpgrades({
			id: 'proton_boost',
			count: 10,
			currency: CurrenciesTypes.PROTONS,
			icon: 'proton',
			name: i => `Proton Boost ${i}`,
			description: i => `${2 + i}x all production`,
			cost: i => {
				const baseCost = Math.ceil(2 ** (i * 2.1));
				return i > 2 ? baseCost * i ** 4.1 : baseCost;
			},
			effects: i => [mul('global', 2 + i)],
		}),
		{
			id: 'proton_electron_boost_1',
			name: 'Double Electrons',
			description: '2x electrons gained from electronize',
			icon: 'electron',
			cost: {
				amount: 8_000_000_000,
				currency: CurrenciesTypes.PROTONS,
			},
			effects: [mul('electron_gain', 2)],
		},
		{
			id: 'proton_electron_boost_2',
			name: 'Double Electrons II',
			description: '2x electrons gained from electronize',
			condition: state => state.upgrades.includes('proton_electron_boost_1'),
			icon: 'electron',
			cost: {
				amount: 350_000_000_000,
				currency: CurrenciesTypes.PROTONS,
			},
			effects: [mul('electron_gain', 2)],
		},
		{
			id: 'proton_electron_boost_3',
			name: 'Triple Electrons',
			description: '3x electrons gained from electronize',
			icon: 'electron',
			cost: {
				amount: 20_000_000_000_000,
				currency: CurrenciesTypes.PROTONS,
			},
			effects: [mul('electron_gain', 3)],
		},
		{
			id: 'proton_electron_boost_total_protonises',
			name: 'Total Protonises',
			description: '+1 electron per protonise',
			icon: 'electron',
			cost: {
				amount: 125_000_000_000_000,
				currency: CurrenciesTypes.PROTONS,
			},
			effects: [add('electron_gain', manager => manager.totalProtonisesRun)],
		},
		...createUpgrades({
			id: 'protonise_boost',
			count: 5,
			currency: CurrenciesTypes.PROTONS,
			icon: 'proton',
			name: i => `Protonise Master ${i}`,
			description: i => `+${25 * i}% production per protonise`,
			cost: i => {
				const baseCost = Math.ceil(5 * 3 ** (i + 2.1));
				return i > 3 ? baseCost * i ** 5.1 : baseCost;
			},
			effects: i => [mul('global', manager => 1 + manager.totalProtonisesRun * 0.25 * i)],
		}),
		...createUpgrades({
			id: 'protonise_start',
			count: 3,
			currency: CurrenciesTypes.PROTONS,
			icon: 'atom',
			name: i => `Quick Start ${i}`,
			description: i => `Start with ${formatNumber(10 ** (3 + i))} atoms after protonising`,
			cost: i => {
				const baseCost = Math.ceil(3 * 2 ** (i + 1.1));
				return i > 2 ? baseCost * i ** 3.1 : baseCost;
			},
			effects: i => [add('start_atoms', 10 ** (3 + i))],
		}),
		...createUpgrades({
			id: 'proton_auto_click',
			count: 5,
			currency: CurrenciesTypes.PROTONS,
			icon: 'click',
			name: i => `Auto Clicker ${i}`,
			description: i => `Automatically clicks ${Math.ceil(i / 2)} time${Math.ceil(i / 2) > 1 ? 's' : ''} per second`,
			cost: i => {
				const baseCost = Math.ceil(3 * 3 ** (i + 1.1));
				return i > 1 ? baseCost * i ** 4.1 : baseCost;
			},
			effects: i => [add('auto_click', Math.ceil(i / 2))],
		}),
		{
			condition: isOfflineUnlocked,
			cost: {
				amount: 120,
				currency: CurrenciesTypes.PROTONS,
			},
			description: 'Unlock offline auto-upgrades (1/120 speed)',
			effects: [],
			icon: 'offline',
			id: 'proton_offline_autobuy',
			name: 'Offline Auto-upgrades',
		},
		{
			condition: isOfflineUnlocked,
			cost: {
				amount: 250,
				currency: CurrenciesTypes.PROTONS,
			},
			description: 'Unlock offline atom auto-clicks (1/120 speed)',
			effects: [],
			icon: 'offline',
			id: 'proton_offline_autoclick',
			name: 'Offline Atom Auto-click',
		},
		...createUpgrades({
			id: 'stability_boost',
			count: 5,
			currency: CurrenciesTypes.PROTONS,
			icon: 'stabilityMeter',
			name: i => `Stable Resonance ${i}`,
			description: i => `+${25 * i}% effect from Stability Meter`,
			condition: isStabilityUnlocked,
			cost: i => Math.ceil(140 * 2.05 ** i),
			effects: () => [add('stability_boost', 0.25)],
		}),
		...createUpgrades({
			id: 'stability_speed',
			count: 10,
			currency: CurrenciesTypes.PROTONS,
			icon: 'stabilityMeter',
			name: i => `Field Coherence ${i}`,
			description: () => `Stability grows 10% faster`,
			condition: isStabilityUnlocked,
			cost: i => Math.ceil(100 * 2.25 ** i),
			effects: () => [add('stability_speed', 0.1)],
		}),
		...createUpgrades({
			id: 'stability_expansion',
			count: 5,
			currency: CurrenciesTypes.PROTONS,
			icon: 'stabilityMeter',
			name: i => `Temporal Expansion ${i}`,
			description: () => `Extends stability capacity and max bonus`,
			condition: isStabilityUnlocked,
			cost: i => Math.ceil(500 * 3 ** i),
			effects: () => [add('stability_capacity', 2.2)],
		}),
	];
}

function createElectronUpgrades(): Upgrade[] {
	return [
		...GENERATOR_TYPES.map((generatorType, index): Upgrade => {
			const generator = GENERATORS[generatorType];
			return {
				id: `electron_auto_buy_${generatorType}`,
				name: `Auto ${generator.name}`,
				description: `Automatically buys 1 ${generator.name} every 30 seconds`,
				cost: {
					amount: 2 + index,
					currency: CurrenciesTypes.ELECTRONS,
				},
				icon: GENERATOR_ICON_NAMES[generatorType],
				effects: [add('auto_buy', 0, generatorType)],
			};
		}),
		...GENERATOR_TYPES.map((generatorType, index): Upgrade => {
			const generator = GENERATORS[generatorType];
			return {
				id: `electron_auto_buy_speed_${generatorType}`,
				name: `Faster Auto ${generator.name}`,
				description: `Reduces ${generator.name} auto-buy interval by 5 seconds`,
				condition: state => state.upgrades.includes(`electron_auto_buy_${generatorType}`),
				cost: {
					amount: 3 + index,
					currency: CurrenciesTypes.ELECTRONS,
				},
				icon: GENERATOR_ICON_NAMES[generatorType],
				effects: [add('auto_buy', -5000, generatorType)],
			};
		}),
		...createUpgrades({
			id: 'electron_auto_upgrade',
			count: 4,
			currency: CurrenciesTypes.ELECTRONS,
			icon: 'upgrade',
			name: i => `${i === 1 ? 'Auto' : 'Faster Auto'} Upgrade ${i > 1 ? i : ''}`,
			description: i =>
				`${i === 1 ? 'Automatically buys' : 'Reduces auto-upgrade interval by'} ${
					i === 1 ? 'the cheapest available upgrade every 30 seconds' : '5 seconds'
				}`,
			condition: (i, state) => i === 1 || state.upgrades.includes(`electron_auto_upgrade_${i - 1}`),
			cost: i => 25 + (i - 1) * 15,
			effects: i => [add('auto_upgrade', i === 1 ? 0 : -5000)],
		}),
		...createUpgrades({
			id: 'electron_power_up_interval',
			count: 4,
			currency: CurrenciesTypes.ELECTRONS,
			icon: 'higgsBoson',
			name: i => `${i === 1 ? 'Faster' : 'Even Faster'} Power-ups ${i > 1 ? i : ''}`,
			description: i => `Reduces power-up spawn interval by ${i * 10}%`,
			condition: (i, state) => i === 1 || state.upgrades.includes(`electron_power_up_interval_${i - 1}`),
			cost: i => 6 * i,
			effects: i => [mul('power_up_interval', 1 - i * 0.1)],
		}),
		{
			id: 'electron_bypass_atom_autoclick_stability',
			name: 'Stable Automation',
			description: 'Auto-clicker on Atom Realm no longer destabilizes the field',
			cost: {
				amount: 50,
				currency: CurrenciesTypes.ELECTRONS,
			},
			icon: 'atom',
			effects: [],
		},
		{
			id: 'electron_bypass_photon_autoclick_stability',
			name: 'Stable Quantum Flux',
			description: 'Auto-clicker on Photon Realm no longer destabilizes the field',
			cost: {
				amount: 100,
				currency: CurrenciesTypes.ELECTRONS,
			},
			icon: 'photon',
			effects: [],
		},
		{
			id: 'electron_bypass_photon_click_stability',
			name: 'Stable Interaction',
			description: 'Manual clicking on Photon Realm no longer destabilizes the field',
			cost: {
				amount: 250,
				currency: CurrenciesTypes.ELECTRONS,
			},
			icon: 'photon',
			effects: [],
		},
		{
			id: 'electron_bypass_atom_click_stability',
			name: 'Stable Manipulation',
			description: 'Manual clicking on Atom Realm no longer destabilizes the field',
			cost: {
				amount: 400,
				currency: CurrenciesTypes.ELECTRONS,
			},
			icon: 'atom',
			effects: [],
		},
		{
			id: 'electron_bypass_bonus_click_stability',
			name: 'Stable Anomalies',
			description: 'Clicking bonuses no longer destabilizes the field',
			cost: {
				amount: 500,
				currency: CurrenciesTypes.ELECTRONS,
			},
			icon: 'higgsBoson',
			effects: [],
		},
	];
}

const upgrades = [
	...GENERATOR_TYPES.flatMap(createGeneratorUpgrades),
	...createClickPowerUpgrades(),
	...createGlobalUpgrades(),
	...createOfflineCapUpgrades(),
	...createPowerUpIntervalUpgrades(),
	...createLevelBoostUpgrades(),
	...createProtonUpgrades(),
	...createElectronUpgrades(),
];

export const UPGRADES = Object.fromEntries(upgrades.map(upgrade => [upgrade.id, upgrade]));
