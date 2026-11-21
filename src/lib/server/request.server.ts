import { generateSignature } from '#helpers/signing.js';
import { resolveUserFromRequest } from '#lib/server/supabase.server.js';

/** A game state weighs ~15 KB, this only stops a client from making the Worker parse megabytes. */
const MAX_VERIFIED_BODY_BYTES = 256 * 1024;
const SIGNATURE_WINDOW_MS = 5000;

interface VerifiedRequest {
	data: Record<string, unknown>;
	userId: string;
}

/** Per-isolate on Workers, so this is a best-effort throttle rather than a hard limit. */
export class RateLimiter {
	private readonly hits = new Map<string, number[]>();

	constructor(
		private readonly windowMs: number,
		private readonly max: number,
		private readonly maxKeys = 10_000,
	) {}

	/** Records a hit for the key and returns the 429 to send back once it went over `max` within the last `windowMs`. */
	reject(key: string): Response | undefined {
		const now = Date.now();
		const timestamps = (this.hits.get(key) ?? []).filter(timestamp => now - timestamp < this.windowMs);
		if (timestamps.length >= this.max) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

		if (this.hits.size >= this.maxKeys) this.hits.clear();
		timestamps.push(now);
		this.hits.set(key, timestamps);
	}
}

/** Counts streamed bytes, a chunked upload sends no Content-Length. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<{ body: unknown } | { error: Response }> {
	const tooLarge = { error: Response.json({ error: 'Payload too large' }, { status: 413 }) };
	if (Number(request.headers.get('content-length')) > maxBytes) return tooLarge;

	let text = '';
	if (request.body) {
		const reader = request.body.getReader();
		const decoder = new TextDecoder();
		let size = 0;
		for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
			size += chunk.value.byteLength;
			if (size > maxBytes) {
				await reader.cancel();
				return tooLarge;
			}
			text += decoder.decode(chunk.value, { stream: true });
		}
		text += decoder.decode();
	}

	try {
		return { body: JSON.parse(text) };
	} catch {
		return { error: Response.json({ error: 'Invalid JSON' }, { status: 400 }) };
	}
}

/** Server side of `helpers/obfuscation.ts`: a tamper/replay guard, not a security boundary, see `signing.ts`. */
export function verifyAndDecryptClientData(
	encodedData: string,
	signature: string,
	timestamp: number,
	maxAge: number = 5 * 60 * 1000
): Record<string, unknown> | null {
	try {
		const age = Date.now() - timestamp;
		if (age > maxAge || age < -10_000) return null;

		const accepted = [timestamp - SIGNATURE_WINDOW_MS, timestamp, timestamp + SIGNATURE_WINDOW_MS]
			.map(t => generateSignature(encodedData, t));
		if (!accepted.includes(signature)) return null;

		return JSON.parse(Buffer.from(encodedData, 'base64').toString('utf-8'));
	} catch {
		return null;
	}
}

/** The `itemId` of a Quarks request, a string (or `null` where the endpoint allows it), or the 400 to send back. */
export function parseItemId(itemId: unknown, nullable: true): string | null | Response;
export function parseItemId(itemId: unknown, nullable?: false): string | Response;
export function parseItemId(itemId: unknown, nullable = false): string | null | Response {
	if (typeof itemId === 'string' || (nullable && itemId === null)) return itemId;
	return Response.json({ error: 'Invalid itemId' }, { status: 400 });
}

/** Resolves the caller from their Supabase token and unwraps the signed payload, or returns the error response to send back. */
async function readVerifiedRequest(request: Request): Promise<VerifiedRequest | Response> {
	const userId = await resolveUserFromRequest(request);
	if (!userId) return Response.json({ error: 'No authorization header' }, { status: 401 });

	const read = await readJsonBody(request, MAX_VERIFIED_BODY_BYTES);
	if ('error' in read) return read.error;

	const { data: encodedData, signature, timestamp } = (read.body ?? {}) as { data?: unknown; signature?: unknown; timestamp?: unknown };
	if (typeof encodedData !== 'string' || typeof signature !== 'string' || typeof timestamp !== 'number') {
		return Response.json({ error: 'Invalid or expired data' }, { status: 400 });
	}
	const data = verifyAndDecryptClientData(encodedData, signature, timestamp);
	if (!data) return Response.json({ error: 'Invalid or expired data' }, { status: 400 });

	return { data, userId };
}

/** Answers 401/413/400 before `handle` runs and turns anything it throws into a logged 500 carrying `failure`. */
export function verifiedHandler(failure: string, handle: (verified: VerifiedRequest) => Promise<Response> | Response) {
	return async ({ request }: { request: Request }): Promise<Response> => {
		try {
			const verified = await readVerifiedRequest(request);
			if (verified instanceof Response) return verified;
			return await handle(verified);
		} catch (error) {
			console.error(`${failure}:`, error);
			return Response.json({ error: failure }, { status: 500 });
		}
	};
}
