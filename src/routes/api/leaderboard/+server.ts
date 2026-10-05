import type { RequestHandler } from './$types';
import { auditScore } from '#lib/server/scoreAudit.server.js';
import { leaderboardService, supabaseAdmin } from '#lib/server/supabase.server.js';
import { readVerifiedRequest } from '#lib/server/verifiedRequest.server.js';
import type { LeaderboardEntry } from '#lib/types/leaderboard.js';
import { addRankToLeaderboard } from '#lib/utils/number-parser.js';

/** A game state weighs ~15 KB, this only stops a client from making the Worker parse megabytes. */
const MAX_BODY_BYTES = 256 * 1024;
const MAX_PICTURE_LENGTH = 2048;
const MAX_USERNAME_LENGTH = 50;
/** Measured on the stored history, so it holds across Worker isolates unlike an in-memory map. */
const MIN_SUBMIT_INTERVAL_MS = 20_000;

/** Every client polls the same board each minute, so an isolate answers from memory and only one request per TTL reaches Supabase. */
const CACHE_TTL_MS = 30_000;

interface LeaderboardResponse {
	entries: LeaderboardEntry[];
	stats: { rankedPlayers: number; totalUsers: number };
}

let cached: { at: number; body: Promise<LeaderboardResponse> } | undefined;

export const GET: RequestHandler = async () => {
	try {
		if (!cached || Date.now() - cached.at > CACHE_TTL_MS) {
			const body = fetchLeaderboard();
			cached = { at: Date.now(), body };
			body.catch(() => {
				if (cached?.body === body) cached = undefined;
			});
		}
		return Response.json(await cached.body);
	} catch (error) {
		console.error('Failed to fetch leaderboard:', error);
		return Response.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
	}
};

async function fetchLeaderboard(): Promise<LeaderboardResponse> {
	const [rawLeaderboard, { count: totalUsersCount }, { count: rankedCount }] = await Promise.all([
		leaderboardService.getLeaderboard(1000),
		supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
		/** Same filter as get_leaderboard, rows emptied by a leaderboard reset count as accounts but not as ranked players. */
		supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).not('atoms', 'is', null).not('atoms', 'in', '("","NaN","Infinity")'),
	]);

	const entries = addRankToLeaderboard(rawLeaderboard).map((entry) => {
		// Online means the flag is set and the heartbeat is fresh, so a closed tab times out after 2 minutes.
		const lastSeen = new Date(entry.updated_at).getTime();
		const isTrulyOnline = entry.is_online && (Date.now() - lastSeen < 120_000);

		return {
			atoms: parseFloat(entry.atoms),
			equippedBanner: entry.equipped_banner ?? null,
			level: entry.level,
			is_online: isTrulyOnline,
			picture: entry.picture || '',
			/** last_updated only moves on a new record, updated_at follows every heartbeat and cloud save. */
			lastSeen: new Date(entry.updated_at ?? entry.last_updated).getTime(),
			rank: entry.rank,
			userId: entry.id,
			username: entry.username || 'Anonymous',
		};
	});

	return {
		entries,
		stats: {
			rankedPlayers: rankedCount ?? entries.length,
			totalUsers: totalUsersCount ?? entries.length,
		},
	};
}

/**
 * The score is never taken from the client: the game state it sends is audited against the current balance and the previous
 * accepted state, and the server reads atoms and level from it. A state that fails rolls the board back, see record_score.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 });

		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { userId } = verified;
		const { picture, state, username } = verified.data;

		if (typeof username !== 'string' || username.trim().length === 0 || username.length > MAX_USERNAME_LENGTH) {
			return Response.json({ error: 'Invalid username' }, { status: 400 });
		}
		if (picture !== undefined && picture !== null && (typeof picture !== 'string' || picture.length > MAX_PICTURE_LENGTH || !picture.startsWith('https://'))) {
			return Response.json({ error: 'Invalid picture value' }, { status: 400 });
		}

		const context = await leaderboardService.getScoreContext(userId);
		const now = Date.now();
		const sinceLast = now - (context.lastReceivedAt ?? 0);
		if (sinceLast < MIN_SUBMIT_INTERVAL_MS) {
			return Response.json({ error: 'Update too frequent', nextUpdateIn: Math.ceil((MIN_SUBMIT_INTERVAL_MS - sinceLast) / 1000) }, { status: 429 });
		}

		const audit = auditScore(state, { colliderTotal: context.colliderTotal, now, previous: context.previous });
		if (audit === 'outdated') return Response.json({ error: 'This game version is outdated, reload the page' }, { status: 409 });
		if (audit === 'malformed') return Response.json({ error: 'Invalid game state' }, { status: 400 });

		const status = await leaderboardService.recordScore(userId, audit, username, picture ?? undefined);
		return Response.json({ issues: audit.issues, status });
	} catch (error) {
		console.error('Failed to update leaderboard:', error);
		return Response.json({ error: 'Failed to update leaderboard' }, { status: 500 });
	}
};
