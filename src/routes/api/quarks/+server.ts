import type { RequestHandler } from './$types';
import { getDailyCap, getDailyQuestCount, pickDailyQuests, todayUtcDayKey } from '#data/dailyQuests.js';
import { quarksService, resolveUserFromRequest } from '#lib/server/supabase.server.js';

export const GET: RequestHandler = async ({ request }) => {
	try {
		const userId = await resolveUserFromRequest(request);
		const dayKey = todayUtcDayKey();

		if (!userId) {
			const quests = pickDailyQuests(dayKey);
			return Response.json({
				balance: 0,
				claimedAchievementIds: [],
				claimedQuestIds: [],
				dailyCap: getDailyCap(quests),
				dayKey,
				entitlements: [],
				equippedBanner: null,
				equippedThemes: {},
				quests,
			});
		}

		const [balanceRow, claimedAchievementIds, claimedQuestIds, entitlements, equipped] = await Promise.all([
			quarksService.getBalance(userId),
			quarksService.getClaimedAchievementIds(userId),
			quarksService.getClaimedQuestIds(userId, dayKey),
			quarksService.getEntitlements(userId),
			quarksService.getEquipped(userId),
		]);
		const quests = pickDailyQuests(dayKey, getDailyQuestCount(entitlements));

		return Response.json({
			balance: balanceRow?.balance ?? 0,
			claimedAchievementIds,
			claimedQuestIds,
			dailyCap: getDailyCap(quests),
			dayKey,
			entitlements,
			...equipped,
			quests,
		});
	} catch (error) {
		console.error('Failed to fetch quarks state:', error);
		return Response.json({ error: 'Failed to fetch quarks state' }, { status: 500 });
	}
};
