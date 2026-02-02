import type { BuildingType } from '$data/buildings';
import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { FeatureTypes } from '$data/features';
import { UPGRADES } from '$data/upgrades';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { calculateEffects, getUpgradesWithEffects } from '$helpers/effects';
import type { GameManager } from '$helpers/GameManager.svelte';
import type { BuildingCountMap, CurrencyAmountMap, OfflineProgressSummary } from '$lib/types';

const OFFLINE_AUTO_FACTOR = 120;
const OFFLINE_BASE_MS = 6 * 60 * 60 * 1000;
const OFFLINE_CAP_UPGRADE_MAP = {
	offline_cap_12h: 12 * 60 * 60 * 1000,
	offline_cap_1_5d: 36 * 60 * 60 * 1000,
	offline_cap_1d: 24 * 60 * 60 * 1000,
	offline_cap_2d: 48 * 60 * 60 * 1000,
	offline_cap_3d: 72 * 60 * 60 * 1000
} as const;
const OFFLINE_INCOME_MULTIPLIER = 0.1;
const OFFLINE_MAX_MS = 3 * 24 * 60 * 60 * 1000;
const OFFLINE_MIN_MS = 30_000;
const OFFLINE_PHOTON_MAX = 10;
const OFFLINE_PHOTON_MIN = 1;
const OFFLINE_UNLOCK_FEATURE = FeatureTypes.OFFLINE_PROGRESS;
const XP_PER_ATOM = 0.1;

export function applyOfflineProgress(manager: GameManager, forcedAwayMs?: number): OfflineProgressSummary | null {
	if (!manager.settings.gameplay.offlineProgressEnabled) return null;
	if (!manager.features[OFFLINE_UNLOCK_FEATURE]) return null;

	const now = Date.now();
	const lastTimestamp = Math.max(manager.lastSave ?? 0, manager.lastInteractionTime ?? 0, manager.startDate ?? 0);
	const awayMs = Math.max(0, forcedAwayMs ?? (now - lastTimestamp));
	const capMs = getOfflineProgressCapMs(manager);
	const appliedMs = Math.min(awayMs, capMs);

	if (appliedMs < OFFLINE_MIN_MS || capMs <= 0) return null;

	let atomsGained = 0;
	let atomAutoClicks = 0;
	let autoUpgradePurchases = 0;
	let excitedPhotonsGained = 0;
	let photonAutoClicks = 0;
	let photonsGained = 0;

	const atomAutoClickEnabled =
		manager.upgrades.includes('proton_offline_autoclick') &&
		manager.settings.automation.autoClick &&
		manager.autoClicksPerSecond > 0;
	const photonOfflineUnlocked = (manager.photonUpgrades['offline_progress'] || 0) > 0;
	const autoBuyEnabled = photonOfflineUnlocked;
	const autoUpgradeEnabled =
		manager.upgrades.includes('proton_offline_autobuy') &&
		manager.settings.automation.upgrades;
	const photonAutoClickEnabled = photonOfflineUnlocked && manager.settings.automation.autoClickPhotons;

	const autoBuyCounts: BuildingCountMap = {};
	const currencyGains: CurrencyAmountMap = {};
	const addCurrency = (currency: CurrencyName, amount: number) => {
		if (amount <= 0) return;
		currencyGains[currency] = (currencyGains[currency] || 0) + amount;
		currenciesManager.add(currency, amount);
	};

	const updateIncome = (deltaMs: number) => {
		const deltaSeconds = deltaMs / 1000;
		const autoClickRate = atomAutoClickEnabled ? manager.autoClicksPerSecond / OFFLINE_AUTO_FACTOR : 0;
		const baseRate = manager.atomsPerSecond + (autoClickRate * manager.clickPower);
		const income = baseRate * OFFLINE_INCOME_MULTIPLIER * deltaSeconds;
		if (income > 0) {
			atomsGained += income;
			addCurrency(CurrenciesTypes.ATOMS, income);
		}

		const autoClicksThisStep = autoClickRate * OFFLINE_INCOME_MULTIPLIER * deltaSeconds;
		if (autoClicksThisStep > 0) {
			atomAutoClicks += autoClicksThisStep;
		}
	};

	const autoBuyIntervals = autoBuyEnabled ? getOfflineAutoBuyIntervals(manager) : {};
	const offlineAutoBuyIntervals: Partial<Record<BuildingType, number>> = {};
	const nextAutoBuyTimes: Partial<Record<BuildingType, number>> = {};

	Object.entries(autoBuyIntervals).forEach(([type, interval]) => {
		if (!interval || !Number.isFinite(interval) || interval <= 0) return;
		const buildingType = type as BuildingType;
		offlineAutoBuyIntervals[buildingType] = interval * OFFLINE_AUTO_FACTOR;
		nextAutoBuyTimes[buildingType] = interval * OFFLINE_AUTO_FACTOR;
	});

	const baseAutoUpgradeInterval = autoUpgradeEnabled ? getOfflineAutoUpgradeInterval(manager) : 0;
	const offlineAutoUpgradeInterval = baseAutoUpgradeInterval > 0 ? baseAutoUpgradeInterval * OFFLINE_AUTO_FACTOR : 0;
	let nextAutoUpgradeAt = offlineAutoUpgradeInterval;

	let elapsed = 0;
	const epsilon = 0.0001;

	while (elapsed < appliedMs) {
		let nextEvent = appliedMs;
		let nextAutoBuyTypes: BuildingType[] = [];

		Object.entries(nextAutoBuyTimes).forEach(([type, time]) => {
			if (!time || time <= 0) return;
			if (time < nextEvent - epsilon) {
				nextEvent = time;
				nextAutoBuyTypes = [type as BuildingType];
			} else if (Math.abs(time - nextEvent) <= epsilon) {
				nextAutoBuyTypes.push(type as BuildingType);
			}
		});

		if (offlineAutoUpgradeInterval > 0 && nextAutoUpgradeAt > 0) {
			if (nextAutoUpgradeAt < nextEvent - epsilon) {
				nextEvent = nextAutoUpgradeAt;
				nextAutoBuyTypes = [];
			}
		}

		const step = Math.min(nextEvent, appliedMs) - elapsed;
		if (step > 0) {
			updateIncome(step);
			elapsed += step;
		}

		if (elapsed + epsilon >= appliedMs) break;

		if (offlineAutoUpgradeInterval > 0 && nextAutoUpgradeAt > 0 && nextAutoUpgradeAt <= elapsed + epsilon) {
			autoUpgradePurchases += purchaseAvailableUpgradesOffline(manager);
			nextAutoUpgradeAt += offlineAutoUpgradeInterval;
		}

		nextAutoBuyTypes.forEach((buildingType) => {
			const interval = offlineAutoBuyIntervals[buildingType];
			if (!interval || interval <= 0) return;
			if (manager.purchaseBuilding(buildingType, 1)) {
				autoBuyCounts[buildingType] = (autoBuyCounts[buildingType] || 0) + 1;
			}
			nextAutoBuyTimes[buildingType] = (nextAutoBuyTimes[buildingType] || interval) + interval;
		});
	}

	if (photonAutoClickEnabled && manager.photonAutoClicksPer5Seconds > 0) {
		const appliedSeconds = appliedMs / 1000;
		const photonAutoClicksPerSecond = (manager.photonAutoClicksPer5Seconds / 5) / OFFLINE_AUTO_FACTOR;
		photonAutoClicks = photonAutoClicksPerSecond * appliedSeconds;

		const photonValueBonus = getOfflinePhotonValueBonus(manager);
		const doubleChance = getOfflinePhotonDoubleChance(manager);
		const excitedDoubleChance = getOfflineExcitedPhotonDoubleChance(manager);
		const fromMaxBonusFactor = getOfflineExcitedFromMaxBonus(manager);

		const allowExcited = (manager.photonUpgrades['excited_auto_click'] || 0) > 0;
		const excitedChance = allowExcited ? manager.excitedPhotonChance : 0;

		const basePhotonAverage = (OFFLINE_PHOTON_MIN + OFFLINE_PHOTON_MAX) / 2;
		const normalExpected = (basePhotonAverage + photonValueBonus) * (1 + doubleChance);
		const baseExcitedExpected = 1 + excitedDoubleChance;
		const maxPhotonValue = OFFLINE_PHOTON_MAX + photonValueBonus;
		const excitedExpected = baseExcitedExpected + (maxPhotonValue * fromMaxBonusFactor);
		const expectedNormal = (1 - excitedChance) * normalExpected * photonAutoClicks;
		const expectedExcited = excitedChance * excitedExpected * photonAutoClicks;

		photonsGained += expectedNormal;
		excitedPhotonsGained += expectedExcited;

		addCurrency(CurrenciesTypes.PHOTONS, expectedNormal);
		addCurrency(CurrenciesTypes.EXCITED_PHOTONS, expectedExcited);
	}

	const levelBefore = manager.playerLevel;
	const xpBefore = manager.totalXP;

	if (atomsGained > 0 && manager.features[FeatureTypes.LEVELS]) {
		manager.totalXP += atomsGained * XP_PER_ATOM * manager.xpGainMultiplier;
	}

	const xpGained = manager.totalXP - xpBefore;
	const levelsGained = manager.playerLevel - levelBefore;

	const autoClickCountForStats = Math.floor(atomAutoClicks);
	if (autoClickCountForStats > 0) {
		manager.totalClicksRun += autoClickCountForStats;
		manager.totalClicksAllTime += autoClickCountForStats;
	}

	const atomAutoClickAffectsStability =
		atomAutoClickEnabled &&
		!manager.upgrades.includes('electron_bypass_atom_autoclick_stability');
	const photonAutoClickAffectsStability =
		photonAutoClickEnabled &&
		manager.photonAutoClicksPer5Seconds > 0 &&
		!manager.upgrades.includes('electron_bypass_photon_autoclick_stability');
	if (atomAutoClickAffectsStability || photonAutoClickAffectsStability) {
		manager.lastInteractionTime = now;
	}

	const photonAutoClicksPerSecond = photonAutoClickEnabled
		? (manager.photonAutoClicksPer5Seconds / 5) / OFFLINE_AUTO_FACTOR
		: 0;
	const photonValueBonus = photonAutoClickEnabled ? getOfflinePhotonValueBonus(manager) : 0;
	const photonDoubleChance = photonAutoClickEnabled ? getOfflinePhotonDoubleChance(manager) : 0;
	const excitedDoubleChance = photonAutoClickEnabled ? getOfflineExcitedPhotonDoubleChance(manager) : 0;
	const fromMaxBonusFactor = photonAutoClickEnabled ? getOfflineExcitedFromMaxBonus(manager) : 0;
	const photonClickExpectedNormal = photonAutoClickEnabled
		? ((OFFLINE_PHOTON_MIN + OFFLINE_PHOTON_MAX) / 2 + photonValueBonus) * (1 + photonDoubleChance)
		: 0;
	const photonClickExpectedExcited = photonAutoClickEnabled
		? (1 + excitedDoubleChance) + ((OFFLINE_PHOTON_MAX + photonValueBonus) * fromMaxBonusFactor)
		: 0;
	const photonClickExpectedTotal = photonAutoClickEnabled
		? (photonsGained + excitedPhotonsGained) / (photonAutoClicks || 1)
		: 0;

	return {
		appliedMs,
		atomAutoClickEnabled,
		atomAutoClicks,
		autoBuyCounts,
		autoBuyEnabled,
		autoBuyFactor: OFFLINE_AUTO_FACTOR,
		autoUpgradeEnabled,
		autoUpgradePurchases,
		awayMs,
		capMs,
		currencyGains,
		incomeMultiplier: OFFLINE_INCOME_MULTIPLIER,
		photonAutoClickEnabled,
		photonAutoClickFactor: OFFLINE_AUTO_FACTOR,
		photonAutoClicks,
		photonAutoClicksPerSecond,
		photonClickExpectedExcited,
		photonClickExpectedNormal,
		photonClickExpectedTotal,
		levelsGained,
		xpGained,
	};
}

function getOfflineAutoBuyIntervals(manager: GameManager) {
	const autoBuyUpgrades = getUpgradesWithEffects(manager.currentUpgradesBought, { type: 'auto_buy' });
	const intervals: Partial<Record<BuildingType, number>> = {};

	autoBuyUpgrades.forEach((upgrade) => {
		if (!upgrade.effects) return;

		upgrade.effects.forEach((effect) => {
			if (effect.type === 'auto_buy' && effect.target) {
				const buildingType = effect.target as BuildingType;
				if (manager.settings.automation.buildings.includes(buildingType)) {
					intervals[buildingType] = effect.apply(intervals[buildingType] || 30000, manager);
				}
			}
		});
	});

	return intervals;
}

function getOfflineAutoUpgradeInterval(manager: GameManager) {
	if (!manager.settings.automation.upgrades) return 0;

	const autoUpgrades = getUpgradesWithEffects(manager.currentUpgradesBought, { type: 'auto_upgrade' });
	let interval = 30000;

	autoUpgrades.forEach((upgrade) => {
		upgrade.effects?.forEach((effect) => {
			if (effect.type === 'auto_upgrade') {
				interval = effect.apply(interval, manager);
			}
		});
	});

	return interval;
}

function getOfflineExcitedFromMaxBonus(manager: GameManager) {
	const options = { type: 'excited_photon_from_max' as const };
	const upgrades = getUpgradesWithEffects(manager.allEffectSources, options);
	return calculateEffects(upgrades, manager, 0, options);
}

function getOfflineExcitedPhotonDoubleChance(manager: GameManager) {
	const options = { type: 'excited_photon_double' as const };
	const upgrades = getUpgradesWithEffects(manager.allEffectSources, options);
	return calculateEffects(upgrades, manager, 0, options);
}

function getOfflinePhotonDoubleChance(manager: GameManager) {
	const options = { type: 'photon_double_chance' as const };
	const upgrades = getUpgradesWithEffects(manager.allEffectSources, options);
	return calculateEffects(upgrades, manager, 0, options);
}

function getOfflinePhotonValueBonus(manager: GameManager) {
	const upgrade = manager.allEffectSources.find(source => source.id === 'photon_value');
	if (!upgrade) return 0;
	return calculateEffects([upgrade], manager, 0, { type: 'click' });
}

function getOfflineProgressCapMs(manager: GameManager) {
	if (!manager.features[OFFLINE_UNLOCK_FEATURE]) return 0;

	let capMs = OFFLINE_BASE_MS;
	Object.entries(OFFLINE_CAP_UPGRADE_MAP).forEach(([id, value]) => {
		if (manager.upgrades.includes(id)) {
			capMs = Math.max(capMs, value);
		}
	});

	return Math.min(capMs, OFFLINE_MAX_MS);
}

function purchaseAvailableUpgradesOffline(manager: GameManager) {
	let purchases = 0;
	const availableUpgrades = Object.values(UPGRADES)
		.filter((upgrade) => {
			const meetsCondition = upgrade.condition?.(manager) ?? true;
			const notPurchased = !manager.upgrades.includes(upgrade.id);
			return meetsCondition && notPurchased;
		})
		.sort((a, b) => a.cost.amount - b.cost.amount);

	availableUpgrades.forEach((upgrade) => {
		if (!manager.canAfford(upgrade.cost)) return;
		manager.purchaseUpgrade(upgrade.id);
		purchases += 1;
	});

	return purchases;
}
