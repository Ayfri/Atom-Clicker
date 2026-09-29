import { CurrenciesTypes } from '$data/currencies';
import type { Price } from '$lib/types';
import type { GameManager } from '$helpers/GameManager.svelte';
import { formatNumber } from '$lib/utils';

/** Effects live in RadiationManager, which reads the levels directly because every reactor formula is a single term per upgrade. */
export interface RadiationUpgrade {
	baseCost: number;
	condition?: (manager: GameManager) => boolean;
	costMultiplier: number;
	description: (level: number) => string;
	id: string;
	maxLevel: number;
	name: string;
}

export const RADIATION_UPGRADES: Record<string, RadiationUpgrade> = {
	breeder_reactor: {
		baseCost: 25,
		costMultiplier: 1.4,
		description: level => `Regenerates +${(level * 0.2).toFixed(1)} u of fuel per second`,
		id: 'breeder_reactor',
		maxLevel: 20,
		name: 'Breeder Reactor',
	},
	cherenkov_glow: {
		baseCost: 100,
		costMultiplier: 1.6,
		description: level => `+${(level * 5).toFixed(0)}% production bonus`,
		id: 'cherenkov_glow',
		maxLevel: 10,
		name: 'Cherenkov Glow',
	},
	coolant_pumps: {
		baseCost: 30,
		costMultiplier: 1.5,
		description: level => `Raises the output cap by ${(level * 50).toFixed(0)}%`,
		id: 'coolant_pumps',
		maxLevel: 20,
		name: 'Coolant Pumps',
	},
	fusion_ignition: {
		baseCost: 8000,
		condition: manager => manager.totalIonizesAllTime >= 3,
		costMultiplier: 1.7,
		description: level => `Raises the output cap by ${formatNumber(level * 1000)} CPM`,
		id: 'fusion_ignition',
		maxLevel: 10,
		name: 'Fusion Ignition',
	},
	graphite_moderators: {
		baseCost: 15,
		costMultiplier: 1.15,
		description: level => `Fuel burns ${(level * 10).toFixed(0)}% slower`,
		id: 'graphite_moderators',
		maxLevel: 8,
		name: 'Graphite Moderators',
	},
	ion_lattice: {
		baseCost: 2000,
		condition: manager => manager.totalIonizesAllTime >= 2,
		costMultiplier: 1.6,
		description: level => `+${(level * 20).toFixed(0)}% radiation multiplier`,
		id: 'ion_lattice',
		maxLevel: 10,
		name: 'Ion Lattice',
	},
	isotopic_enrichment: {
		baseCost: 10,
		costMultiplier: 1.25,
		description: level => `+${(level * 25).toFixed(0)}% output from the same fuel`,
		id: 'isotopic_enrichment',
		maxLevel: 20,
		name: 'Isotopic Enrichment',
	},
	magnetic_confinement: {
		baseCost: 50,
		costMultiplier: 1.5,
		description: level => `${(level * 10).toFixed(0)}% chance each second to burn only half the fuel`,
		id: 'magnetic_confinement',
		maxLevel: 5,
		name: 'Magnetic Confinement',
	},
	neutron_reflector: {
		baseCost: 500,
		condition: manager => manager.totalIonizesAllTime >= 1,
		costMultiplier: 1.5,
		description: level => `Each electron makes ${(level * 25).toFixed(0)}% more fuel`,
		id: 'neutron_reflector',
		maxLevel: 10,
		name: 'Neutron Reflector',
	},
};

export const getRadiationUpgradeCost = (upgrade: RadiationUpgrade, currentLevel: number): number => {
	return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
};

export const getRadiationUpgradePrice = (upgrade: RadiationUpgrade, currentLevel: number): Price => ({
	amount: getRadiationUpgradeCost(upgrade, currentLevel),
	currency: CurrenciesTypes.ELECTRONS,
});
