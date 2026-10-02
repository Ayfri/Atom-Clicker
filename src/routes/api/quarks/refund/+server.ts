import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '#data/quarkShop.js';
import { quarksService } from '#lib/server/supabase.server.js';
import { readVerifiedRequest } from '#lib/server/verifiedRequest.server.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { itemId } = verified.data;
		if (typeof itemId !== 'string') {
			return Response.json({ error: 'Invalid itemId' }, { status: 400 });
		}

		const item = getQuarkShopItem(itemId);
		if (!item) {
			return Response.json({ error: 'Unknown item' }, { status: 400 });
		}
		// Themes and banners are a permanent sink, never refundable.
		if (item.type === 'theme' || item.type === 'banner') {
			return Response.json({ error: `${item.type[0].toUpperCase()}${item.type.slice(1)}s are not refundable` }, { status: 400 });
		}

		const result = await quarksService.refundItem(verified.userId, itemId);

		return Response.json(result);
	} catch (error) {
		console.error('Failed to refund quark item:', error);
		return Response.json({ error: 'Failed to refund quark item' }, { status: 500 });
	}
};
