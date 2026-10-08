import { verifyAndDecryptClientData } from '#lib/server/obfuscation.server.js';
import { resolveUserFromRequest } from '#lib/server/supabase.server.js';

/** A game state weighs ~15 KB, this only stops a client from making the Worker parse megabytes. */
const MAX_BODY_BYTES = 256 * 1024;

export interface VerifiedRequest {
	data: Record<string, unknown>;
	userId: string;
}

/** Reads the body up to MAX_BODY_BYTES, a chunked upload sends no Content-Length so the stream itself is counted. */
async function readBody(request: Request): Promise<string | null> {
	if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return null;
	if (!request.body) return '';
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let text = '';
	for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
		size += chunk.value.byteLength;
		if (size > MAX_BODY_BYTES) {
			await reader.cancel();
			return null;
		}
		text += decoder.decode(chunk.value, { stream: true });
	}
	return text + decoder.decode();
}

/** Resolves the caller from their Supabase token and unwraps the signed payload, or returns the error response to send back. */
export async function readVerifiedRequest(request: Request): Promise<VerifiedRequest | Response> {
	const userId = await resolveUserFromRequest(request);
	if (!userId) return Response.json({ error: 'No authorization header' }, { status: 401 });

	const body = await readBody(request);
	if (body === null) return Response.json({ error: 'Payload too large' }, { status: 413 });

	let envelope: { data?: unknown; signature?: unknown; timestamp?: unknown };
	try {
		envelope = JSON.parse(body);
	} catch {
		return Response.json({ error: 'Invalid JSON' }, { status: 400 });
	}
	const { data: encodedData, signature, timestamp } = envelope ?? {};
	if (typeof encodedData !== 'string' || typeof signature !== 'string' || typeof timestamp !== 'number') {
		return Response.json({ error: 'Invalid or expired data' }, { status: 400 });
	}
	const data = verifyAndDecryptClientData(encodedData, signature, timestamp);
	if (!data) return Response.json({ error: 'Invalid or expired data' }, { status: 400 });

	return { data, userId };
}
