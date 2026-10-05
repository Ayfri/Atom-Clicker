import { SimulationEngine } from '#lib/simulation/engine.js';
import { type BotProfileId, buildBenchmarkConfig, profileForm } from '#lib/simulation/presets.js';

/** Plays a seeded bot and calls `onSnapshot` with the live game at every snapshot interval, the run restores the game afterwards. */
export function playHonestRun(profile: BotProfileId, hours: number, onSnapshot: () => void) {
	const engine = new SimulationEngine(buildBenchmarkConfig(profileForm(profile, hours)));
	const hooked = engine as unknown as { takeSnapshot: () => void };
	const takeSnapshot = hooked.takeSnapshot.bind(engine);
	hooked.takeSnapshot = () => {
		takeSnapshot();
		onSnapshot();
	};
	engine.run();
}
