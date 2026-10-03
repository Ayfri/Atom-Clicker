import { expect, test } from 'bun:test';
import { checkStatePlausibility } from '#helpers/plausibility.js';

const HOUR = 3_600_000;

const legit = {
	currencies: { Atoms: { amount: 50, earnedAllTime: 500, earnedRun: 200 } },
	inGameTime: HOUR,
	lastSave: 10 * HOUR,
	startDate: 8 * HOUR,
	totalClicksAllTime: 100,
	totalClicksRun: 40,
	totalElectronizesAllTime: 1,
	totalElectronizesRun: 1,
	totalProtonisesAllTime: 3,
	totalProtonisesRun: 2,
};

test('a consistent save raises nothing', () => {
	expect(checkStatePlausibility(legit)).toEqual([]);
});

test('flags run counters above their all-time totals', () => {
	expect(checkStatePlausibility({ ...legit, totalClicksRun: 101 })).toEqual(['totalClicksRun (101) exceeds totalClicksAllTime (100)']);
});

test('flags a currency holding or earning more than it ever earned', () => {
	const warnings = checkStatePlausibility({ ...legit, currencies: { Atoms: { amount: 501, earnedAllTime: 500, earnedRun: 900 } } });
	expect(warnings).toHaveLength(2);
	expect(warnings[0]).toStartWith('Currency Atoms: amount');
});

test('flags more play time than wall-clock time, with a minute of drift allowed', () => {
	expect(checkStatePlausibility({ ...legit, inGameTime: 2 * HOUR + 60_000 })).toEqual([]);
	expect(checkStatePlausibility({ ...legit, inGameTime: 2 * HOUR + 60_001 })).toHaveLength(1);
});

test('ignores fields that are missing or not numbers instead of throwing', () => {
	expect(checkStatePlausibility({})).toEqual([]);
	expect(checkStatePlausibility({ currencies: { Atoms: null }, totalClicksAllTime: 'x', totalClicksRun: 5 })).toEqual([]);
	expect(checkStatePlausibility({ currencies: 'broken' })).toEqual([]);
});
