import { CurrenciesTypes } from '$data/currencies';
import type { Effect, Price } from '$lib/types';
import type { GameManager } from '$helpers/GameManager.svelte';

export interface RadiationUpgrade {
	baseCost: number;
	condition?: (manager: GameManager) => boolean;
	costMultiplier: number;
	description: (level: number) => string;
	effects: (level: number) => Effect[];
	id: string;
	maxLevel: number;
	name: string;
}

export const RADIATION_UPGRADES: Record<string, RadiationUpgrade> = {
	breeder_reactor: {
		baseCost: 25,
		costMultiplier: 1.4,
		description: level => `Regenerates +${(level * 0.2).toFixed(1)} u of fuel per second`,
		effects: level => [
			{
				apply: value => value + level * 0.2,
				description: `+${(level * 0.2).toFixed(1)} mass/sec regeneration`,
				type: 'radiation_mass_regen',
			},
		],
		id: 'breeder_reactor',
		maxLevel: 20,
		name: 'Breeder Reactor',
	},
	cherenkov_glow: {
		baseCost: 100,
		costMultiplier: 1.6,
		description: level => `+${(level * 5).toFixed(0)}% production bonus`,
		effects: level => [
			{
				apply: value => value + level * 0.05,
				description: `+${(level * 5).toFixed(0)}% multiplier bonus`,
				type: 'radiation_critical_chance',
			},
		],
		id: 'cherenkov_glow',
		maxLevel: 10,
		name: 'Cherenkov Glow',
	},
	coolant_pumps: {
		baseCost: 30,
		costMultiplier: 1.5,
		description: level => `Raises the output cap by ${(level * 50).toFixed(0)}%`,
		effects: level => [
			{
				apply: value => value * (1 + level * 0.5),
				description: `+${(level * 50).toFixed(0)}% max CPM`,
				type: 'radiation_max_cpm',
			},
		],
		id: 'coolant_pumps',
		maxLevel: 20,
		name: 'Coolant Pumps',
	},
	graphite_moderators: {
		baseCost: 15,
		costMultiplier: 1.15,
		description: level => `Fuel burns ${(level * 10).toFixed(0)}% slower`,
		effects: level => [
			{
				apply: value => value * (1 - level * 0.1),
				description: `-${(level * 10).toFixed(0)}% burn rate`,
				type: 'radiation_control_precision',
			},
		],
		id: 'graphite_moderators',
		maxLevel: 8,
		name: 'Graphite Moderators',
	},
	isotopic_enrichment: {
		baseCost: 10,
		costMultiplier: 1.25,
		description: level => `+${(level * 25).toFixed(0)}% output from the same fuel`,
		effects: level => [
			{
				apply: value => value * (1 + level * 0.25),
				description: `+${(level * 25).toFixed(0)}% enrichment`,
				type: 'radiation_enrichment',
			},
		],
		id: 'isotopic_enrichment',
		maxLevel: 20,
		name: 'Isotopic Enrichment',
	},
	magnetic_confinement: {
		baseCost: 50,
		costMultiplier: 1.5,
		description: level => `${(level * 10).toFixed(0)}% chance each second to burn only half the fuel`,
		effects: level => [
			{
				apply: value => value + level * 0.1,
				description: `+${(level * 10).toFixed(0)}% mass preservation`,
				type: 'radiation_mass_preservation',
			},
		],
		id: 'magnetic_confinement',
		maxLevel: 5,
		name: 'Magnetic Confinement',
	},
};

export const getRadiationUpgradeCost = (upgrade: RadiationUpgrade, currentLevel: number): number => {
	return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
};

export const getRadiationUpgradePrice = (upgrade: RadiationUpgrade, currentLevel: number): Price => ({
	amount: getRadiationUpgradeCost(upgrade, currentLevel),
	currency: CurrenciesTypes.ELECTRONS,
});
