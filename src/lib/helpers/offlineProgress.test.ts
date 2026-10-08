import { beforeEach, expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import type { PowerUp } from '#lib/types.js';

const HOUR = 3_600_000;

const powerUp = (startTime: number, duration: number): PowerUp => ({ description: '', duration, id: `p${startTime}`, multiplier: 25, name: 'Boost', startTime });

/** Atoms a catch-up of `awayMs` pays, from an empty bank. */
function catchUp(awayMs: number): number {
	currenciesManager.hardReset();
	gameManager.catchUpOffline(awayMs);
	return gameManager.atoms;
}

beforeEach(() => {
	gameManager.resetAll();
	gameManager.generators = { molecule: { count: 10, level: 0, unlocked: true } };
	gameManager.skillUpgrades = ['offlineProgress'];
});

test('pays a tenth of the production rate for the time away', () => {
	const rate = gameManager.atomsPerSecond;
	expect(rate).toBeGreaterThan(0);
	expect(catchUp(HOUR)).toBeCloseTo(rate * 3600 * 0.1);
	expect(gameManager.offlineProgressSummary?.appliedMs).toBe(HOUR);
});

test('pays nothing under 30 seconds, with the setting off or before the skill', () => {
	expect(gameManager.catchUpOffline(29_000)).toBe(false);
	gameManager.settings.gameplay.offlineProgressEnabled = false;
	expect(gameManager.catchUpOffline(HOUR)).toBe(false);
	gameManager.settings.gameplay.offlineProgressEnabled = true;
	gameManager.skillUpgrades = [];
	expect(gameManager.catchUpOffline(HOUR)).toBe(false);
});

test('caps the time at 6 hours, raised by the cap upgrades', () => {
	gameManager.catchUpOffline(10 * 24 * HOUR);
	expect(gameManager.offlineProgressSummary?.appliedMs).toBe(6 * HOUR);
	gameManager.upgrades = ['offline_cap_12h', 'offline_cap_3d'];
	gameManager.catchUpOffline(10 * 24 * HOUR);
	expect(gameManager.offlineProgressSummary?.appliedMs).toBe(72 * HOUR);
});

test('an expired power-up never multiplies the catch-up, a live one ran through it all', () => {
	const base = catchUp(HOUR);
	/** Collected a minute before the tab froze, both power-ups saw the whole hour start, only the longer one is still live after it. */
	gameManager.activePowerUps = [powerUp(Date.now() - HOUR - 60_000, 2 * 60_000)];
	expect(catchUp(HOUR)).toBeCloseTo(base);
	expect(gameManager.activePowerUps).toEqual([]);

	gameManager.activePowerUps = [powerUp(Date.now() - HOUR - 60_000, 2 * HOUR)];
	expect(catchUp(HOUR)).toBeCloseTo(base * 25);
});

test('offline purchases stay out of the daily quest counters', () => {
	currenciesManager.add(CurrenciesTypes.ATOMS, 1e6);
	gameManager.applyingOfflineProgress = true;
	gameManager.purchaseGenerator('crystal');
	gameManager.applyingOfflineProgress = false;
	expect(gameManager.dailyStats.generatorsPurchased).toBe(0);
	expect(gameManager.totalGeneratorsPurchasedAllTime).toBe(1);
});
