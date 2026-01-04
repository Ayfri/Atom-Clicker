import type { RealmType } from '$data/realms';
import type { BuildingType } from '$data/buildings';
import type {CurrencyName} from '$data/currencies';
import type {GameManager} from '$helpers/GameManager.svelte';
import type {LayerType} from '$helpers/statConstants';
import type { Component } from 'svelte';
import type { Icon } from 'lucide-svelte';

export interface Building {
	count: number;
	cost: Price;
	level: number;
	rate: number;
	unlocked: boolean;
}

export interface Upgrade {
	id: string;
	name: string;
	condition?: (state: GameManager) => boolean;
	description: string;
	effects: Effect[];
	cost: Price;
}

export interface Effect {
	target?: string;
	type: 'auto_buy' | 'auto_click' | 'auto_speed' | 'auto_upgrade' | 'building' | 'click' | 'electron_gain' | 'excited_auto_click' | 'excited_photon_chance' | 'excited_photon_double' | 'excited_photon_duration' | 'excited_photon_from_max' | 'excited_photon_stability' | 'global' | 'photon_auto_click' | 'photon_double_chance' | 'photon_duration' | 'photon_size' | 'photon_spawn_interval' | 'photon_stability' | 'power_up_duration' | 'power_up_interval' | 'power_up_multiplier' | 'proton_gain' | 'stability_boost' | 'stability_capacity' | 'stability_speed' | 'xp_gain';
	apply: (currentValue: number, manager: GameManager) => number;
	description: string;
}

export interface Achievement {
	condition: (manager: GameManager) => boolean;
	description: string;
	hiddenCondition?: (manager: GameManager) => boolean;
	icon?: Component | typeof Icon;
	id: string;
	name: string;
}

export interface PowerUp {
	description: string;
	duration: number;
	id: string;
	multiplier: number;
	name: string;
	startTime: number;
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

export interface GameState {
	achievements: string[];
	activePowerUps: PowerUp[];
	buildings: Partial<Record<BuildingType, Building>>;
	currencies: Record<CurrencyName, {
		amount: number;
		earnedRun: number;
		earnedAllTime: number;
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

export type Range = [number, number];

export interface SkillUpgrade {
	id: string;
	name: string;
	description: string;
	position: { x: number; y: number };
	condition?: (manager: GameManager) => boolean;
	effects: Effect[];
	requires?: string[];
}

export interface Currency {
	id: string;
	achievementTiers?: number[];
	color: string;
	layer?: LayerType;
	name: CurrencyName;
	stat?: CurrencyName;
}

export interface Price {
	amount: number;
	currency: CurrencyName;
}
