import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { ACHIEVEMENTS } from '#data/achievements.js';
import { getQuestTarget, QUEST_POOL } from '#data/dailyQuests.js';
import { MAX_ACHIEVEMENT_IDS_PER_REQUEST } from '#data/quarkAchievements.js';
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

describe('claiming every achievement', () => {
	const ids = Object.keys(ACHIEVEMENTS);
	const stubPost = (answer: (batch: string[]) => { balance: number; granted: number } | null) => {
		const sizes: number[] = [];
		const post = spyOn(quarksManager as unknown as { postAction: (path: string, body: { achievementIds: string[] }) => Promise<unknown> }, 'postAction').mockImplementation(
			async (_path, body) => {
				sizes.push(body.achievementIds.length);
				return answer(body.achievementIds);
			},
		);
		return { post, sizes };
	};

	beforeEach(() => {
		quarksManager.claimedAchievementIds = [];
		quarksManager.balance = 0;
	});

	test('goes out in sequential batches of at most the server limit', async () => {
		expect(ids.length).toBeGreaterThan(MAX_ACHIEVEMENT_IDS_PER_REQUEST);
		const { post, sizes } = stubPost(batch => ({ balance: 0, granted: batch.length }));
		expect(await quarksManager.claimAchievements(ids)).toBe(ids.length);
		post.mockRestore();
		expect(sizes.every(size => size <= MAX_ACHIEVEMENT_IDS_PER_REQUEST)).toBe(true);
		expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(ids.length);
		expect(quarksManager.claimedAchievementIds).toHaveLength(ids.length);
	});

	test('stops at the first failed batch and keeps the ones already claimed', async () => {
		const { post, sizes } = stubPost(() => (sizes.length === 1 ? { balance: 0, granted: MAX_ACHIEVEMENT_IDS_PER_REQUEST } : null));
		expect(await quarksManager.claimAchievements(ids)).toBe(MAX_ACHIEVEMENT_IDS_PER_REQUEST);
		post.mockRestore();
		expect(sizes).toHaveLength(2);
		expect(quarksManager.claimedAchievementIds).toEqual(ids.slice(0, MAX_ACHIEVEMENT_IDS_PER_REQUEST));
	});
});

test('the same day keeps its frozen targets and progress', () => {
	quarksManager['rolloverDailyStatsIfNeeded']('2026-10-02');
	expect(gameManager.dailyStats.questTargets.atoms_earned).toBe(123);
	expect(gameManager.dailyStats.clicks).toBe(40);
	expect(quarksManager.getTarget(atomsQuest)).toBe(123);
});
