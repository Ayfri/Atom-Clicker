import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { quarksService } from '#lib/server/supabase.server.js';
import { readVerifiedRequest } from '#lib/server/verifiedRequest.server.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { itemId } = verified.data;
		if (itemId !== null && typeof itemId !== 'string') {
			return Response.json({ error: 'Invalid itemId' }, { status: 400 });
		}

		if (typeof itemId === 'string') {
			const item = getQuarkShopItem(itemId);
			if (!item || item.type !== 'banner') {
				return Response.json({ error: 'Unknown banner' }, { status: 400 });
			}

			const owned = await quarksService.getEntitlements(verified.userId);
			if (!owned.includes(itemId)) {
				return Response.json({ error: 'Banner not owned' }, { status: 403 });
			}
		}

		await quarksService.equipBanner(verified.userId, itemId);

		return Response.json({ equippedBanner: itemId });
	} catch (error) {
		console.error('Failed to equip banner:', error);
		return Response.json({ error: 'Failed to equip banner' }, { status: 500 });
	}
};
