import type { RequestHandler } from './$types';
import { isQuarkAchievement, QUARK_ACHIEVEMENT_REWARD } from '#data/quarkAchievements.js';
import { quarksService } from '#lib/server/supabase.server.js';
import { readVerifiedRequest } from '#lib/server/verifiedRequest.server.js';

const MAX_ACHIEVEMENT_IDS_PER_REQUEST = 250;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { achievementIds } = verified.data;
		if (!Array.isArray(achievementIds) || achievementIds.some(id => typeof id !== 'string')) {
			return Response.json({ error: 'Invalid achievementIds' }, { status: 400 });
		}
		if (achievementIds.length > MAX_ACHIEVEMENT_IDS_PER_REQUEST) {
			return Response.json({ error: 'Too many achievementIds' }, { status: 400 });
		}

		// Unknown ids are dropped silently, the reward is our own constant, never the request's.
		const validIds: string[] = achievementIds.filter(isQuarkAchievement);
		const result = await quarksService.grantAchievementQuarks(verified.userId, validIds, QUARK_ACHIEVEMENT_REWARD);

		return Response.json(result);
	} catch (error) {
		console.error('Failed to grant achievement quarks:', error);
		return Response.json({ error: 'Failed to grant achievement quarks' }, { status: 500 });
	}
};
