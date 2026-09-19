import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { leaderboardService, supabaseAdmin } from '$lib/server/supabase.server';
import { readVerifiedRequest } from '$lib/server/verifiedRequest.server';
import { addRankToLeaderboard } from '$lib/utils/number-parser';

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

		const [rawLeaderboard, { count: totalUsersCount }] = await Promise.all([
			leaderboardService.getLeaderboard(1000),
			supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
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
				lastUpdated: new Date(entry.last_updated).getTime(),
				rank: entry.rank,
				userId: entry.id,
				username: entry.username || 'Anonymous',
			};
		});

		return json({
			entries: formattedLeaderboard,
			stats: {
				totalUsers: totalUsersCount ?? formattedLeaderboard.length,
			},
		});
	} catch (error) {
		console.error('Failed to fetch leaderboard:', error);
		return json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { userId } = verified;
		const { username, atoms, level, picture } = verified.data;

		if (typeof username !== 'string' || username.trim().length === 0 || username.length > MAX_USERNAME_LENGTH) {
			return json({ error: 'Invalid username' }, { status: 400 });
		}
		if (typeof atoms !== 'number' || !Number.isFinite(atoms) || atoms < 0 || atoms > MAX_ATOMS) {
			return json({ error: 'Invalid atoms value' }, { status: 400 });
		}
		if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > MAX_LEVEL) {
			return json({ error: 'Invalid level value' }, { status: 400 });
		}
		if (picture !== undefined && picture !== null && (typeof picture !== 'string' || picture.length > MAX_PICTURE_LENGTH)) {
			return json({ error: 'Invalid picture value' }, { status: 400 });
		}

		const timeSinceLastUpdate = Date.now() - (userLastUpdate.get(userId) || 0);
		if (timeSinceLastUpdate < UPDATE_INTERVAL) {
			return json({
				error: 'Update too frequent',
				nextUpdateIn: Math.ceil((UPDATE_INTERVAL - timeSinceLastUpdate) / 1000)
			}, { status: 429 });
		}

		await leaderboardService.updateProfileStats(userId, atoms, level, username, picture ?? undefined);
		userLastUpdate.set(userId, Date.now());

		return json({ success: true });
	} catch (error) {
		console.error('Failed to update leaderboard:', error);
		return json({ error: 'Failed to update leaderboard' }, { status: 500 });
	}
};
