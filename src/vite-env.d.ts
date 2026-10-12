/// <reference types="svelte" />
import type {gameManager} from '#helpers/GameManager.svelte.js';
import type {perfMonitor} from '#helpers/PerfMonitor.js';
import type {ACHIEVEMENTS} from '#data/achievements.js';
import type {GENERATORS} from '#data/generators.js';
import type {UPGRADES} from '#data/upgrades.js';
import type {formatNumber} from '#lib/utils.js';
/// <reference types="vite/client" />

declare global {
	interface Window {
		formatNumber: typeof formatNumber;
		gameManager: typeof gameManager;
		perfMonitor: typeof perfMonitor;
		ACHIEVEMENTS: typeof ACHIEVEMENTS;
		GENERATORS: typeof GENERATORS;
		SKILL_UPGRADES: typeof SKILL_UPGRADES;
		UPGRADES: typeof UPGRADES;
	}
}
