import { CurrenciesTypes } from '#data/currencies.js';
import { POWER_UPS } from '#data/powerUp.js';
import type { GameManager } from '#helpers/GameManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import { MAX_BOOST_POINTS, XP_PER_ATOM } from '#lib/constants.js';

/**
 * Bumped by any balance change that lowers what a run can earn. Every save then rebases its current run once on load, and the
 * leaderboard refuses scores checked against an older version, so a nerf never leaves runs above what the game allows.
 */
export const BALANCE_VERSION = 1;
/** Margin over the best case, it absorbs float drift and small balance changes, never whole orders of magnitude. */
export const RUN_BOUND_SLACK = 10;
/** No save predates the first commit of the game. */
const GAME_EPOCH =Date.UTC(2024, 9, 31);

/** Seconds the current run has lasted, from the save start when the run start is unknown. */
export function runSeconds(runStartedAt: number, startDate: number, now: number): number {
	return Math.max(0, now - Math.max(runStartedAt > 0 ? runStartedAt : startDate, GAME_EPOCH)) / 1000;
}

export interface RunBounds {
	autoClicksPerSecond: number;
	clickPower: number;
	/** Power-up factor averaged over a long stretch, one of each power-up per shortest spawn interval. */
	powerUpAverage: number;
	/** Every power-up stacked at once, which a short window can hold for `peakSeconds`. */
	powerUpPeak: number;
	peakSeconds: number;
	/** Production and auto-click income per second without power-ups. */
	rate: number;
	startAtoms: number;
	xpPerAtom: number;
}

/**
 * Best rates the loaded state can reach: the whole boost pool on atoms, a full Stability Field, the reactor at its CPM cap and
 * auto-click on. Generators and upgrades are never sold, so within a Protonize run these rates only grow and bound the whole run.
 */
export function measureRunBounds(manager: GameManager, now: number): RunBounds {
	const saved = {
		activePowerUps: manager.activePowerUps,
		autoClick: manager.settings.automation.autoClick,
		controlRodLevel: radiationManager.controlRodLevel,
		currencyBoosts: manager.currencyBoosts,
		lastInteractionTime: manager.lastInteractionTime,
		mass: radiationManager.mass,
		tickTime: manager.tickTime,
	};

	try {
		manager.activePowerUps = [];
		manager.settings.automation.autoClick = true;
		manager.lastInteractionTime = 0;
		manager.tickTime = now;
		manager.currencyBoosts = { ...saved.currencyBoosts, [CurrenciesTypes.ATOMS]: Math.min(MAX_BOOST_POINTS, manager.boostPointsTotal) };
		if (radiationManager.unlocked) {
			radiationManager.mass = 1e300;
			radiationManager.controlRodLevel = 1;
		}

		const effect = manager.powerUpEffectMultiplier;
		const duration = manager.powerUpDurationMultiplier;
		const interval = manager.powerUpInterval[0];
		const powerUpPeak = POWER_UPS.reduce((product, powerUp) => product * powerUp.multiplier * effect, 1);
		const averageGain = POWER_UPS.reduce((total, powerUp) => total + (powerUp.multiplier * effect - 1) * powerUp.duration * duration, 0) / interval;

		return {
			autoClicksPerSecond: manager.autoClicksPerSecond,
			clickPower: manager.clickPower,
			peakSeconds: (Math.max(...POWER_UPS.map(powerUp => powerUp.duration)) * duration) / 1000,
			powerUpAverage: Math.min(powerUpPeak, 1 + averageGain),
			powerUpPeak,
			rate: manager.atomsPerSecond + manager.clickPower * manager.autoClicksPerSecond,
			startAtoms: manager.effects.value('start_atoms', 0, manager),
			xpPerAtom: XP_PER_ATOM * manager.xpGainMultiplier,
		};
	} finally {
		manager.activePowerUps = saved.activePowerUps;
		manager.settings.automation.autoClick = saved.autoClick;
		manager.lastInteractionTime = saved.lastInteractionTime;
		manager.tickTime = saved.tickTime;
		manager.currencyBoosts = saved.currencyBoosts;
		radiationManager.mass = saved.mass;
		radiationManager.controlRodLevel = saved.controlRodLevel;
	}
}

/** Most atoms a Protonize run can earn in `seconds` with `clicks` clicks, offline time included since it pays a tenth of the online rate. */
export function maxRunAtoms(bounds: RunBounds, seconds: number, clicks: number): number {
	const { clickPower, peakSeconds, powerUpAverage, powerUpPeak, rate, startAtoms } = bounds;
	const production = rate * (powerUpAverage * seconds + (powerUpPeak - powerUpAverage) * Math.min(seconds, peakSeconds));
	return RUN_BOUND_SLACK * (production + clicks * clickPower * powerUpPeak + startAtoms);
}
