import {SKILL_UPGRADES} from '#data/skillTree.js';
import {gameManager} from '#helpers/managers/GameManager.svelte.js';
import {perfMonitor} from '#helpers/perf/PerfMonitor.js';
import {ACHIEVEMENTS} from '#data/achievements.js';
import {GENERATORS} from '#data/generators.js';
import {UPGRADES} from '#data/upgrades.js';
import {formatNumber} from '#lib/utils.js';

export function setGlobals() {
	window.ACHIEVEMENTS = ACHIEVEMENTS;
	window.GENERATORS = GENERATORS;
	window.SKILL_UPGRADES = SKILL_UPGRADES;
	window.UPGRADES = UPGRADES;
	if (import.meta.env.DEV) {
		window.gameManager = gameManager;
		window.perfMonitor = perfMonitor;
	}
	window.formatNumber = formatNumber;
}
