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
	test('keeps the picks of a given day across releases, a player mid-day must not see their quests change', () => {
		expect(pickDailyQuests('2026-01-01', DAILY_QUEST_COUNT + 1).map(quest => quest.id)).toEqual(['complete_other_daily_quests', 'clicks_250', 'chromatic_breaks']);
		expect(pickDailyQuests('2026-10-03').map(quest => quest.id)).toEqual(['higgs_bosons_collected', 'chromatic_each_color']);
	});

	test('always returns the requested count of distinct pool quests', () => {
		for (const day of days) {
			for (const count of [DAILY_QUEST_COUNT, DAILY_QUEST_COUNT + 1]) {
				const quests = pickDailyQuests(day, count, context);
				expect(new Set(quests).size, day).toBe(count);
				expect(quests.every(quest => QUEST_POOL.includes(quest)), day).toBe(true);
			}
		}
	});

	test('only offers quests the player can do', () => {
		for (const day of days) {
			for (const quest of pickDailyQuests(day, DAILY_QUEST_COUNT + 1, context)) expect(quest.isAvailable?.(context) ?? true, `${day} ${quest.id}`).toBe(true);
		}
	});

	test('the server cap, picked without the player context, matches the client picks', () => {
		for (const day of days) {
			for (const count of [DAILY_QUEST_COUNT, DAILY_QUEST_COUNT + 1]) expect(getDailyCap(pickDailyQuests(day, count)), day).toBe(getDailyCap(pickDailyQuests(day, count, context)));
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
	const cap = (entitlements: string[]) => getDailyCap(pickDailyQuests('2026-10-03', getDailyQuestCount(entitlements)));
	expect(getDailyQuestCount([])).toBe(DAILY_QUEST_COUNT);
	expect(getDailyQuestCount(['convenience_third_daily_quest'])).toBe(DAILY_QUEST_COUNT + 1);
	expect(cap(['convenience_third_daily_quest'])).toBeGreaterThan(cap([]));
});
