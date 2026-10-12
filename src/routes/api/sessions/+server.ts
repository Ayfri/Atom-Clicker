import { dev } from '$app/env';
import type { RequestHandler } from './$types';
import { RateLimiter } from '#lib/server/rateLimit.server.js';
import { deviceKey, parseSessionStart, readJsonBody } from '#lib/server/sessionPayload.server.js';
import { SessionConflictError, sessionsService } from '#lib/server/sessions.server.js';
import { resolveUserFromRequest } from '#lib/server/supabase.server.js';
import type { SessionStartResponse } from '#lib/types/session.js';
import type { Json } from '#lib/types/supabase.js';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_USER_AGENT_LENGTH = 400;

const startRateLimit = new RateLimiter(60 * 1000, 6);

/** Opens the row of a page load and hands back the key its updates are signed with. The player comes from the bearer token only. */
export const POST: RequestHandler = async ({ getClientAddress, request }) => {
	try {
		if (startRateLimit.limited(getClientAddress())) {
			return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
		}

		const read = await readJsonBody(request, MAX_BODY_BYTES);
		if ('error' in read) return read.error;

		const payload = parseSessionStart(read.body);
		if (!payload) {
			return Response.json({ error: 'Invalid session' }, { status: 400 });
		}

		if (dev) return Response.json({ writeKey: crypto.randomUUID() } satisfies SessionStartResponse);

		const userId = await resolveUserFromRequest(request);
		const device = { ...payload.device, userAgent: (request.headers.get('user-agent') ?? '').slice(0, MAX_USER_AGENT_LENGTH) };
		const writeKey = await sessionsService.start({
			app_version: device.appVersion,
			device: device as unknown as Json,
			device_key: await deviceKey(device),
			game: payload.game as unknown as Json,
			id: device.sessionId,
			in_app_browser: device.inAppBrowser,
			user_agent: device.userAgent,
			user_id: userId,
		});

		return Response.json({ writeKey } satisfies SessionStartResponse);
	} catch (error) {
		if (error instanceof SessionConflictError) {
			return Response.json({ error: 'Session already started' }, { status: 409 });
		}

		console.error('[SessionsAPI] Failed to start session:', error);
		return Response.json({ error: 'Failed to start session' }, { status: 500 });
	}
};
