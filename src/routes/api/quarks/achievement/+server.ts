import type { RequestHandler } from './$types';
import { ACHIEVEMENTS } from '#data/achievements.js';
import { MAX_ACHIEVEMENT_IDS_PER_REQUEST, QUARK_ACHIEVEMENT_REWARD } from '#data/quarks.js';
import { verifiedHandler } from '#lib/server/request.server.js';
import { quarksService } from '#lib/server/supabase.server.js';

export const POST: RequestHandler = verifiedHandler('Failed to grant achievement quarks', async ({ data, userId }) => {
	const { achievementIds } = data;
	if (!Array.isArray(achievementIds) || achievementIds.some(id => typeof id !== 'string')) {
		return Response.json({ error: 'Invalid achievementIds' }, { status: 400 });
	}
	if (achievementIds.length > MAX_ACHIEVEMENT_IDS_PER_REQUEST) {
		return Response.json({ error: 'Too many achievementIds' }, { status: 400 });
	}

	/** Unknown ids are dropped silently, the reward is our own constant, never the request's. */
	const validIds: string[] = achievementIds.filter(id => Object.hasOwn(ACHIEVEMENTS, id));
	const result = await quarksService.grantAchievementQuarks(userId, validIds, QUARK_ACHIEVEMENT_REWARD);

	return Response.json(result);
});
