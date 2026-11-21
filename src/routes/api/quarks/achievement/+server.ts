import type { RequestHandler } from './$types';
import { ACHIEVEMENTS } from '#data/achievements.js';
import { MAX_ACHIEVEMENT_IDS_PER_REQUEST, QUARK_ACHIEVEMENT_REWARD } from '#data/quarks.js';
import { auditScore } from '#lib/server/audit/scoreAudit.server.js';
import { RateLimiter, verifiedHandler } from '#lib/server/request.server.js';
import { leaderboardService, quarksService } from '#lib/server/supabase.server.js';

/** Every claim runs a full audit. Claim all makes 2 requests for every achievement (344 over batches of 250), so this leaves room for a few single claims on top. */
const claimRateLimit = new RateLimiter(60 * 1000, 15);

/**
 * Only an achievement the server saw earned pays: its condition held on a state that passed the leaderboard audit, either one submitted earlier or the
 * state sent with this claim. A list of ids alone earns nothing, and a state that fails the audit still collects what was remembered before it.
 */
export const POST: RequestHandler = verifiedHandler('Failed to grant achievement quarks', async ({ data, userId }) => {
	const { achievementIds, state } = data;
	if (!Array.isArray(achievementIds) || achievementIds.some(id => typeof id !== 'string')) {
		return Response.json({ error: 'Invalid achievementIds' }, { status: 400 });
	}
	if (achievementIds.length > MAX_ACHIEVEMENT_IDS_PER_REQUEST) {
		return Response.json({ error: 'Too many achievementIds' }, { status: 400 });
	}
	/** A tab left open across an update still sends the old payload, which has no state: it needs a reload, not an error about the state. */
	if (state === undefined) return Response.json({ error: 'This game version is outdated, reload the page' }, { status: 409 });

	const rejected = claimRateLimit.reject(userId);
	if (rejected) return rejected;

	const [context, totalUsers, ownedQuarkItems] = await Promise.all([leaderboardService.getScoreContext(userId), leaderboardService.countUsers(), quarksService.getEntitlements(userId)]);
	const audit = auditScore(state, { accountCreatedAt: context.accountCreatedAt, colliderTotal: context.colliderTotal, now: Date.now(), ownedQuarkItems, previous: context.previous, totalUsers });
	if (audit === 'outdated') return Response.json({ error: 'This game version is outdated, reload the page' }, { status: 409 });
	if (audit === 'malformed') return Response.json({ error: 'Invalid game state' }, { status: 400 });

	/** Unknown ids are dropped silently, the reward is our own constant, never the request's. */
	const validIds: string[] = achievementIds.filter(id => Object.hasOwn(ACHIEVEMENTS, id));
	const earnedIds = audit.issues.length === 0 ? audit.earnedAchievements : [];
	const result = await quarksService.claimAchievementQuarks(userId, validIds, earnedIds, QUARK_ACHIEVEMENT_REWARD);

	return Response.json(result);
});
