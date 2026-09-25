/// <reference types="svelte" />
import type {gameManager} from '$helpers/GameManager.svelte';
import type {ACHIEVEMENTS} from '$data/achievements';
import type {GENERATORS} from '$data/generators';
import type {UPGRADES} from '$data/upgrades';
import type {formatNumber} from '$lib/utils';
/// <reference types="vite/client" />

declare global {
	interface Window {
		formatNumber: typeof formatNumber;
		gameManager: typeof gameManager;
		ACHIEVEMENTS: typeof ACHIEVEMENTS;
		GENERATORS: typeof GENERATORS;
		SKILL_UPGRADES: typeof SKILL_UPGRADES;
		UPGRADES: typeof UPGRADES;
	}
}
