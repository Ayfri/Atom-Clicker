import { expect, test } from 'bun:test';
import { levelFromTotalXP, totalXPForLevel, xpForLevel } from '#helpers/xp.js';

test('level costs grow strictly and add up to the cumulative total', () => {
	let total = 0;
	for (let level = 1; level <= 120; level++) {
		expect(xpForLevel(level)).toBeGreaterThan(xpForLevel(level - 1));
		total += xpForLevel(level);
		expect(totalXPForLevel(level)).toBe(total);
	}
});

test('levelFromTotalXP inverts totalXPForLevel on both sides of every threshold', () => {
	for (let level = 1; level <= 120; level++) {
		const threshold = totalXPForLevel(level);
		expect(levelFromTotalXP(threshold)).toBe(level);
		// Past 2^53 a whole XP point is below double precision, so the edge is the next lower double.
		expect(levelFromTotalXP(threshold * (1 - Number.EPSILON))).toBe(level - 1);
	}
});

test('non-positive and non-finite XP sits at level 0', () => {
	for (const xp of [0, -5, NaN, Infinity]) expect(levelFromTotalXP(xp)).toBe(0);
	expect(totalXPForLevel(0)).toBe(0);
});

test('the first levels keep their tuned costs', () => {
	expect([1, 2, 3, 10].map(xpForLevel)).toEqual([100, 332, 804, 65_010]);
});
