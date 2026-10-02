import { verifyAndDecryptClientData } from '#lib/server/obfuscation.server.js';
import { resolveUserFromRequest } from '#lib/server/supabase.server.js';

export interface VerifiedRequest {
	data: Record<string, unknown>;
	userId: string;
}

/** Resolves the caller from their Supabase token and unwraps the signed payload, or returns the error response to send back. */
export async function readVerifiedRequest(request: Request): Promise<VerifiedRequest | Response> {
	const userId = await resolveUserFromRequest(request);
	if (!userId) return Response.json({ error: 'No authorization header' }, { status: 401 });

	const { data: encodedData, signature, timestamp } = await request.json();
	const data = verifyAndDecryptClientData(encodedData, signature, timestamp);
	if (!data) return Response.json({ error: 'Invalid or expired data' }, { status: 400 });

	return { data, userId };
}
