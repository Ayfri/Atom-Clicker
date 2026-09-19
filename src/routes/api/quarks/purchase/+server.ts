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
		if (typeof itemId !== 'string') {
			return json({ error: 'Invalid itemId' }, { status: 400 });
		}

		// Cost comes from the server's own shop data, never from the request.
		const item = getQuarkShopItem(itemId);
		if (!item) {
			return json({ error: 'Unknown item' }, { status: 400 });
		}

		const result = await quarksService.purchaseItem(verified.userId, itemId, item.cost);

		return json(result);
	} catch (error) {
		console.error('Failed to purchase quark item:', error);
		return json({ error: 'Failed to purchase quark item' }, { status: 500 });
	}
};
