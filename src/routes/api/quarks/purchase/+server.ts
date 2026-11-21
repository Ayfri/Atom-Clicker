import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { parseItemId, verifiedHandler } from '#lib/server/request.server.js';
import { quarksService } from '#lib/server/supabase.server.js';

export const POST: RequestHandler = verifiedHandler('Failed to purchase quark item', async ({ data, userId }) => {
	const itemId = parseItemId(data.itemId);
	if (itemId instanceof Response) return itemId;

	/** Cost comes from the server's own shop data, never from the request. */
	const item = getQuarkShopItem(itemId);
	if (!item) {
		return Response.json({ error: 'Unknown item' }, { status: 400 });
	}

	const result = await quarksService.purchaseItem(userId, itemId, item.cost);

	return Response.json(result);
});
