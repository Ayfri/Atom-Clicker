import { ACHIEVEMENTS, ACHIEVEMENT_ENTRIES } from '#data/achievements.js';
import { CHROMATIC_BASE_SPAWN_INTERVAL, CHROMATIC_UPGRADES, type ChromaticColor } from '#data/chromatic.js';
import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
import type { DailyQuestContext, DailyStats } from '#data/dailyQuests.js';
import { FeatureTypes } from '#data/features.js';
import { type GeneratorType, GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES, GENERATORS, getGeneratorLevelMultiplier } from '#data/generators.js';
import { ALL_PHOTON_UPGRADES, getPhotonUpgradeCost } from '#data/photonUpgrades.js';
import { POWER_UP_DEFAULT_INTERVAL, POWER_UP_MIN_INTERVAL } from '#data/powerUp.js';
import { REALMS, RealmTypes } from '#data/realms.js';
import { SKILL_UPGRADES } from '#data/skillTree.js';
import { UPGRADES } from '#data/upgrades.js';
import { ELECTRONS_PROTONS_REQUIRED, GENERATOR_COST_MULTIPLIER, MAX_BOOST_POINTS, PROTONS_ATOMS_REQUIRED, XP_PER_ATOM } from '#lib/constants.js';
import type {
	ChromaticState,
	CurrencyBoosts,
	EffectSource,
	FeatureState,
	GameState,
	Generator,
	OfflineProgressSummary,
	PowerUp,
	Price,
	RealmState,
	Settings,
	SkillUpgrade,
} from '#lib/types.js';
import { numberNotation } from '#lib/utils.js';
import { setItem } from '#lib/utils/safeLocalStorage.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { EffectTable } from '#helpers/effects.js';
import { FeaturesManager } from '#helpers/FeaturesManager.svelte.js';
import { applyOfflineProgress } from '#helpers/offlineProgress.js';
import { checkStatePlausibility } from '#helpers/plausibility.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import { realmManager } from '#helpers/RealmManager.svelte.js';
import { SAVE_KEY, SAVE_VERSION, loadSavedState, serializeSaveState } from '#helpers/saves.js';
import { LAYERS, type LayerType, statsConfig } from '#helpers/statConstants.js';
import { TutorialManager } from '#helpers/TutorialManager.svelte.js';
import { levelFromTotalXP, totalXPForLevel, xpForLevel } from '#helpers/xp.js';
import { leaderboard } from '#stores/leaderboard.svelte.js';
import { saveRecovery } from '#stores/saveRecovery.svelte.js';
import { toastStore } from '#stores/toasts.svelte.js';

const AUTO_PURCHASE_BASE_INTERVAL = 30_000;
const AUTO_PURCHASE_MIN_INTERVAL = 1000;
const STABILITY_BASE_TIME_MS = 600_000;

/** `tick` already drops expired power-ups on `clock`, so this timer only adds sub-second precision and must never hold a headless runtime open. */
function scheduleExpiry(callback: () => void, delay: number) {
	const timer = setTimeout(callback, delay) as ReturnType<typeof setTimeout> & { unref?: () => void };
	timer.unref?.();
}

export class GameManager {
	achievements = $state.raw<string[]>([]);
	activePowerUps = $state.raw<PowerUp[]>([]);
	/** Guards dailyStats increments during applyOfflineProgress, which reuses purchaseGenerator/purchaseUpgrade directly. */
	applyingOfflineProgress = false;
	/** The simulation swaps this for its own clock, a 24h benchmark run finishes in seconds of wall time. */
	clock: () => number = () => Date.now();
	/** Pushed in by ColliderManager, it stays at 0 in the simulation, which has no server to read the shared counter from. */
	colliderBonus = $state(0);
	currencyBoosts = $state.raw<CurrencyBoosts>({});
	dailyStats = $state<DailyStats>(structuredClone(statsConfig.dailyStats.defaultValue));
	featuresManager = new FeaturesManager();
	generators = $state.raw<Partial<Record<GeneratorType, Generator>>>({});
	highestAPS = $state(0);
	/** Best rate since the last Electronize, which sets the daily atoms quest: the all-time best can sit 60+ orders above a fresh run. */
	highestAPSRun = $state(0);
	inGameTime = $state(0);
	/** Saved and sticky: the next save re-signs an edited payload, so a reload would otherwise clear a checksum mismatch. */
	integrityFlagged = $state(false);
	lastInteractionTime = $state(Date.now());
	lastSave = $state(Date.now());
	offlineProgressSummary = $state<OfflineProgressSummary | null>(null);
	photonUpgrades = $state.raw<Record<string, number>>({});
	powerUpsCollected = $state(0);
	/** Pushed in by QuarksManager, which GameManager never imports so the simulation worker stays free of fetch and auth code. */
	quarkBoostSources = $state<EffectSource[]>([]);
	/** Owned Quark shop item ids, gating prestige-persistence behaviors the effect pipeline can't express. */
	quarkEntitlements = $state<string[]>([]);
	realms = $state<Record<string, RealmState>>(structuredClone(statsConfig.realms.defaultValue));
	saveIntegrityWarnings = $state<string[]>([]);
	settings = $state<Settings>(structuredClone(statsConfig.settings.defaultValue));
	skillUpgrades = $state.raw<string[]>([]);
	startDate = $state(Date.now());
	totalClicksAllTime = $state(0);
	totalClicksRun = $state(0);
	totalElectronizesAllTime = $state(0);
	totalElectronizesRun = $state(0);
	totalGeneratorsPurchasedAllTime = $state(0);
	totalProtonisesAllTime = $state(0);
	totalProtonisesRun = $state(0);
	totalUpgradesPurchasedAllTime = $state(0);
	totalXP = $state(0);
	tutorialManager = new TutorialManager();
	upgrades = $state.raw<string[]>([]);

	private gameInterval: ReturnType<typeof setInterval> | null = null;

	get atoms() {
		return currenciesManager.getAmount(CurrenciesTypes.ATOMS);
	}

	/** ChromaticManager owns the colored photon state, these accessors only expose it to the save and reset loops. */
	get chromatic(): ChromaticState {
		return chromaticManager.getState();
	}
	set chromatic(state: ChromaticState) {
		chromaticManager.loadState(state);
	}

	get chromaticUpgrades() {
		return chromaticManager.upgradeLevels;
	}
	set chromaticUpgrades(levels: Record<string, number>) {
		chromaticManager.upgradeLevels = levels;
	}

	get currencies() {
		return currenciesManager.currencies;
	}
	/** A save from before a currency existed has no entry for it, which `add` would crash on. */
	set currencies(value) {
		for (const type of Object.values(CurrenciesTypes)) value[type] ??= { amount: 0, earnedAllTime: 0, earnedRun: 0 };
		currenciesManager.currencies = value;
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
	set features(value: FeatureState) {
		this.featuresManager.state = value;
	}

	get photons() {
		return currenciesManager.getAmount(CurrenciesTypes.PHOTONS);
	}

	get protons() {
		return currenciesManager.getAmount(CurrenciesTypes.PROTONS);
	}

	/** RadiationManager owns the count since it sets the ionization line, this accessor exposes it to the save and reset loops. */
	get totalIonizesAllTime() {
		return radiationManager.ionizes;
	}
	set totalIonizesAllTime(count: number) {
		radiationManager.ionizes = count;
	}

	/** RadiationManager owns the levels, this accessor only exposes them to the save and reset loops. */
	get radiationUpgrades() {
		return radiationManager.upgradeLevels;
	}
	set radiationUpgrades(levels: Record<string, number>) {
		radiationManager.upgradeLevels = levels;
	}

	allEffectSources = $derived.by((): EffectSource[] => {
		const photonUpgrades = Object.entries(this.photonUpgrades).flatMap(([id, level]) => {
			const upgrade = ALL_PHOTON_UPGRADES[id];
			return level > 0 && upgrade ? [{ effects: upgrade.effects(level), id, name: upgrade.name }] : [];
		});
		const chromaticUpgrades = Object.entries(this.chromaticUpgrades).flatMap(([id, level]) => {
			const upgrade = CHROMATIC_UPGRADES[id];
			return level > 0 && upgrade?.effects ? [{ effects: upgrade.effects(level), id, name: upgrade.name }] : [];
		});
		return [...this.currentUpgradesBought, ...photonUpgrades, ...chromaticUpgrades, ...this.quarkBoostSources];
	});

	/** Rebuilt only on a purchase, every stat below reads its value from here. */
	effects = $derived(new EffectTable(this.allEffectSources));

	/** Achievement conditions read these every sweep, so the totals are folded once per generators change. */
	generatorTotals = $derived.by(() => {
		let count = 0;
		let levels = 0;
		for (const generator of Object.values(this.generators)) {
			if (!generator) continue;
			count += generator.count;
			levels += generator.level;
		}
		return { count, levels };
	});

	playerLevel = $derived(levelFromTotalXP(this.totalXP));

	radiationMultiplier = $derived(radiationManager.radiationMultiplier);

	atomsPerSecond = $derived.by(() => {
		let baseProduction = 0;
		for (const production of Object.values(this.generatorProductions)) baseProduction += production;
		return baseProduction * this.getCurrencyBoostMultiplier(CurrenciesTypes.ATOMS);
	});

	/** Auto-buy period of each generator the player automated, in the order its upgrades were bought. */
	autoBuyIntervals = $derived.by(() => {
		const intervals: Partial<Record<GeneratorType, number>> = {};
		const speed = this.effects.value('auto_speed', 1, this);
		for (const target of this.effects.targets('auto_buy')) {
			if (!this.settings.automation.generators.includes(target)) continue;
			intervals[target] = Math.max(AUTO_PURCHASE_MIN_INTERVAL, this.effects.value('auto_buy', AUTO_PURCHASE_BASE_INTERVAL, this, target)) / speed;
		}
		return intervals;
	});

	autoClicksPerSecond = $derived(this.settings.automation.autoClick ? this.effects.value('auto_click', 0, this) : 0);

	autoUpgradeInterval = $derived(
		this.settings.automation.upgrades && this.effects.has('auto_upgrade')
			? Math.max(AUTO_PURCHASE_MIN_INTERVAL, this.effects.value('auto_upgrade', AUTO_PURCHASE_BASE_INTERVAL, this))
			: 0,
	);

	bonusMultiplier = $derived(this.activePowerUps.reduce((acc, powerUp) => acc * powerUp.multiplier, 1));

	/** One currency boost point per generator level, each worth 10%, capped at MAX_BOOST_POINTS per currency. */
	boostPointsTotal = $derived(this.generatorTotals.levels);

	boostPointsUsed = $derived(Object.values(this.currencyBoosts).reduce((sum, points) => sum + (points ?? 0), 0));

	boostPointsAvailable = $derived(this.boostPointsTotal - this.boostPointsUsed);

	canProtonise = $derived(this.atoms >= PROTONS_ATOMS_REQUIRED || this.protons > 0);

	/** The share of atoms per second stays outside the click multipliers, which would otherwise scale it by ~250,000x late game. */
	clickPower = $derived(
		(this.effects.value('click', 1, this) + this.effects.value('click_aps', 0, this) * this.atomsPerSecond) * this.bonusMultiplier,
	);

	currentLevelXP = $derived(Math.max(0, this.totalXP - totalXPForLevel(this.playerLevel)));

	currentUpgradesBought = $derived([...this.upgrades, ...this.skillUpgrades].flatMap(id => UPGRADES[id] ?? SKILL_UPGRADES[id] ?? []));

	/** Multiplies the whole electron gain by one more per decade of protons past the threshold: 1e9 gives x1, 1e12 gives x4. */
	electronizeBaseGain = $derived(this.protons < ELECTRONS_PROTONS_REQUIRED ? 0 : Math.floor(1 + Math.log10(this.protons / ELECTRONS_PROTONS_REQUIRED)));

	electronizeElectronsGain = $derived(
		this.electronizeBaseGain * this.effects.value('electron_gain', 1, this) * this.getCurrencyBoostMultiplier(CurrenciesTypes.ELECTRONS),
	);

	excitedPhotonChance = $derived(this.effects.value('excited_photon_chance', 0.002, this));

	excitedPhotonDoubleChance = $derived(this.effects.value('excited_photon_double', 0, this));

	excitedPhotonFromMaxBonus = $derived(this.effects.value('excited_photon_from_max', 0, this));

	generatorProductions = $derived.by(() => {
		const productions = {} as Record<GeneratorType, number>;
		for (const type of GENERATOR_TYPES) productions[type] = (this.generators[type]?.count ?? 0) * this.generatorUnitProductions[type];
		return productions;
	});

	/** Atoms per second of one generator of each type at its current count and level, owned or not, so the panel can preview a first purchase. */
	generatorUnitProductions = $derived.by(() => {
		const productions = {} as Record<GeneratorType, number>;
		const commonMultiplier = this.globalMultiplier * this.bonusMultiplier * this.stabilityMultiplier;
		for (const type of GENERATOR_TYPES) {
			const generator = this.generators[type];
			const rate = this.effects.value('generator', GENERATORS[type].rate, this, type);
			productions[type] = rate * getGeneratorLevelMultiplier(generator?.count ?? 0, generator?.level ?? 0) * commonMultiplier;
		}
		return productions;
	});

	globalMultiplier = $derived(this.effects.value('global', 1, this) * this.radiationMultiplier);

	hasAvailableSkillUpgrades = $derived(Object.values(SKILL_UPGRADES).some(skill => this.canPurchaseSkill(skill)));

	hasBonus = $derived(this.activePowerUps.length > 0);

	nextLevelXP = $derived(xpForLevel(this.playerLevel + 1));

	photonAutoClicksPer5Seconds = $derived(this.settings.automation.autoClickPhotons ? this.effects.value('photon_auto_click', 0, this) : 0);

	photonDoubleChance = $derived(this.effects.value('photon_double_chance', 0, this));

	photonSpawnInterval = $derived(this.effects.value('photon_spawn_interval', 2000, this));

	/** Summing a `$state` record walks the proxy for every key, and the milestone check reads this on every tick. */
	photonUpgradeLevels = $derived(Object.values(this.photonUpgrades).reduce((sum, level) => sum + (level ?? 0), 0));

	photonValueBonus = $derived(this.effects.value('photon_value', 0, this));

	powerUpDurationMultiplier = $derived(this.effects.value('power_up_duration', 1, this));

	powerUpEffectMultiplier = $derived(this.effects.value('power_up_multiplier', 1, this));

	powerUpInterval = $derived(
		POWER_UP_DEFAULT_INTERVAL.map(interval => Math.max(POWER_UP_MIN_INTERVAL, this.effects.value('power_up_interval', interval, this))) as [
			number,
			number,
		],
	);

	protoniseProtonsGain = $derived(
		this.atoms < PROTONS_ATOMS_REQUIRED
			? 0
			: this.effects.value('proton_gain', Math.floor(Math.sqrt(this.atoms / PROTONS_ATOMS_REQUIRED)), this) *
					this.getCurrencyBoostMultiplier(CurrenciesTypes.PROTONS),
	);

	stabilityCapacity = $derived(this.effects.value('stability_capacity', 1, this));

	stabilityMaxBoost = $derived(this.effects.value('stability_boost', 2, this));

	/** Full Stability Field multiplier, reached once `stabilityProgress` hits 1. */
	stabilityMax = $derived(1 + (this.stabilityMaxBoost - 1) * this.stabilityCapacity);

	/** 0 to 1 share of the idle time needed to fill the field. */
	stabilityProgress = $derived.by(() => {
		/** `clock` isn't reactive, reading inGameTime re-runs this every tick. */
		this.inGameTime;
		return Math.min(Math.max((this.clock() - this.lastInteractionTime) / this.stabilityTimeRequired, 0), 1);
	});

	/** Fills linearly while idle, up to `stabilityMax`, paused while a power-up is live. */
	stabilityMultiplier = $derived(
		!this.features[FeatureTypes.STABILITY_FIELD] || this.activePowerUps.length > 0 ? 1 : 1 + (this.stabilityMax - 1) * this.stabilityProgress,
	);

	stabilitySpeed = $derived(this.effects.value('stability_speed', 1, this));

	/** Idle time to fill the stability field: 10 minutes, stretched by capacity and shortened by speed. */
	stabilityTimeRequired = $derived((STABILITY_BASE_TIME_MS * this.stabilityCapacity) / this.stabilitySpeed);

	totalUsers = $derived(leaderboard.stats.totalUsers);

	/** Membership lookups run over every achievement each tick, so the array is mirrored into a set once per change. */
	unlockedAchievementIds = $derived(new Set(this.achievements));

	xpGainMultiplier = $derived(this.effects.value('xp_gain', 1, this));

	xpProgress = $derived((this.currentLevelXP / this.nextLevelXP) * 100);

	addAtoms(amount: number) {
		currenciesManager.add(CurrenciesTypes.ATOMS, amount);
		if (amount <= 0) return;
		if (this.features[FeatureTypes.LEVELS]) this.totalXP += amount * XP_PER_ATOM * this.xpGainMultiplier;
		this.dailyStats.atomsEarned += amount;
	}

	addCurrencyBoost(currency: CurrencyName): boolean {
		const points = this.currencyBoosts[currency] ?? 0;
		if (this.boostPointsAvailable <= 0 || points >= MAX_BOOST_POINTS) return false;
		this.currencyBoosts = { ...this.currencyBoosts, [currency]: points + 1 };
		return true;
	}

	addPowerUp(powerUp: PowerUp) {
		const newPowerUp = { ...powerUp, startTime: powerUp.startTime || this.clock() };
		this.activePowerUps = [...this.activePowerUps, newPowerUp];
		this.powerUpsCollected++;
		this.dailyStats.powerUpsCollected++;
		if (!this.features[FeatureTypes.STABLE_BONUS_CLICK]) this.lastInteractionTime = this.clock();
		scheduleExpiry(() => this.removePowerUp(newPowerUp.id), newPowerUp.duration);
	}

	assignAllCurrencyBoosts(currency: CurrencyName) {
		const points = this.currencyBoosts[currency] ?? 0;
		const added = Math.min(this.boostPointsAvailable, MAX_BOOST_POINTS - points);
		if (added > 0) this.currencyBoosts = { ...this.currencyBoosts, [currency]: points + added };
	}

	canAfford(price: Price): boolean {
		return currenciesManager.getAmount(price.currency) >= price.amount;
	}

	canPurchaseSkill(skill: SkillUpgrade): boolean {
		return (
			!this.skillUpgrades.includes(skill.id) &&
			(skill.requires?.every(id => this.skillUpgrades.includes(id)) ?? true) &&
			(skill.condition?.(this) ?? true) &&
			this.canAfford(skill.cost)
		);
	}

	checkRealmUnlocks() {
		for (const { condition, id } of Object.values(REALMS)) {
			this.realms[id] ??= { unlocked: false };
			if (!this.realms[id].unlocked && condition(this.features)) this.realms[id].unlocked = true;
		}
	}

	cleanup() {
		if (this.gameInterval) clearInterval(this.gameInterval);
	}

	/** Pays away time at the offline rates, since the last save on load or `awayMs` of a frozen tab, and returns whether any was paid. */
	catchUpOffline(awayMs?: number): boolean {
		/** A power-up still live now ran through the whole absence, an expired one must not multiply it. */
		this.dropExpiredPowerUps();
		this.applyingOfflineProgress = true;
		const summary = applyOfflineProgress(this, awayMs);
		this.applyingOfflineProgress = false;
		if (summary) this.offlineProgressSummary = summary;
		return summary !== null;
	}

	clearOfflineProgressSummary() {
		this.offlineProgressSummary = null;
	}

	/** Counts colored photon breaks for the daily quests, the simulation passes fractional ones. */
	countChromaticBreak(color: ChromaticColor, amount = 1) {
		this.dailyStats.chromaticBreaks = (this.dailyStats.chromaticBreaks ?? 0) + amount;
		(this.dailyStats.chromaticColorBreaks ??= { blue: 0, green: 0, red: 0 })[color] += amount;
	}

	/** What the daily quest pool filters and scales on, shared by QuarksManager and the simulation so both offer the same quests. */
	dailyQuestContext(hasThirdQuestSlot: boolean): DailyQuestContext {
		return {
			chromaticSpawnBoost: CHROMATIC_BASE_SPAWN_INTERVAL / chromaticManager.spawnInterval,
			fuelAffordable: (this.electrons + this.electronizeElectronsGain) * radiationManager.massPerElectron,
			hasElectronized: this.totalElectronizesAllTime > 0,
			hasPhotonRealm: this.realms[RealmTypes.PHOTONS]?.unlocked ?? false,
			hasPrism: this.totalIonizesAllTime > 0,
			hasRadiationRealm: this.realms[RealmTypes.RADIATION]?.unlocked ?? false,
			hasThirdQuestSlot,
			highestAPSRun: this.highestAPSRun,
			remainingAchievements: ACHIEVEMENT_ENTRIES.filter(([id]) => !this.unlockedAchievementIds.has(id)).length,
		};
	}

	/** Reassigning unconditionally would invalidate the whole production chain on every tick a power-up is live. */
	private dropExpiredPowerUps() {
		if (this.activePowerUps.length === 0) return;
		const now = this.clock();
		const remaining = this.activePowerUps.filter(p => now - (p.startTime ?? 0) < p.duration);
		if (remaining.length !== this.activePowerUps.length) this.activePowerUps = remaining;
	}

	electronize() {
		if (this.protons < ELECTRONS_PROTONS_REQUIRED) return false;
		this.totalElectronizesAllTime++;
		this.totalElectronizesRun++;
		this.dailyStats.electronizes = (this.dailyStats.electronizes ?? 0) + 1;
		this.prestige(LAYERS.ELECTRONIZE, { amount: this.electronizeElectronsGain, currency: CurrenciesTypes.ELECTRONS });
		this.save();
		return true;
	}

	/**
	 * Layer 4 prestige once the reactor held its ionization line for a minute. The core and the electrons that fuel it are emptied too,
	 * neither resets by layer, and a kept electron bank refuelled the reactor for another Ionize a minute later.
	 */
	ionize() {
		if (!radiationManager.ionizeReady) return false;
		this.totalIonizesAllTime++;
		this.prestige(LAYERS.RADIATION_REALM);
		currenciesManager.remove(CurrenciesTypes.ELECTRONS, this.electrons);
		this.totalElectronizesRun = 0;
		radiationManager.reset();
		this.save();
		return true;
	}

	getCurrencyBoostMultiplier(currency: CurrencyName): number {
		return 1 + (this.currencyBoosts[currency] ?? 0) * 0.1;
	}

	getCurrentState(): GameState {
		return {
			achievements: this.achievements,
			activePowerUps: this.activePowerUps,
			chromatic: this.chromatic,
			chromaticUpgrades: this.chromaticUpgrades,
			currencies: this.currencies,
			currencyBoosts: this.currencyBoosts,
			dailyStats: this.dailyStats,
			features: this.features,
			generators: this.generators,
			highestAPS: this.highestAPS,
			highestAPSRun: this.highestAPSRun,
			inGameTime: this.inGameTime,
			integrityFlagged: this.integrityFlagged,
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
			totalClicksAllTime: this.totalClicksAllTime,
			totalClicksRun: this.totalClicksRun,
			totalElectronizesAllTime: this.totalElectronizesAllTime,
			totalElectronizesRun: this.totalElectronizesRun,
			totalGeneratorsPurchasedAllTime: this.totalGeneratorsPurchasedAllTime,
			totalIonizesAllTime: this.totalIonizesAllTime,
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

	getGeneratorCost(type: GeneratorType, amount: number): number {
		const r = GENERATOR_COST_MULTIPLIER;
		const next = GENERATORS[type].cost.amount * r ** (this.generators[type]?.count ?? 0);
		return Math.round((next * (r ** amount - 1)) / (r - 1));
	}

	getMaxAffordableGenerator(type: GeneratorType): number {
		const { cost } = GENERATORS[type];
		const r = GENERATOR_COST_MULTIPLIER;
		const next = cost.amount * r ** (this.generators[type]?.count ?? 0);
		const owned = currenciesManager.getAmount(cost.currency);
		let max = Math.floor(Math.log((owned * (r - 1)) / next + 1) / Math.log(r));
		if (!Number.isFinite(max)) return max;
		/** The log inverts the exact sum while getGeneratorCost charges it rounded, so the edges move to the count that rounded cost allows. */
		while (this.getGeneratorCost(type, max + 1) <= owned) max++;
		while (max > 0 && this.getGeneratorCost(type, max) > owned) max--;
		return max;
	}

	incrementBonusHiggsBosonClicks() {
		currenciesManager.add(CurrenciesTypes.HIGGS_BOSON, 1);
		this.dailyStats.higgsBosonsCollected = (this.dailyStats.higgsBosonsCollected ?? 0) + 1;
		if (!this.features[FeatureTypes.STABLE_BONUS_CLICK]) this.lastInteractionTime = this.clock();
	}

	incrementClicks(isAuto = false, count = 1) {
		this.totalClicksRun += count;
		this.totalClicksAllTime += count;
		this.dailyStats.clicks += count;
		if (!this.features[isAuto ? FeatureTypes.STABLE_ATOM_AUTO_CLICK : FeatureTypes.STABLE_ATOM_CLICK]) this.lastInteractionTime = this.clock();
	}

	/** Feeds the reactor and counts the fuel toward the daily quest. */
	injectFuel(electrons: number): boolean {
		if (!radiationManager.bombardCore(electrons)) return false;
		this.dailyStats.fuelInjected = (this.dailyStats.fuelInjected ?? 0) + electrons * radiationManager.massPerElectron;
		return true;
	}

	initialize() {
		this.loadGame();
		this.setupInterval();
	}

	loadGame() {
		const result = loadSavedState();

		if (!result.success || !result.state) {
			if (result.success || !result.errorType) return;
			saveRecovery.setError(result.errorType, result.errorDetails || 'Unknown error loading save', result.rawData ?? null);
			console.error('Save load failed:', result.errorType, result.errorDetails);
			return;
		}

		this.loadSaveData(result.state);
		this.syncFeatures();
		this.checkRealmUnlocks();
		if (result.integrityTampered) this.integrityFlagged = true;
		this.reportIntegrity(result.integrityWarnings ?? []);
		this.catchUpOffline();
		this.save();
	}

	/** Replaces the game with a cloud save, syncing features and realms like a local load and writing it to this device at once. */
	loadCloudSave(state: GameState) {
		const flagged = this.integrityFlagged;
		this.loadSaveData(state);
		this.integrityFlagged ||= flagged;
		this.syncFeatures();
		this.checkRealmUnlocks();
		this.reportIntegrity(checkStatePlausibility(state));
		this.save();
	}

	private reportIntegrity(warnings: string[]) {
		this.saveIntegrityWarnings = warnings;
		if (!this.integrityFlagged && warnings.length === 0) return;
		console.warn('Save integrity check flagged this save:', { flagged: this.integrityFlagged, warnings });
		toastStore.warning({
			message: 'This save looks like it was edited outside the game, so it no longer submits to the leaderboard.',
			title: 'Save check',
		});
	}

	loadSaveData(data: Partial<GameState>) {
		for (const key of Object.keys(statsConfig)) {
			if (!(key in data)) continue;
			switch (key) {
				case 'currencyBoosts':
					this.currencyBoosts = data.currencyBoosts ?? {};
					break;
				case 'radiation':
					if (data.radiation) radiationManager.loadState(data.radiation, data.radiationUpgrades ?? {});
					break;
				case 'radiationUpgrades':
					this.radiationUpgrades = data.radiationUpgrades ?? {};
					break;
				case 'selectedRealmId':
					if (data.selectedRealmId) realmManager.selectRealm(data.selectedRealmId);
					break;
				case 'settings': {
					const defaults = statsConfig.settings.defaultValue;
					const saved = data.settings;
					this.settings = {
						...defaults,
						...saved,
						automation: { ...defaults.automation, ...saved?.automation },
						display: { ...defaults.display, ...saved?.display },
						gameplay: { ...defaults.gameplay, ...saved?.gameplay },
						upgrades: { ...defaults.upgrades, ...saved?.upgrades },
					};
					break;
				}
				case 'tutorial':
					this.tutorialManager.state = { ...statsConfig.tutorial.defaultValue, ...data.tutorial };
					break;
				default:
					Reflect.set(this, key, data[key as keyof GameState]);
			}
		}
		if (data.lastInteractionTime) this.lastInteractionTime = data.lastInteractionTime;

		if (this.activePowerUps.length === 0) return;
		const now = this.clock();
		this.activePowerUps = this.activePowerUps.filter(p => p.startTime && now < p.startTime + p.duration);
		for (const p of this.activePowerUps) scheduleExpiry(() => this.removePowerUp(p.id), p.startTime + p.duration - now);
	}

	/** Upgrades paid in protons or electrons survive every prestige and photon upgrades survive Ionize, skills never reset. */
	private prestige(layer: LayerType, gain?: Price) {
		const upgrades = this.upgrades.filter(id => {
			const currency = UPGRADES[id]?.cost.currency;
			return currency === CurrenciesTypes.PROTONS || currency === CurrenciesTypes.ELECTRONS;
		});
		const photonUpgrades = this.photonUpgrades;

		this.resetLayer(layer);
		this.upgrades = upgrades;
		this.photonUpgrades = photonUpgrades;
		this.syncFeatures();
		this.checkRealmUnlocks();
		if (gain) currenciesManager.add(gain.currency, gain.amount);
		this.lastInteractionTime = this.clock();
	}

	protonise() {
		if (this.atoms < PROTONS_ATOMS_REQUIRED) return false;
		this.totalProtonisesAllTime++;
		this.totalProtonisesRun++;
		this.dailyStats.protonises++;
		this.prestige(LAYERS.PROTONIZER, { amount: this.protoniseProtonsGain, currency: CurrenciesTypes.PROTONS });
		currenciesManager.add(CurrenciesTypes.ATOMS, this.effects.value('start_atoms', 0, this));
		this.save();
		return true;
	}

	/** Buys every affordable upgrade, cheapest first, the way auto-upgrade does online and offline. Returns the purchased ids. */
	purchaseAffordableUpgrades(): string[] {
		const owned = new Set(this.upgrades);
		const candidates = Object.values(UPGRADES)
			.filter(upgrade => !owned.has(upgrade.id) && (upgrade.condition?.(this) ?? true))
			.sort((a, b) => a.cost.amount - b.cost.amount);
		const purchased: string[] = [];
		for (const upgrade of candidates) {
			if (this.canAfford(upgrade.cost) && this.purchaseUpgrade(upgrade.id)) purchased.push(upgrade.id);
		}
		return purchased;
	}

	purchaseGenerator(type: GeneratorType, amount = 1) {
		/** An overflowed bank makes Max infinite, and Infinity - Infinity would store NaN atoms. */
		if (!Number.isSafeInteger(amount) || amount < 1) return false;
		if (!this.spendCurrency({ amount: this.getGeneratorCost(type, amount), currency: GENERATORS[type].cost.currency })) return false;

		const count = (this.generators[type]?.count ?? 0) + amount;
		this.generators = { ...this.generators, [type]: { count, level: Math.floor(count / GENERATOR_LEVEL_UP_COST), unlocked: true } };
		this.totalGeneratorsPurchasedAllTime += amount;
		if (!this.applyingOfflineProgress) this.dailyStats.generatorsPurchased += amount;
		return true;
	}

	purchasePhotonUpgrade(upgradeId: string) {
		const upgrade = ALL_PHOTON_UPGRADES[upgradeId];
		const level = this.photonUpgrades[upgradeId] ?? 0;
		if (!upgrade || level >= upgrade.maxLevel || !(upgrade.condition?.(this) ?? true)) return false;
		if (!this.spendCurrency({ amount: getPhotonUpgradeCost(upgrade, level), currency: upgrade.currency || CurrenciesTypes.PHOTONS })) return false;

		this.photonUpgrades = { ...this.photonUpgrades, [upgradeId]: level + 1 };
		this.syncFeatures();
		this.checkRealmUnlocks();
		return true;
	}

	purchaseSkill(skillId: string) {
		const skill = SKILL_UPGRADES[skillId];
		if (!skill || !this.canPurchaseSkill(skill) || !this.spendCurrency(skill.cost)) return false;

		this.skillUpgrades = [...this.skillUpgrades, skillId];
		this.syncFeatures();
		this.checkRealmUnlocks();
		return true;
	}

	purchaseUpgrade(id: string) {
		const upgrade = UPGRADES[id];
		if (!upgrade || this.upgrades.includes(id) || !(upgrade.condition?.(this) ?? true) || !this.spendCurrency(upgrade.cost)) return false;

		this.upgrades = [...this.upgrades, id];
		this.syncFeatures();
		this.checkRealmUnlocks();
		this.totalUpgradesPurchasedAllTime++;
		if (!this.applyingOfflineProgress) this.dailyStats.upgradesPurchased++;
		return true;
	}

	removeCurrencyBoost(currency: CurrencyName): boolean {
		const points = this.currencyBoosts[currency] ?? 0;
		if (points <= 0) return false;
		this.currencyBoosts = { ...this.currencyBoosts, [currency]: points - 1 };
		return true;
	}

	removePowerUp(id: string) {
		this.activePowerUps = this.activePowerUps.filter(p => p.id !== id);
	}

	reset() {
		this.resetAll();
		this.saveIntegrityWarnings = [];
		this.startDate = Date.now();
		this.save();
	}

	resetAll() {
		for (const [key, config] of Object.entries(statsConfig)) this.resetStat(key, config.defaultValue);
	}

	resetCurrencyBoosts() {
		this.currencyBoosts = {};
	}

	resetLayer(layer: LayerType) {
		const keepBoosts = this.quarkEntitlements.includes('convenience_keep_currency_boosts');
		for (const [key, config] of Object.entries(statsConfig)) {
			if (config.layer <= 0 || config.layer > layer || (key === 'currencyBoosts' && keepBoosts)) continue;
			this.resetStat(key, config.defaultValue);
		}
		currenciesManager.reset(layer);
	}

	private resetStat(key: string, defaultValue: unknown) {
		switch (key) {
			case 'currencies':
				currenciesManager.hardReset();
				break;
			case 'features':
				this.featuresManager.reset();
				break;
			case 'radiation':
				radiationManager.loadState({ ...statsConfig.radiation.defaultValue, lastTick: Date.now() }, {});
				break;
			case 'selectedRealmId':
				realmManager.selectRealm(RealmTypes.ATOMS);
				break;
			case 'tutorial':
				this.tutorialManager.reset();
				break;
			default:
				Reflect.set(this, key, structuredClone(defaultValue));
		}
	}

	save() {
		this.lastSave = Date.now();
		setItem(SAVE_KEY, serializeSaveState(this.getCurrentState()));
	}

	setupInterval() {
		this.cleanup();
		this.gameInterval = setInterval(() => this.tick(1000, false, true), 1000);
	}

	spendCurrency(price: Price): boolean {
		if (!this.canAfford(price)) return false;
		currenciesManager.remove(price.currency, price.amount);
		return true;
	}

	/** Reassigns every point round-robin over the given currencies so they end up within one point of each other. */
	splitCurrencyBoostsEvenly(currencies: CurrencyName[]) {
		if (currencies.length === 0) return;
		const boosts: CurrencyBoosts = {};
		let remaining = this.boostPointsTotal;
		for (let i = 0; remaining > 0 && i < currencies.length * MAX_BOOST_POINTS; i++) {
			const currency = currencies[i % currencies.length];
			const points = boosts[currency] ?? 0;
			if (points >= MAX_BOOST_POINTS) continue;
			boosts[currency] = points + 1;
			remaining--;
		}
		this.currencyBoosts = boosts;
	}

	syncFeatures() {
		this.featuresManager.syncFromState(this);
	}

	/**
	 * `skipProduction` is what the browser passes: there generator and auto-click atoms are summed per commit in
	 * `+page.svelte` for a smooth counter and XP bar, crediting them here too would pay them twice. The simulation has no
	 * commit loop and pays here.
	 */
	tick(deltaTime = 1000, skipAchievements = false, skipProduction = false) {
		const seconds = deltaTime / 1000;
		this.inGameTime += deltaTime;

		if (!skipProduction) {
			if (this.atomsPerSecond > 0) this.addAtoms(this.atomsPerSecond * seconds);
			if (this.autoClicksPerSecond > 0) this.addAtoms(this.clickPower * this.autoClicksPerSecond * seconds);
		}
		if (this.atomsPerSecond > this.highestAPS) this.highestAPS = this.atomsPerSecond;
		if (this.atomsPerSecond > this.highestAPSRun) this.highestAPSRun = this.atomsPerSecond;

		radiationManager.tick(deltaTime);

		if (!skipAchievements) {
			const unlocked = this.unlockedAchievementIds;
			for (const [id, achievement] of ACHIEVEMENT_ENTRIES) {
				if (!unlocked.has(id) && achievement.condition(this)) this.unlockAchievement(id);
			}
		}

		this.dropExpiredPowerUps();
	}

	toggleAutoClick() {
		this.settings.automation.autoClick = !this.settings.automation.autoClick;
	}

	toggleAutoClickPhotons() {
		this.settings.automation.autoClickPhotons = !this.settings.automation.autoClickPhotons;
	}

	toggleAutomation(generatorType: GeneratorType) {
		const { automation } = this.settings;
		automation.generators =
			automation.generators.includes(generatorType) ?
				automation.generators.filter(type => type !== generatorType)
			:	[...automation.generators, generatorType];
	}

	toggleUpgradeAutomation() {
		this.settings.automation.upgrades = !this.settings.automation.upgrades;
	}

	unlockAchievement(achievementId: string) {
		if (this.achievements.includes(achievementId)) return;
		this.achievements = [...this.achievements, achievementId];
		this.dailyStats.achievementsUnlocked = (this.dailyStats.achievementsUnlocked ?? 0) + 1;
		const achievement = ACHIEVEMENTS[achievementId];
		if (achievement) {
			toastStore.info({
				duration: 10000,
				icon: achievement.iconStack ?? achievement.icon ?? 'Trophy',
				message: `${achievement.name}\n${achievement.description}`,
				title: 'Achievement unlocked',
			});
		}
	}

	unlockGenerator(type: GeneratorType) {
		if (type in this.generators) return;
		this.generators = { ...this.generators, [type]: { count: 0, level: 0, unlocked: true } };
	}
}

export const gameManager = new GameManager();
numberNotation.read = () => gameManager.settings.display.notation;
