import { BUILDINGS, BUILDING_LEVEL_UP_COST, BUILDING_TYPES, type BuildingType, getBuildingLevelMultiplier } from '$data/buildings';
import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { ALL_PHOTON_UPGRADES, getPhotonUpgradeCost } from '$data/photonUpgrades';
import { RADIATION_UPGRADES, getRadiationUpgradePrice } from '$data/radiationUpgrades';
import { SKILL_UPGRADES } from '$data/skillTree';
import { UPGRADES } from '$data/upgrades';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { gameManager } from '$helpers/GameManager.svelte';
import { radiationManager } from '$helpers/RadiationManager.svelte';
import type { BotBehavior } from './types';

type Priced = { cost: { amount: number; currency: CurrencyName } };
type CurrencyGroups<T> = [CurrencyName, [string, T][]][];

/** Costs are only comparable inside one currency, so each currency gets its own cost-ascending list. */
function groupByCurrency<T extends Priced>(source: Record<string, T>): CurrencyGroups<T> {
	const groups = new Map<CurrencyName, [string, T][]>();
	for (const entry of Object.entries(source)) {
		const currency = entry[1].cost.currency;
		const group = groups.get(currency);
		if (group) group.push(entry);
		else groups.set(currency, [entry]);
	}
	for (const group of groups.values()) group.sort(([, a], [, b]) => a.cost.amount - b.cost.amount);
	return [...groups.entries()];
}

const UPGRADE_GROUPS = groupByCurrency(UPGRADES);
const SKILL_GROUPS = groupByCurrency(SKILL_UPGRADES);
const PHOTON_UPGRADE_ENTRIES = Object.entries(ALL_PHOTON_UPGRADES);
const RADIATION_UPGRADE_ENTRIES = Object.entries(RADIATION_UPGRADES);

export class PurchasePlanner {
	private ownedSkillsRef: string[] | null = null;
	private ownedSkillsSet = new Set<string>();
	private ownedUpgradesRef: string[] | null = null;
	private ownedUpgradesSet = new Set<string>();
	private unownedSkills: CurrencyGroups<(typeof SKILL_UPGRADES)[string]> = SKILL_GROUPS;
	private unownedUpgrades: CurrencyGroups<(typeof UPGRADES)[string]> = UPGRADE_GROUPS;

	reset() {
		this.ownedSkillsRef = null;
		this.ownedSkillsSet = new Set();
		this.ownedUpgradesRef = null;
		this.ownedUpgradesSet = new Set();
		this.unownedSkills = SKILL_GROUPS;
		this.unownedUpgrades = UPGRADE_GROUPS;
	}

	/** gameManager swaps the array on every purchase, so identity is enough to know the cache is stale. */
	private refreshCaches() {
		if (gameManager.upgrades !== this.ownedUpgradesRef) {
			this.ownedUpgradesRef = gameManager.upgrades;
			this.ownedUpgradesSet = new Set(gameManager.upgrades);
			this.unownedUpgrades = UPGRADE_GROUPS.map(([currency, entries]) => [
				currency,
				entries.filter(([id]) => !this.ownedUpgradesSet.has(id)),
			]);
		}
		if (gameManager.skillUpgrades !== this.ownedSkillsRef) {
			this.ownedSkillsRef = gameManager.skillUpgrades;
			this.ownedSkillsSet = new Set(gameManager.skillUpgrades);
			this.unownedSkills = SKILL_GROUPS.map(([currency, entries]) => [
				currency,
				entries.filter(([id]) => !this.ownedSkillsSet.has(id)),
			]);
		}
	}

	/** One pick per currency: the cheapest affordable entry of each, since amounts across currencies are not comparable. */
	affordableUpgrades(): string[] {
		this.refreshCaches();
		const picks: string[] = [];
		for (const [currency, entries] of this.unownedUpgrades) {
			const available = currenciesManager.getAmount(currency);
			for (const [id, upgrade] of entries) {
				if (available < upgrade.cost.amount) break;
				if (upgrade.condition && !upgrade.condition(gameManager)) continue;
				picks.push(id);
				break;
			}
		}
		return picks;
	}

	affordableSkills(): string[] {
		this.refreshCaches();
		const owned = this.ownedSkillsSet;
		const picks: string[] = [];
		for (const [currency, entries] of this.unownedSkills) {
			const available = currenciesManager.getAmount(currency);
			for (const [id, skill] of entries) {
				if (available < skill.cost.amount) break;
				if (skill.requires && !skill.requires.every(req => owned.has(req))) continue;
				if (skill.condition && !skill.condition(gameManager)) continue;
				picks.push(id);
				break;
			}
		}
		return picks;
	}

	affordablePhotonUpgrade(): string | null {
		const photons = currenciesManager.getAmount(CurrenciesTypes.PHOTONS);
		const excitedPhotons = currenciesManager.getAmount(CurrenciesTypes.EXCITED_PHOTONS);
		let bestId: string | null = null;
		let bestCost = Infinity;

		for (const [id, upgrade] of PHOTON_UPGRADE_ENTRIES) {
			const currentLevel = gameManager.photonUpgrades[id] ?? 0;
			if (currentLevel >= upgrade.maxLevel) continue;
			const cost = getPhotonUpgradeCost(upgrade, currentLevel);
			if (cost >= bestCost) continue;
			const available = upgrade.currency === CurrenciesTypes.EXCITED_PHOTONS ? excitedPhotons : photons;
			if (available < cost) continue;
			if (upgrade.condition && !upgrade.condition(gameManager)) continue;
			bestCost = cost;
			bestId = id;
		}

		return bestId;
	}

	affordableRadiationUpgrade(): string | null {
		const electrons = currenciesManager.getAmount(CurrenciesTypes.ELECTRONS);
		let bestId: string | null = null;
		let bestCost = Infinity;

		for (const [id, upgrade] of RADIATION_UPGRADE_ENTRIES) {
			const currentLevel = radiationManager.upgradeLevels[id] ?? 0;
			if (currentLevel >= upgrade.maxLevel) continue;
			const price = getRadiationUpgradePrice(upgrade, currentLevel);
			if (price.amount >= bestCost) continue;
			if (electrons < price.amount) continue;
			bestCost = price.amount;
			bestId = id;
		}

		return bestId;
	}

	selectBuilding(behavior: BotBehavior): BuildingType | null {
		const { buyStrategy, gameKnowledge } = behavior;
		const atoms = currenciesManager.getAmount(CurrenciesTypes.ATOMS);

		const costs: number[] = [];
		let anyAffordable = false;
		for (let i = 0; i < BUILDING_TYPES.length; i++) {
			costs[i] = gameManager.getBuildingCost(BUILDING_TYPES[i], 1);
			if (atoms >= costs[i]) anyAffordable = true;
		}
		if (!anyAffordable) return null;

		const cheapestAffordable = (onlyUnowned: boolean): BuildingType | null => {
			let best: BuildingType | null = null;
			let bestCost = Infinity;
			for (let i = 0; i < BUILDING_TYPES.length; i++) {
				const type = BUILDING_TYPES[i];
				if (atoms < costs[i] || costs[i] >= bestCost) continue;
				if (onlyUnowned && (gameManager.buildings[type]?.count ?? 0) > 0) continue;
				bestCost = costs[i];
				best = type;
			}
			return best;
		};

		// gameKnowledge blends the naive base-rate ranking a newcomer uses with the real marginal gain per atom spent.
		const mostEfficientAffordable = (): BuildingType | null => {
			let best: BuildingType | null = null;
			let bestScore = -Infinity;
			for (let i = 0; i < BUILDING_TYPES.length; i++) {
				const type = BUILDING_TYPES[i];
				if (atoms < costs[i]) continue;
				const naive = BUILDINGS[type].rate / costs[i];
				let score = naive;
				if (gameKnowledge > 0) {
					const amount = Math.max(1, gameManager.getMaxAffordableBuilding(type));
					const informed = marginalProduction(type, amount) / gameManager.getBuildingCost(type, amount);
					score = informed > 0 ? Math.pow(naive, 1 - gameKnowledge) * Math.pow(informed, gameKnowledge) : naive;
				}
				if (best !== null && score <= bestScore) continue;
				bestScore = score;
				best = type;
			}
			return best;
		};

		switch (buyStrategy) {
			case 'cheapest':
				return cheapestAffordable(false);
			case 'mostEfficient':
				return mostEfficientAffordable();
			case 'balanced':
			default:
				return cheapestAffordable(true) ?? mostEfficientAffordable();
		}
	}
}

/** The per-unit rate is read back out of buildingProductions so the upgrade chain counts without re-folding effects. */
function marginalProduction(type: BuildingType, amount: number): number {
	const building = gameManager.buildings[type];
	const count = building?.count ?? 0;
	const currentLevelFactor = getBuildingLevelMultiplier(count, building?.level ?? 0);
	const perUnit =
		count > 0
			? (gameManager.buildingProductions[type] ?? 0) / (count * currentLevelFactor)
			: BUILDINGS[type].rate * gameManager.globalMultiplier * gameManager.bonusMultiplier * gameManager.stabilityMultiplier;

	const newCount = count + amount;
	const newLevelFactor = getBuildingLevelMultiplier(newCount, Math.floor(newCount / BUILDING_LEVEL_UP_COST));
	return (newCount * newLevelFactor - count * currentLevelFactor) * perUnit;
}
