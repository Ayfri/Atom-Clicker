import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { parseItemId, verifiedHandler } from '#lib/server/request.server.js';
import { quarksService } from '#lib/server/supabase.server.js';

export const POST: RequestHandler = verifiedHandler('Failed to equip banner', async ({ data, userId }) => {
	const itemId = parseItemId(data.itemId, true);
	if (itemId instanceof Response) return itemId;

	if (itemId !== null) {
		const item = getQuarkShopItem(itemId);
		if (!item || item.type !== 'banner') {
			return Response.json({ error: 'Unknown banner' }, { status: 400 });
		}

		const owned = await quarksService.getEntitlements(userId);
		if (!owned.includes(itemId)) {
			return Response.json({ error: 'Banner not owned' }, { status: 403 });
		}
	}

	await quarksService.equipBanner(userId, itemId);

	return Response.json({ equippedBanner: itemId });
});
