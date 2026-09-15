import { ACHIEVEMENTS } from '$data/achievements';
import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { POWER_UPS } from '$data/powerUp';
import { QUARK_ACHIEVEMENT_REWARD } from '$data/quarkAchievements';
import { RealmTypes } from '$data/realms';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { foldEffects } from '$helpers/effects';
import { gameManager } from '$helpers/GameManager.svelte';
import { radiationManager } from '$helpers/RadiationManager.svelte';
import { connectDeriveds } from '$helpers/reactiveRoot.svelte';
import type { SkillUpgrade, Upgrade } from '$lib/types';
import { MILESTONE_ENTRIES, type MilestoneEntry } from './milestones';
import { PurchasePlanner } from './purchases';
import { DEFAULT_SEED, createRandom } from './random';
import { QuestTracker } from './quests';
import { createSnapshotData, fillMilestoneData, type RunState } from './snapshots';
import {
	DETAILED_ACTION_TYPES,
	type BenchmarkConfig,
	type MilestoneCheckData,
	type MilestoneHit,
	type SimulationAction,
	type SimulationActionType,
	type SimulationResult,
	type SimulationSnapshot,
	type SpikeEvent,
} from './types';

const CHUNK_SIZE = 500;
const YIELD_INTERVAL = 10;

const ACHIEVEMENT_ENTRIES = Object.entries(ACHIEVEMENTS);

export interface SimulationProgress {
	currentHour: number;
	estimatedTimeLeft: number;
	milestoneCount: number;
	percent: number;
	recentMilestones: MilestoneHit[];
	recentSpikes: SpikeEvent[];
	/** Only the snapshots taken since the previous callback: sending the whole array every time is quadratic. */
	newSnapshots: SimulationSnapshot[];
	ticksPerSecond: number;
	totalHours: number;
}

export type ProgressCallback = (progress: SimulationProgress) => void;

interface PhotonRealmEffects {
	excitedLifetimeMultiplier: number;
	excitedValue: number;
	lifetimeMs: number;
	normalValue: number;
}

export interface SimulationEngineOptions {
	/** Ticks between yields to the host event loop. 0 never yields, which is what a headless CLI run wants. */
	yieldInterval?: number;
}

const schedulerYield = (globalThis as any).scheduler?.yield as (() => Promise<void>) | undefined;
const yieldToMain: () => Promise<void> =
	typeof schedulerYield === 'function'
		? () => schedulerYield.call((globalThis as any).scheduler)
		: () => new Promise(resolve => setTimeout(resolve, 0));

// Photon realm geometry, mirrored from PhotonRealm.svelte: circles spawn on a timer, live a while, and cap out on screen.
const PHOTON_BASE_LIFETIME_MS = 5000;
const PHOTON_MAX_CIRCLES = 100;
const PHOTON_MAX_VALUE = 10;
const PHOTON_MIN_VALUE = 1;
const PHOTON_AVERAGE_VALUE = (PHOTON_MIN_VALUE + PHOTON_MAX_VALUE) / 2;

// Prestige budgets are a pacing limit per play session, not a lifetime cap.
const PRESTIGE_WINDOW_MS = 3_600_000;

const SPIKE_WINDOW_MS = 60_000;
const SPIKE_MIN_HISTORY = 5;
const SPIKE_MULTIPLIER = 4;
const SPIKE_MIN_RATE = 50;

export class SimulationEngine {
	private abortController: AbortController | null = null;
	private actionCounts: Partial<Record<SimulationActionType, number>> = {};
	private actions: SimulationAction[] = [];
	private activeNow = false;
	private config: BenchmarkConfig;
	private everPurchasedBuildings = new Set<string>();
	private ownedAchievements = new Set<string>();
	private pendingMilestones: MilestoneEntry[] = MILESTONE_ENTRIES;
	private lastElectronizeGain = 0;
	private lastProtoniseGain = 0;
	private lastWasActive = false;
	private milestones: MilestoneHit[] = [];
	private nextPowerUpTime = 0;
	private powerUpCounter = 0;
	private prestigesThisActiveWindow = 0;
	private prestigeWindowStart = 0;
	private planner = new PurchasePlanner();
	private quarksFromAchievements = 0;
	private quests: QuestTracker;
	private recentMilestones: MilestoneHit[] = [];
	private recentSpikes: SpikeEvent[] = [];
	private savedState: string | null = null;
	private snapshots: SimulationSnapshot[] = [];
	private snapshotsSent = 0;
	private spikeRateHistory: number[] = [];
	private spikes: SpikeEvent[] = [];
	private spikeWindowActions: SimulationAction[] = [];
	private spikeWindowAps = 0;
	private spikeWindowStart = 0;
	private yieldInterval: number;

	/** Uncollected circles on screen, as expected counts: the realm is a spawn-and-expire queue, not one payout per click. */
	private photonPoolExcited = 0;
	private photonPoolNormal = 0;
	private peakAtomsPerSecond = 0;
	private photonsExpired = 0;
	private photonEffects: PhotonRealmEffects | null = null;
	private photonEffectsSources: unknown = null;
	private photonEffectsStability = 0;
	private photonValueKey: unknown = null;
	private photonValueSources: (Upgrade | SkillUpgrade)[] = [];
	private milestoneScratch = {} as MilestoneCheckData;
	private runStateCache = {} as RunState;
	private random: () => number = createRandom(DEFAULT_SEED);

	constructor(config: BenchmarkConfig, options: SimulationEngineOptions = {}) {
		this.config = config;
		this.quests = new QuestTracker(config.botBehavior.questBehavior);
		this.yieldInterval = options.yieldInterval ?? YIELD_INTERVAL;
		this.random = createRandom(config.seed ?? DEFAULT_SEED);
	}

	/** Read on every tick by the milestone check, so the object is reused instead of rebuilt. */
	private get runState(): RunState {
		const state = this.runStateCache;
		state.actionCounts = this.actionCounts;
		state.actions = this.actions;
		state.everPurchasedBuildings = this.everPurchasedBuildings;
		state.peakAtomsPerSecond = this.peakAtomsPerSecond;
		state.photonsExpired = this.photonsExpired;
		state.quarksFromAchievements = this.quarksFromAchievements;
		state.quests = this.quests;
		return state;
	}

	cancel() {
		this.abortController?.abort();
	}

	async runAsync(onProgress?: ProgressCallback): Promise<SimulationResult> {
		this.abortController = new AbortController();
		const { signal } = this.abortController;

		const startRealTime = performance.now();
		const disconnect = connectDeriveds([gameManager, currenciesManager, radiationManager]);
		// Simulation mutates global game state; save and restore so main game is unchanged.
		this.savedState = JSON.stringify(gameManager.getCurrentState());
		gameManager.resetAll();
		currenciesManager.hardReset();
		// Every wall-clock read inside the game is swapped for the simulated clock, or the stability field and the
		// power-up bookkeeping would follow how fast the host machine happens to be running.
		gameManager.clock = () => gameManager.inGameTime;
		gameManager.lastInteractionTime = 0;
		radiationManager.random = () => this.random();

		// A real engaged player turns auto-click on as soon as upgrades unlock it; the derived returns 0 if no upgrade.
		if (!gameManager.settings.automation.autoClick) gameManager.toggleAutoClick();
		if (!gameManager.settings.automation.autoClickPhotons) gameManager.toggleAutoClickPhotons();
		this.actionCounts = {};
		this.actions = [];
		this.activeNow = false;
		this.planner.reset();
		this.quests.reset(this.config.botBehavior.questBehavior);
		this.random = createRandom(this.config.seed ?? DEFAULT_SEED);
		this.everPurchasedBuildings.clear();
		this.ownedAchievements = new Set(gameManager.achievements);
		this.pendingMilestones = MILESTONE_ENTRIES;
		this.lastElectronizeGain = 0;
		this.lastProtoniseGain = 0;
		this.lastWasActive = false;
		this.milestones = [];
		this.nextPowerUpTime = this.rollPowerUpInterval();
		this.photonEffects = null;
		this.photonEffectsSources = null;
		this.photonValueKey = null;
		this.photonPoolExcited = 0;
		this.photonPoolNormal = 0;
		this.peakAtomsPerSecond = 0;
		this.photonsExpired = 0;
		this.powerUpCounter = 0;
		this.prestigesThisActiveWindow = 0;
		this.prestigeWindowStart = 0;
		this.quarksFromAchievements = 0;
		this.recentMilestones = [];
		this.recentSpikes = [];
		this.snapshots = [];
		this.snapshotsSent = 0;
		this.spikeRateHistory = [];
		this.spikes = [];
		this.spikeWindowActions = [];
		this.spikeWindowAps = gameManager.atomsPerSecond;
		this.spikeWindowStart = 0;

		const totalGameTimeMs = this.config.targetHours * 3600 * 1000;
		const totalTicks = Math.floor(totalGameTimeMs / this.config.tickRate);
		const snapshotIntervalTicks = Math.floor((this.config.snapshotInterval * 1000) / this.config.tickRate);
		const achievementCheckInterval = Math.max(1, Math.round(1000 / this.config.tickRate));
		this.takeSnapshot();

		let lastProgressUpdate = startRealTime;
		let ticksSinceLastUpdate = 0;
		let lastTicksPerSecond = 0;
		let cancelled = false;
		const tickRate = this.config.tickRate;

		const yieldInterval = this.yieldInterval;

		try {
			for (let tick = 0; tick < totalTicks; tick++) {
				if (yieldInterval > 0 ? tick % yieldInterval === 0 : tick % CHUNK_SIZE === 0) {
					if (yieldInterval > 0) await yieldToMain();
					if (signal.aborted) {
						cancelled = true;
						break;
					}
				}
				gameManager.tick(tickRate, true);
				// Sampled per tick rather than per snapshot, and with the power-up bonus out, so the ratchet is honest.
				const rawAps = gameManager.atomsPerSecond / (gameManager.bonusMultiplier || 1);
				if (rawAps > this.peakAtomsPerSecond) this.peakAtomsPerSecond = rawAps;
				const activeNow = this.isInActiveWindow();
				this.activeNow = activeNow;
				this.simulateClicks();
				this.simulatePhotonRealm();
				this.tickPowerUps();
				this.quests.checkDayRollover();
				// An always-active run never crosses an inactive edge, so the budget also expires on a simulated-hour timer.
				const startsActiveWindow = activeNow && !this.lastWasActive;
				const windowExpired = gameManager.inGameTime - this.prestigeWindowStart >= PRESTIGE_WINDOW_MS;
				if (startsActiveWindow || windowExpired) {
					this.prestigesThisActiveWindow = 0;
					this.prestigeWindowStart = gameManager.inGameTime;
				}
				this.lastWasActive = activeNow;
				if (activeNow) {
					this.executeBotBehavior();
					this.quests.steerDedicated();
				}
				this.flushSpikeWindowIfNeeded();
				if (tick % achievementCheckInterval === 0) {
					this.checkAchievements();
				}
				// Every tick, not on a sampling interval: a counter that rises and is spent inside one window still counts.
				this.checkMilestones();

				if ((tick + 1) % snapshotIntervalTicks === 0) {
					this.takeSnapshot();
				}

				ticksSinceLastUpdate++;
				if (tick % CHUNK_SIZE === 0 && tick > 0) {
					const now = performance.now();
					const elapsed = now - lastProgressUpdate;

					if (elapsed > 0) {
						lastTicksPerSecond = (ticksSinceLastUpdate / elapsed) * 1000;
					}

					const remainingTicks = totalTicks - tick;
					const estimatedTimeLeft = lastTicksPerSecond > 0 ? (remainingTicks / lastTicksPerSecond) * 1000 : 0;

					onProgress?.({
						currentHour: gameManager.inGameTime / (3600 * 1000),
						estimatedTimeLeft,
						milestoneCount: this.milestones.length,
						percent: (tick / totalTicks) * 100,
						recentMilestones: [...this.recentMilestones],
						recentSpikes: [...this.recentSpikes],
						newSnapshots: this.snapshots.slice(this.snapshotsSent),
						ticksPerSecond: lastTicksPerSecond,
						totalHours: this.config.targetHours,
					});

					this.snapshotsSent = this.snapshots.length;
					this.recentMilestones = [];
					this.recentSpikes = [];
					lastProgressUpdate = now;
					ticksSinceLastUpdate = 0;
				}
			}

			if (this.quests.hasOpenDay) this.quests.settleDay();
			if (!cancelled) {
				this.takeSnapshot();
			}
		} finally {
			disconnect();
			gameManager.clock = () => Date.now();
			radiationManager.random = () => Math.random();
			if (this.savedState) {
				const originalState = JSON.parse(this.savedState);
				gameManager.loadSaveData(originalState);
			}
		}

		const durationMs = performance.now() - startRealTime;

		return {
			cancelled,
			config: this.config,
			durationMs,
			milestones: this.milestones,
			snapshots: this.snapshots,
			spikes: this.spikes,
		};
	}

	private flushSpikeWindowIfNeeded() {
		const simTime = gameManager.inGameTime;
		if (simTime - this.spikeWindowStart < SPIKE_WINDOW_MS) return;

		const windowDurationMs = simTime - this.spikeWindowStart;
		const ratePerMin = (this.spikeWindowActions.length / windowDurationMs) * 60_000;

		if (this.spikeRateHistory.length >= SPIKE_MIN_HISTORY && ratePerMin >= SPIKE_MIN_RATE) {
			const recentHistory = this.spikeRateHistory.slice(-SPIKE_MIN_HISTORY);
			const avgRate = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;
			if (avgRate > 0 && ratePerMin > avgRate * SPIKE_MULTIPLIER) {
				const spike: SpikeEvent = {
					actions: [...this.spikeWindowActions],
					apsEnd: gameManager.atomsPerSecond,
					apsStart: this.spikeWindowAps,
					avgRatePerMin: avgRate,
					peakRatePerMin: ratePerMin,
					timestamp: this.spikeWindowStart,
				};
				this.spikes.push(spike);
				this.recentSpikes.push(spike);
			}
		}

		this.spikeRateHistory.push(ratePerMin);
		this.spikeWindowActions = [];
		this.spikeWindowAps = gameManager.atomsPerSecond;
		this.spikeWindowStart = simTime;
	}

	private pushAction(action: SimulationAction) {
		this.actionCounts[action.type] = (this.actionCounts[action.type] ?? 0) + 1;
		// Buildings and power-ups run into the millions over a multi-day run and nothing reads them back by id.
		if (DETAILED_ACTION_TYPES.has(action.type)) this.actions.push(action);
		this.spikeWindowActions.push(action);
	}

	private checkAchievements() {
		const owned = this.ownedAchievements;
		const newlyEarned: string[] = [];

		for (const [id, achievement] of ACHIEVEMENT_ENTRIES) {
			if (owned.has(id)) continue;
			try {
				if (achievement.condition(gameManager)) {
					owned.add(id);
					newlyEarned.push(id);
					this.pushAction({
						details: achievement.name,
						timestamp: gameManager.inGameTime,
						type: 'achievement',
					});
				}
			} catch {
				// Some achievement conditions throw in simulation (e.g. DOM / optional deps).
			}
		}

		if (newlyEarned.length > 0) {
			gameManager.achievements = [...gameManager.achievements, ...newlyEarned];
			this.quarksFromAchievements += newlyEarned.length * QUARK_ACHIEVEMENT_REWARD;
		}
	}

	private checkMilestones() {
		const pending = this.pendingMilestones;
		if (pending.length === 0) return;

		const snapshot = fillMilestoneData(this.runState, this.milestoneScratch);
		let stillPending: MilestoneEntry[] | null = null;

		for (let i = 0; i < pending.length; i++) {
			const entry = pending[i];
			if (!entry.check(snapshot)) {
				stillPending?.push(entry);
				continue;
			}
			if (!stillPending) stillPending = pending.slice(0, i);
			const hit: MilestoneHit = {
				dayReached: snapshot.dayNumber,
				milestone: entry.milestone,
				timeReached: snapshot.timestamp,
			};
			this.milestones.push(hit);
			this.recentMilestones.push(hit);
		}

		if (stillPending) this.pendingMilestones = stillPending;
	}

	private executeBotBehavior() {
		const { botBehavior, prestigeStrategy } = this.config;
		const maxActionsPerTick = botBehavior.maxActionsPerTick;
		const maxPrestigesPerActiveWindow = botBehavior.maxPrestigesPerActiveWindow;
		let actionsThisTick = 0;

		const canDoAction = (): boolean => maxActionsPerTick == null || actionsThisTick < maxActionsPerTick;
		const canPrestige = (): boolean =>
			maxPrestigesPerActiveWindow == null || this.prestigesThisActiveWindow < maxPrestigesPerActiveWindow;

		// Thresholds are ratios against the previous run's gain: an absolute proton count is meaningless once the curve takes off.
		const protoniseGain = gameManager.protoniseProtonsGain;
		const protoniseTarget = Math.max(1, this.lastProtoniseGain * prestigeStrategy.protoniseThreshold);
		if (canDoAction() && canPrestige() && prestigeStrategy.autoProtonise && protoniseGain >= protoniseTarget) {
			if (gameManager.protonise()) {
				this.lastProtoniseGain = protoniseGain;
				this.pushAction({
					details: `+${protoniseGain} protons`,
					timestamp: gameManager.inGameTime,
					type: 'protonise',
				});
				this.prestigesThisActiveWindow++;
				actionsThisTick++;
			}
		}

		const electronizeGain = gameManager.electronizeElectronsGain;
		const electronizeTarget = Math.max(1, this.lastElectronizeGain * prestigeStrategy.electronizeThreshold);
		if (canDoAction() && canPrestige() && prestigeStrategy.autoElectronize && electronizeGain >= electronizeTarget) {
			if (gameManager.electronize()) {
				this.lastElectronizeGain = electronizeGain;
				this.pushAction({
					details: `+${electronizeGain} electrons`,
					timestamp: gameManager.inGameTime,
					type: 'electronize',
				});
				this.prestigesThisActiveWindow++;
				actionsThisTick++;
			}
		}

		if (!botBehavior.autoBuy) return;

		if (canDoAction() && botBehavior.autoBuyBuildings) {
			const building = this.planner.selectBuilding(botBehavior);
			if (building) {
				const maxAffordable = gameManager.getMaxAffordableBuilding(building);
				if (maxAffordable > 0) {
					const isFirstPurchase = !this.everPurchasedBuildings.has(building);
					const apsBeforeBuy = gameManager.atomsPerSecond;
					gameManager.purchaseBuilding(building, maxAffordable);
					this.everPurchasedBuildings.add(building);
					this.pushAction({
						apsDelta: gameManager.atomsPerSecond - apsBeforeBuy,
						details: `${building} x${maxAffordable}`,
						isFirstPurchase,
						timestamp: gameManager.inGameTime,
						type: 'building',
					});
					actionsThisTick++;
				}
			}
		}
		if (botBehavior.autoBuyUpgrades) {
			for (const affordableUpgrade of this.planner.affordableUpgrades()) {
				if (!canDoAction()) break;
				gameManager.purchaseUpgrade(affordableUpgrade);
				this.pushAction({
					details: affordableUpgrade,
					timestamp: gameManager.inGameTime,
					type: 'upgrade',
				});
				actionsThisTick++;
			}
		}
		if (botBehavior.autoBuySkills) {
			for (const affordableSkill of this.planner.affordableSkills()) {
				if (!canDoAction()) break;
				gameManager.purchaseSkill(affordableSkill);
				this.pushAction({
					details: affordableSkill,
					timestamp: gameManager.inGameTime,
					type: 'skill',
				});
				actionsThisTick++;
			}
		}
		if (canDoAction() && botBehavior.autoBuyPhotonUpgrades) {
			const affordablePhotonUpgrade = this.planner.affordablePhotonUpgrade();
			if (affordablePhotonUpgrade) {
				gameManager.purchasePhotonUpgrade(affordablePhotonUpgrade);
				this.pushAction({
					details: affordablePhotonUpgrade,
					timestamp: gameManager.inGameTime,
					type: 'photon_upgrade',
				});
				actionsThisTick++;
			}
		}
		let availableSkillPoints = gameManager.skillPointsAvailable;
		if (canDoAction() && availableSkillPoints > 0) {
			const boostPriority: CurrencyName[] = [
				CurrenciesTypes.ATOMS,
				CurrenciesTypes.PROTONS,
				CurrenciesTypes.ELECTRONS,
				CurrenciesTypes.PHOTONS,
			];

			for (const currency of boostPriority) {
				if (availableSkillPoints <= 0 || !canDoAction()) break;
				if (gameManager.addCurrencyBoost(currency)) {
					availableSkillPoints--;
					actionsThisTick++;
				}
			}
		}

		if (radiationManager.unlocked) {
			// Fuelling the core is realm attention like any other, so it competes for the same per-tick budget.
			const electrons = currenciesManager.getAmount(CurrenciesTypes.ELECTRONS);
			const electronizeReserve = gameManager.electronizeElectronsGain > 0
				? gameManager.electronizeElectronsGain * 3
				: 50;
			const surplus = electrons - electronizeReserve;
			if (canDoAction() && surplus > 0 && (radiationManager.mass === 0 || radiationManager.timeToEmpty < 3_600_000)) {
				radiationManager.bombardCore(Math.min(Math.floor(surplus * 0.3), 20));
				actionsThisTick++;
			}
			if (canDoAction() && radiationManager.mass > 0 && radiationManager.controlRodLevel === 0) {
				radiationManager.setControlRodLevel(0.5);
				actionsThisTick++;
			}
			if (canDoAction()) {
				const upgradeId = this.planner.affordableRadiationUpgrade();
				if (upgradeId && radiationManager.purchaseUpgrade(upgradeId)) {
					actionsThisTick++;
				}
			}
		}
	}

	private isInActiveWindow(): boolean {
		const { activityPattern } = this.config.botBehavior;
		if (!activityPattern) return true;
		const cycleMs = (activityPattern.activeMinutes + activityPattern.inactiveMinutes) * 60 * 1000;
		const activeMs = activityPattern.activeMinutes * 60 * 1000;
		const positionInCycle = gameManager.inGameTime % cycleMs;
		return positionInCycle < activeMs;
	}

	/**
	 * A player has one realm on screen at a time and switches between them, so over a tick their clicks
	 * are split across every unlocked realm that accepts clicks rather than going wholly to the newest one.
	 */
	private clickShare(): number {
		let realms = 1;
		if (gameManager.realms[RealmTypes.PHOTONS]?.unlocked) realms++;
		return 1 / realms;
	}

	private simulateClicks() {
		const { clicksPerSecond } = this.config.botBehavior;
		if (!this.activeNow) return;
		if (clicksPerSecond <= 0) return;

		const clicksThisTick = clicksPerSecond * this.clickShare() * (this.config.tickRate / 1000);
		if (clicksThisTick <= 0) return;
		const clickPower = gameManager.clickPower;

		gameManager.addAtoms(clickPower * clicksThisTick);
		const wholeClicks = Math.floor(clicksThisTick);
		gameManager.totalClicksAllTime += wholeClicks;
		gameManager.totalClicksRun += wholeClicks;
		// Bypasses gameManager.incrementClicks() for performance, so dailyStats needs its own bump here.
		if (wholeClicks > 0) gameManager.dailyStats.clicks += wholeClicks;
	}

	/**
	 * The realm pays per circle collected, not per click: circles spawn on `photonSpawnInterval`, expire after their
	 * lifetime, and cap at 100 on screen. Clicking faster than circles spawn earns nothing extra, which is the whole
	 * difference between this and the offline approximation.
	 */
	private simulatePhotonRealm() {
		if (!gameManager.realms[RealmTypes.PHOTONS]?.unlocked) return;

		const deltaSeconds = this.config.tickRate / 1000;
		const effects = this.photonRealmEffects();

		const spawnInterval = Math.max(1, gameManager.photonSpawnInterval);
		const spawns = (deltaSeconds * 1000) / spawnInterval;
		const excitedChance = gameManager.excitedPhotonChance;

		// Circles die of old age; with spawn times spread evenly the share reaching the cutoff over a tick is delta/lifetime.
		const normalLifetime = Math.max(1, effects.lifetimeMs) / 1000;
		const excitedLifetime = normalLifetime * effects.excitedLifetimeMultiplier;
		const expiredNormal = this.photonPoolNormal * Math.min(1, deltaSeconds / normalLifetime);
		const expiredExcited = this.photonPoolExcited * Math.min(1, deltaSeconds / excitedLifetime);
		this.photonPoolNormal -= expiredNormal;
		this.photonPoolExcited -= expiredExcited;
		this.photonsExpired += expiredNormal + expiredExcited;

		this.photonPoolNormal += spawns * (1 - excitedChance);
		this.photonPoolExcited += spawns * excitedChance;

		const onScreen = this.photonPoolNormal + this.photonPoolExcited;
		if (onScreen > PHOTON_MAX_CIRCLES) {
			const overflow = onScreen - PHOTON_MAX_CIRCLES;
			const scale = PHOTON_MAX_CIRCLES / onScreen;
			this.photonPoolNormal *= scale;
			this.photonPoolExcited *= scale;
			this.photonsExpired += overflow;
		}

		const manualClicks = this.activeNow ? this.config.botBehavior.clicksPerSecond * this.clickShare() * deltaSeconds : 0;
		const autoClicks = gameManager.photonAutoClicksPer5Seconds > 0 ? (gameManager.photonAutoClicksPer5Seconds / 5) * deltaSeconds : 0;
		if (manualClicks + autoClicks <= 0) return;

		let collectedNormal = 0;
		let collectedExcited = 0;

		// The auto-clicker picks uniformly among circles it may target, so excited ones stay put until it is upgraded.
		const autoTargetsExcited = (gameManager.photonUpgrades['excited_auto_click'] ?? 0) > 0;
		if (autoClicks > 0) {
			const reachable = this.photonPoolNormal + (autoTargetsExcited ? this.photonPoolExcited : 0);
			if (reachable > 0) {
				const taken = Math.min(autoClicks, reachable);
				const normal = (taken * this.photonPoolNormal) / reachable;
				const excited = taken - normal;
				this.photonPoolNormal -= normal;
				this.photonPoolExcited -= excited;
				collectedNormal += normal;
				collectedExcited += excited;
			}
		}

		if (manualClicks > 0) {
			const reachable = this.photonPoolNormal + this.photonPoolExcited;
			if (reachable > 0) {
				const taken = Math.min(manualClicks, reachable);
				const normal = (taken * this.photonPoolNormal) / reachable;
				const excited = taken - normal;
				this.photonPoolNormal -= normal;
				this.photonPoolExcited -= excited;
				collectedNormal += normal;
				collectedExcited += excited;
			}
		}

		if (collectedNormal > 0) {
			const gain = collectedNormal * effects.normalValue * gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.PHOTONS);
			currenciesManager.add(CurrenciesTypes.PHOTONS, gain);
		}
		if (collectedExcited > 0) {
			const gain = collectedExcited * effects.excitedValue * gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.EXCITED_PHOTONS);
			currenciesManager.add(CurrenciesTypes.EXCITED_PHOTONS, gain);
		}
	}

	/**
	 * One pass over the effect sources for everything a circle is worth and how long it lives.
	 * Memoized on the effect-source identity, which only changes on a purchase, plus the stability field that the two
	 * stability upgrades read live.
	 */
	private photonRealmEffects(): PhotonRealmEffects {
		const sources = gameManager.allEffectSources;
		const stability = gameManager.stabilityMultiplier;
		const cached = this.photonEffects;
		if (cached && this.photonEffectsSources === sources && this.photonEffectsStability === stability) return cached;

		// Only the photon_value upgrade's click effect counts here, so it keeps its own stable one-source list to fold.
		if (this.photonValueKey !== sources) {
			const source = sources.find(entry => entry.id === 'photon_value');
			this.photonValueKey = sources;
			this.photonValueSources = source ? [source] : [];
		}

		const photonValueBonus = foldEffects(this.photonValueSources, gameManager, 0, { type: 'click' });
		const doubleChance = foldEffects(sources, gameManager, 0, { type: 'photon_double_chance' });
		const excitedDoubleChance = foldEffects(sources, gameManager, 0, { type: 'excited_photon_double' });
		const excitedFromMaxBonus = foldEffects(sources, gameManager, 0, { type: 'excited_photon_from_max' });
		const excitedLifetimeMultiplier = foldEffects(sources, gameManager, 1, { type: 'excited_photon_duration' });
		const excitedStability = foldEffects(sources, gameManager, 1, { type: 'excited_photon_stability' });
		const lifetimeBonusMs = foldEffects(sources, gameManager, 0, { type: 'photon_duration' });
		const normalStability = foldEffects(sources, gameManager, 1, { type: 'photon_stability' });

		const effects: PhotonRealmEffects = {
			excitedLifetimeMultiplier,
			excitedValue:
				(1 + excitedDoubleChance + (PHOTON_MAX_VALUE + photonValueBonus) * excitedFromMaxBonus) * excitedStability,
			lifetimeMs: PHOTON_BASE_LIFETIME_MS + lifetimeBonusMs,
			normalValue: (PHOTON_AVERAGE_VALUE + photonValueBonus) * (1 + doubleChance) * normalStability,
		};

		this.photonEffects = effects;
		this.photonEffectsSources = sources;
		this.photonEffectsStability = stability;
		return effects;
	}

	private rollPowerUpInterval(): number {
		const [min, max] = gameManager.powerUpInterval;
		return gameManager.inGameTime + min + this.random() * (max - min);
	}

	private tickPowerUps() {
		if (gameManager.inGameTime < this.nextPowerUpTime) return;

		this.nextPowerUpTime = this.rollPowerUpInterval();
		if (!this.activeNow) return;

		const base = POWER_UPS[Math.floor(this.random() * POWER_UPS.length)];
		const multiplier = base.multiplier * gameManager.powerUpEffectMultiplier;
		const duration = base.duration * gameManager.powerUpDurationMultiplier;

		gameManager.addPowerUp({
			description: `Multiplies atoms by ${multiplier} for ${duration / 1000}s`,
			duration,
			id: `sim_${this.powerUpCounter++}`,
			multiplier,
			name: base.name,
			startTime: gameManager.inGameTime,
		});
		gameManager.incrementBonusHiggsBosonClicks();

		this.pushAction({
			details: `×${multiplier.toFixed(1)} / ${(duration / 1000).toFixed(0)}s`,
			timestamp: gameManager.inGameTime,
			type: 'power_up',
		});
	}

	private takeSnapshot() {
		this.snapshots.push(createSnapshotData(this.runState));
		this.actionCounts = {};
		this.actions = [];
	}
}
