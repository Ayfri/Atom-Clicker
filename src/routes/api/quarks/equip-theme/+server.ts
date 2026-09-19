import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuarkShopItem } from '$data/quarkShop';
import { quarksService } from '$lib/server/supabase.server';
import { readVerifiedRequest } from '$lib/server/verifiedRequest.server';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		const { itemId, realmId } = verified.data;
		if (itemId !== null && typeof itemId !== 'string') {
			return json({ error: 'Invalid itemId' }, { status: 400 });
		}
		if (typeof realmId !== 'string') {
			return json({ error: 'Invalid realmId' }, { status: 400 });
		}

		if (typeof itemId === 'string') {
			const item = getQuarkShopItem(itemId);
			if (!item || item.type !== 'theme' || item.theme?.realmId !== realmId) {
				return json({ error: 'Unknown theme' }, { status: 400 });
			}

			const owned = await quarksService.getEntitlements(verified.userId);
			if (!owned.includes(itemId)) {
				return json({ error: 'Theme not owned' }, { status: 403 });
			}
		}

		const equippedThemes = await quarksService.equipTheme(verified.userId, realmId, itemId);

		return json({ equippedThemes });
	} catch (error) {
		console.error('Failed to equip theme:', error);
		return json({ error: 'Failed to equip theme' }, { status: 500 });
	}
};
