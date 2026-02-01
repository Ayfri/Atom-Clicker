import { CurrenciesTypes } from '$data/currencies';
import { FeatureTypes } from '$data/features';
import type { GameManager } from '$helpers/GameManager.svelte';
import type { PhotonUpgrade } from '$lib/types';
import { formatNumber } from '$lib/utils';

export const PHOTON_UPGRADES: Record<string, PhotonUpgrade> = {
	auto_clicker: {
		id: 'auto_clicker',
		name: 'Auto Clicker',
		description: (level: number) => `Auto-click ${level} circle${level > 1 ? 's' : ''} every 5 seconds`,
		baseCost: 500,
		costMultiplier: 3,
		maxLevel: 5,
		effects: (level: number) => [
			{
				type: 'photon_auto_click',
				description: `Auto-click ${level} circles every 5 seconds`,
				apply: (currentValue) => currentValue + level,
			},
		],
	},
	cheap_excited_spawn_boost: {
		id: 'cheap_excited_spawn_boost',
		name: 'Unstable Flux',
		description: (level: number) => `Increases chance for Excited Photons to spawn (+${formatNumber(0.06 * level)}%)`,
		baseCost: 500,
		costMultiplier: 2.6,
		maxLevel: 7,
		effects: (level: number) => [
			{
				type: 'excited_photon_chance',
				description: `Increase excited photon chance by ${0.06 * level}%`,
				apply: (currentValue) => currentValue + (0.0006 * level),
			},
		],
	},
	circle_lifetime: {
		id: 'circle_lifetime',
		name: 'Circle Duration',
		description: (level: number) => `Circles last ${formatNumber(0.25 * level)}s longer`,
		baseCost: 15,
		costMultiplier: 1.8,
		maxLevel: 10,
		effects: (level: number) => [
			{
				type: 'photon_duration',
				description: `Increase circle lifetime by ${0.25 * level} seconds`,
				apply: (currentValue) => currentValue + (250 * level), // 250ms per level
			},
		],
	},
	circle_size: {
		id: 'circle_size',
		name: 'Bigger Circles',
		description: (level: number) => `Circles are ${formatNumber(5 * level)}% bigger`,
		baseCost: 30,
		costMultiplier: 1.6,
		maxLevel: 12,
		effects: (level: number) => [
			{
				apply: (currentValue) => currentValue * (1 + (0.05 * level)),
				description: `Increase circle size by ${5 * level}%`,
				type: 'photon_size',
			},
		],
	},
	double_chance: {
		id: 'double_chance',
		name: 'Double Photons',
		description: (level: number) => `${formatNumber(level * 2)}% chance for double photons`,
		baseCost: 100,
		costMultiplier: 2.25,
		maxLevel: 10,
		effects: (level: number) => [
			{
				type: 'photon_double_chance',
				description: `${level * 2}% chance for double photons`,
				apply: (currentValue) => currentValue + (level * 0.02),
			},
		],
	},
	electron_boost: {
		id: 'electron_boost',
		name: 'Electron Amplifier',
		description: (level: number) => `${formatNumber(25 * level)}% more electrons from electronize`,
		baseCost: 2500,
		costMultiplier: 4,
		maxLevel: 8,
		effects: (level: number) => [
			{
				type: 'electron_gain',
				description: `Multiply electron gain by ${1 + (0.25 * level)}`,
				apply: (currentValue) => currentValue * (1 + (0.25 * level)),
			},
		],
		condition: (manager: GameManager) => manager.electrons > 0,
	},
	electron_super_boost: {
		id: 'electron_super_boost',
		name: 'Electron Overdrive',
		description: (level: number) => `${formatNumber(50 * level)}% more electrons from electronize`,
		baseCost: 25000,
		costMultiplier: 6,
		maxLevel: 5,
		effects: (level: number) => [
			{
				type: 'electron_gain',
				description: `Multiply electron gain by ${1 + (0.5 * level)}`,
				apply: (currentValue) => currentValue * (1 + (0.5 * level)),
			},
		],
		condition: (manager: GameManager) => manager.electrons >= 10,
	},
	offline_progress: {
		id: 'offline_progress',
		name: 'Offline Resonance',
		description: () => 'Enable offline Photon Realm clicks and offline auto-buy',
		baseCost: 1000,
		costMultiplier: 1,
		maxLevel: 1,
		effects: () => [],
		condition: (manager: GameManager) => manager.features[FeatureTypes.OFFLINE_PROGRESS] === true,
	},
	photon_spawn_rate: {
		id: 'photon_spawn_rate',
		name: 'Faster Circles',
		description: (level: number) => `Spawn circles ${formatNumber(4 * level)}% faster`,
		baseCost: 10,
		costMultiplier: 1.6,
		maxLevel: 22,
		effects: (level: number) => [
			{
				apply: (currentValue) => currentValue * (1 - (0.04 * level)),
				description: `Reduce circle spawn interval by ${4 * level}%`,
				type: 'photon_spawn_interval',
			},
		],
	},
	photon_stability: {
		id: 'photon_stability',
		name: 'Stable Photons',
		description: (level: number) => `Photons gain ${[20, 50, 100][level - 1] || 20}% of Stability Field bonus`,
		baseCost: 200000,
		costMultiplier: 2.5,
		maxLevel: 3,
		effects: (level: number) => [
			{
				type: 'photon_stability',
				description: `Photons gain ${[20, 50, 100][level - 1] || 20}% of Stability Field bonus`,
				apply: (currentValue, manager) => {
					const efficiencies = [0.2, 0.5, 1];
					const efficiency = efficiencies[level - 1] || 0.2;
					return currentValue * (1 + (manager.stabilityMultiplier - 1) * efficiency);
				},
			},
		],
	},
	photon_value: {
		id: 'photon_value',
		name: 'Photon Value',
		description: (level: number) => `+${level} photons per circle`,
		baseCost: 25,
		costMultiplier: 1.75,
		maxLevel: 20,
		effects: (level: number) => [
			{
				type: 'click',
				description: `Add ${level} photons per circle`,
				apply: (currentValue) => currentValue + level,
			},
		],
	},
	proton_boost: {
		id: 'proton_boost',
		name: 'Proton Multiplier',
		description: (level: number) => `${formatNumber(15 * level)}% more protons from protonise`,
		baseCost: 5000,
		costMultiplier: 5,
		maxLevel: 6,
		effects: (level: number) => [
			{
				type: 'proton_gain',
				description: `Multiply proton gain by ${1 + (0.15 * level)}`,
				apply: (currentValue) => currentValue * (1 + (0.15 * level)),
			},
		],
		condition: (manager: GameManager) => manager.protons > 0,
	},
	proton_super_boost: {
		id: 'proton_super_boost',
		name: 'Proton Overdrive',
		description: (level: number) => `${formatNumber(40 * level)}% more protons from protonise`,
		baseCost: 50000,
		costMultiplier: 7,
		maxLevel: 4,
		effects: (level: number) => [
			{
				type: 'proton_gain',
				description: `Multiply proton gain by ${1 + (0.4 * level)}`,
				apply: (currentValue) => currentValue * (1 + (0.4 * level)),
			},
		],
		condition: (manager: GameManager) => manager.protons >= 5,
	},
};

export const EXCITED_PHOTON_UPGRADES: Record<string, PhotonUpgrade> = {
	energetic_decay: {
		id: 'energetic_decay',
		name: 'Energetic Decay',
		description: (level: number) => `Excited Photons stay on screen ${20 * level}% longer`,
		baseCost: 20,
		costMultiplier: 1.5,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 5,
		effects: (level: number) => [
			{
				type: 'excited_photon_duration',
				description: `Excited Photons stay ${20 * level}% longer`,
				apply: (currentValue) => currentValue * (1 + (0.2 * level)),
			},
		],
	},
	excited_auto_click: {
		id: 'excited_auto_click',
		name: 'Excited Targeting',
		description: () => 'The auto-clicker can now target Excited Photons.',
		baseCost: 35,
		costMultiplier: 1.5,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 1,
		effects: () => [
			{
				type: 'excited_auto_click',
				description: 'Enables auto-clicking on Excited Photons',
				apply: (currentValue) => currentValue,
			},
		],
		condition: (manager) => manager.currencies[CurrenciesTypes.EXCITED_PHOTONS].earnedAllTime > 0,
	},
	excited_from_max_photons: {
		id: 'excited_from_max_photons',
		name: 'Photon Excitation',
		description: (level: number) => `+${5 * level}% of max photon value added to Excited Photons`,
		baseCost: 10,
		costMultiplier: 2,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 5,
		effects: (level: number) => [
			{
				type: 'excited_photon_from_max',
				description: `Add ${5 * level}% of max photon value to excited photons`,
				apply: (currentValue) => currentValue + (0.05 * level),
			},
		],
	},
	excited_stabilization: {
		id: 'excited_stabilization',
		name: 'Excited Stabilization',
		description: (level: number) => `Increase Stabilization field capacity by ${200 * level}% but it now collapse also when you click on purple realm`,
		baseCost: 5000,
		costMultiplier: 2,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 3,
		effects: (level: number) => [
			{
				type: 'stability_capacity',
				description: `Increase stability capacity by ${200 * level}%`,
				apply: (currentValue) => currentValue * (1 + (2 * level)),
			},
			{
				type: 'stability_speed',
				description: `Increase stability speed by ${100 * level}%`,
				apply: (currentValue) => currentValue * (1 + (1 * level)),
			}
		],
	},
	excited_photon_stability: {
		id: 'excited_photon_stability',
		name: 'Excited Stability',
		description: (level: number) => `Excited Photons gain ${[20, 50, 100][level - 1] || 20}% of Stability Field bonus`,
		baseCost: 1500,
		costMultiplier: 2.5,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 3,
		effects: (level: number) => [
			{
				type: 'excited_photon_stability',
				description: `Excited Photons gain ${[20, 50, 100][level - 1] || 20}% of Stability Field bonus`,
				apply: (currentValue, manager) => {
					const efficiencies = [0.2, 0.5, 1];
					const efficiency = efficiencies[level - 1] || 0.2;
					return currentValue * (1 + (manager.stabilityMultiplier - 1) * efficiency);
				},
			},
		],
	},
	excited_yield: {
		id: 'excited_yield',
		name: 'Excited Yield',
		description: (level: number) => `${8 * level}% chance to get double Excited Photons`,
		baseCost: 50,
		costMultiplier: 1.65,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 10,
		effects: (level: number) => [
			{
				type: 'excited_photon_double',
				description: `${8 * level}% chance for double Excited Photons`,
				apply: (currentValue) => currentValue + (0.08 * level),
			},
		],
	},
	quantum_fluctuation: {
		id: 'quantum_fluctuation',
		name: 'Quantum Fluctuation',
		description: (level: number) => `Increases chance for Excited Photons to spawn (+${formatNumber(0.08 * level)}%)`,
		baseCost: 1,
		costMultiplier: 1.5,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 20,
		effects: (level: number) => [
			{
				type: 'excited_photon_chance',
				description: `Increase excited photon chance by ${0.08 * level}%`,
				apply: (currentValue) => currentValue + (0.0008 * level),
			},
		],
	},
	photon_overdrive: {
		baseCost: 2000,
		costMultiplier: 2.3,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		description: (level: number) => `Spawn circles ${10 * level}% even faster`,
		effects: (level: number) => [
			{
				apply: (currentValue) => currentValue * (1 - 0.1 * level),
				description: `Reduce circle spawn interval by ${10 * level}%`,
				type: 'photon_spawn_interval',
			},
		],
		id: 'photon_overdrive',
		maxLevel: 4,
		name: 'Photon Overdrive',
	},
	resonant_frequency: {
		id: 'resonant_frequency',
		name: 'Resonant Frequency',
		description: (level: number) => `+${level} auto-clicks every 5 seconds`,
		baseCost: 500,
		costMultiplier: 2.5,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 5,
		effects: (level: number) => [
			{
				type: 'photon_auto_click',
				description: `+${level} auto-clicks every 5 seconds`,
				apply: (currentValue) => currentValue + level,
			},
		],
	},
};

export const ALL_PHOTON_UPGRADES: Record<string, PhotonUpgrade> = {
	...PHOTON_UPGRADES,
	...EXCITED_PHOTON_UPGRADES,
};

export function getPhotonUpgradeCost(upgrade: PhotonUpgrade, level: number): number {
	return Math.ceil(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
}

export function canAffordPhotonUpgrade(upgrade: PhotonUpgrade, level: number, manager: GameManager): boolean {
	const currency = upgrade.currency || CurrenciesTypes.PHOTONS;
	const cost = getPhotonUpgradeCost(upgrade, level);

	if (currency === CurrenciesTypes.EXCITED_PHOTONS) {
		return manager.excitedPhotons >= cost;
	}
	return manager.photons >= cost;
}
