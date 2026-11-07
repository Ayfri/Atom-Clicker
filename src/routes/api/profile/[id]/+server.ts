import type { RequestHandler } from './$types';
import { readStats } from '#lib/server/profileStats.server.js';
import { leaderboardService } from '#lib/server/supabase.server.js';
import type { PublicProfile } from '#lib/types/leaderboard.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params }) => {
	if (!UUID.test(params.id)) return Response.json({ error: 'Invalid player id' }, { status: 400 });

	try {
		const row = await leaderboardService.getPublicSave(params.id);
		if (!row) return Response.json({ error: 'Player not found' }, { status: 404 });

		const profile: PublicProfile = {
			joinedAt: row.created_at ? new Date(row.created_at).getTime() : null,
			stats: readStats(row.save),
		};
		return Response.json(profile, { headers: { 'Cache-Control': 'public, max-age=60' } });
	} catch (error) {
		console.error('Failed to fetch profile:', error);
		return Response.json({ error: 'Failed to fetch profile' }, { status: 500 });
	}
};
