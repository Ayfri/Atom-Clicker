import type { RequestHandler } from './$types';
import { logError } from '#lib/server/errorHandler.server.js';
import { RateLimiter } from '#lib/server/rateLimit.server.js';
import { readJsonBody } from '#lib/server/requestBody.server.js';
import { resolveUserFromRequest } from '#lib/server/supabase.server.js';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 16_000;
const MAX_URL_LENGTH = 2_048;
const MAX_JSON_FIELD_BYTES = 8_000;

const errorRateLimit = new RateLimiter(60 * 1000, 10);

function clampString(value: unknown, maxLength: number): string | null {
	return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

function clampJson(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return JSON.stringify(value).length > MAX_JSON_FIELD_BYTES ? { truncated: true } : value as Record<string, unknown>;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		if (errorRateLimit.limited(getClientAddress())) {
			return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
		}

		const read = await readJsonBody(request, MAX_BODY_BYTES);
		if ('error' in read) return read.error;

		const body = read.body as Record<string, unknown> | null;
		const errorMessage = clampString(body?.errorMessage, MAX_MESSAGE_LENGTH);
		if (!errorMessage) {
			return Response.json({ error: 'Missing error message' }, { status: 400 });
		}

		// The reporter's identity comes from its session token, never from the payload.
		const userId = await resolveUserFromRequest(request);

		const result = await logError({
			browserInfo: clampJson(body?.browserInfo),
			errorMessage,
			gameState: clampJson(body?.gameState),
			stackTrace: clampString(body?.stackTrace, MAX_STACK_LENGTH),
			url: clampString(body?.url, MAX_URL_LENGTH),
			userId
		});

		return Response.json({ id: result?.id ?? null, success: true });
	} catch (error) {
		console.error('[ErrorAPI] Failed to process error report:', error);
		return Response.json({ error: 'Failed to log error' }, { status: 500 });
	}
};
