import { describe, expect, test } from 'bun:test';
import { neutrinoPath } from '#components/cosmos/periodic/neutrinoPath.js';
import { NEUTRINO_FLIGHT_MS, NEUTRINO_REDUCED_FLIGHT_MS } from '#data/neutrinos.js';

const OFF = 24;
const MARGIN = 32;
const BAND = 0.7;
const SIZES = [
	[360, 640],
	[1920, 1080],
] as const;

function lcg(seed: number): () => number {
	let state = seed;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 2 ** 32;
	};
}

const parse = (transform: unknown) => {
	const [x, y, angle, scaleX, scaleY] = String(transform).match(/-?\d+(?:\.\d+)?/g)!.map(Number);
	return { angle, scaleX, scaleY, x, y };
};

describe('neutrinoPath', () => {
	test.each(SIZES)('crosses a %ix%i overlay from one off-screen side to the other, in bounds in between', (width, height) => {
		for (let seed = 1; seed <= 300; seed++) {
			const { durationMs, keyframes } = neutrinoPath(width, height, lcg(seed));
			const frames = keyframes.map(keyframe => ({ ...parse(keyframe.transform), offset: keyframe.offset as number }));
			const [first, last] = [frames[0], frames.at(-1)!];

			expect(durationMs).toBe(NEUTRINO_FLIGHT_MS);
			expect(frames.length).toBeLessThanOrEqual(30);
			expect([first.x, last.x]).toEqual(first.x < 0 ? [-OFF, width + OFF] : [width + OFF, -OFF]);
			expect(first.offset).toBe(0);
			expect(last.offset).toBe(1);

			for (const [i, frame] of frames.entries()) {
				if (i > 0) expect(frame.offset).toBeGreaterThan(frames[i - 1].offset);
				expect(frame.y).toBeGreaterThanOrEqual(MARGIN);
				expect(frame.y).toBeLessThanOrEqual(height * BAND + 0.1);
				if (i > 0 && i < frames.length - 1) {
					expect(frame.x).toBeGreaterThanOrEqual(MARGIN);
					expect(frame.x).toBeLessThanOrEqual(width - MARGIN);
				}
				if (i > 0) expect(Math.abs(frame.angle - frames[i - 1].angle)).toBeLessThanOrEqual(180);
			}
		}
	});

	test('reduced motion glides through three points with no rotation or stretch', () => {
		for (let seed = 1; seed <= 50; seed++) {
			const { durationMs, keyframes } = neutrinoPath(360, 640, lcg(seed), true);
			expect(durationMs).toBe(NEUTRINO_REDUCED_FLIGHT_MS);
			expect(keyframes.map(keyframe => keyframe.offset)).toEqual([0, 0.5, 1]);
			for (const keyframe of keyframes) {
				const { angle, scaleX, scaleY } = parse(keyframe.transform);
				expect([angle, scaleX, scaleY]).toEqual([0, 1, 1]);
			}
		}
	});
});
