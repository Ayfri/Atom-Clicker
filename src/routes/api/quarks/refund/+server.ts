import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { parseItemId, verifiedHandler } from '#lib/server/request.server.js';
import { quarksService } from '#lib/server/supabase.server.js';

export const POST: RequestHandler = verifiedHandler('Failed to refund quark item', async ({ data, userId }) => {
	const itemId = parseItemId(data.itemId);
	if (itemId instanceof Response) return itemId;

	const item = getQuarkShopItem(itemId);
	if (!item) {
		return Response.json({ error: 'Unknown item' }, { status: 400 });
	}
	/** Themes and banners are a permanent sink, never refundable. */
	if (item.type === 'theme' || item.type === 'banner') {
		return Response.json({ error: `${item.type[0].toUpperCase()}${item.type.slice(1)}s are not refundable` }, { status: 400 });
	}

	const result = await quarksService.refundItem(userId, itemId);

	return Response.json(result);
});
