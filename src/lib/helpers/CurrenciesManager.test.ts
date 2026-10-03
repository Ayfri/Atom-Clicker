import { expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { CurrenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { LAYERS } from '#helpers/statConstants.js';

const { ATOMS, ELECTRONS, PHOTONS, PROTONS, RED_LIGHT } = CurrenciesTypes;

test('add counts earnings, ignoring zero, negative and NaN amounts', () => {
	const currencies = new CurrenciesManager();
	for (const amount of [10, -5, 0, NaN]) currencies.add(ATOMS, amount);
	currencies.remove(ATOMS, NaN);
	expect(currencies.currencies[ATOMS]).toEqual({ amount: 10, earnedAllTime: 10, earnedRun: 10 });
});

test('remove floors at zero and never touches earnings', () => {
	const currencies = new CurrenciesManager();
	currencies.add(PROTONS, 10);
	currencies.remove(PROTONS, 25);
	expect(currencies.currencies[PROTONS]).toEqual({ amount: 0, earnedAllTime: 10, earnedRun: 10 });
});

test('a layer reset clears the run of the currencies up to it and keeps all-time earnings', () => {
	const currencies = new CurrenciesManager();
	for (const currency of [ATOMS, ELECTRONS, PHOTONS, PROTONS, RED_LIGHT]) currencies.add(currency, 5);
	currencies.reset(LAYERS.ELECTRONIZE);
	expect(currencies.currencies[ATOMS]).toEqual({ amount: 0, earnedAllTime: 5, earnedRun: 0 });
	expect(currencies.getAmount(PROTONS)).toBe(0);
	expect([ELECTRONS, PHOTONS, RED_LIGHT].map(currency => currencies.getAmount(currency))).toEqual([5, 5, 5]);
});
