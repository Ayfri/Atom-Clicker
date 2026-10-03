import { expect, test } from 'bun:test';
import { CurrenciesTypes } from '#data/currencies.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { SimulationEngine } from '#lib/simulation/engine.js';
import { buildBenchmarkConfig, profileForm } from '#lib/simulation/presets.js';

const run = () => {
	const { milestones, snapshots, spikes } = new SimulationEngine(buildBenchmarkConfig(profileForm('balanced', 0.5, 7))).run();
	return { milestones, snapshots, spikes };
};

test('a seeded run is reproducible and hands the live game back untouched', () => {
	gameManager.resetAll();
	currenciesManager.add(CurrenciesTypes.ATOMS, 123);
	gameManager.upgrades = ['molecular_boost'];
	const live = JSON.stringify(gameManager.getCurrentState());

	const first = run();
	expect(first.snapshots.length).toBeGreaterThan(0);
	expect(run()).toEqual(first);
	expect(JSON.stringify(gameManager.getCurrentState())).toBe(live);
});
