import { beforeEach, expect, test } from 'bun:test';
import { SPECTROSCOPE_ID } from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { zs } from '#data/elements.js';
import { CHAINS, DECAY_EVENTS_PER_SECOND } from '#data/sites.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
import type { PowerUp } from '#lib/types.js';

const MINUTE = 60_000;
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

test('each offline auto-buy builds a whole Bulk Assembly batch', () => {
	gameManager.skillUpgrades = ['offlineProgress', 'autoClicker', 'moleculeAutoBuy'];
	gameManager.toggleAutomation('molecule');
	gameManager.photonUpgrades = { auto_buy_bulk: 1, offline_progress: 1 };
	currenciesManager.hardReset();
	currenciesManager.add(CurrenciesTypes.ATOMS, 1e12);
	/** Offline auto-buy runs at 1/120 speed, so a 30 s period fires every hour, here at 1 h and 2 h of a 3 h absence. */
	expect(gameManager.catchUpOffline(3 * HOUR)).toBe(true);
	expect(gameManager.offlineProgressSummary?.autoBuyCounts.molecule).toBe(10);
	expect(gameManager.generators.molecule?.count).toBe(20);
});

test('Overdrive keeps draining bosons while away, doubles production until they run out and then stops', () => {
	const now = Date.now();
	gameManager.clock = () => now;
	try {
		gameManager.skillUpgrades = ['offlineProgress', 'higgsOverdrive'];
		const rate = gameManager.atomsPerSecond;
		currenciesManager.hardReset();
		currenciesManager.add(CurrenciesTypes.HIGGS_BOSON, 3);
		/** Paid until 5 minutes into the hour away, so renewals at 5, 10 and 15 minutes spend the 3 bosons and the one at 20 finds none. */
		gameManager.overdrive = { molecule: { active: true, paidUntil: now - HOUR + 5 * MINUTE } };
		expect(gameManager.catchUpOffline(HOUR)).toBe(true);

		expect(gameManager.offlineProgressSummary?.overdriveBosonsSpent).toBe(3);
		expect(currenciesManager.getAmount(CurrenciesTypes.HIGGS_BOSON)).toBe(0);
		expect(gameManager.overdrive.molecule?.active).toBe(false);
		expect(gameManager.atoms).toBeCloseTo(rate * 0.1 * (60 + 20) * 60);
	} finally {
		gameManager.clock = () => Date.now();
	}
});

test('Decay events, lamp and sky Light are paid once for the time away and listed in the gains', () => {
	gameManager.totalIonizesAllTime = 1;
	cosmosManager.instruments = [SPECTROSCOPE_ID];
	cosmosManager.discovered = ['mira'];
	gameManager.periodic = {
		identified: zs('H U Th'),
		sites: { bigbang: { index: 2, level: 0, progress: 0 }, decay: { index: 0, level: 1, progress: 0 }, neutron: { index: CHAINS.neutron.steps.length, level: 0, progress: 0 } },
	};
	const rate = periodicManager.decayEventsPerSecond;
	expect(rate).toBe(2 * DECAY_EVENTS_PER_SECOND);
	const passive = { ...gameManager.passiveLight };
	expect(passive.red).toBeGreaterThan(periodicManager.lampLight.red);

	currenciesManager.hardReset();
	expect(gameManager.catchUpOffline(HOUR)).toBe(true);
	const { currencyGains } = gameManager.offlineProgressSummary!;
	expect(currenciesManager.getAmount(CurrenciesTypes.DECAY_EVENTS)).toBeCloseTo(rate * 3600);
	expect(currencyGains[CurrenciesTypes.DECAY_EVENTS]).toBeCloseTo(rate * 3600);
	const lights = { blue: CurrenciesTypes.BLUE_LIGHT, green: CurrenciesTypes.GREEN_LIGHT, red: CurrenciesTypes.RED_LIGHT } as const;
	for (const color of ['blue', 'green', 'red'] as const) {
		expect(currenciesManager.getAmount(lights[color])).toBeCloseTo(passive[color] * 3600);
		expect(currencyGains[lights[color]]).toBeCloseTo(passive[color] * 3600);
	}
});

test('the Starlight boost multiplies the Starlight paid while away', () => {
	gameManager.totalIonizesAllTime = 1;
	const rate = cosmosManager.starlightPerSecond;
	gameManager.currencyBoosts = { [CurrenciesTypes.STARLIGHT]: 10 };
	expect(cosmosManager.starlightPerSecond).toBeCloseTo(rate * 2);

	currenciesManager.hardReset();
	expect(gameManager.catchUpOffline(HOUR)).toBe(true);
	expect(currenciesManager.getAmount(CurrenciesTypes.STARLIGHT)).toBeCloseTo(rate * 2 * 3600);
	expect(gameManager.offlineProgressSummary?.currencyGains[CurrenciesTypes.STARLIGHT]).toBeCloseTo(rate * 2 * 3600);
});

test('the summary lists the elements forged while away, and a source stops at the unread cap however fast it forges', () => {
	gameManager.totalIonizesAllTime = 1;
	cosmosManager.instruments = [SPECTROSCOPE_ID];
	cosmosManager.discovered = ['cmb'];
	gameManager.periodic = { active: ['bigbang'], identified: [], sites: { bigbang: { index: 0, level: 999, progress: 0 } } };

	expect(gameManager.catchUpOffline(HOUR)).toBe(true);
	expect(gameManager.offlineProgressSummary?.forged).toEqual(zs('H He'));
	expect(periodicManager.statuses.bigbang).toEqual({ kind: 'full', unread: zs('H He'), z: zs('Li')[0] });
});

test('offline purchases stay out of the daily quest counters', () => {
	currenciesManager.add(CurrenciesTypes.ATOMS, 1e6);
	gameManager.applyingOfflineProgress = true;
	gameManager.purchaseGenerator('crystal');
	gameManager.applyingOfflineProgress = false;
	expect(gameManager.dailyStats.generatorsPurchased).toBe(0);
	expect(gameManager.totalGeneratorsPurchasedAllTime).toBe(1);
});
