import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '$data/quarkShop';
import { quarksService } from '$lib/server/supabase.server';
import { readVerifiedRequest } from '$lib/server/verifiedRequest.server';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { itemId } = verified.data;
		if (itemId !== null && typeof itemId !== 'string') {
			return json({ error: 'Invalid itemId' }, { status: 400 });
		}

		if (typeof itemId === 'string') {
			const item = getQuarkShopItem(itemId);
			if (!item || item.type !== 'banner') {
				return json({ error: 'Unknown banner' }, { status: 400 });
			}

			const owned = await quarksService.getEntitlements(verified.userId);
			if (!owned.includes(itemId)) {
				return json({ error: 'Banner not owned' }, { status: 403 });
			}
		}

		await quarksService.equipBanner(verified.userId, itemId);

		return json({ equippedBanner: itemId });
	} catch (error) {
		console.error('Failed to equip banner:', error);
		return json({ error: 'Failed to equip banner' }, { status: 500 });
	}
};
