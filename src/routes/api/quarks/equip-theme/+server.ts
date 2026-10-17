import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { quarksService } from '#lib/server/supabase.server.js';
import { verifiedHandler } from '#lib/server/verifiedRequest.server.js';

export const POST: RequestHandler = verifiedHandler('Failed to equip theme', async ({ data, userId }) => {
	const { itemId, realmId } = data;
	if (itemId !== null && typeof itemId !== 'string') {
		return Response.json({ error: 'Invalid itemId' }, { status: 400 });
	}
	if (typeof realmId !== 'string') {
		return Response.json({ error: 'Invalid realmId' }, { status: 400 });
	}

	if (typeof itemId === 'string') {
		const item = getQuarkShopItem(itemId);
		if (!item || item.type !== 'theme' || item.theme?.realmId !== realmId) {
			return Response.json({ error: 'Unknown theme' }, { status: 400 });
		}

		const owned = await quarksService.getEntitlements(userId);
		if (!owned.includes(itemId)) {
			return Response.json({ error: 'Theme not owned' }, { status: 403 });
		}
	}

	const equippedThemes = await quarksService.equipTheme(userId, realmId, itemId);

	return Response.json({ equippedThemes });
});
