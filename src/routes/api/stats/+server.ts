import type { RequestHandler } from './$types';
import { leaderboardService } from '#lib/server/supabase.server.js';

export const GET: RequestHandler = async () => {
	try {
		return Response.json({
			totalUsers: await leaderboardService.countUsers()
		}, {
			headers: {
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (error) {
		console.error('Failed to fetch user count:', error);
		return Response.json({ error: 'Failed to fetch user count' }, { status: 500 });
	}
};
