// Lightweight tamper/replay guard for leaderboard payloads in transit.
// This runs identically on client and server, so it is NOT a secret and NOT a
// security boundary - request identity is enforced via Supabase auth tokens
// server-side, see src/lib/server/obfuscation.server.ts.

export function simpleHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return Math.abs(hash);
}

export function generateSignature(data: string, timestamp: number): string {
	const timeWindow = Math.floor(timestamp / 5000);
	return simpleHash(`${data}|${timeWindow}`).toString(36);
}
