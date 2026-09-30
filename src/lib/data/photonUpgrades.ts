import { CurrenciesTypes } from '$data/currencies';
import { FeatureTypes } from '$data/features';
import { add, mul } from '$helpers/effects';
import type { GameManager } from '$helpers/GameManager.svelte';
import type { PhotonUpgrade } from '$lib/types';
import { formatNumber } from '$lib/utils';

const STABILITY_EFFICIENCIES = [0.2, 0.5, 1];

const stabilityShare = (level: number) => (manager: GameManager) =>
	1 + (manager.stabilityMultiplier - 1) * (STABILITY_EFFICIENCIES[level - 1] ?? 0.2);

export const PHOTON_UPGRADES: Record<string, PhotonUpgrade> = {
	auto_clicker: {
		id: 'auto_clicker',
		name: 'Auto Clicker',
		description: (level: number) => `Auto-click ${level} circle${level > 1 ? 's' : ''} every 5 seconds`,
		baseCost: 500,
		costMultiplier: 3,
		maxLevel: 5,
		effects: level => [add('photon_auto_click', level)],
	},
	cheap_excited_spawn_boost: {
		id: 'cheap_excited_spawn_boost',
		name: 'Unstable Flux',
		description: (level: number) => `Increases chance for Excited Photons to spawn (+${formatNumber(0.06 * level)}%)`,
		baseCost: 500,
		costMultiplier: 2.6,
		maxLevel: 7,
		effects: level => [add('excited_photon_chance', 0.0006 * level)],
	},
	circle_lifetime: {
		id: 'circle_lifetime',
		name: 'Circle Duration',
		description: (level: number) => `Circles last ${formatNumber(0.25 * level)}s longer`,
		baseCost: 15,
		costMultiplier: 1.8,
		maxLevel: 10,
		effects: level => [add('photon_duration', 250 * level)],
	},
	circle_size: {
		id: 'circle_size',
		name: 'Bigger Circles',
		description: (level: number) => `Circles are ${formatNumber(5 * level)}% bigger`,
		baseCost: 30,
		costMultiplier: 1.6,
		maxLevel: 12,
		effects: level => [mul('photon_size', 1 + 0.05 * level)],
	},
	double_chance: {
		id: 'double_chance',
		name: 'Double Photons',
		description: (level: number) => `${formatNumber(level * 2)}% chance for double photons`,
		baseCost: 100,
		costMultiplier: 2.25,
		maxLevel: 10,
		effects: level => [add('photon_double_chance', level * 0.02)],
	},
	electron_boost: {
		id: 'electron_boost',
		name: 'Electron Amplifier',
		description: (level: number) => `${formatNumber(25 * level)}% more electrons from Electronize`,
		baseCost: 2500,
		costMultiplier: 4,
		maxLevel: 8,
		effects: level => [mul('electron_gain', 1 + 0.25 * level)],
		condition: (manager: GameManager) => manager.electrons > 0,
	},
	electron_super_boost: {
		id: 'electron_super_boost',
		name: 'Electron Overdrive',
		description: (level: number) => `${formatNumber(50 * level)}% more electrons from Electronize`,
		baseCost: 25000,
		costMultiplier: 6,
		maxLevel: 5,
		effects: level => [mul('electron_gain', 1 + 0.5 * level)],
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
	photon_efficiency: {
		id: 'photon_efficiency',
		name: 'Photon Efficiency',
		description: () => '+1% atom production per photon upgrade level owned',
		baseCost: 5_000,
		costMultiplier: 1,
		maxLevel: 1,
		effects: () => [mul('global', manager => 1 + manager.photonUpgradeLevels * 0.01)],
		condition: (manager: GameManager) => Object.keys(manager.photonUpgrades).length >= 3,
	},
	photon_proton_boost: {
		id: 'photon_proton_boost',
		name: 'Photon Proton Boost',
		description: () => '+1% protons from Protonise per photon upgrade level owned',
		baseCost: 10_000,
		costMultiplier: 1,
		maxLevel: 1,
		effects: () => [mul('proton_gain', manager => 1 + manager.photonUpgradeLevels * 0.01)],
		condition: (manager: GameManager) => (manager.photonUpgrades.photon_efficiency ?? 0) > 0,
	},
	photon_spawn_rate: {
		id: 'photon_spawn_rate',
		name: 'Faster Circles',
		description: (level: number) => `Spawn circles ${formatNumber(4 * level)}% faster`,
		baseCost: 10,
		costMultiplier: 1.6,
		maxLevel: 22,
		effects: level => [mul('photon_spawn_interval', 1 - 0.04 * level)],
	},
	photon_stability: {
		id: 'photon_stability',
		name: 'Stable Photons',
		description: (level: number) => `Photons gain ${[20, 50, 100][level - 1] || 20}% of Stability Field bonus`,
		baseCost: 200000,
		costMultiplier: 2.5,
		maxLevel: 3,
		effects: level => [mul('photon_stability', stabilityShare(level))],
	},
	photon_value: {
		id: 'photon_value',
		name: 'Photon Value',
		description: (level: number) => `+${level} photons per circle`,
		baseCost: 25,
		costMultiplier: 1.75,
		maxLevel: 20,
		effects: level => [add('photon_value', level)],
	},
	proton_boost: {
		id: 'proton_boost',
		name: 'Proton Multiplier',
		description: (level: number) => `${formatNumber(15 * level)}% more protons from Protonise`,
		baseCost: 5000,
		costMultiplier: 5,
		maxLevel: 6,
		effects: level => [mul('proton_gain', 1 + 0.15 * level)],
		condition: (manager: GameManager) => manager.protons > 0,
	},
	proton_super_boost: {
		id: 'proton_super_boost',
		name: 'Proton Overdrive',
		description: (level: number) => `${formatNumber(40 * level)}% more protons from Protonise`,
		baseCost: 50000,
		costMultiplier: 7,
		maxLevel: 4,
		effects: level => [mul('proton_gain', 1 + 0.4 * level)],
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
		effects: level => [mul('excited_photon_duration', 1 + 0.2 * level)],
	},
	excited_auto_click: {
		id: 'excited_auto_click',
		name: 'Excited Targeting',
		description: () => 'The auto-clicker can now target Excited Photons.',
		baseCost: 35,
		costMultiplier: 1.5,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 1,
		effects: () => [],
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
		effects: level => [add('excited_photon_from_max', 0.05 * level)],
	},
	excited_stabilization: {
		id: 'excited_stabilization',
		name: 'Excited Stabilization',
		description: (level: number) => `Increases Stability Field capacity by ${200 * level}%, but clicking photons now collapses it too`,
		baseCost: 5000,
		costMultiplier: 2,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 3,
		effects: level => [mul('stability_capacity', 1 + 2 * level), mul('stability_speed', 1 + level)],
	},
	excited_photon_stability: {
		id: 'excited_photon_stability',
		name: 'Excited Stability',
		description: (level: number) => `Excited Photons gain ${[20, 50, 100][level - 1] || 20}% of Stability Field bonus`,
		baseCost: 1500,
		costMultiplier: 2.5,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 3,
		effects: level => [mul('excited_photon_stability', stabilityShare(level))],
	},
	excited_yield: {
		id: 'excited_yield',
		name: 'Excited Yield',
		description: (level: number) => `${8 * level}% chance to get double Excited Photons`,
		baseCost: 50,
		costMultiplier: 1.65,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 10,
		effects: level => [add('excited_photon_double', 0.08 * level)],
	},
	quantum_fluctuation: {
		id: 'quantum_fluctuation',
		name: 'Quantum Fluctuation',
		description: (level: number) => `Increases chance for Excited Photons to spawn (+${formatNumber(0.08 * level)}%)`,
		baseCost: 1,
		costMultiplier: 1.5,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		maxLevel: 20,
		effects: level => [add('excited_photon_chance', 0.0008 * level)],
	},
	photon_overdrive: {
		baseCost: 2000,
		costMultiplier: 2.3,
		currency: CurrenciesTypes.EXCITED_PHOTONS,
		description: (level: number) => `Spawn circles ${10 * level}% even faster`,
		effects: level => [mul('photon_spawn_interval', 1 - 0.1 * level)],
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
		effects: level => [add('photon_auto_click', level)],
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
