import { verifyAndDecryptClientData } from '#lib/server/obfuscation.server.js';
import { readJsonBody } from '#lib/server/requestBody.server.js';
import { resolveUserFromRequest } from '#lib/server/supabase.server.js';

/** A game state weighs ~15 KB, this only stops a client from making the Worker parse megabytes. */
const MAX_BODY_BYTES = 256 * 1024;

interface VerifiedRequest {
	data: Record<string, unknown>;
	userId: string;
}

/** Resolves the caller from their Supabase token and unwraps the signed payload, or returns the error response to send back. */
async function readVerifiedRequest(request: Request): Promise<VerifiedRequest | Response> {
	const userId = await resolveUserFromRequest(request);
	if (!userId) return Response.json({ error: 'No authorization header' }, { status: 401 });

	const read = await readJsonBody(request, MAX_BODY_BYTES);
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
