import { describe, expect, test } from 'bun:test';
import { COSMOS_QUEST_SECONDS, type DailyQuestContext, type DailyStats, DAILY_QUEST_COUNT, getDailyCap, getDailyQuestCount, getQuestProgress, getQuestTarget, pickDailyQuests, QUEST_POOL } from '#data/dailyQuests.js';
import { statsConfig } from '#helpers/statConstants.js';

const context: DailyQuestContext = {
	chromaticSpawnBoost: 1,
	cosmosStudyReach: 0,
	fuelAffordable: 0,
	hasCosmos: false,
	hasElectronized: false,
	hasPhotonRealm: false,
	hasPrism: false,
	hasRadiationRealm: false,
	hasThirdQuestSlot: false,
	highestAPSRun: 0,
	remainingAchievements: 100,
	starlightPerSecond: 0,
};

/** Every system before the Cosmos, the newest pool a released save can see. */
const preCosmos: DailyQuestContext = { ...context, hasElectronized: true, hasPhotonRealm: true, hasPrism: true, hasRadiationRealm: true, hasThirdQuestSlot: true };

const days = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));

describe('pickDailyQuests', () => {
	test('keeps the picks of a given day across releases, a player mid-day must not see their quests change', () => {
		const ids = (day: string, count = DAILY_QUEST_COUNT) => pickDailyQuests(day, count, preCosmos).map(quest => quest.id);
		expect(ids('2026-01-01', DAILY_QUEST_COUNT + 1)).toEqual(['complete_other_daily_quests', 'clicks_250', 'chromatic_breaks']);
		expect(ids('2026-10-03')).toEqual(['higgs_bosons_collected', 'chromatic_each_color']);
		expect(ids('2026-10-05', DAILY_QUEST_COUNT + 1)).toEqual(['fuel_injected', 'higgs_bosons_collected', 'upgrades_purchased']);
	});

	test('offers the Cosmos quests only once the Cosmos is open', () => {
		const cosmosIds = new Set(['cosmos_studies', 'starlight_earned']);
		const offered = (ctx: DailyQuestContext) => days.flatMap(day => pickDailyQuests(day, DAILY_QUEST_COUNT, ctx).map(quest => quest.id)).filter(id => cosmosIds.has(id));
		expect(offered(preCosmos)).toEqual([]);
		expect(new Set(offered({ ...preCosmos, hasCosmos: true }))).toEqual(cosmosIds);
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
		expect(
			getQuestTarget(quest, { ...context, chromaticSpawnBoost: 2.3, cosmosStudyReach: 40, fuelAffordable: 1e9, highestAPSRun: 1e6, starlightPerSecond: 1e8 }),
		).toBeGreaterThanOrEqual(quest.floor);
	}
});

test('the Cosmos quests ask for 3 hours of Starlight income', () => {
	const quest = (id: string) => QUEST_POOL.find(q => q.id === id)!;
	expect(getQuestTarget(quest('starlight_earned'), { ...context, starlightPerSecond: 1e6 })).toBe(1e6 * COSMOS_QUEST_SECONDS);
	expect(getQuestTarget(quest('cosmos_studies'), { ...context, cosmosStudyReach: 12 })).toBe(12);
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
