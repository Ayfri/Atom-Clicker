import { generateSignature } from '$lib/utils/signing';

const SIGNATURE_WINDOW_MS = 5000;

/** Server side of src/lib/utils/obfuscation.ts: a tamper/replay guard, not a security boundary, see signing.ts. */
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
