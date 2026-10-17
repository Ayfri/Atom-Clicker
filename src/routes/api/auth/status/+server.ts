import type { RequestHandler } from './$types';
import { readJsonBody } from '#lib/server/requestBody.server.js';
import { resolveUserFromRequest, supabaseAdmin } from '#lib/server/supabase.server.js';

const MAX_BODY_BYTES = 1024;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const userId = await resolveUserFromRequest(request);
		if (!userId) return Response.json({ error: 'No authorization header' }, { status: 401 });

		const read = await readJsonBody(request, MAX_BODY_BYTES);
		if ('error' in read) return read.error;

		const isOnline = (read.body as { is_online?: unknown } | null)?.is_online;
		if (typeof isOnline !== 'boolean') {
			return Response.json({ error: 'Invalid is_online value' }, { status: 400 });
		}

		const { error: updateError } = await supabaseAdmin
			.from('profiles')
			.update({
				is_online: isOnline,
				updated_at: new Date().toISOString()
			})
			.eq('id', userId);

		if (updateError) {
			console.error('Error updating online status:', updateError);
			return Response.json({ error: 'Failed to update status' }, { status: 500 });
		}

		return Response.json({ success: true });
	} catch (error) {
		console.error('Error in auth status endpoint:', error);
		return Response.json({ error: 'Internal server error' }, { status: 500 });
	}
};
