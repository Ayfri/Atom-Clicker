import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { quarksService } from '#lib/server/supabase.server.js';
import { verifiedHandler } from '#lib/server/verifiedRequest.server.js';

export const POST: RequestHandler = verifiedHandler('Failed to purchase quark item', async ({ data, userId }) => {
	const { itemId } = data;
	if (typeof itemId !== 'string') {
		return Response.json({ error: 'Invalid itemId' }, { status: 400 });
	}

	// Cost comes from the server's own shop data, never from the request.
	const item = getQuarkShopItem(itemId);
	if (!item) {
		return Response.json({ error: 'Unknown item' }, { status: 400 });
	}

	const result = await quarksService.purchaseItem(userId, itemId, item.cost);

	return Response.json(result);
});
