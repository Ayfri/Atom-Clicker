import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.server';

export const GET: RequestHandler = async () => {
	try {
		const { count, error } = await supabaseAdmin
			.from('profiles')
			.select('*', { count: 'exact', head: true });

		if (error) throw error;

		return json({
			totalUsers: count || 0
		}, {
			headers: {
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (error) {
		console.error('Failed to fetch user count:', error);
		return json({ error: 'Failed to fetch user count' }, { status: 500 });
	}
};
