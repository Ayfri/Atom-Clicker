import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { FeatureTypes } from '$data/features';
import type { GeneratorType } from '$data/generators';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import type { GameManager } from '$helpers/GameManager.svelte';
import { radiationManager } from '$helpers/RadiationManager.svelte';
import { XP_PER_ATOM } from '$lib/constants';
import type { GeneratorCountMap, CurrencyAmountMap, OfflineProgressSummary } from '$lib/types';

const OFFLINE_AUTO_FACTOR = 120;
const OFFLINE_BASE_MS = 6 * 60 * 60 * 1000;
const OFFLINE_CAP_UPGRADE_MAP = {
	offline_cap_12h: 12 * 60 * 60 * 1000,
	offline_cap_1_5d: 36 * 60 * 60 * 1000,
	offline_cap_1d: 24 * 60 * 60 * 1000,
	offline_cap_2d: 48 * 60 * 60 * 1000,
	offline_cap_3d: 72 * 60 * 60 * 1000,
} as const;
const OFFLINE_INCOME_MULTIPLIER = 0.1;
const OFFLINE_MAX_MS = 3 * 24 * 60 * 60 * 1000;
const OFFLINE_MIN_MS = 30_000;
const OFFLINE_PHOTON_MAX = 10;
const OFFLINE_PHOTON_MIN = 1;
const OFFLINE_UNLOCK_FEATURE = FeatureTypes.OFFLINE_PROGRESS;

export function applyOfflineProgress(manager: GameManager, forcedAwayMs?: number): OfflineProgressSummary | null {
	if (!manager.settings.gameplay.offlineProgressEnabled) return null;
	if (!manager.features[OFFLINE_UNLOCK_FEATURE]) return null;

	const now = Date.now();
	const lastTimestamp = Math.max(manager.lastSave ?? 0, manager.lastInteractionTime ?? 0, manager.startDate ?? 0);
	const awayMs = Math.max(0, forcedAwayMs ?? now - lastTimestamp);
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
		manager.features[FeatureTypes.OFFLINE_AUTO_CLICK] && manager.settings.automation.autoClick && manager.autoClicksPerSecond > 0;
	const photonOfflineUnlocked = (manager.photonUpgrades['offline_progress'] || 0) > 0;
	const autoBuyEnabled = photonOfflineUnlocked;
	const autoUpgradeEnabled = manager.features[FeatureTypes.OFFLINE_AUTO_UPGRADE] && manager.settings.automation.upgrades;
	const photonAutoClickEnabled = photonOfflineUnlocked && manager.settings.automation.autoClickPhotons;

	const autoBuyCounts: GeneratorCountMap = {};
	const currencyGains: CurrencyAmountMap = {};
	const addCurrency = (currency: CurrencyName, amount: number) => {
		if (amount <= 0) return;
		currencyGains[currency] = (currencyGains[currency] || 0) + amount;
		currenciesManager.add(currency, amount);
	};

	let radMultiplierSum = 0;
	let radSteps = 0;
	const radStartMass = radiationManager.mass;
	let radRegenTotal = 0;

	const updateIncome = (deltaMs: number) => {
		const deltaSeconds = deltaMs / 1000;
		const autoClickRate = atomAutoClickEnabled ? manager.autoClicksPerSecond / OFFLINE_AUTO_FACTOR : 0;
		/** `atomsPerSecond` already holds the live reactor multiplier, it is swapped for the average over the step. */
		const productionWithoutRadiation = manager.atomsPerSecond / manager.radiationMultiplier;

		const radiationMult = radiationManager.tickOffline(deltaSeconds);
		radMultiplierSum += radiationMult;
		radSteps++;
		radRegenTotal += radiationManager.regenRate * deltaSeconds;

		const income = (productionWithoutRadiation * radiationMult + autoClickRate * manager.clickPower) * OFFLINE_INCOME_MULTIPLIER * deltaSeconds;
		if (income > 0) {
			atomsGained += income;
			addCurrency(CurrenciesTypes.ATOMS, income);
		}

		const autoClicksThisStep = autoClickRate * OFFLINE_INCOME_MULTIPLIER * deltaSeconds;
		if (autoClicksThisStep > 0) {
			atomAutoClicks += autoClicksThisStep;
		}
	};

	const offlineAutoBuyIntervals: Partial<Record<GeneratorType, number>> = {};
	const nextAutoBuyTimes: Partial<Record<GeneratorType, number>> = {};

	if (autoBuyEnabled) {
		for (const [type, interval] of Object.entries(manager.autoBuyIntervals) as [GeneratorType, number][]) {
			if (!Number.isFinite(interval) || interval <= 0) continue;
			offlineAutoBuyIntervals[type] = interval * OFFLINE_AUTO_FACTOR;
			nextAutoBuyTimes[type] = interval * OFFLINE_AUTO_FACTOR;
		}
	}

	const offlineAutoUpgradeInterval = autoUpgradeEnabled ? manager.autoUpgradeInterval * OFFLINE_AUTO_FACTOR : 0;
	let nextAutoUpgradeAt = offlineAutoUpgradeInterval;

	let elapsed = 0;
	const epsilon = 0.0001;

	while (elapsed < appliedMs) {
		let nextEvent = appliedMs;
		let nextAutoBuyTypes: GeneratorType[] = [];

		Object.entries(nextAutoBuyTimes).forEach(([type, time]) => {
			if (!time || time <= 0) return;
			if (time < nextEvent - epsilon) {
				nextEvent = time;
				nextAutoBuyTypes = [type as GeneratorType];
			} else if (Math.abs(time - nextEvent) <= epsilon) {
				nextAutoBuyTypes.push(type as GeneratorType);
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
			autoUpgradePurchases += manager.purchaseAffordableUpgrades().length;
			nextAutoUpgradeAt += offlineAutoUpgradeInterval;
		}

		nextAutoBuyTypes.forEach(generatorType => {
			const interval = offlineAutoBuyIntervals[generatorType];
			if (!interval || interval <= 0) return;
			if (manager.purchaseGenerator(generatorType, 1)) {
				autoBuyCounts[generatorType] = (autoBuyCounts[generatorType] || 0) + 1;
			}
			nextAutoBuyTimes[generatorType] = (nextAutoBuyTimes[generatorType] || interval) + interval;
		});
	}

	const photonAutoClicksPerSecond = photonAutoClickEnabled ? manager.photonAutoClicksPer5Seconds / 5 / OFFLINE_AUTO_FACTOR : 0;
	/** Expected photons from one normal and one excited circle, the averages the whole offline stretch is paid at. */
	const photonClickExpectedNormal =
		photonAutoClickEnabled ? ((OFFLINE_PHOTON_MIN + OFFLINE_PHOTON_MAX) / 2 + manager.photonValueBonus) * (1 + manager.photonDoubleChance) : 0;
	const photonClickExpectedExcited =
		photonAutoClickEnabled ?
			1 + manager.excitedPhotonDoubleChance + (OFFLINE_PHOTON_MAX + manager.photonValueBonus) * manager.excitedPhotonFromMaxBonus
		:	0;

	if (photonAutoClicksPerSecond > 0) {
		photonAutoClicks = photonAutoClicksPerSecond * (appliedMs / 1000);

		const allowExcited = (manager.photonUpgrades['excited_auto_click'] || 0) > 0;
		const excitedChance = allowExcited ? manager.excitedPhotonChance : 0;
		const expectedNormal = (1 - excitedChance) * photonClickExpectedNormal * photonAutoClicks;
		const expectedExcited = excitedChance * photonClickExpectedExcited * photonAutoClicks;

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

	const atomAutoClickAffectsStability = atomAutoClickEnabled && !manager.features[FeatureTypes.STABLE_ATOM_AUTO_CLICK];
	const photonAutoClickAffectsStability =
		photonAutoClickEnabled && manager.photonAutoClicksPer5Seconds > 0 && !manager.features[FeatureTypes.STABLE_PHOTON_AUTO_CLICK];
	if (atomAutoClickAffectsStability || photonAutoClickAffectsStability) {
		manager.lastInteractionTime = now;
	}

	const photonClickExpectedTotal = photonAutoClickEnabled ? (photonsGained + excitedPhotonsGained) / (photonAutoClicks || 1) : 0;

	// Radiation Summary
	const radEndMass = radiationManager.mass;
	const radMassDelta = radEndMass - radStartMass;
	const radMassLost = radRegenTotal - radMassDelta;

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
		levelsGained,
		photonAutoClickEnabled,
		photonAutoClickFactor: OFFLINE_AUTO_FACTOR,
		photonAutoClicks,
		photonAutoClicksPerSecond,
		photonClickExpectedExcited,
		photonClickExpectedNormal,
		photonClickExpectedTotal,
		radiationActive: radiationManager.unlocked && radSteps > 0,
		radiationAvgMultiplier: radSteps > 0 ? radMultiplierSum / radSteps : 1,
		radiationMassGained: radRegenTotal,
		radiationMassLost: Math.max(0, radMassLost),
		radiationTimeToEmpty: radiationManager.timeToEmpty,
		xpGained,
	};
}

function getOfflineProgressCapMs(manager: GameManager) {
	if (!manager.features[OFFLINE_UNLOCK_FEATURE]) return 0;

	let capMs = OFFLINE_BASE_MS;
	for (const [id, value] of Object.entries(OFFLINE_CAP_UPGRADE_MAP)) {
		if (manager.upgrades.includes(id)) capMs = Math.max(capMs, value);
	}
	return Math.min(capMs, OFFLINE_MAX_MS);
}
