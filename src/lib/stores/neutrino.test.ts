import { describe, expect, test } from 'bun:test';
import { NEUTRINO_MAX_INTERVAL_MS, NEUTRINO_MIN_INTERVAL_MS } from '#data/neutrinos.js';
import { NeutrinoTimer } from '#stores/neutrino.svelte.js';

describe('NeutrinoTimer', () => {
	test('waits between the shortest and the longest interval', () => {
		expect(new NeutrinoTimer(() => 0).remainingMs).toBe(NEUTRINO_MIN_INTERVAL_MS);
		expect(new NeutrinoTimer(() => 0.999999).remainingMs).toBeLessThan(NEUTRINO_MAX_INTERVAL_MS);
		expect(new NeutrinoTimer(() => 0.5).remainingMs).toBe((NEUTRINO_MIN_INTERVAL_MS + NEUTRINO_MAX_INTERVAL_MS) / 2);
	});

	test('is due once the whole wait is spent, never before', () => {
		const timer = new NeutrinoTimer(() => 0);
		expect(timer.consume(NEUTRINO_MIN_INTERVAL_MS - 1)).toBe(false);
		expect(timer.consume(1)).toBe(true);
		expect(timer.consume(5000)).toBe(true);
		expect(timer.remainingMs).toBe(0);
	});

	test('restarting draws a new wait', () => {
		const draws = [0, 1];
		const timer = new NeutrinoTimer(() => draws.shift() ?? 0);
		timer.consume(100_000);
		timer.restart();
		expect(timer.remainingMs).toBe(NEUTRINO_MAX_INTERVAL_MS);
	});
});
