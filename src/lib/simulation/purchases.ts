import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { GENERATORS, GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES, type GeneratorType, getGeneratorLevelMultiplier } from '$data/generators';
import { ALL_PHOTON_UPGRADES, getPhotonUpgradeCost } from '$data/photonUpgrades';
import { RADIATION_UPGRADES, type RadiationUpgrade, getRadiationUpgradePrice } from '$data/radiationUpgrades';
import { SKILL_UPGRADES } from '$data/skillTree';
import { UPGRADES } from '$data/upgrades';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { gameManager } from '$helpers/GameManager.svelte';
import { radiationManager } from '$helpers/RadiationManager.svelte';
import type { PhotonUpgrade } from '$lib/types';
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

interface NextLevel<T> {
	cost: number;
	entry: T;
	id: string;
}

/** Price of the next level of every entry below its max, cheapest first. Only changes when a level does. */
function nextLevels<T extends { maxLevel: number }>(
	entries: [string, T][],
	levels: Record<string, number>,
	price: (entry: T, level: number) => number,
): NextLevel<T>[] {
	return entries
		.filter(([id, entry]) => (levels[id] ?? 0) < entry.maxLevel)
		.map(([id, entry]) => ({ cost: price(entry, levels[id] ?? 0), entry, id }))
		.sort((a, b) => a.cost - b.cost);
}

export class PurchasePlanner {
	private ownedSkillsRef: string[] | null = null;
	private ownedSkillsSet = new Set<string>();
	private ownedUpgradesRef: string[] | null = null;
	private ownedUpgradesSet = new Set<string>();
	private photonLevels: NextLevel<PhotonUpgrade>[] = [];
	private photonLevelsRef: Record<string, number> | null = null;
	private radiationLevels: NextLevel<RadiationUpgrade>[] = [];
	private radiationLevelsRef: Record<string, number> | null = null;
	private unownedSkills: CurrencyGroups<(typeof SKILL_UPGRADES)[string]> = SKILL_GROUPS;
	private unownedUpgrades: CurrencyGroups<(typeof UPGRADES)[string]> = UPGRADE_GROUPS;

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

	/** Whether an upgrade or skill priced in `currency` is affordable now, so a balance gets spent before a prestige wipes it. */
	canSpend(currency: CurrencyName): boolean {
		return [...this.affordableUpgrades(), ...this.affordableSkills()].some(id => (UPGRADES[id] ?? SKILL_UPGRADES[id]).cost.currency === currency);
	}

	/** The cheapest affordable level across both photon currencies, entry order breaking ties. */
	affordablePhotonUpgrade(): string | null {
		if (gameManager.photonUpgrades !== this.photonLevelsRef) {
			this.photonLevelsRef = gameManager.photonUpgrades;
			this.photonLevels = nextLevels(PHOTON_UPGRADE_ENTRIES, gameManager.photonUpgrades, getPhotonUpgradeCost);
		}
		const photons = currenciesManager.getAmount(CurrenciesTypes.PHOTONS);
		const excitedPhotons = currenciesManager.getAmount(CurrenciesTypes.EXCITED_PHOTONS);
		const most = Math.max(photons, excitedPhotons);

		for (const { cost, entry: upgrade, id } of this.photonLevels) {
			if (cost > most) break;
			if ((upgrade.currency === CurrenciesTypes.EXCITED_PHOTONS ? excitedPhotons : photons) < cost) continue;
			if (upgrade.condition && !upgrade.condition(gameManager)) continue;
			return id;
		}
		return null;
	}

	affordableRadiationUpgrade(): string | null {
		if (radiationManager.upgradeLevels !== this.radiationLevelsRef) {
			this.radiationLevelsRef = radiationManager.upgradeLevels;
			this.radiationLevels = nextLevels(RADIATION_UPGRADE_ENTRIES, radiationManager.upgradeLevels, (upgrade, level) => getRadiationUpgradePrice(upgrade, level).amount);
		}
		const electrons = currenciesManager.getAmount(CurrenciesTypes.ELECTRONS);
		for (const { cost, entry: upgrade, id } of this.radiationLevels) {
			if (cost > electrons) break;
			if (upgrade.condition && !upgrade.condition(gameManager)) continue;
			return id;
		}
		return null;
	}

	selectGenerator(behavior: BotBehavior): GeneratorType | null {
		const { buyStrategy, gameKnowledge } = behavior;
		const atoms = currenciesManager.getAmount(CurrenciesTypes.ATOMS);

		const costs: number[] = [];
		let anyAffordable = false;
		for (let i = 0; i < GENERATOR_TYPES.length; i++) {
			costs[i] = gameManager.getGeneratorCost(GENERATOR_TYPES[i], 1);
			if (atoms >= costs[i]) anyAffordable = true;
		}
		if (!anyAffordable) return null;

		const cheapestAffordable = (onlyUnowned: boolean): GeneratorType | null => {
			let best: GeneratorType | null = null;
			let bestCost = Infinity;
			for (let i = 0; i < GENERATOR_TYPES.length; i++) {
				const type = GENERATOR_TYPES[i];
				if (atoms < costs[i] || costs[i] >= bestCost) continue;
				if (onlyUnowned && (gameManager.generators[type]?.count ?? 0) > 0) continue;
				bestCost = costs[i];
				best = type;
			}
			return best;
		};

		// gameKnowledge blends the naive base-rate ranking a newcomer uses with the real marginal gain per atom spent.
		const mostEfficientAffordable = (): GeneratorType | null => {
			let best: GeneratorType | null = null;
			let bestScore = -Infinity;
			for (let i = 0; i < GENERATOR_TYPES.length; i++) {
				const type = GENERATOR_TYPES[i];
				if (atoms < costs[i]) continue;
				const naive = GENERATORS[type].rate / costs[i];
				let score = naive;
				if (gameKnowledge > 0) {
					const amount = Math.max(1, gameManager.getMaxAffordableGenerator(type));
					const informed = marginalProduction(type, amount) / gameManager.getGeneratorCost(type, amount);
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

/** The per-unit rate is read back out of generatorUnitProductions so the upgrade chain counts without re-folding effects. */
function marginalProduction(type: GeneratorType, amount: number): number {
	const generator = gameManager.generators[type];
	const count = generator?.count ?? 0;
	const currentLevelFactor = getGeneratorLevelMultiplier(count, generator?.level ?? 0);
	const perUnit = gameManager.generatorUnitProductions[type] / currentLevelFactor;

	const newCount = count + amount;
	const newLevelFactor = getGeneratorLevelMultiplier(newCount, Math.floor(newCount / GENERATOR_LEVEL_UP_COST));
	return (newCount * newLevelFactor - count * currentLevelFactor) * perUnit;
}
