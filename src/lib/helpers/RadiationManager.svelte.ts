import { CurrenciesTypes } from '#data/currencies.js';
import { RADIATION_UPGRADES, getRadiationUpgradePrice } from '#data/radiationUpgrades.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import type { RadiationState } from '#lib/types.js';

/** Share of the core mass burnt per second at full control, before Graphite Moderators. */
const BASE_DECAY_PERCENT = 0.02;
export const MASS_PER_ELECTRON = 0.1;
/**
 * The first Ionize needs the core held at IONIZE_CPM without a break, 18 of the 20 Coolant Pumps levels lift the cap that high.
 * Every Ionize raises the line by IONIZE_CPM_STEP: the late game replays a whole Electronize run in a minute, so only a
 * stronger reactor can pace it.
 */
export const IONIZE_CPM = 10_000;
export const IONIZE_CPM_STEP = 2000;
export const IONIZE_HOLD_SECONDS = 60;

/** Electrons fuel the core, and the control rods raise its output and its burn rate together, so the player trades output for fuel. */
class RadiationManager {
	controlRodLevel = $state(0);
	/** Seconds the core has stayed at or above `ionizeCpm` in a row, latched once ready. Not saved, a reload restarts the hold. */
	ionizeHold = $state(0);
	/** Saved by GameManager as `totalIonizesAllTime`, it lives here because it sets the ionization line. */
	ionizes = $state(0);
	ionizeCpm = $derived(IONIZE_CPM + IONIZE_CPM_STEP * this.ionizes);
	lastTick = $state(Date.now());
	/** Swapped by the simulation for a seeded generator so a benchmark run is reproducible. */
	random: () => number = () => Math.random();
	mass = $state(0);
	unlocked = $state(false);
	/** Last fuel insertion, not saved: the reactor visual watches it to play the intake burst. */
	lastBombard = $state({ mass: 0, seq: 0 });

	upgradeLevels = $state.raw<Record<string, number>>({});

	moderatorBonus = $derived(Math.max(0.2, 1 - this.getUpgradeEffect('graphite_moderators') * 0.1));

	/** Share of the mass burnt per second, quadratic in the control level: 0.5% at half control, 2% at full, before moderators. */
	decayRatePercent = $derived.by(() => {
		const controlEffect = Math.pow(this.controlRodLevel, 2);
		return BASE_DECAY_PERCENT * controlEffect * this.moderatorBonus;
	});

	/** Highest control level where expected burn still matches regen, so the core never drains. 0 when there is no regen. */
	stableControlLevel = $derived.by(() => {
		if (this.mass <= 0 || this.regenRate <= 0) return 0;
		const expectedBurn = this.mass * BASE_DECAY_PERCENT * this.moderatorBonus * (1 - 0.5 * this.preservationChance);
		return Math.min(1, Math.sqrt(this.regenRate / expectedBurn));
	});

	decayRate = $derived.by(() => {
		return this.mass * this.decayRatePercent;
	});

	regenRate = $derived.by(() => {
		const level = this.upgradeLevels['breeder_reactor'] || 0;
		return level * 0.2;
	});

	netMassChange = $derived.by(() => {
		return this.regenRate - this.decayRate;
	});

	maxCpm = $derived.by(() => {
		const baseCpm = 1000;
		const level = this.upgradeLevels['coolant_pumps'] || 0;
		return (baseCpm * (1 + level * 0.5) + this.getUpgradeEffect('fusion_ignition') * 1000) * chromaticManager.reactorCapBonus;
	});

	enrichmentBonus = $derived.by(() => {
		const level = this.upgradeLevels['isotopic_enrichment'] || 0;
		return (1 + level * 0.25) * chromaticManager.reactorOutputBonus;
	});

	/** Chance that a tick only burns half its decay. */
	preservationChance = $derived.by(() => {
		const level = this.upgradeLevels['magnetic_confinement'] || 0;
		return Math.min(0.5, level * 0.1);
	});

	/** Mass the core drifts to at the current power, where regen matches the expected burn. With regen it never empties. */
	settledMass = $derived(
		this.regenRate > 0 && this.decayRatePercent > 0 ? this.regenRate / (this.decayRatePercent * (1 - 0.5 * this.preservationChance)) : 0,
	);

	criticalChance = $derived.by(() => {
		const level = this.upgradeLevels['cherenkov_glow'] || 0;
		return level * 0.05;
	});

	currentCpm = $derived(this.cpmFor(this.mass, this.controlRodLevel));

	/** Lowest power that reaches the output cap, any more only burns fuel faster. Above 1 when the fuel can't reach the cap. */
	capControlLevel = $derived(this.mass > 0 ? this.maxCpm / (this.mass * 10 * this.enrichmentBonus) : Infinity);

	/** Same formula as currentCpm for arbitrary inputs, used by the UI to preview a fuel purchase before spending. */
	cpmFor(mass: number, controlLevel: number): number {
		if (mass <= 0 || controlLevel <= 0) return 0;
		return Math.min(mass * controlLevel * 10 * this.enrichmentBonus, this.maxCpm);
	}

	radiationMultiplier = $derived(this.unlocked ? this.multiplierFor(this.currentCpm) : 1);

	/** 1 + CPM / 50 before Cherenkov Glow and Ion Lattice: 100 CPM gives x3, 1000 CPM gives x21. */
	multiplierFor(cpm: number): number {
		return cpm > 0 ? 1 + (cpm / 50) * (1 + this.criticalChance) * (1 + 0.2 * this.getUpgradeEffect('ion_lattice')) : 1;
	}

	/** Fuel mass one electron adds, raised by Neutron Reflector. */
	massPerElectron = $derived(MASS_PER_ELECTRON * (1 + 0.25 * this.getUpgradeEffect('neutron_reflector')));

	ionizeReady = $derived(this.ionizeHold >= IONIZE_HOLD_SECONDS);

	/** 0 to 1, shakes the core and thickens its radiation streaks. */
	instability = $derived.by(() => {
		if (this.mass <= 0) return 0;
		return Math.min(1, this.controlRodLevel * (this.mass / 100));
	});

	timeToEmpty = $derived.by(() => {
		const netLoss = this.decayRate - this.regenRate;
		if (netLoss <= 0) return Infinity;
		return this.mass / netLoss;
	});

	getUpgradeEffect(upgradeId: string): number {
		return this.upgradeLevels[upgradeId] || 0;
	}

	bombardCore(electronAmount: number): boolean {
		/** Written `!(x > 0)` so NaN is refused too, it would poison the mass and the daily fuel quest. */
		if (!this.unlocked || !(electronAmount > 0)) return false;
		const electronBalance = currenciesManager.getAmount(CurrenciesTypes.ELECTRONS);
		if (electronBalance < electronAmount) return false;

		currenciesManager.remove(CurrenciesTypes.ELECTRONS, electronAmount);
		const added = electronAmount * this.massPerElectron;
		this.mass += added;
		this.lastBombard = { mass: added, seq: this.lastBombard.seq + 1 };
		return true;
	}

	setControlRodLevel(level: number) {
		this.controlRodLevel = Math.max(0, Math.min(1, level));
	}

	tick(deltaMs: number) {
		if (!this.unlocked || this.mass <= 0) {
			if (!this.ionizeReady) this.ionizeHold = 0;
			return;
		}

		const seconds = deltaMs / 1000;
		this.mass += this.regenRate * seconds;

		let decay = this.decayRate * seconds;
		if (this.preservationChance > 0 && this.random() < this.preservationChance) {
			decay *= 0.5;
		}

		this.mass = Math.max(0, this.mass - decay);
		if (!this.ionizeReady) this.ionizeHold = this.currentCpm >= this.ionizeCpm ? this.ionizeHold + seconds : 0;
		this.lastTick = Date.now();
	}

	/** Advances the core over an offline stretch and returns the radiation multiplier at its average mass. */
	tickOffline(seconds: number): number {
		if (!this.unlocked || this.mass <= 0) return 1;

		/** Expected decay constant, preservation halves the burn on its share of ticks. */
		const k = this.decayRatePercent * (1 - 0.5 * this.preservationChance);
		const R = this.regenRate;

		let avgMass = this.mass;

		if (seconds > 0) {
			if (k > 0.000001) {
				// m(t) = R/k + (m0 - R/k) * e^(-kt), averaged over [0, t] as R/k + (m0 - R/k) / (kt) * (1 - e^(-kt))
				const equilibrium = R / k;
				const m0 = this.mass;
				const expFactor = Math.exp(-k * seconds);
				const finalMass = equilibrium + (m0 - equilibrium) * expFactor;
				avgMass = equilibrium + ((m0 - equilibrium) / (k * seconds)) * (1 - expFactor);
				this.mass = finalMass;
			} else {
				const finalMass = this.mass + R * seconds;
				avgMass = (this.mass + finalMass) / 2;
				this.mass = finalMass;
			}
		}

		return this.multiplierFor(this.cpmFor(avgMass, this.controlRodLevel));
	}

	purchaseUpgrade(upgradeId: string): boolean {
		const upgrade = RADIATION_UPGRADES[upgradeId];
		if (!upgrade) return false;

		const currentLevel = this.upgradeLevels[upgradeId] || 0;
		if (currentLevel >= upgrade.maxLevel) return false;

		const price = getRadiationUpgradePrice(upgrade, currentLevel);
		const balance = currenciesManager.getAmount(price.currency);
		if (balance < price.amount) return false;

		currenciesManager.remove(price.currency, price.amount);
		this.upgradeLevels = {
			...this.upgradeLevels,
			[upgradeId]: currentLevel + 1,
		};
		return true;
	}

	/** The upgrade levels load apart, through `gameManager.radiationUpgrades`. */
	loadState(state: RadiationState) {
		this.controlRodLevel = state.controlRodLevel ?? 0;
		this.ionizeHold = 0;
		this.lastTick = state.lastTick ?? Date.now();
		this.mass = state.mass ?? 0;
		this.unlocked = state.unlocked ?? false;
	}

	getState(): RadiationState {
		return {
			controlRodLevel: this.controlRodLevel,
			lastTick: this.lastTick,
			mass: this.mass,
			unlocked: this.unlocked,
		};
	}

	reset() {
		this.controlRodLevel = 0;
		this.ionizeHold = 0;
		this.lastTick = Date.now();
		this.mass = 0;
	}

	unlock() {
		this.unlocked = true;
	}
}

export const radiationManager = new RadiationManager();
