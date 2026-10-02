import type { RequestHandler } from './$types';
import { checkStatePlausibility } from '#helpers/plausibility.js';
import { leaderboardService, supabaseAdmin } from '#lib/server/supabase.server.js';
import { readVerifiedRequest } from '#lib/server/verifiedRequest.server.js';
import { addRankToLeaderboard } from '#lib/utils/number-parser.js';

const UPDATE_INTERVAL = 25 * 1000;

/** Loose on purpose: only rejects near-float-ceiling garbage, never balance-tuned values. */
const MAX_ATOMS = 1e100;
/** Tight since it is balance-independent, the XP curve makes anything past ~1000 unreachable. */
const MAX_LEVEL = 1_000;
const MAX_USERNAME_LENGTH = 50;
const MAX_PICTURE_LENGTH = 2048;

/** Per-isolate on Workers, so this is a best-effort throttle rather than a hard limit. */
const userLastUpdate = new Map<string, number>();

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userIdParam = url.searchParams.get('userId');
		const currentUserId = userIdParam && userIdParam.trim().length > 0 ? userIdParam : undefined;

		const [rawLeaderboard, { count: totalUsersCount }, { count: rankedCount }] = await Promise.all([
			leaderboardService.getLeaderboard(1000),
			supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
			/** Same filter as get_leaderboard, rows emptied by a leaderboard reset count as accounts but not as ranked players. */
			supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).not('atoms', 'is', null).not('atoms', 'in', '("","NaN","Infinity")'),
		]);

		const formattedLeaderboard = addRankToLeaderboard(rawLeaderboard).map((entry) => {
			// Online means the flag is set and the heartbeat is fresh, so a closed tab times out after 2 minutes.
			const lastSeen = new Date(entry.updated_at).getTime();
			const isTrulyOnline = entry.is_online && (Date.now() - lastSeen < 120_000);

			return {
				atoms: parseFloat(entry.atoms),
				equippedBanner: entry.equipped_banner ?? null,
				level: entry.level,
				is_online: isTrulyOnline,
				picture: entry.picture || '',
				self: currentUserId ? entry.id === currentUserId : false,
				/** last_updated only moves on a new record, updated_at follows every heartbeat and cloud save. */
				lastSeen: new Date(entry.updated_at ?? entry.last_updated).getTime(),
				rank: entry.rank,
				userId: entry.id,
				username: entry.username || 'Anonymous',
			};
		});

		return Response.json({
			entries: formattedLeaderboard,
			stats: {
				rankedPlayers: rankedCount ?? formattedLeaderboard.length,
				totalUsers: totalUsersCount ?? formattedLeaderboard.length,
			},
		});
	} catch (error) {
		console.error('Failed to fetch leaderboard:', error);
		return Response.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { userId } = verified;
		const { username, atoms, level, picture } = verified.data;

		if (typeof username !== 'string' || username.trim().length === 0 || username.length > MAX_USERNAME_LENGTH) {
			return Response.json({ error: 'Invalid username' }, { status: 400 });
		}
		if (typeof atoms !== 'number' || !Number.isFinite(atoms) || atoms < 0 || atoms > MAX_ATOMS) {
			return Response.json({ error: 'Invalid atoms value' }, { status: 400 });
		}
		if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > MAX_LEVEL) {
			return Response.json({ error: 'Invalid level value' }, { status: 400 });
		}
		if (picture !== undefined && picture !== null && (typeof picture !== 'string' || picture.length > MAX_PICTURE_LENGTH)) {
			return Response.json({ error: 'Invalid picture value' }, { status: 400 });
		}

		const timeSinceLastUpdate = Date.now() - (userLastUpdate.get(userId) || 0);
		if (timeSinceLastUpdate < UPDATE_INTERVAL) {
			return Response.json({
				error: 'Update too frequent',
				nextUpdateIn: Math.ceil((UPDATE_INTERVAL - timeSinceLastUpdate) / 1000)
			}, { status: 429 });
		}

		/** The client already skips flagged saves, this catches direct calls when the cloud save carries the evidence. */
		const save = await leaderboardService.getSaveIntegrityFields(userId);
		if (save && (save.integrityFlagged === true || checkStatePlausibility(save).length > 0)) {
			return Response.json({ error: 'Save flagged by the integrity checks' }, { status: 403 });
		}

		await leaderboardService.updateProfileStats(userId, atoms, level, username, picture ?? undefined);
		userLastUpdate.set(userId, Date.now());

		return Response.json({ success: true });
	} catch (error) {
		console.error('Failed to update leaderboard:', error);
		return Response.json({ error: 'Failed to update leaderboard' }, { status: 500 });
	}
};
