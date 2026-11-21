import { expect, test } from 'bun:test';
import { unwrapStoredSave, wrapSaveForStorage } from '#helpers/save/saveIntegrity.js';

test('save checksums catch an edited payload and accept raw legacy saves', () => {
	const wrapped = wrapSaveForStorage('{"totalXP":1}');
	expect(unwrapStoredSave(wrapped)).toEqual({ payload: '{"totalXP":1}', tampered: false });
	expect(unwrapStoredSave(wrapped.replace('totalXP\\":1', 'totalXP\\":9')).tampered).toBe(true);
	expect(unwrapStoredSave('{"version":12}')).toEqual({ payload: '{"version":12}', tampered: false });
});
