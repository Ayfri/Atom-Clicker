import { ACHIEVEMENTS } from '$data/achievements';
import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
import { GENERATOR_TYPES, type GeneratorType } from '$data/generators';
import { POWER_UPS } from '$data/powerUp';
import { QUARK_ACHIEVEMENT_REWARD } from '$data/quarkAchievements';
import { RealmTypes } from '$data/realms';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { gameManager } from '$helpers/GameManager.svelte';
import { radiationManager } from '$helpers/RadiationManager.svelte';
import { connectDeriveds } from '$helpers/reactiveRoot.svelte';
import { MilestoneTracker } from './milestones';
import { PurchasePlanner } from './purchases';
import { DEFAULT_SEED, createRandom } from './random';
import { QuestTracker } from './quests';
import { createSnapshotData, type RunState } from './snapshots';
import {
	DETAILED_ACTION_TYPES,
	type BenchmarkConfig,
	type MilestoneHit,
	type SimulationAction,
	type SimulationActionType,
	type SimulationProgress,
	type SimulationResult,
	type SimulationSnapshot,
	type SpikeEvent,
} from './types';

const BOOST_PRIORITY: CurrencyName[] = [CurrenciesTypes.ATOMS, CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS, CurrenciesTypes.PHOTONS];
const HOUR_MS = 3_600_000;
const PROGRESS_CHECK_TICKS = 500;
const PROGRESS_INTERVAL_MS = 100;

// Photon realm geometry, mirrored from PhotonRealm.svelte: circles spawn on a timer, live a while, and cap out on screen.
const PHOTON_BASE_LIFETIME_MS = 5000;
const PHOTON_MAX_CIRCLES = 100;
const PHOTON_MAX_VALUE = 10;
const PHOTON_MIN_VALUE = 1;
const PHOTON_AVERAGE_VALUE = (PHOTON_MIN_VALUE + PHOTON_MAX_VALUE) / 2;

/** Prestige budgets are a pacing limit per play session, not a lifetime cap. */
const PRESTIGE_WINDOW_MS = HOUR_MS;

const SPIKE_WINDOW_MS = 60_000;
const SPIKE_MIN_HISTORY = 5;
const SPIKE_MULTIPLIER = 4;
const SPIKE_MIN_RATE = 50;

interface PhotonRealmEffects {
	excitedLifetimeMultiplier: number;
	excitedValue: number;
	lifetimeMs: number;
	normalValue: number;
}

/**
 * Drives the real game managers with a bot on a simulated clock. Single-use: build one engine per run.
 * The loop never yields, a worker host stops it by terminating the worker.
 */
export class SimulationEngine {
	private autoBuyNext: Partial<Record<GeneratorType, number>> = {};
	private autoClickCarry = 0;
	private autoUpgradeInterval = 0;
	private autoUpgradeNext = 0;
	private readonly config: BenchmarkConfig;
	private lastElectronizeGain = 0;
	private lastProtoniseGain = 0;
	private lastWasActive = false;
	private manualClickCarry = 0;
	private readonly milestones: MilestoneHit[] = [];
	private readonly milestoneTracker = new MilestoneTracker();
	private nextPowerUpTime = 0;
	private pendingAchievements = Object.entries(ACHIEVEMENTS);
	private photonEffects: PhotonRealmEffects | null = null;
	private photonEffectsSources: unknown = null;
	private photonEffectsStability = 0;
	/** Uncollected circles on screen, as expected counts: the realm is a spawn-and-expire queue, not one payout per click. */
	private photonPoolExcited = 0;
	private photonPoolNormal = 0;
	private readonly planner = new PurchasePlanner();
	private powerUpCounter = 0;
	private prestigesThisActiveWindow = 0;
	private prestigeWindowStart = 0;
	private readonly quests: QuestTracker;
	private readonly random: () => number;
	private readonly snapshots: SimulationSnapshot[] = [];
	private readonly spikeRateHistory: number[] = [];
	private readonly spikes: SpikeEvent[] = [];
	private spikeWindowActions: SimulationAction[] = [];
	private spikeWindowAps = 0;
	private spikeWindowStart = 0;
	private readonly state: RunState;

	constructor(config: BenchmarkConfig) {
		this.config = config;
		this.quests = new QuestTracker(config.botBehavior.questBehavior);
		this.random = createRandom(config.seed ?? DEFAULT_SEED);
		this.state = {
			actionCounts: {},
			actions: [],
			everPurchasedGenerators: new Set(),
			peakAtomsPerSecond: 0,
			photonsExpired: 0,
			quarksFromAchievements: 0,
			quests: this.quests,
		};
	}

	/** Mutates the global game managers for the duration of the run, then restores the state they started with. */
	run(onProgress?: (progress: SimulationProgress) => void): SimulationResult {
		const started = performance.now();
		const disconnect = connectDeriveds([gameManager, currenciesManager, radiationManager]);
		const savedState = JSON.stringify(gameManager.getCurrentState());
		gameManager.resetAll();
		currenciesManager.hardReset();
		// Every wall-clock read inside the game is swapped for the simulated clock, or the stability field and the
		// power-up bookkeeping would follow how fast the host machine happens to be running.
		gameManager.clock = () => gameManager.inGameTime;
		gameManager.lastInteractionTime = 0;
		radiationManager.random = this.random;

		// An engaged player switches every automation on, each one stays inert until an upgrade grants its effect.
		gameManager.settings.automation = { autoClick: true, autoClickPhotons: true, generators: [...GENERATOR_TYPES], upgrades: true };
		this.nextPowerUpTime = this.rollPowerUpInterval();
		this.spikeWindowAps = gameManager.atomsPerSecond;

		const { snapshotInterval, targetHours, tickRate } = this.config;
		const totalTicks = Math.floor((targetHours * HOUR_MS) / tickRate);
		const snapshotTicks = Math.floor((snapshotInterval * 1000) / tickRate);
		const achievementTicks = Math.max(1, Math.round(1000 / tickRate));
		let lastProgress = started;
		let lastProgressTick = 0;
		const sent = { milestones: 0, snapshots: 0, spikes: 0 };
		this.takeSnapshot();

		try {
			for (let tick = 0; tick < totalTicks; tick++) {
				this.tick(tick % achievementTicks === 0);
				if ((tick + 1) % snapshotTicks === 0 && tick + 1 < totalTicks) this.takeSnapshot();
				if (!onProgress || tick % PROGRESS_CHECK_TICKS !== 0) continue;

				const now = performance.now();
				if (now - lastProgress < PROGRESS_INTERVAL_MS) continue;
				const done = tick + 1;
				onProgress({
					currentHour: gameManager.inGameTime / HOUR_MS,
					estimatedTimeLeft: ((now - started) * (totalTicks - done)) / done,
					newMilestones: this.milestones.slice(sent.milestones),
					newSnapshots: this.snapshots.slice(sent.snapshots),
					newSpikes: this.spikes.slice(sent.spikes),
					percent: (done / totalTicks) * 100,
					ticksPerSecond: ((done - lastProgressTick) / (now - lastProgress)) * 1000,
					totalHours: targetHours,
				});
				sent.milestones = this.milestones.length;
				sent.snapshots = this.snapshots.length;
				sent.spikes = this.spikes.length;
				lastProgress = now;
				lastProgressTick = done;
			}

			if (this.quests.hasOpenDay) this.quests.settleDay();
			this.takeSnapshot();
		} finally {
			disconnect();
			gameManager.clock = () => Date.now();
			radiationManager.random = Math.random;
			gameManager.loadSaveData(JSON.parse(savedState));
		}

		return {
			cancelled: false,
			config: this.config,
			durationMs: performance.now() - started,
			milestones: this.milestones,
			snapshots: this.snapshots,
			spikes: this.spikes,
		};
	}

	private tick(checkAchievements: boolean) {
		gameManager.tick(this.config.tickRate, true);
		// Sampled per tick rather than per snapshot, and with the power-up bonus out, so the ratchet is honest.
		const rawAps = gameManager.atomsPerSecond / (gameManager.bonusMultiplier || 1);
		if (rawAps > this.state.peakAtomsPerSecond) this.state.peakAtomsPerSecond = rawAps;

		const active = this.isActive();
		this.simulateClicks(active);
		this.simulatePhotonRealm(active);
		this.tickPowerUps(active);
		this.tickAutomation();
		this.quests.checkDayRollover();

		// An always-active run never crosses an inactive edge, so the budget also expires on a simulated-hour timer.
		if ((active && !this.lastWasActive) || gameManager.inGameTime - this.prestigeWindowStart >= PRESTIGE_WINDOW_MS) {
			this.prestigesThisActiveWindow = 0;
			this.prestigeWindowStart = gameManager.inGameTime;
		}
		this.lastWasActive = active;
		if (active) {
			this.executeBotBehavior();
			this.quests.steerDedicated();
		}

		this.flushSpikeWindowIfNeeded();
		if (checkAchievements) this.checkAchievements();
		this.milestoneTracker.check(this.state, this.milestones);
	}

	private record(type: SimulationActionType, details: string, extra?: Pick<SimulationAction, 'apsDelta' | 'isFirstPurchase'>) {
		const action: SimulationAction = { ...extra, details, timestamp: gameManager.inGameTime, type };
		const { actionCounts } = this.state;
		actionCounts[type] = (actionCounts[type] ?? 0) + 1;
		// Generators and power-ups run into the millions over a multi-day run and nothing reads them back by id.
		if (DETAILED_ACTION_TYPES.has(type)) this.state.actions.push(action);
		this.spikeWindowActions.push(action);
	}

	private flushSpikeWindowIfNeeded() {
		const now = gameManager.inGameTime;
		const windowMs = now - this.spikeWindowStart;
		if (windowMs < SPIKE_WINDOW_MS) return;

		const ratePerMin = (this.spikeWindowActions.length / windowMs) * 60_000;
		if (this.spikeRateHistory.length >= SPIKE_MIN_HISTORY && ratePerMin >= SPIKE_MIN_RATE) {
			const avgRate = this.spikeRateHistory.slice(-SPIKE_MIN_HISTORY).reduce((a, b) => a + b, 0) / SPIKE_MIN_HISTORY;
			if (avgRate > 0 && ratePerMin > avgRate * SPIKE_MULTIPLIER) {
				this.spikes.push({
					actions: this.spikeWindowActions,
					apsEnd: gameManager.atomsPerSecond,
					apsStart: this.spikeWindowAps,
					avgRatePerMin: avgRate,
					peakRatePerMin: ratePerMin,
					timestamp: this.spikeWindowStart,
				});
			}
		}

		this.spikeRateHistory.push(ratePerMin);
		this.spikeWindowActions = [];
		this.spikeWindowAps = gameManager.atomsPerSecond;
		this.spikeWindowStart = now;
	}

	private checkAchievements() {
		const earned: string[] = [];
		const pending = this.pendingAchievements.filter(([id, achievement]) => {
			if (!achievement.condition(gameManager)) return true;
			earned.push(id);
			this.record('achievement', achievement.name);
			return false;
		});
		if (earned.length === 0) return;

		this.pendingAchievements = pending;
		gameManager.achievements = [...gameManager.achievements, ...earned];
		gameManager.dailyStats.achievementsUnlocked += earned.length;
		this.state.quarksFromAchievements += earned.length * QUARK_ACHIEVEMENT_REWARD;
	}

	private executeBotBehavior() {
		const { botBehavior, prestigeStrategy } = this.config;
		const { maxActionsPerTick, maxPrestigesPerActiveWindow } = botBehavior;
		let actionsThisTick = 0;
		const canAct = () => maxActionsPerTick == null || actionsThisTick < maxActionsPerTick;
		const canPrestige = () =>
			canAct() && (maxPrestigesPerActiveWindow == null || this.prestigesThisActiveWindow < maxPrestigesPerActiveWindow);

		// Thresholds are ratios against the previous run's gain: an absolute proton count is meaningless once the curve takes off.
		const protoniseGain = gameManager.protoniseProtonsGain;
		if (
			canPrestige() &&
			prestigeStrategy.autoProtonise &&
			protoniseGain >= Math.max(1, this.lastProtoniseGain * prestigeStrategy.protoniseThreshold) &&
			gameManager.protonise()
		) {
			this.lastProtoniseGain = protoniseGain;
			this.record('protonise', `+${protoniseGain} protons`);
			this.prestigesThisActiveWindow++;
			actionsThisTick++;
		}

		const electronizeGain = gameManager.electronizeElectronsGain;
		if (
			canPrestige() &&
			prestigeStrategy.autoElectronize &&
			electronizeGain >= Math.max(1, this.lastElectronizeGain * prestigeStrategy.electronizeThreshold) &&
			!this.planner.canSpend(CurrenciesTypes.PROTONS) &&
			gameManager.electronize()
		) {
			this.lastElectronizeGain = electronizeGain;
			/** Electronize wipes protons, a threshold left on the last proton run would block every protonise after it. */
			this.lastProtoniseGain = 0;
			this.record('electronize', `+${electronizeGain} electrons`);
			this.prestigesThisActiveWindow++;
			actionsThisTick++;
		}

		if (!botBehavior.autoBuy) return;

		if (canAct() && botBehavior.autoBuyGenerators) {
			const generator = this.planner.selectGenerator(botBehavior);
			const amount = generator ? gameManager.getMaxAffordableGenerator(generator) : 0;
			if (generator && amount > 0) {
				const isFirstPurchase = !this.state.everPurchasedGenerators.has(generator);
				const apsBefore = gameManager.atomsPerSecond;
				gameManager.purchaseGenerator(generator, amount);
				this.state.everPurchasedGenerators.add(generator);
				this.record('generator', `${generator} x${amount}`, { apsDelta: gameManager.atomsPerSecond - apsBefore, isFirstPurchase });
				actionsThisTick++;
			}
		}
		if (botBehavior.autoBuyUpgrades) {
			for (const id of this.planner.affordableUpgrades()) {
				if (!canAct()) break;
				gameManager.purchaseUpgrade(id);
				this.record('upgrade', id);
				actionsThisTick++;
			}
		}
		if (botBehavior.autoBuySkills) {
			for (const id of this.planner.affordableSkills()) {
				if (!canAct()) break;
				gameManager.purchaseSkill(id);
				this.record('skill', id);
				actionsThisTick++;
			}
		}
		if (canAct() && botBehavior.autoBuyPhotonUpgrades) {
			const id = this.planner.affordablePhotonUpgrade();
			if (id) {
				gameManager.purchasePhotonUpgrade(id);
				this.record('photon_upgrade', id);
				actionsThisTick++;
			}
		}
		for (const currency of BOOST_PRIORITY) {
			if (gameManager.boostPointsAvailable <= 0 || !canAct()) break;
			if (gameManager.addCurrencyBoost(currency)) actionsThisTick++;
		}

		if (!radiationManager.unlocked) return;
		// Fuelling the core is realm attention like any other, so it competes for the same per-tick budget.
		const reserve = gameManager.electronizeElectronsGain > 0 ? gameManager.electronizeElectronsGain * 3 : 50;
		const surplus = currenciesManager.getAmount(CurrenciesTypes.ELECTRONS) - reserve;
		if (canAct() && surplus > 0 && (radiationManager.mass === 0 || radiationManager.timeToEmpty < HOUR_MS)) {
			radiationManager.bombardCore(Math.min(Math.floor(surplus * 0.3), 20));
			actionsThisTick++;
		}
		if (canAct() && radiationManager.mass > 0 && radiationManager.controlRodLevel === 0) {
			radiationManager.setControlRodLevel(0.5);
			actionsThisTick++;
		}
		const upgradeId = canAct() ? this.planner.affordableRadiationUpgrade() : null;
		if (upgradeId && radiationManager.purchaseUpgrade(upgradeId)) actionsThisTick++;
	}

	private isActive(): boolean {
		const pattern = this.config.botBehavior.activityPattern;
		if (!pattern) return true;
		const cycleMs = (pattern.activeMinutes + pattern.inactiveMinutes) * 60_000;
		return gameManager.inGameTime % cycleMs < pattern.activeMinutes * 60_000;
	}

	/** One realm is on screen at a time, so manual clicks are split across every unlocked realm that accepts clicks. */
	private manualClicksThisTick(active: boolean): number {
		if (!active) return 0;
		const realms = gameManager.realms[RealmTypes.PHOTONS]?.unlocked ? 2 : 1;
		return (this.config.botBehavior.clicksPerSecond / realms) * (this.config.tickRate / 1000);
	}

	/**
	 * Clicks come in fractions per tick, so the remainders carry over until they make a whole click for the counters,
	 * which also reset the stability field. Auto-click atoms are already paid by `gameManager.tick()`.
	 */
	private simulateClicks(active: boolean) {
		const manual = this.manualClicksThisTick(active);
		if (manual > 0) gameManager.addAtoms(gameManager.clickPower * manual);
		this.manualClickCarry += manual;
		this.autoClickCarry += gameManager.autoClicksPerSecond * (this.config.tickRate / 1000);

		const manualWhole = Math.floor(this.manualClickCarry);
		if (manualWhole > 0) {
			this.manualClickCarry -= manualWhole;
			gameManager.incrementClicks(false, manualWhole);
		}
		const autoWhole = Math.floor(this.autoClickCarry);
		if (autoWhole > 0) {
			this.autoClickCarry -= autoWhole;
			gameManager.incrementClicks(true, autoWhole);
		}
	}

	/** The browser's auto-buy and auto-upgrade timers, which keep firing whether or not the player is at the keyboard. */
	private tickAutomation() {
		const now = gameManager.inGameTime;
		const intervals = gameManager.autoBuyIntervals;
		for (const type of Object.keys(this.autoBuyNext) as GeneratorType[]) {
			if (!(type in intervals)) delete this.autoBuyNext[type];
		}
		for (const [type, interval] of Object.entries(intervals) as [GeneratorType, number][]) {
			const next = this.autoBuyNext[type];
			if (next === undefined) this.autoBuyNext[type] = now + interval;
			else if (now >= next) {
				gameManager.purchaseGenerator(type, 1);
				this.autoBuyNext[type] = Math.max(next + interval, now);
			}
		}

		const upgradeInterval = gameManager.autoUpgradeInterval;
		if (upgradeInterval !== this.autoUpgradeInterval) {
			this.autoUpgradeInterval = upgradeInterval;
			this.autoUpgradeNext = now + upgradeInterval;
		} else if (upgradeInterval > 0 && now >= this.autoUpgradeNext) {
			for (const id of gameManager.purchaseAffordableUpgrades()) this.record('upgrade', id);
			this.autoUpgradeNext = now + upgradeInterval;
		}
	}

	/**
	 * The realm pays per circle collected, not per click: circles spawn on `photonSpawnInterval`, expire after their
	 * lifetime, and cap at 100 on screen. Clicking faster than circles spawn earns nothing extra.
	 */
	private simulatePhotonRealm(active: boolean) {
		if (!gameManager.realms[RealmTypes.PHOTONS]?.unlocked) return;

		const deltaSeconds = this.config.tickRate / 1000;
		const effects = this.photonRealmEffects();
		const spawns = (deltaSeconds * 1000) / Math.max(1, gameManager.photonSpawnInterval);
		const excitedChance = gameManager.excitedPhotonChance;

		// Circles die of old age; with spawn times spread evenly the share reaching the cutoff over a tick is delta/lifetime.
		const normalLifetime = Math.max(1, effects.lifetimeMs) / 1000;
		const excitedLifetime = normalLifetime * effects.excitedLifetimeMultiplier;
		const expiredNormal = this.photonPoolNormal * Math.min(1, deltaSeconds / normalLifetime);
		const expiredExcited = this.photonPoolExcited * Math.min(1, deltaSeconds / excitedLifetime);
		this.photonPoolNormal -= expiredNormal;
		this.photonPoolExcited -= expiredExcited;
		this.state.photonsExpired += expiredNormal + expiredExcited;
		this.photonPoolNormal += spawns * (1 - excitedChance);
		this.photonPoolExcited += spawns * excitedChance;

		const onScreen = this.photonPoolNormal + this.photonPoolExcited;
		if (onScreen > PHOTON_MAX_CIRCLES) {
			const scale = PHOTON_MAX_CIRCLES / onScreen;
			this.photonPoolNormal *= scale;
			this.photonPoolExcited *= scale;
			this.state.photonsExpired += onScreen - PHOTON_MAX_CIRCLES;
		}

		// The auto-clicker picks uniformly among circles it may target, so excited ones stay put until it is upgraded.
		const autoTargetsExcited = (gameManager.photonUpgrades['excited_auto_click'] ?? 0) > 0;
		const collected = { excited: 0, normal: 0 };
		const collect = (clicks: number, includeExcited: boolean) => {
			const reachable = this.photonPoolNormal + (includeExcited ? this.photonPoolExcited : 0);
			if (clicks <= 0 || reachable <= 0) return;
			const taken = Math.min(clicks, reachable);
			const normal = (taken * this.photonPoolNormal) / reachable;
			this.photonPoolNormal -= normal;
			this.photonPoolExcited -= taken - normal;
			collected.normal += normal;
			collected.excited += taken - normal;
		};
		collect((gameManager.photonAutoClicksPer5Seconds / 5) * deltaSeconds, autoTargetsExcited);
		collect(this.manualClicksThisTick(active), true);

		if (collected.normal > 0) {
			const boost = gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.PHOTONS);
			currenciesManager.add(CurrenciesTypes.PHOTONS, collected.normal * effects.normalValue * boost);
		}
		if (collected.excited > 0) {
			const boost = gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.EXCITED_PHOTONS);
			currenciesManager.add(CurrenciesTypes.EXCITED_PHOTONS, collected.excited * effects.excitedValue * boost);
		}
	}

	/**
	 * Everything a circle is worth and how long it lives, memoized on the effect table identity, which only changes on a
	 * purchase, plus the stability field that the two stability upgrades read live.
	 */
	private photonRealmEffects(): PhotonRealmEffects {
		const sources = gameManager.effects;
		const stability = gameManager.stabilityMultiplier;
		if (this.photonEffects && this.photonEffectsSources === sources && this.photonEffectsStability === stability) return this.photonEffects;

		const photonValueBonus = gameManager.photonValueBonus;
		this.photonEffects = {
			excitedLifetimeMultiplier: sources.value('excited_photon_duration', 1, gameManager),
			excitedValue:
				(1 + gameManager.excitedPhotonDoubleChance + (PHOTON_MAX_VALUE + photonValueBonus) * gameManager.excitedPhotonFromMaxBonus) *
				sources.value('excited_photon_stability', 1, gameManager),
			lifetimeMs: PHOTON_BASE_LIFETIME_MS + sources.value('photon_duration', 0, gameManager),
			normalValue:
				(PHOTON_AVERAGE_VALUE + photonValueBonus) *
				(1 + gameManager.photonDoubleChance) *
				sources.value('photon_stability', 1, gameManager),
		};
		this.photonEffectsSources = sources;
		this.photonEffectsStability = stability;
		return this.photonEffects;
	}

	private rollPowerUpInterval(): number {
		const [min, max] = gameManager.powerUpInterval;
		return gameManager.inGameTime + min + this.random() * (max - min);
	}

	private tickPowerUps(active: boolean) {
		if (gameManager.inGameTime < this.nextPowerUpTime) return;

		this.nextPowerUpTime = this.rollPowerUpInterval();
		if (!active) return;

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
		this.record('power_up', `×${multiplier.toFixed(1)} / ${(duration / 1000).toFixed(0)}s`);
	}

	private takeSnapshot() {
		this.snapshots.push(createSnapshotData(this.state));
		this.state.actionCounts = {};
		this.state.actions = [];
	}
}
