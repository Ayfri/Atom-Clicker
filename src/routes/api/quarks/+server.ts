import type { RequestHandler } from './$types';
import { getDailyCap, getDailyQuestCount, pickDailyQuests } from '#data/dailyQuests.js';
import { leaderboardService, quarksService, resolveUserFromRequest } from '#lib/server/supabase.server.js';

function todayUtcDayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

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

		const [balanceRow, claimedAchievementIds, claimedQuestIds, entitlements] = await Promise.all([
			quarksService.getBalance(userId),
			quarksService.getClaimedAchievementIds(userId),
			quarksService.getClaimedQuestIds(userId, dayKey),
			quarksService.getEntitlements(userId),
		]);
		const quests = pickDailyQuests(dayKey, getDailyQuestCount(entitlements));
		const profile = await leaderboardService.getProfile(userId);
		const typedProfile = profile as { equipped_banner?: string | null; equipped_themes?: Record<string, string> } | null;

		return Response.json({
			balance: balanceRow?.balance ?? 0,
			claimedAchievementIds,
			claimedQuestIds,
			dailyCap: getDailyCap(quests),
			dayKey,
			entitlements,
			equippedBanner: typedProfile?.equipped_banner ?? null,
			equippedThemes: typedProfile?.equipped_themes ?? {},
			quests,
		});
	} catch (error) {
		console.error('Failed to fetch quarks state:', error);
		return Response.json({ error: 'Failed to fetch quarks state' }, { status: 500 });
	}
};
