import { generateSignature } from './signing';

/** Base64 + a signature so a payload can't be casually edited in transit. Not encryption, see signing.ts. */
export function obfuscateClientData(data: Record<string, unknown>) {
	const timestamp = Date.now();
	const bytes = new TextEncoder().encode(JSON.stringify(data));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	const encodedData = btoa(binary);

	return {
		data: encodedData,
		signature: generateSignature(encodedData, timestamp),
		timestamp
	};
}
