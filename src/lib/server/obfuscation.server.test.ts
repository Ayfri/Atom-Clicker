import { afterEach, expect, setSystemTime, test } from 'bun:test';
import { verifyAndDecryptClientData } from '#lib/server/obfuscation.server.js';
import { obfuscateClientData } from '#lib/utils/obfuscation.js';
import { unwrapStoredSave, wrapSaveForStorage } from '#lib/utils/saveIntegrity.js';

afterEach(() => setSystemTime());

test('a client payload reaches the server intact, unicode included', () => {
	const data = { picture: null, questId: 'atoms_earned', username: 'Électron ⚛️ 原子' };
	const { data: encoded, signature, timestamp } = obfuscateClientData(data);
	expect(verifyAndDecryptClientData(encoded, signature, timestamp)).toEqual(data);
});

test('rejects an edited payload or signature', () => {
	const { data: encoded, signature, timestamp } = obfuscateClientData({ amount: 1 });
	const edited = btoa(JSON.stringify({ amount: 1000 }));
	expect(verifyAndDecryptClientData(edited, signature, timestamp)).toBeNull();
	expect(verifyAndDecryptClientData(encoded, `${signature}x`, timestamp)).toBeNull();
});

test('rejects payloads older than five minutes or from too far in the future', () => {
	setSystemTime(new Date('2026-01-01T00:00:00Z'));
	const { data: encoded, signature, timestamp } = obfuscateClientData({ amount: 1 });

	setSystemTime(new Date('2026-01-01T00:04:59Z'));
	expect(verifyAndDecryptClientData(encoded, signature, timestamp)).not.toBeNull();
	setSystemTime(new Date('2026-01-01T00:05:01Z'));
	expect(verifyAndDecryptClientData(encoded, signature, timestamp)).toBeNull();
	setSystemTime(new Date('2025-12-31T23:59:49Z'));
	expect(verifyAndDecryptClientData(encoded, signature, timestamp)).toBeNull();
});

test('save checksums catch an edited payload and accept raw legacy saves', () => {
	const wrapped = wrapSaveForStorage('{"totalXP":1}');
	expect(unwrapStoredSave(wrapped)).toEqual({ payload: '{"totalXP":1}', tampered: false });
	expect(unwrapStoredSave(wrapped.replace('totalXP\\":1', 'totalXP\\":9')).tampered).toBe(true);
	expect(unwrapStoredSave('{"version":12}')).toEqual({ payload: '{"version":12}', tampered: false });
});
