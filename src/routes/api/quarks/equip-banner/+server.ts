import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { quarksService } from '#lib/server/supabase.server.js';
import { verifiedHandler } from '#lib/server/verifiedRequest.server.js';

export const POST: RequestHandler = verifiedHandler('Failed to equip banner', async ({ data, userId }) => {
	const { itemId } = data;
	if (itemId !== null && typeof itemId !== 'string') {
		return Response.json({ error: 'Invalid itemId' }, { status: 400 });
	}

	if (typeof itemId === 'string') {
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
