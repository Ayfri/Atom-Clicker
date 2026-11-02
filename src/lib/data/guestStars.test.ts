import { describe, expect, test } from 'bun:test';
import { flareIntensity, GUEST_STAR_LIFE, guestStarSpot } from '#data/guestStars.js';

describe('flareIntensity', () => {
	test('is dark before the flare and once its life is over', () => {
		expect(flareIntensity(0, false)).toBe(0);
		expect(flareIntensity(-1, false)).toBe(0);
		expect(flareIntensity(GUEST_STAR_LIFE, false)).toBe(0);
		expect(flareIntensity(GUEST_STAR_LIFE + 5, true)).toBe(0);
	});

	test('holds steady at full brightness when still and twinkles within the top of the range otherwise', () => {
		for (let age = 1.3; age < 6.4; age += 0.05) {
			expect(flareIntensity(age, true)).toBe(1);
			const twinkle = flareIntensity(age, false);
			expect(twinkle).toBeGreaterThanOrEqual(0.7);
			expect(twinkle).toBeLessThanOrEqual(1);
		}
	});

	test('rises and fades without going negative or NaN', () => {
		let previous = 0;
		for (let age = 0.05; age < 1.2; age += 0.05) {
			const rising = flareIntensity(age, true);
			expect(rising).toBeGreaterThanOrEqual(previous);
			previous = rising;
		}
		previous = 1;
		for (let age = 6.5; age < GUEST_STAR_LIFE; age += 0.05) {
			const fading = flareIntensity(age, true);
			expect(fading).toBeLessThanOrEqual(previous);
			expect(fading).toBeGreaterThanOrEqual(0);
			previous = fading;
		}
	});
});

describe('guestStarSpot', () => {
	test('keeps its margin from the side edges and skips the points a panel covers', () => {
		const draws = [0.1, 0, 0.9, 1];
		let drawn = 0;
		const tried: { x: number; y: number }[] = [];
		const spot = guestStarSpot(
			400,
			800,
			56,
			(x, y) => {
				tried.push({ x, y });
				return x > 200;
			},
			() => draws[drawn++],
		);
		expect(tried).toHaveLength(2);
		expect(tried[0].x).toBeCloseTo(56 + 0.1 * 288);
		expect(tried[0].y).toBeCloseTo(160);
		expect(spot!.x).toBeCloseTo(56 + 0.9 * 288);
		expect(spot!.y).toBeCloseTo(560);
	});

	test('gives up after a handful of tries when every point is covered', () => {
		let calls = 0;
		expect(guestStarSpot(400, 800, 56, () => (calls++, false))).toBeNull();
		expect(calls).toBe(8);
	});
});
