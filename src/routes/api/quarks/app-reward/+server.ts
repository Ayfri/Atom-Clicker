import type { RequestHandler } from './$types';
import { APP_REWARD_QUARKS } from '#data/quarks.js';
import { quarksService } from '#lib/server/supabase.server.js';
import { verifiedHandler } from '#lib/server/verifiedRequest.server.js';

/** Running as the app can't be proven to the server, like achievement claims, so the fixed ref makes it one grant per account. */
export const POST: RequestHandler = verifiedHandler('Failed to grant the app reward', async ({ userId }) =>
	Response.json(await quarksService.grantQuarks(userId, APP_REWARD_QUARKS, 'app_install', 'app_install')),
);
