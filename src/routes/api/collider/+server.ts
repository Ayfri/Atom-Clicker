import type { RequestHandler } from './$types';
import { colliderService, resolveUserFromRequest } from '#lib/server/supabase.server.js';
import { readVerifiedRequest } from '#lib/server/verifiedRequest.server.js';

/** Signed-out players only read the shared total, a signed-in one also gets their injections and cooldown. */
export const GET: RequestHandler = async ({ request }) => {
	try {
		const userId = await resolveUserFromRequest(request);
		return Response.json(await colliderService.get(userId), { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('Failed to fetch collider:', error);
		return Response.json({ error: 'Failed to fetch the Collider' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		return Response.json(await colliderService.inject(verified.userId));
	} catch (error) {
		console.error('Failed to inject into the collider:', error);
		return Response.json({ error: 'Failed to inject into the Collider' }, { status: 500 });
	}
};
