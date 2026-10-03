import { beforeEach, expect, test } from 'bun:test';
import { getQuestTarget, QUEST_POOL } from '#data/dailyQuests.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { quarksManager } from '#helpers/QuarksManager.svelte.js';
import { statsConfig } from '#helpers/statConstants.js';

const atomsQuest = QUEST_POOL.find(quest => quest.id === 'atoms_earned')!;

beforeEach(() => {
	gameManager.resetAll();
	gameManager.dailyStats = { ...structuredClone(statsConfig.dailyStats.defaultValue), clicks: 40, dayKey: '2026-10-02', questIds: ['atoms_earned'], questTargets: { atoms_earned: 123 } };
	gameManager.highestAPSRun = 1e9;
	quarksManager.quests = [atomsQuest];
});

test('a new day clears the counters and sizes its targets afresh, even for a quest picked two days running', () => {
	quarksManager['rolloverDailyStatsIfNeeded']('2026-10-03');
	const { clicks, dayKey, questIds } = gameManager.dailyStats;
	expect([clicks, dayKey, [...questIds]]).toEqual([0, '2026-10-03', ['atoms_earned']]);
	expect(gameManager.dailyStats.questTargets.atoms_earned).toBe(getQuestTarget(atomsQuest, gameManager.dailyQuestContext(false)));
	expect(gameManager.dailyStats.questTargets.atoms_earned).toBe(1e9 * 10_800);
});

test('the same day keeps its frozen targets and progress', () => {
	quarksManager['rolloverDailyStatsIfNeeded']('2026-10-02');
	expect(gameManager.dailyStats.questTargets.atoms_earned).toBe(123);
	expect(gameManager.dailyStats.clicks).toBe(40);
	expect(quarksManager.getTarget(atomsQuest)).toBe(123);
});
