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

const isGeneratorUnlocked = (generatorType: GeneratorType) => (state: GameManager) => state.generators[generatorType]?.unlocked === true;

function createGeneratorUpgrades(generatorType: GeneratorType, index: number): Upgrade[] {
	const generator = GENERATORS[generatorType];
	const icon = GENERATOR_ICON_NAMES[generatorType];
	const id = generatorType.toLowerCase();
	const levels = (manager: GameManager) => manager.generators[generatorType]?.level ?? 0;
	return [
		...createUpgrades({
			condition: (i, state) => isGeneratorUnlocked(generatorType)(state) && state.totalProtonisesAllTime >= boostTierProtonises(i),
			count: 20,
			icon,
			id,
			name: i => `${generator.name} Boost ${i}`,
			description: i => `${capitalize(shortNumberText(1 + Math.ceil(i / 5)))} ${generator.name} production`,
			cost: i => generator.cost.amount * 2.5 ** (i * 2) * (i > 10 ? i ** 3 : 1),
			effects: i => [mul('generator', 1 + Math.ceil(i / 5), generatorType)],
		}),
		{
			condition: state => (state.generators[generatorType]?.count ?? 0) >= 100,
			cost: { amount: 1_000_000 * 10 ** index, currency: CurrenciesTypes.ATOMS },
			description: `2x ${generator.name} production, needs 100 ${generator.name}`,
			effects: [mul('generator', 2, generatorType)],
			icon,
			id: `${id}_multiplier`,
			name: `${generator.name} Multiplier`,
		},
		{
			condition: isGeneratorUnlocked(generatorType),
			// 30x per generator so the last masteries wait for later protonise runs instead of all landing at 5e14 atoms.
			cost: { amount: 5_000_000 * 30 ** index, currency: CurrenciesTypes.ATOMS },
			description: `+10% ${generator.name} production per 25 ${generator.name} levels`,
			effects: [mul('generator', manager => 1 + Math.floor(levels(manager) / 25) * 0.1, generatorType)],
			icon: 'generator',
			id: `${id}_level_mastery`,
			name: `${generator.name} Level Mastery`,
		},
	];
}

/** Boosts shared by a few neighbouring generator tiers, shown once the first tier they boost is unlocked. */
function createGeneratorGroupUpgrades(): Upgrade[] {
	const groups: { amount: number; cost: number; id: string; name: string; targets: GeneratorType[] }[] = [
		{ amount: 1.5, cost: 100_000, id: 'atomic_stability', name: 'Atomic Bonding', targets: ['molecule', 'crystal', 'nanostructure'] },
		{ amount: 3, cost: 1_000_000, id: 'molecular_boost', name: 'Molecular Boost', targets: ['molecule', 'crystal'] },
		{ amount: 2.5, cost: 2_500_000, id: 'nano_enhancement', name: 'Nano Enhancement', targets: ['nanostructure'] },
		{ amount: 2.5, cost: 5_000_000, id: 'biological_amplifier', name: 'Biological Amplifier', targets: ['microorganism'] },
		{ amount: 2, cost: 15_000_000, id: 'geological_force', name: 'Geological Force', targets: ['rock', 'planet'] },
	];
	return groups.map(({ amount, cost, id, name, targets }) => ({
		condition: isGeneratorUnlocked(targets[0]),
		cost: { amount: cost, currency: CurrenciesTypes.ATOMS },
		description: `${amount}x ${new Intl.ListFormat('en').format(targets.map(type => GENERATORS[type].name))} production`,
		effects: targets.map(type => mul('generator', amount, type)),
		icon: GENERATOR_ICON_NAMES[targets[0]],
		id,
		name,
	}));
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

function createGlobalUpgrades(): Upgrade[] {
	return [
		{
			cost: { amount: 5_000, currency: CurrenciesTypes.ATOMS },
			description: '2x all production',
			effects: [mul('global', 2)],
			icon: 'globe',
			id: 'global_multiplier',
			name: 'Global Multiplier',
		},
		{
			cost: { amount: 250_000, currency: CurrenciesTypes.ATOMS },
			description: '+10% production per 100 clicks this run',
			effects: [mul('global', manager => 1 + Math.floor(manager.totalClicksRun / 100) * 0.1)],
			icon: 'click',
			id: 'click_mastery',
			name: 'Click Mastery',
		},
		{
			condition: state => state.features[FeatureTypes.LEVELS],
			cost: { amount: 500_000, currency: CurrenciesTypes.ATOMS },
			description: '+20% production per 10 levels',
			effects: [mul('global', manager => 1 + Math.floor(manager.playerLevel / 10) * 0.2)],
			icon: 'level',
			id: 'level_mastery',
			name: 'Level Mastery',
		},
		{
			cost: { amount: 10_000_000, currency: CurrenciesTypes.ATOMS },
			description: '0.9x power-up interval, 1.1x power-up duration',
			effects: [mul('power_up_interval', 0.9), mul('power_up_duration', 1.1)],
			icon: 'higgsBoson',
			id: 'power_up_mastery',
			name: 'Power-up Mastery',
		},
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
		name: i => `Power-up Interval ${i + 1}`,
		description: i => `${i > 5 ? '0.9x' : '0.8x'} power-up interval`,
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

	return [
		...createUpgrades({
			id: 'proton_boost',
			count: 10,
			currency: CurrenciesTypes.PROTONS,
			icon: 'proton',
			name: i => `Proton Power ${i}`,
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
			description: '2x electrons gained from Electronize',
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
			description: '2x electrons gained from Electronize',
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
			description: '3x electrons gained from Electronize',
			icon: 'electron',
			cost: {
				amount: 20_000_000_000_000,
				currency: CurrenciesTypes.PROTONS,
			},
			effects: [mul('electron_gain', 3)],
		},
		{
			id: 'proton_electron_boost_total_protonises',
			name: 'Electron Residue',
			description: '+1 electron per Protonize',
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
			name: i => `Protonize Master ${i}`,
			description: i => `+${25 * i}% production per Protonize`,
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
			description: i => `Start with ${formatNumber(10 ** (3 + i))} atoms after a Protonize`,
			cost: i => {
				const baseCost = Math.ceil(3 * 2 ** (i + 1.1));
				return i > 2 ? baseCost * i ** 3.1 : baseCost;
			},
			effects: i => [add('start_atoms', 10 ** (3 + i))],
		}),
		// Level 1 is the Auto Clicker skill, these start at level 2.
		...createUpgrades({
			id: 'proton_auto_click',
			count: 4,
			condition: (_, state) => state.skillUpgrades.includes('autoClicker'),
			currency: CurrenciesTypes.PROTONS,
			icon: 'click',
			idForIndex: i => `proton_auto_click_${i + 1}`,
			name: i => `Auto Clicker Speed ${i + 1}`,
			description: i => `Automatically clicks ${Math.ceil((i + 1) / 2)} more time${Math.ceil((i + 1) / 2) > 1 ? 's' : ''} per second`,
			cost: i => Math.ceil(3 * 3 ** (i + 2.1)) * (i + 1) ** 4.1,
			effects: i => [add('auto_click', Math.ceil((i + 1) / 2))],
		}),
		{
			cost: { amount: 1_000, currency: CurrenciesTypes.PROTONS },
			description: '+1% production per thousand registered players',
			effects: [mul('global', manager => 1 + manager.totalUsers / 100_000)],
			icon: 'players',
			id: 'proton_community_power',
			name: 'Community Power',
		},
		{
			cost: { amount: 2_500, currency: CurrenciesTypes.PROTONS },
			description: '2x electrons gained from Electronize',
			effects: [mul('electron_gain', 2)],
			icon: 'electron',
			id: 'proton_electron_harvester',
			name: 'Electron Harvester',
		},
		{
			cost: { amount: 25_000, currency: CurrenciesTypes.PROTONS },
			description: '1.5x protons gained from Protonize',
			effects: [mul('proton_gain', 1.5)],
			icon: 'proton',
			id: 'proton_collector',
			name: 'Proton Collector',
		},
		{
			cost: { amount: 250_000, currency: CurrenciesTypes.PROTONS },
			description: '+1% production per Electronize',
			effects: [mul('global', manager => 1 + manager.totalElectronizesAllTime * 0.01)],
			icon: 'electron',
			id: 'proton_prestige_bonus',
			name: 'Prestige Bonus',
		},
		{
			cost: { amount: 2_500_000, currency: CurrenciesTypes.PROTONS },
			description: '+20% production per 100 generators owned',
			effects: [mul('global', manager => 1 + Math.floor(manager.generatorTotals.count / 100) * 0.2)],
			icon: 'generator',
			id: 'proton_quantum_resonance',
			name: 'Quantum Resonance',
		},
		{
			condition: state => (state.generators.star?.count ?? 0) >= 5,
			cost: { amount: 25_000_000, currency: CurrenciesTypes.PROTONS },
			description: '2x Star, Neutron Star and Black Hole production',
			effects: [mul('generator', 2, 'star'), mul('generator', 2, 'neutronStar'), mul('generator', 2, 'blackHole')],
			icon: 'star',
			id: 'proton_stellar_core',
			name: 'Stellar Core',
		},
		{
			cost: { amount: 250_000_000, currency: CurrenciesTypes.PROTONS },
			description: '+25% production per Protonize',
			effects: [mul('global', manager => 1 + manager.totalProtonisesRun * 0.25)],
			icon: 'proton',
			id: 'proton_particle_accelerator',
			name: 'Particle Accelerator',
		},
		...createUpgrades({
			id: 'stability_boost',
			count: 5,
			currency: CurrenciesTypes.PROTONS,
			icon: 'stabilityField',
			name: i => `Field Strength ${i}`,
			description: i => `+${25 * i}% Stability Field bonus`,
			condition: isStabilityUnlocked,
			cost: i => Math.ceil(140 * 2.05 ** i),
			effects: () => [add('stability_boost', 0.25)],
		}),
		...createUpgrades({
			id: 'stability_speed',
			count: 10,
			currency: CurrenciesTypes.PROTONS,
			icon: 'stabilityField',
			name: i => `Field Coherence ${i}`,
			description: () => `The Stability Field grows 10% faster`,
			condition: isStabilityUnlocked,
			cost: i => Math.ceil(100 * 2.25 ** i),
			effects: () => [add('stability_speed', 0.1)],
		}),
		...createUpgrades({
			id: 'stability_expansion',
			count: 5,
			currency: CurrenciesTypes.PROTONS,
			icon: 'stabilityField',
			name: i => `Temporal Expansion ${i}`,
			description: () => `+220% Stability Field max bonus, but it takes 220% longer to fill`,
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
				id: `electron_auto_buy_speed_${generatorType}`,
				name: `Faster Auto ${generator.name}`,
				description: `Reduces ${generator.name} auto-buy interval by 5 seconds`,
				condition: state => state.skillUpgrades.includes(`${generatorType}AutoBuy`),
				cost: {
					amount: 3 + index,
					currency: CurrenciesTypes.ELECTRONS,
				},
				icon: GENERATOR_ICON_NAMES[generatorType],
				effects: [add('auto_buy', -5000, generatorType)],
			};
		}),
		// Level 1 is the Auto Upgrade skill, these start at level 2.
		...createUpgrades({
			id: 'electron_auto_upgrade',
			count: 3,
			currency: CurrenciesTypes.ELECTRONS,
			icon: 'upgrade',
			idForIndex: i => `electron_auto_upgrade_${i + 1}`,
			name: i => `Faster Auto Upgrade ${i + 1}`,
			description: () => 'Reduces auto-upgrade interval by 5 seconds',
			condition: (i, state) => (i === 1 ? state.skillUpgrades.includes('autoUpgrade') : state.upgrades.includes(`electron_auto_upgrade_${i}`)),
			cost: i => 25 + i * 15,
			effects: () => [add('auto_upgrade', -5000)],
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
			cost: { amount: 10, currency: CurrenciesTypes.ELECTRONS },
			description: '+5% production per generator type owned',
			effects: [mul('global', manager => 1 + GENERATOR_TYPES.filter(type => (manager.generators[type]?.count ?? 0) > 0).length * 0.05)],
			icon: 'generator',
			id: 'electron_cosmic_synergy',
			name: 'Cosmic Synergy',
		},
	];
}

const upgrades = [
	...GENERATOR_TYPES.flatMap(createGeneratorUpgrades),
	...createGeneratorGroupUpgrades(),
	...createClickPowerUpgrades(),
	...createGlobalUpgrades(),
	...createOfflineCapUpgrades(),
	...createPowerUpIntervalUpgrades(),
	...createLevelBoostUpgrades(),
	...createProtonUpgrades(),
	...createElectronUpgrades(),
];

export const UPGRADES = Object.fromEntries(upgrades.map(upgrade => [upgrade.id, upgrade]));
