import { dev } from '$app/env';
import type { RequestHandler } from './$types';
import { isDegraded } from '#helpers/perf/perfStats.js';
import { RateLimiter, readJsonBody } from '#lib/server/request.server.js';
import { parseSessionUpdate } from '#lib/server/sessions/sessionPayload.server.js';
import { sessionsService } from '#lib/server/sessions/sessions.server.js';
import { judgeSession } from '#lib/server/sessions/sessionVerdict.server.js';

const MAX_BODY_BYTES = 16 * 1024;

const updateRateLimit = new RateLimiter(60 * 1000, 20);

/** Safe for `sendBeacon`: the write key in the body is the credential. The degraded flag, problem, cause and summary are computed here, never read from the client. */
export const POST: RequestHandler = async ({ getClientAddress, request }) => {
	try {
		const rejected = updateRateLimit.reject(getClientAddress());
		if (rejected) return rejected;

		const read = await readJsonBody(request, MAX_BODY_BYTES);
		if ('error' in read) return read.error;

		const payload = parseSessionUpdate(read.body);
		if (!payload) {
			return Response.json({ error: 'Invalid session update' }, { status: 400 });
		}

		if (dev) return new Response(null, { status: 204 });

		const { cause, problem, summary } = judgeSession(payload.perf, payload.game);
		const updated = await sessionsService.update({
			cause,
			degraded: isDegraded(payload.perf.evidence),
			game: payload.game,
			id: payload.sessionId,
			perf: payload.perf,
			problem,
			summary,
			writeKey: payload.writeKey,
		});

		return updated ? new Response(null, { status: 204 }) : Response.json({ error: 'Unknown session' }, { status: 404 });
	} catch (error) {
		console.error('[SessionsAPI] Failed to update session:', error);
		return Response.json({ error: 'Failed to update session' }, { status: 500 });
	}
};
