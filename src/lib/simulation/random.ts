/**
 * A run has to be reproducible for a before/after pair to mean anything, so the two random draws in the engine
 * (power-up interval and power-up type) come from a seeded generator rather than `Math.random`.
 */
export function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

export const DEFAULT_SEED = 20260101;
