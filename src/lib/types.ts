import type { BuildingType } from '$data/buildings';
import type { CurrencyName } from '$data/currencies';
import type { RealmType } from '$data/realms';
import type { GameManager } from '$helpers/GameManager.svelte';
import type { LayerType } from '$helpers/statConstants';
import type { Icon } from 'lucide-svelte';
import type { Component } from 'svelte';

export interface Achievement {
	condition: (manager: GameManager) => boolean;
	description: string;
	hiddenCondition?: (manager: GameManager) => boolean;
	icon?: Component | typeof Icon;
	id: string;
	name: string;
}

export interface Building {
	cost: Price;
	count: number;
	level: number;
	rate: number;
	unlocked: boolean;
}

export interface Currency {
	achievementTiers?: number[];
	color: string;
	id: string;
	layer?: LayerType;
	name: CurrencyName;
	stat?: CurrencyName;
}

export interface Effect {
	apply: (currentValue: number, manager: GameManager) => number;
	description: string;
	target?: BuildingType;
	type: 'auto_buy' | 'auto_click' | 'auto_speed' | 'auto_upgrade' | 'building' | 'click' | 'electron_gain' | 'excited_auto_click' | 'excited_photon_chance' | 'excited_photon_double' | 'excited_photon_duration' | 'excited_photon_from_max' | 'excited_photon_stability' | 'global' | 'photon_auto_click' | 'photon_double_chance' | 'photon_duration' | 'photon_size' | 'photon_spawn_interval' | 'photon_stability' | 'power_up_duration' | 'power_up_interval' | 'power_up_multiplier' | 'proton_gain' | 'stability_boost' | 'stability_capacity' | 'stability_speed' | 'xp_gain';
}

export interface PhotonUpgrade {
	baseCost: number;
	condition?: (manager: GameManager) => boolean;
	costMultiplier: number;
	currency?: CurrencyName;
	description: (level: number) => string;
	effects: (level: number) => Effect[];
	id: string;
	maxLevel: number;
	name: string;
}

export interface GameState {
	achievements: string[];
	activePowerUps: PowerUp[];
	buildings: Partial<Record<BuildingType, Building>>;
	currencies: Record<CurrencyName, {
		amount: number;
		earnedAllTime: number;
		earnedRun: number;
	}>;
	highestAPS: number;
	inGameTime: number;
	lastInteractionTime: number;
	lastSave: number;
	photonUpgrades: Record<string, number>;
	powerUpsCollected: number;
	realms: Record<RealmType, RealmState>;
	settings: Settings;
	skillUpgrades: string[];
	startDate: number;
	totalBuildingsPurchasedAllTime: number;
	totalClicksAllTime: number;
	totalClicksRun: number;
	totalElectronizesAllTime: number;
	totalElectronizesRun: number;
	totalProtonisesAllTime: number;
	totalProtonisesRun: number;
	totalUpgradesPurchasedAllTime: number;
	totalUsers: number;
	totalXP: number;
	upgrades: string[];
	version: number;
}

export interface PowerUp {
	description: string;
	duration: number;
	id: string;
	multiplier: number;
	name: string;
	startTime: number;
}

export interface Price {
	amount: number;
	currency: CurrencyName;
}

export interface RealmState {
	unlocked: boolean;
}

export interface Settings {
	automation: {
		autoClick: boolean;
		autoClickPhotons: boolean;
		buildings: BuildingType[];
		upgrades: boolean;
	};
}

export interface SkillUpgrade {
	condition?: (manager: GameManager) => boolean;
	description: string;
	effects: Effect[];
	id: string;
	name: string;
	position: { x: number; y: number };
	requires?: string[];
}

export interface Upgrade {
	condition?: (state: GameManager) => boolean;
	cost: Price;
	description: string;
	effects: Effect[];
	id: string;
	name: string;
}

export type Range = [number, number];
