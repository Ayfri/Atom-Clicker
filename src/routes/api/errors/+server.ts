import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logError } from '$lib/server/errorHandler.server';
import { resolveUserFromRequest } from '$lib/server/supabase.server';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 16_000;
const MAX_URL_LENGTH = 2_048;
const MAX_JSON_FIELD_BYTES = 8_000;

const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_ERRORS_PER_WINDOW = 10;
const MAX_TRACKED_IPS = 10_000;

/** Per-isolate on Workers, so this is a best-effort throttle rather than a hard limit. */
const errorRateLimit = new Map<string, number[]>();

function isRateLimited(clientIp: string): boolean {
	const now = Date.now();
	const timestamps = (errorRateLimit.get(clientIp) || []).filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
	if (timestamps.length >= MAX_ERRORS_PER_WINDOW) return true;

	if (errorRateLimit.size >= MAX_TRACKED_IPS) errorRateLimit.clear();
	timestamps.push(now);
	errorRateLimit.set(clientIp, timestamps);
	return false;
}

function clampString(value: unknown, maxLength: number): string | null {
	return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

function clampJson(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return JSON.stringify(value).length > MAX_JSON_FIELD_BYTES ? { truncated: true } : value as Record<string, unknown>;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		if (isRateLimited(getClientAddress())) {
			return json({ error: 'Rate limit exceeded' }, { status: 429 });
		}

		const rawBody = await request.text();
		if (rawBody.length > MAX_BODY_BYTES) {
			return json({ error: 'Payload too large' }, { status: 413 });
		}

		const body: Record<string, unknown> = JSON.parse(rawBody);
		const errorMessage = clampString(body.errorMessage, MAX_MESSAGE_LENGTH);
		if (!errorMessage) {
			return json({ error: 'Missing error message' }, { status: 400 });
		}

		// The reporter's identity comes from its session token, never from the payload.
		const userId = await resolveUserFromRequest(request);

		const result = await logError({
			browserInfo: clampJson(body.browserInfo),
			errorMessage,
			gameState: clampJson(body.gameState),
			stackTrace: clampString(body.stackTrace, MAX_STACK_LENGTH),
			url: clampString(body.url, MAX_URL_LENGTH),
			userId
		});

		return json({ id: result?.id ?? null, success: true });
	} catch (error) {
		console.error('[ErrorAPI] Failed to process error report:', error);
		return json({ error: 'Failed to log error' }, { status: 500 });
	}
};
