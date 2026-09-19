import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDailyCap, getDailyQuestCount, pickDailyQuests, QUEST_POOL } from '$data/dailyQuests';
import { quarksService } from '$lib/server/supabase.server';
import { readVerifiedRequest } from '$lib/server/verifiedRequest.server';

function todayUtcDayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { questId } = verified.data;
		if (typeof questId !== 'string') {
			return json({ error: 'Invalid questId' }, { status: 400 });
		}

		// Quest eligibility lives in the local save, so the server only checks the pool and derives the reward itself.
		const dayKey = todayUtcDayKey();
		const entitlements = await quarksService.getEntitlements(verified.userId);
		const todaysQuests = pickDailyQuests(dayKey, getDailyQuestCount(entitlements));
		const quest = QUEST_POOL.find(candidate => candidate.id === questId);
		if (!quest) {
			return json({ error: 'Unknown quest' }, { status: 400 });
		}
		if (quest.id === 'complete_other_daily_quests' && todaysQuests.length < 3) {
			return json({ error: 'The Third Daily Quest upgrade is required' }, { status: 400 });
		}

		const result = await quarksService.grantQuarks(verified.userId, quest.reward, 'quest', `quest:${dayKey}:${questId}`, getDailyCap(todaysQuests));

		return json(result);
	} catch (error) {
		console.error('Failed to claim quest:', error);
		return json({ error: 'Failed to claim quest' }, { status: 500 });
	}
};
