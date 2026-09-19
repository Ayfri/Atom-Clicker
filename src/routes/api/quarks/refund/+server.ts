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

		const item = getQuarkShopItem(itemId);
		if (!item) {
			return json({ error: 'Unknown item' }, { status: 400 });
		}
		// Themes and banners are a permanent sink, never refundable.
		if (item.type === 'theme' || item.type === 'banner') {
			return json({ error: `${item.type[0].toUpperCase()}${item.type.slice(1)}s are not refundable` }, { status: 400 });
		}

		const result = await quarksService.refundItem(verified.userId, itemId);

		return json(result);
	} catch (error) {
		console.error('Failed to refund quark item:', error);
		return json({ error: 'Failed to refund quark item' }, { status: 500 });
	}
};
