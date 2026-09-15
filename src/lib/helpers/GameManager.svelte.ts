import { ACHIEVEMENTS, ACHIEVEMENT_ENTRIES } from '$data/achievements';
import { type BuildingType, BUILDINGS, BUILDING_LEVEL_UP_COST, getBuildingLevelMultiplier } from '$data/buildings';
import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import type { DailyStats } from '$data/dailyQuests';
import { FeatureTypes } from '$data/features';
import { ALL_PHOTON_UPGRADES, getPhotonUpgradeCost } from '$data/photonUpgrades';
import { POWER_UP_DEFAULT_INTERVAL, POWER_UP_MIN_INTERVAL } from '$data/powerUp';
import { REALMS, RealmTypes } from '$data/realms';
import { SKILL_UPGRADES } from '$data/skillTree';
import { UPGRADES } from '$data/upgrades';
import { BUILDING_COST_MULTIPLIER, ELECTRONS_PROTONS_REQUIRED, PROTONS_ATOMS_REQUIRED, XP_PER_ATOM } from '$lib/constants';
import {
	type Building,
	type CurrencyBoosts,
	type Effect,
	type FeatureState,
	type GameState,
	type OfflineProgressSummary,
	type PowerUp,
	type Price,
	type RealmState,
	type Settings,
	type SkillUpgrade,
	type Upgrade,
} from '$lib/types';
import { setItem } from '$lib/utils/safeLocalStorage';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { foldEffects } from '$helpers/effects';
import { FeaturesManager } from '$helpers/FeaturesManager.svelte';
import { applyOfflineProgress } from '$helpers/offlineProgress';
import { radiationManager } from '$helpers/RadiationManager.svelte';
import { realmManager } from '$helpers/RealmManager.svelte';
import { SAVE_KEY, SAVE_VERSION, loadSavedState, serializeSaveState } from '$helpers/saves';
import { LAYERS, type LayerType, statsConfig } from '$helpers/statConstants';
import { TutorialManager } from '$helpers/TutorialManager.svelte';
import { levelFromTotalXP, totalXPForLevel, xpForLevel } from '$helpers/xp';
import { leaderboard } from '$stores/leaderboard.svelte';
import { saveRecovery } from '$stores/saveRecovery';
import { toastStore } from '$stores/toasts.svelte';

/** `tick` already drops expired power-ups on the simulated clock, so this timer is a precision helper and must never hold a headless runtime open. */
function scheduleExpiry(callback: () => void, delay: number) {
	const timer = setTimeout(callback, delay) as ReturnType<typeof setTimeout> & { unref?: () => void };
	timer.unref?.();
}

export class GameManager {
	// State
	achievements = $state<string[]>([]);
	activePowerUps = $state<PowerUp[]>([]);
	buildings = $state<Partial<Record<BuildingType, Building>>>({});
	dailyStats = $state<DailyStats>({
		achievementsUnlocked: 0,
		atomsEarned: 0,
		buildingsPurchased: 0,
		clicks: 0,
		dayKey: '',
		electronizes: 0,
		higgsBosonsCollected: 0,
		otherDailyQuestsCompleted: 0,
		powerUpsCollected: 0,
		protonises: 0,
		questIds: [],
		questTargets: {},
		upgradesPurchased: 0,
	});
	featuresManager = new FeaturesManager();
	highestAPS = $state(0);
	inGameTime = $state(0);
	lastInteractionTime = $state(Date.now());
	/**
	 * Source of "now" for the interaction clock the stability field runs on. Real time in the game; the simulation
	 * swaps it for its own clock, because a 24h benchmark run finishes in seconds of wall time and would otherwise
	 * read the stability field off whatever the machine happened to be doing.
	 */
	clock: () => number = () => Date.now();
	lastLoadedSave = $state(0);
	lastSave = $state(Date.now());

	offlineProgressSummary = $state<OfflineProgressSummary | null>(null);
	photonUpgrades = $state<Record<string, number>>({});
	powerUpsCollected = $state(0);
	/**
	 * Effects of owned Quark shop boosts, pushed in by QuarksManager after sync/purchase/refund.
	 * GameManager never imports QuarksManager directly, since simulation.worker.ts imports GameManager
	 * and has no auth/DOM context - see QuarksManager.svelte.ts for the one-way dependency rule.
	 */
	quarkBoostEffects = $state<Effect[]>([]);
	/**
	 * IDs of owned Quark shop items, pushed in by QuarksManager after sync/purchase/refund. Used to
	 * gate prestige-persistence behaviors (e.g. keeping skill tree/currency boosts) that the generic
	 * Effect pipeline can't express. Same one-way dependency rule as `quarkBoostEffects`.
	 */
	quarkEntitlements = $state<string[]>([]);
	radiationUpgrades = $state<Record<string, number>>({});
	realms = $state<Record<string, RealmState>>({
		[RealmTypes.ATOMS]: { unlocked: true },
		[RealmTypes.PHOTONS]: { unlocked: false },
		[RealmTypes.RADIATION]: { unlocked: false },
	});
	/** True once the loaded save fails its checksum, see saveIntegrity.ts. */
	saveIntegrityTampered = $state(false);
	/** Plausibility warnings from checkStatePlausibility, see saves.ts. */
	saveIntegrityWarnings = $state<string[]>([]);
	settings = $state<Settings>({
		automation: {
			autoClick: false,
			autoClickPhotons: false,
			buildings: [],
			upgrades: false,
		},
		gameplay: {
			offlineProgressEnabled: true,
		},
		upgrades: {
			displayAlreadyBought: false,
		},
	});
	skillUpgrades = $state<string[]>([]);
	skillPointBoosts = $state<CurrencyBoosts>({});
	startDate = $state(Date.now());
	totalBuildingsPurchasedAllTime = $state(0);
	totalClicksAllTime = $state(0);
	totalClicksRun = $state(0);
	totalElectronizesAllTime = $state(0);
	totalElectronizesRun = $state(0);
	totalProtonisesAllTime = $state(0);
	totalProtonisesRun = $state(0);
	totalUpgradesPurchasedAllTime = $state(0);
	totalUsers = $derived(leaderboard.stats.totalUsers);
	totalXP = $state(0);
	tutorialManager = new TutorialManager();
	upgrades = $state<string[]>([]);

	// Configuration
	private statsConfig = statsConfig;
	private gameInterval: ReturnType<typeof setInterval> | null = null;
	/** Guards dailyStats increments during applyOfflineProgress, which reuses purchaseBuilding/purchaseUpgrade directly. */
	applyingOfflineProgress = false;

	initialize() {
		this.loadGame();
		this.setupInterval();
	}

	cleanup() {
		if (this.gameInterval) clearInterval(this.gameInterval);
	}

	// Derived Props (Sorted Alphabetically)

	allEffectSources = $derived.by(() => {
		const baseUpgrades = this.currentUpgradesBought;
		const photonUpgrades = Object.entries(this.photonUpgrades)
			.filter(([id, level]) => level > 0 && ALL_PHOTON_UPGRADES[id])
			.map(([id, level]) => ({
				effects: ALL_PHOTON_UPGRADES[id].effects(level),
				id,
			}));

		const quarkBoosts = this.quarkBoostEffects.length > 0 ? [{ effects: this.quarkBoostEffects, id: 'quark_boosts' }] : [];

		return [...baseUpgrades, ...photonUpgrades, ...quarkBoosts] as (Upgrade | SkillUpgrade)[];
	});

	atomsPerSecond = $derived.by(() => {
		let baseProduction = 0;
		for (const production of Object.values(this.buildingProductions)) baseProduction += production;
		return baseProduction * this.getCurrencyBoostMultiplier(CurrenciesTypes.ATOMS);
	});

	autoClicksPerSecond = $derived.by(() => {
		if (!this.settings.automation.autoClick) return 0;
		const options = { type: 'auto_click' as const };
		return foldEffects(this.allEffectSources, this, 0, options);
	});

	photonAutoClicksPer5Seconds = $derived.by(() => {
		if (!this.settings.automation.autoClickPhotons) return 0;
		const options = { type: 'photon_auto_click' as const };
		return foldEffects(this.allEffectSources, this, 0, options);
	});

	bonusMultiplier = $derived(this.activePowerUps.reduce((acc, powerUp) => acc * powerUp.multiplier, 1));

	/** Achievement conditions read these every sweep, so the totals are folded once per buildings change. */
	buildingTotals = $derived.by(() => {
		let count = 0;
		let levels = 0;
		for (const building of Object.values(this.buildings)) {
			if (!building) continue;
			count += building.count;
			levels += building.level;
		}
		return { count, levels };
	});

	// Currency Boost System (from building levels, 10% boost per point, max 20 per currency)
	skillPointsTotal = $derived(this.buildingTotals.levels);
	skillPointsUsed = $derived(Object.values(this.skillPointBoosts).reduce((sum, points) => sum + (points ?? 0), 0));
	/** Summing a `$state` record walks the proxy for every key, and the milestone check reads this on every tick. */
	photonUpgradeLevels = $derived(Object.values(this.photonUpgrades).reduce((sum, level) => sum + (level ?? 0), 0));
	skillPointsAvailable = $derived(this.skillPointsTotal - this.skillPointsUsed);

	buildingProductions = $derived.by(() => {
		const productions = {} as Record<BuildingType, number>;
		const commonMultiplier = this.globalMultiplier * this.bonusMultiplier * this.stabilityMultiplier;

		for (const [type, building] of Object.entries(this.buildings)) {
			if (!building) {
				productions[type as BuildingType] = 0;
				continue;
			}

			const options = { target: type as BuildingType, type: 'building' as const };
			const multiplier = foldEffects(this.allEffectSources, this, building.rate, options);
			const levelMultiplier = getBuildingLevelMultiplier(building.count, building.level);
			productions[type as BuildingType] = building.count * multiplier * levelMultiplier * commonMultiplier;
		}

		return productions;
	});

	canProtonise = $derived(this.atoms >= PROTONS_ATOMS_REQUIRED || this.protons > 0);

	clickPower = $derived.by(() => {
		const options = { type: 'click' as const };
		return foldEffects(this.allEffectSources, this, 1, options) * this.bonusMultiplier;
	});

	currentLevelXP = $derived.by(() => {
		const level = this.getLevelFromTotalXP(this.totalXP);
		if (level === 0) return this.totalXP;
		return Math.max(0, this.totalXP - totalXPForLevel(level));
	});

	currentUpgradesBought = $derived.by(() => {
		const allUpgradeIds = [...this.upgrades, ...this.skillUpgrades];
		return allUpgradeIds.filter(id => UPGRADES[id] || SKILL_UPGRADES[id]).map(id => UPGRADES[id] || SKILL_UPGRADES[id]);
	});

	electronizeElectronsGain = $derived.by(() => {
		if (this.protons < ELECTRONS_PROTONS_REQUIRED) return 0;
		const options = { type: 'electron_gain' as const };
		const baseGain = foldEffects(this.allEffectSources, this, 1, options);
		return baseGain * this.getCurrencyBoostMultiplier(CurrenciesTypes.ELECTRONS);
	});

	excitedPhotonChance = $derived.by(() => {
		const baseChance = 0.002; // 0.2%
		const options = { type: 'excited_photon_chance' as const };
		return foldEffects(this.allEffectSources, this, baseChance, options);
	});

	radiationMultiplier = $derived(radiationManager.radiationMultiplier);

	globalMultiplier = $derived.by(() => {
		const options = { type: 'global' as const };
		const baseMultiplier = foldEffects(this.allEffectSources, this, 1, options);
		// Radiation multiplier is applied multiplicatively
		return baseMultiplier * this.radiationMultiplier;
	});

	hasAvailableSkillUpgrades = $derived.by(() => {
		return Object.values(SKILL_UPGRADES).some(skill => {
			if (this.skillUpgrades.includes(skill.id)) return false;
			if (skill.condition && !skill.condition(this)) return false;
			if (skill.requires && !skill.requires.every(req => this.skillUpgrades.includes(req))) return false;
			// Check if can afford
			const currency = skill.cost.currency;
			const amount = currenciesManager.getAmount(currency);
			return amount >= skill.cost.amount;
		});
	});

	hasBonus = $derived(this.activePowerUps.length > 0);

	nextLevelXP = $derived.by(() => {
		const level = this.getLevelFromTotalXP(this.totalXP);
		return this.getXPForLevel(level + 1);
	});

	photonSpawnInterval = $derived.by(() => {
		const baseSpawnRate = 2000;
		const options = { type: 'photon_spawn_interval' as const };
		return foldEffects(this.allEffectSources, this, baseSpawnRate, options);
	});

	playerLevel = $derived(this.getLevelFromTotalXP(this.totalXP));

	powerUpDurationMultiplier = $derived.by(() => {
		const options = { type: 'power_up_duration' as const };
		return foldEffects(this.allEffectSources, this, 1, options);
	});

	powerUpEffectMultiplier = $derived.by(() => {
		const options = { type: 'power_up_multiplier' as const };
		return foldEffects(this.allEffectSources, this, 1, options);
	});

	powerUpInterval = $derived.by(() => {
		const options = { type: 'power_up_interval' as const };
		return POWER_UP_DEFAULT_INTERVAL.map(interval =>
			Math.max(POWER_UP_MIN_INTERVAL, foldEffects(this.allEffectSources, this, interval, options))
		) as [number, number];
	});

	protoniseProtonsGain = $derived.by(() => {
		if (this.atoms < PROTONS_ATOMS_REQUIRED) return 0;

		const baseGain = Math.floor(Math.sqrt(this.atoms / PROTONS_ATOMS_REQUIRED));
		const options = { type: 'proton_gain' as const };
		const boostedGain = foldEffects(this.allEffectSources, this, baseGain, options);
		return boostedGain * this.getCurrencyBoostMultiplier(CurrenciesTypes.PROTONS);
	});

	stabilityCapacity = $derived.by(() => {
		const options = { type: 'stability_capacity' as const };
		return foldEffects(this.allEffectSources, this, 1, options);
	});

	stabilityMaxBoost = $derived.by(() => {
		const options = { type: 'stability_boost' as const };
		return foldEffects(this.allEffectSources, this, 2, options);
	});

	stabilityMultiplier = $derived.by(() => {
		// 1. Check unlock & pause conditions
		if (!this.features[FeatureTypes.STABILITY_FIELD]) return 1;
		if (this.activePowerUps.length > 0) return 1;

		// 2. Calculate Time Requirements
		// Base time: 10 minutes (600,000 ms)
		// Modified by Capacity (increases time) and Speed (decreases time)
		const BASE_TIME_MS = 600_000;
		const timeRequired = (BASE_TIME_MS * this.stabilityCapacity) / this.stabilitySpeed;

		// 3. Calculate Progress (0 to 1)
		// Reactivity trigger: this.inGameTime changes every second
		this.inGameTime;
		const elapsed = this.clock() - this.lastInteractionTime;
		const progress = Math.min(Math.max(elapsed / timeRequired, 0), 1);

		if (progress <= 0) return 1;

		// 4. Calculate Max Possible Boost
		// The max boost is determined by the Base Max Boost (from boosts upgrades)
		// scaled by the Capacity multiplier.
		// Formula: 1 + (BaseBonus * CapacityMultiplier)
		const baseBonus = this.stabilityMaxBoost - 1; // e.g., if MaxBoost is 2x, bonus is 1x (100%)
		const scaledBonus = baseBonus * this.stabilityCapacity;

		// 5. Apply Curve (Linear)
		// The current boost is simply the Max Possible Boost scaled linearly by progress
		// e.g., 50% progress = 50% of the possible bonus
		const currentBoost = 1 + scaledBonus * progress;

		return currentBoost;
	});

	stabilitySpeed = $derived.by(() => {
		const options = { type: 'stability_speed' as const };
		return foldEffects(this.allEffectSources, this, 1, options);
	});

	/** Membership lookups run over every achievement each tick, so the array is mirrored into a set once per change. */
	unlockedAchievementIds = $derived(new Set(this.achievements));

	xpGainMultiplier = $derived.by(() => {
		const options = { type: 'xp_gain' as const };
		return foldEffects(this.allEffectSources, this, 1, options);
	});

	xpProgress = $derived((this.currentLevelXP / this.nextLevelXP) * 100);

	// Stats Getters for Currencies
	get atoms() {
		return currenciesManager.getAmount(CurrenciesTypes.ATOMS);
	}
	get currencies() {
		return currenciesManager.currencies;
	}
	get electrons() {
		return currenciesManager.getAmount(CurrenciesTypes.ELECTRONS);
	}
	get excitedPhotons() {
		return currenciesManager.getAmount(CurrenciesTypes.EXCITED_PHOTONS);
	}
	get features() {
		return this.featuresManager.state;
	}
	get photons() {
		return currenciesManager.getAmount(CurrenciesTypes.PHOTONS);
	}
	get protons() {
		return currenciesManager.getAmount(CurrenciesTypes.PROTONS);
	}

	set currencies(value) {
		currenciesManager.currencies = value;
	}

	set features(value: FeatureState) {
		this.featuresManager.state = value;
	}

	// Methods

	// State Management
	getCurrentState(): GameState {
		return {
			achievements: this.achievements,
			activePowerUps: this.activePowerUps,
			buildings: this.buildings,
			currencies: this.currencies,
			currencyBoosts: this.skillPointBoosts,
			dailyStats: this.dailyStats,
			features: this.features,
			highestAPS: this.highestAPS,
			inGameTime: this.inGameTime,
			lastInteractionTime: this.lastInteractionTime,
			lastSave: this.lastSave,
			photonUpgrades: this.photonUpgrades,
			powerUpsCollected: this.powerUpsCollected,
			radiation: radiationManager.getState(),
			radiationUpgrades: this.radiationUpgrades,
			realms: this.realms,
			selectedRealmId: realmManager.selectedRealmId,
			settings: this.settings,
			skillUpgrades: this.skillUpgrades,
			startDate: this.startDate,
			totalBuildingsPurchasedAllTime: this.totalBuildingsPurchasedAllTime,
			totalClicksAllTime: this.totalClicksAllTime,
			totalClicksRun: this.totalClicksRun,
			totalElectronizesAllTime: this.totalElectronizesAllTime,
			totalElectronizesRun: this.totalElectronizesRun,
			totalProtonisesAllTime: this.totalProtonisesAllTime,
			totalProtonisesRun: this.totalProtonisesRun,
			totalUpgradesPurchasedAllTime: this.totalUpgradesPurchasedAllTime,
			totalUsers: this.totalUsers,
			totalXP: this.totalXP,
			tutorial: this.tutorialManager.state,
			upgrades: this.upgrades,
			version: SAVE_VERSION,
		};
	}

	// Skill Point Boost Methods
	getCurrencyBoostMultiplier(currency: CurrencyName): number {
		const points = this.skillPointBoosts[currency] ?? 0;
		return 1 + points * 0.1; // 10% per point
	}

	addCurrencyBoost(currency: CurrencyName): boolean {
		if (this.skillPointsAvailable <= 0) return false;
		const currentPoints = this.skillPointBoosts[currency] ?? 0;
		if (currentPoints >= 20) return false; // Max 20 per currency

		this.skillPointBoosts = {
			...this.skillPointBoosts,
			[currency]: currentPoints + 1,
		};
		return true;
	}

	removeCurrencyBoost(currency: CurrencyName): boolean {
		const currentPoints = this.skillPointBoosts[currency] ?? 0;
		if (currentPoints <= 0) return false;

		this.skillPointBoosts = {
			...this.skillPointBoosts,
			[currency]: currentPoints - 1,
		};
		return true;
	}

	loadGame() {
		const result = loadSavedState();

		if (result.success && result.state) {
			this.loadSaveData(result.state);
			this.syncFeatures();
			this.checkRealmUnlocks();
			this.lastLoadedSave = typeof result.state.lastSave === 'number' ? result.state.lastSave : 0;
			this.saveIntegrityTampered = result.integrityTampered ?? false;
			this.saveIntegrityWarnings = result.integrityWarnings ?? [];
			if (this.saveIntegrityTampered || this.saveIntegrityWarnings.length > 0) {
				console.warn('Save integrity check flagged this save:', {
					tampered: this.saveIntegrityTampered,
					warnings: this.saveIntegrityWarnings,
				});
				toastStore.warning({
					title: 'Save check',
					message: 'This save looks like it was edited outside the game. Leaderboard submission is disabled for this session.',
				});
			}
			this.applyingOfflineProgress = true;
			const offlineSummary = applyOfflineProgress(this);
			this.applyingOfflineProgress = false;
			if (offlineSummary) {
				this.offlineProgressSummary = offlineSummary;
			}
			console.log('Game loaded successfully');
			this.save();
		} else if (!result.success && result.errorType) {
			saveRecovery.setError(result.errorType, result.errorDetails || 'Unknown error loading save', result.rawData ?? null);
			console.error('Save load failed:', result.errorType, result.errorDetails);
		}
	}

	clearOfflineProgressSummary() {
		this.offlineProgressSummary = null;
	}

	syncFeatures() {
		this.featuresManager.syncFromState(this);
	}

	loadSaveData(data: Partial<GameState>) {
		for (const key of Object.keys(this.statsConfig)) {
			if (key in data) {
				if (key === 'settings') {
					const savedSettings = data.settings as Settings;
					const defaultSettings = this.statsConfig.settings.defaultValue as Settings;

					this.settings = {
						...defaultSettings,
						...savedSettings,
						automation: {
							...defaultSettings.automation,
							...(savedSettings?.automation ?? {}),
						},
						gameplay: {
							...defaultSettings.gameplay,
							...(savedSettings?.gameplay ?? {}),
						},
						upgrades: {
							...defaultSettings.upgrades,
							...(savedSettings?.upgrades ?? {}),
						},
					};
				} else if (key === 'currencyBoosts') {
					this.skillPointBoosts = data.currencyBoosts ?? {};
				} else if (key === 'radiation') {
					// Radiation state is handled by RadiationManager
					if (data.radiation) {
						radiationManager.loadState(data.radiation, data.radiationUpgrades ?? {});
					}
				} else if (key === 'radiationUpgrades') {
					this.radiationUpgrades = data.radiationUpgrades ?? {};
					radiationManager.upgradeLevels = this.radiationUpgrades;
				} else if (key === 'selectedRealmId') {
					if (data.selectedRealmId) {
						realmManager.selectRealm(data.selectedRealmId);
					}
				} else if (key === 'tutorial') {
					this.tutorialManager.state = { ...(this.statsConfig.tutorial.defaultValue as GameState['tutorial']), ...data.tutorial };
				} else {
					this[key as keyof this] = data[key as keyof GameState] as any;
				}
			}
		}
		if (data.lastInteractionTime) {
			this.lastInteractionTime = data.lastInteractionTime;
		}

		// Filter expired power-ups and setup removal timeouts
		if (this.activePowerUps.length > 0) {
			const now = Date.now();
			this.activePowerUps = this.activePowerUps.filter(p => {
				if (!p.startTime) return false; // Remove malformed power-ups
				return now < p.startTime + p.duration;
			});
			this.activePowerUps.forEach(p => {
				scheduleExpiry(() => this.removePowerUp(p.id), p.startTime + p.duration - now);
			});
		}
	}

	save() {
		this.lastSave = Date.now();
		const saveData = this.getCurrentState();
		setItem(SAVE_KEY, serializeSaveState(saveData));
	}

	// Reset Logic
	reset() {
		this.resetAll();
		this.startDate = Date.now();
		this.save();
	}

	resetAll() {
		for (const [key, config] of Object.entries(this.statsConfig)) {
			if (key === 'currencies') {
				currenciesManager.hardReset();
			} else if (key === 'features') {
				this.featuresManager.reset();
			} else if (key === 'currencyBoosts') {
				this.skillPointBoosts = {};
			} else if (key === 'tutorial') {
				this.tutorialManager.reset();
			} else {
				this[key as keyof this] = config.defaultValue;
			}
		}
	}

	resetLayer(layer: LayerType) {
		for (const [key, config] of Object.entries(this.statsConfig)) {
			if (config.layer > 0 && config.layer <= layer) {
				if (key === 'features') {
					this.featuresManager.reset();
				} else if (key === 'currencyBoosts') {
					if (!this.quarkEntitlements.includes('convenience_keep_currency_boosts')) {
						this.skillPointBoosts = {};
					}
				} else if (key === 'tutorial') {
					this.tutorialManager.reset();
				} else {
					this[key as keyof this] = config.defaultValue;
				}
			}
		}
		currenciesManager.reset(layer);
	}

	// Currency & Affordability
	canAfford(price: Price): boolean {
		return this.getCurrency(price) >= price.amount;
	}

	getCurrency(price: Price): number {
		return currenciesManager.getAmount(price.currency);
	}

	spendCurrency(price: Price): boolean {
		if (!this.canAfford(price)) return false;
		currenciesManager.remove(price.currency, price.amount);
		return true;
	}

	// Building Helpers
	getBuildingCost(type: BuildingType, amount: number): number {
		const building = BUILDINGS[type];
		const currentCount = this.buildings[type]?.count ?? 0;
		const baseCost = building.cost.amount;
		const r = BUILDING_COST_MULTIPLIER;
		const a = baseCost * r ** currentCount;
		const cost = (a * (Math.pow(r, amount) - 1)) / (r - 1);
		return Math.round(cost);
	}

	getMaxAffordableBuilding(type: BuildingType): number {
		const building = BUILDINGS[type];
		const currency = this.getCurrency(building.cost);
		const currentCount = this.buildings[type]?.count ?? 0;
		const baseCost = building.cost.amount;
		const r = BUILDING_COST_MULTIPLIER;
		const a = baseCost * r ** currentCount;

		if (currency < a) return 0;

		const n = Math.log((currency * (r - 1)) / a + 1) / Math.log(r);
		return Math.floor(n);
	}

	// Purchasing
	purchaseBuilding(type: BuildingType, amount: number = 1) {
		const building = BUILDINGS[type];
		const currentBuilding =
			this.buildings[type] ??
			({
				cost: building.cost,
				rate: building.rate,
				level: 0,
				count: 0,
				unlocked: true,
			} as Building);

		const totalCost = this.getBuildingCost(type, amount);

		const cost = {
			amount: totalCost,
			currency: currentBuilding.cost.currency,
		};

		if (!this.spendCurrency(cost)) return false;

		const newCount = currentBuilding.count + amount;
		const newBuilding = {
			...currentBuilding,
			cost: {
				amount: this.getBuildingCost(type, 1),
				currency: cost.currency,
			},
			count: newCount,
			level: Math.floor(newCount / BUILDING_LEVEL_UP_COST),
		};

		this.buildings = {
			...this.buildings,
			[type]: newBuilding,
		};

		this.totalBuildingsPurchasedAllTime += amount;
		if (!this.applyingOfflineProgress) {
			this.dailyStats = { ...this.dailyStats, buildingsPurchased: this.dailyStats.buildingsPurchased + amount };
		}
		return true;
	}

	purchasePhotonUpgrade(upgradeId: string) {
		const currentLevel = this.photonUpgrades[upgradeId] || 0;
		const upgrade = ALL_PHOTON_UPGRADES[upgradeId];

		if (!upgrade || currentLevel >= upgrade.maxLevel) {
			return false;
		}

		const cost = {
			amount: getPhotonUpgradeCost(upgrade, currentLevel),
			currency: upgrade.currency || CurrenciesTypes.PHOTONS,
		};

		if (this.spendCurrency(cost)) {
			this.photonUpgrades = {
				...this.photonUpgrades,
				[upgradeId]: currentLevel + 1,
			};
			this.syncFeatures();
			this.checkRealmUnlocks();
			return true;
		}
		return false;
	}

	purchaseSkill(skillId: string) {
		const skill = SKILL_UPGRADES[skillId];
		if (!skill) return false;

		if (this.skillUpgrades.includes(skillId)) return false;
		if (skill.requires && !skill.requires.every(req => this.skillUpgrades.includes(req))) return false;
		if (skill.condition && !skill.condition(this)) return false;

		// Spend currency
		if (!this.spendCurrency(skill.cost)) return false;

		this.skillUpgrades = [...this.skillUpgrades, skillId];
		this.syncFeatures();
		this.checkRealmUnlocks();
		return true;
	}

	purchaseUpgrade(id: string) {
		const upgrade = UPGRADES[id];
		if (!upgrade) return false;
		const purchased = this.upgrades.includes(id);

		if (!purchased && this.spendCurrency(upgrade.cost)) {
			this.upgrades = [...this.upgrades, id];
			this.syncFeatures();

			this.checkRealmUnlocks();

			this.totalUpgradesPurchasedAllTime += 1;
			if (!this.applyingOfflineProgress) {
				this.dailyStats = { ...this.dailyStats, upgradesPurchased: this.dailyStats.upgradesPurchased + 1 };
			}
			return true;
		}
		return false;
	}

	checkRealmUnlocks() {
		const features = this.features;
		for (const realmDef of Object.values(REALMS)) {
			if (!this.realms[realmDef.id]) {
				this.realms[realmDef.id] = { unlocked: false };
			}
			const realmState = this.realms[realmDef.id];
			if (!realmState.unlocked && realmDef.condition(features)) {
				realmState.unlocked = true;
			}
		}
	}

	unlockBuilding(type: BuildingType) {
		if (type in this.buildings) return;

		this.buildings = {
			...this.buildings,
			[type]: {
				cost: BUILDINGS[type].cost,
				rate: BUILDINGS[type].rate,
				level: 0,
				count: 0,
				unlocked: true,
			},
		};
	}

	// Prestige
	electronize() {
		const electronGain = this.electronizeElectronsGain;

		if (this.protons >= ELECTRONS_PROTONS_REQUIRED || electronGain > 0) {
			const persistentUpgrades = this.upgrades.filter(id => id.startsWith('electron') || id.startsWith('proton'));
			const persistentSkills =
				this.quarkEntitlements.includes('convenience_keep_skill_tree') ?
					this.skillUpgrades
				:	this.skillUpgrades.filter(id => {
						const skill = SKILL_UPGRADES[id];
						return (
							!!skill?.feature ||
							skill?.cost.currency === CurrenciesTypes.PROTONS ||
							skill?.cost.currency === CurrenciesTypes.ELECTRONS
						);
					});

			this.totalElectronizesRun += 1;
			this.totalElectronizesAllTime += 1;
			this.totalProtonisesRun = 0;
			this.dailyStats = { ...this.dailyStats, electronizes: (this.dailyStats.electronizes ?? 0) + 1 };

			this.resetLayer(LAYERS.ELECTRONIZE);

			this.upgrades = persistentUpgrades;
			this.skillUpgrades = persistentSkills;
			this.syncFeatures();
			this.checkRealmUnlocks();
			currenciesManager.add(CurrenciesTypes.ELECTRONS, electronGain);

			this.lastInteractionTime = this.clock();
			this.save();
			return true;
		}
		return false;
	}

	protonise() {
		const protonGain = this.protoniseProtonsGain;

		if (this.atoms >= PROTONS_ATOMS_REQUIRED || protonGain > 0) {
			const persistentUpgrades = this.upgrades.filter(id => id.startsWith('proton') || id.startsWith('electron'));
			const persistentSkills =
				this.quarkEntitlements.includes('convenience_keep_skill_tree') ?
					this.skillUpgrades
				:	this.skillUpgrades.filter(id => {
						const skill = SKILL_UPGRADES[id];
						return (
							!!skill?.feature ||
							skill?.cost.currency === CurrenciesTypes.PROTONS ||
							skill?.cost.currency === CurrenciesTypes.ELECTRONS
						);
					});

			this.totalProtonisesRun += 1;
			this.totalProtonisesAllTime += 1;
			this.dailyStats = { ...this.dailyStats, protonises: this.dailyStats.protonises + 1 };

			this.resetLayer(LAYERS.PROTONIZER);

			this.upgrades = persistentUpgrades;
			this.skillUpgrades = persistentSkills;
			this.syncFeatures();
			this.checkRealmUnlocks();
			currenciesManager.add(CurrenciesTypes.PROTONS, protonGain);

			this.lastInteractionTime = this.clock();
			this.save();
			return true;
		}
		return false;
	}

	// Stats & Progression
	addAtoms(amount: number) {
		currenciesManager.add(CurrenciesTypes.ATOMS, amount);
		if (amount > 0) {
			if (this.features[FeatureTypes.LEVELS]) {
				this.totalXP += amount * XP_PER_ATOM * this.xpGainMultiplier;
			}
			this.dailyStats.atomsEarned += amount;
		}
	}

	incrementBonusHiggsBosonClicks() {
		currenciesManager.add(CurrenciesTypes.HIGGS_BOSON, 1);
		this.dailyStats = { ...this.dailyStats, higgsBosonsCollected: (this.dailyStats.higgsBosonsCollected ?? 0) + 1 };
		if (!this.upgrades.includes('electron_bypass_bonus_click_stability')) {
			this.lastInteractionTime = this.clock();
		}
	}

	incrementClicks(isAuto = false) {
		this.totalClicksRun += 1;
		this.totalClicksAllTime += 1;
		this.dailyStats.clicks += 1;

		const shouldUpdate =
			isAuto ?
				!this.upgrades.includes('electron_bypass_atom_autoclick_stability')
			:	!this.upgrades.includes('electron_bypass_atom_click_stability');

		if (shouldUpdate) {
			this.lastInteractionTime = this.clock();
		}
	}

	/**
	 * Set from outside (see +layout.svelte) rather than imported here, so GameManager never
	 * statically imports QuarksManager - simulation.worker.ts imports GameManager and has no
	 * auth/DOM context, see QuarksManager.svelte.ts for the full one-way dependency rule.
	 */
	onAchievementUnlocked: ((achievementId: string) => void) | null = null;

	unlockAchievement(achievementId: string) {
		if (!this.achievements.includes(achievementId)) {
			this.achievements = [...this.achievements, achievementId];
			this.dailyStats = { ...this.dailyStats, achievementsUnlocked: (this.dailyStats.achievementsUnlocked ?? 0) + 1 };
			const achievement = ACHIEVEMENTS[achievementId];
			if (achievement) {
				toastStore.info({
					title: 'Achievement unlocked',
					message: `${achievement.name}\n${achievement.description}`,
					duration: 10000,
					icon: achievement.iconStack ?? achievement.icon ?? 'Trophy',
				});
			}
			this.onAchievementUnlocked?.(achievementId);
		}
	}

	// Power-Ups
	addPowerUp(powerUp: PowerUp) {
		const newPowerUp = { ...powerUp };
		if (!newPowerUp.startTime) newPowerUp.startTime = this.clock();
		this.activePowerUps = [...this.activePowerUps, newPowerUp];
		this.powerUpsCollected += 1;
		this.dailyStats = { ...this.dailyStats, powerUpsCollected: this.dailyStats.powerUpsCollected + 1 };
		if (!this.upgrades.includes('electron_bypass_bonus_click_stability')) {
			this.lastInteractionTime = this.clock();
		}

		scheduleExpiry(() => this.removePowerUp(newPowerUp.id), newPowerUp.duration);
	}

	removePowerUp(id: string) {
		this.activePowerUps = this.activePowerUps.filter(p => p.id !== id);
	}

	// Automation
	toggleAutomation(buildingType: BuildingType) {
		const buildings = [...this.settings.automation.buildings];
		const index = buildings.indexOf(buildingType);

		if (index === -1) {
			buildings.push(buildingType);
		} else {
			buildings.splice(index, 1);
		}

		this.settings = {
			...this.settings,
			automation: {
				...this.settings.automation,
				buildings,
			},
		};
	}

	toggleAutoClick() {
		this.settings = {
			...this.settings,
			automation: {
				...this.settings.automation,
				autoClick: !this.settings.automation.autoClick,
			},
		};
	}

	toggleAutoClickPhotons() {
		this.settings = {
			...this.settings,
			automation: {
				...this.settings.automation,
				autoClickPhotons: !this.settings.automation.autoClickPhotons,
			},
		};
	}

	toggleUpgradeAutomation() {
		this.settings = {
			...this.settings,
			automation: {
				...this.settings.automation,
				upgrades: !this.settings.automation.upgrades,
			},
		};
	}

	// XP Helpers
	getLevelFromTotalXP(totalXP: number) {
		if (!isFinite(totalXP) || totalXP <= 0) return 0;
		return levelFromTotalXP(totalXP);
	}

	getXPForLevel(level: number) {
		return xpForLevel(level);
	}

	/**
	 * `skipProduction` is what the browser passes: there the atoms are summed per frame in `+page.svelte` for a smooth
	 * counter, and crediting them here too would pay every building twice. The simulation has no frame loop and pays here.
	 */
	tick(deltaTime: number = 1000, skipAchievements = false, skipProduction = false) {
		this.inGameTime += deltaTime;

		// Production - atoms per second scaled by deltaTime
		const production = skipProduction ? 0 : this.atomsPerSecond * (deltaTime / 1000);
		if (production > 0) {
			this.addAtoms(production);
		}

		// Auto-click atoms
		if (this.settings.automation.autoClick && this.autoClicksPerSecond > 0) {
			const autoClicks = this.autoClicksPerSecond * (deltaTime / 1000);
			this.addAtoms(this.clickPower * autoClicks);
		}

		// Update highest APS
		if (this.atomsPerSecond > this.highestAPS) {
			this.highestAPS = this.atomsPerSecond;
		}

		// Process radiation decay
		radiationManager.tick(deltaTime);

		// Check achievements
		if (!skipAchievements) {
			const unlocked = this.unlockedAchievementIds;
			for (const [id, achievement] of ACHIEVEMENT_ENTRIES) {
				if (!unlocked.has(id) && achievement.condition(this)) {
					this.unlockAchievement(id);
				}
			}
		}

		// Reassigning unconditionally would invalidate the whole production chain on every tick a power-up is live.
		if (this.activePowerUps.length > 0) {
			const expireTime = this.inGameTime;
			const remaining = this.activePowerUps.filter(p => expireTime - (p.startTime ?? 0) < p.duration);
			if (remaining.length !== this.activePowerUps.length) this.activePowerUps = remaining;
		}
	}

	// Intervals
	setupInterval() {
		if (this.gameInterval) clearInterval(this.gameInterval);

		this.gameInterval = setInterval(() => {
			this.tick(1000, false, true);
		}, 1000);
	}
}

export const gameManager = new GameManager();
