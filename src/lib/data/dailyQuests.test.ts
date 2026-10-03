import { describe, expect, test } from 'bun:test';
import { type DailyQuestContext, type DailyStats, DAILY_QUEST_COUNT, getDailyCap, getDailyQuestCount, getQuestProgress, getQuestTarget, pickDailyQuests, QUEST_POOL } from '#data/dailyQuests.js';
import { statsConfig } from '#helpers/statConstants.js';

const context: DailyQuestContext = {
	chromaticSpawnBoost: 1,
	fuelAffordable: 0,
	hasElectronized: false,
	hasPhotonRealm: false,
	hasPrism: false,
	hasRadiationRealm: false,
	hasThirdQuestSlot: false,
	highestAPSRun: 0,
	remainingAchievements: 100,
};

const days = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));

describe('pickDailyQuests', () => {
	test('is deterministic per day, since the server derives the same quests to size the daily cap', () => {
		for (const day of days.slice(0, 30)) expect(pickDailyQuests(day, 3).map(q => q.id)).toEqual(pickDailyQuests(day, 3).map(q => q.id));
	});

	test('always returns the requested count of distinct quests', () => {
		for (const day of days) {
			for (const count of [DAILY_QUEST_COUNT, DAILY_QUEST_COUNT + 1]) {
				const ids = pickDailyQuests(day, count, context).map(quest => quest?.id);
				expect(ids, day).toHaveLength(count);
				expect(new Set(ids).size, day).toBe(count);
				expect(ids, day).not.toContain(undefined);
			}
		}
	});

	test('only offers quests the player can do', () => {
		for (const day of days) {
			for (const quest of pickDailyQuests(day, 3, context)) expect(quest.isAvailable?.(context) ?? true, `${day} ${quest.id}`).toBe(true);
		}
	});

	test('spreads over the whole available pool across a year', () => {
		const seen = new Set(days.flatMap(day => pickDailyQuests(day, DAILY_QUEST_COUNT, context).map(quest => quest.id)));
		const available = QUEST_POOL.filter(quest => quest.isAvailable?.(context) ?? true);
		expect(seen.size).toBe(available.length);
	});
});

test('quest ids are unique, the server keys claims on them', () => {
	const ids = QUEST_POOL.map(quest => quest.id);
	expect(new Set(ids).size).toBe(ids.length);
});

test('every quest metric is a counter of the daily stats', () => {
	const stats = statsConfig.dailyStats.defaultValue;
	for (const quest of QUEST_POOL) {
		if (quest.metric !== 'chromaticColorBreaks') expect(typeof stats[quest.metric], quest.id).toBe('number');
	}
});

test('targets never fall below their floor', () => {
	for (const quest of QUEST_POOL) {
		expect(getQuestTarget(quest, context)).toBe(quest.floor);
		expect(getQuestTarget(quest, { ...context, chromaticSpawnBoost: 2.3, fuelAffordable: 1e9, highestAPSRun: 1e6 })).toBeGreaterThanOrEqual(quest.floor);
	}
});

test('the color quest progresses with the least broken color', () => {
	const stats: DailyStats = { ...structuredClone(statsConfig.dailyStats.defaultValue), chromaticColorBreaks: { blue: 4, green: 9, red: 12 } };
	expect(getQuestProgress('chromaticColorBreaks', stats)).toBe(4);
	expect(getQuestProgress('chromaticColorBreaks', statsConfig.dailyStats.defaultValue)).toBe(0);
	expect(getQuestProgress('clicks', { ...stats, clicks: 7 })).toBe(7);
});

test('the third quest entitlement raises the count and the daily cap', () => {
	expect(getDailyQuestCount([])).toBe(DAILY_QUEST_COUNT);
	expect(getDailyQuestCount(['convenience_third_daily_quest'])).toBe(DAILY_QUEST_COUNT + 1);
	expect(getDailyCap(pickDailyQuests('2026-10-03', 3))).toBe(3);
});
