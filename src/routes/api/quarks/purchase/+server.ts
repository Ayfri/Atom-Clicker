import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { quarksService } from '#lib/server/supabase.server.js';
import { readVerifiedRequest } from '#lib/server/verifiedRequest.server.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { itemId } = verified.data;
		if (typeof itemId !== 'string') {
			return Response.json({ error: 'Invalid itemId' }, { status: 400 });
		}

		// Cost comes from the server's own shop data, never from the request.
		const item = getQuarkShopItem(itemId);
		if (!item) {
			return Response.json({ error: 'Unknown item' }, { status: 400 });
		}

		const result = await quarksService.purchaseItem(verified.userId, itemId, item.cost);

		return Response.json(result);
	} catch (error) {
		console.error('Failed to purchase quark item:', error);
		return Response.json({ error: 'Failed to purchase quark item' }, { status: 500 });
	}
};
