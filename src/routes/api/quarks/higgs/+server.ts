import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { quarksService } from '$lib/server/supabase.server';
import { readVerifiedRequest } from '$lib/server/verifiedRequest.server';

const HIGGS_DROP_CHANCE = 1 / 300;
/** A legit player clicks a few dozen power-ups a day, so anything past this is a script hammering the route. */
const HIGGS_DAILY_CAP = 5;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const verified = await readVerifiedRequest(request);
		if (verified instanceof Response) return verified;

		if (Math.random() >= HIGGS_DROP_CHANCE) return json({ granted: 0 });

		const result = await quarksService.grantQuarks(verified.userId, 1, 'higgs_boson', `higgs:${crypto.randomUUID()}`, HIGGS_DAILY_CAP);
		return json({ balance: result.balance, granted: result.status === 'ok' ? 1 : 0 });
	} catch (error) {
		console.error('Failed to grant Higgs Boson Quark:', error);
		return json({ error: 'Failed to grant Higgs Boson Quark' }, { status: 500 });
	}
};
