/**
 * Integrity guard for the local save. Not a security boundary, like signing.ts /
 * obfuscation.ts, just catches naive hand-editing of the save through DevTools.
 */

import { simpleHash } from './signing';

const WRAPPER_VERSION = 1;

interface WrappedSave {
	checksum: string;
	payload: string;
	v: number;
}

function computeSaveChecksum(payload: string): string {
	return simpleHash(payload).toString(36);
}

export function wrapSaveForStorage(payload: string): string {
	const wrapped: WrappedSave = {
		checksum: computeSaveChecksum(payload),
		payload,
		v: WRAPPER_VERSION,
	};
	return JSON.stringify(wrapped);
}

export interface UnwrappedSave {
	payload: string;
	tampered: boolean;
}

/** Accepts wrapped and raw (legacy/hand-pasted) payloads, so old saves keep working. */
export function unwrapStoredSave(raw: string): UnwrappedSave {
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && typeof parsed.payload === 'string' && typeof parsed.checksum === 'string') {
			return {
				payload: parsed.payload,
				tampered: computeSaveChecksum(parsed.payload) !== parsed.checksum,
			};
		}
	} catch {
		// Not wrapped JSON, fall through and treat raw as the payload itself.
	}

	return { payload: raw, tampered: false };
}
