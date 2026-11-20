import { afterEach, expect, mock, setSystemTime, test } from 'bun:test';
import { obfuscateClientData } from '#helpers/obfuscation.js';

/** The real module opens a Supabase client. Bun keeps one export list per mocked module for the whole run, so every export of the real one is declared. */
mock.module('#lib/server/supabase.server.js', () => ({
	colliderService: {},
	leaderboardService: {},
	quarksService: {},
	resolveUserFromRequest: async () => null,
	supabaseAdmin: {},
}));

const { RateLimiter, readJsonBody, verifyAndDecryptClientData } = await import('./request.server.js');

afterEach(() => setSystemTime());

const post = (body: string, headers: Record<string, string> = {}) => new Request('http://localhost/api', { body, headers, method: 'POST' });

test('readJsonBody parses a body within the cap', async () => {
	expect(await readJsonBody(post('{"a":1}'), 100)).toEqual({ body: { a: 1 } });
});

test('readJsonBody refuses a declared length over the cap before the body is read', async () => {
	const result = await readJsonBody(post('{}', { 'content-length': '500' }), 100);
	expect('error' in result && result.error.status).toBe(413);
});

test('readJsonBody counts the cap in UTF-8 bytes, not characters', async () => {
	const body = JSON.stringify({ a: 'é'.repeat(60) });
	expect(body.length).toBeLessThan(100);
	const result = await readJsonBody(post(body), 100);
	expect('error' in result && result.error.status).toBe(413);
});

test('readJsonBody counts a chunked body without Content-Length while it streams', async () => {
	const bytes = new TextEncoder().encode(JSON.stringify({ a: 'x'.repeat(100_000) }));
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (let i = 0; i < bytes.length; i += 16_384) controller.enqueue(bytes.slice(i, i + 16_384));
			controller.close();
		},
	});
	const request = new Request('http://localhost/api', { body: stream, duplex: 'half', method: 'POST' } as RequestInit);
	expect(request.headers.has('content-length')).toBe(false);
	const result = await readJsonBody(request, 50_000);
	expect('error' in result && result.error.status).toBe(413);
});

test('readJsonBody answers 400 for invalid JSON and for a request with no body', async () => {
	const invalid = await readJsonBody(post('{nope'), 100);
	expect('error' in invalid && invalid.error.status).toBe(400);
	const empty = await readJsonBody(new Request('http://localhost/api', { method: 'POST' }), 100);
	expect('error' in empty && empty.error.status).toBe(400);
});

test('a client payload reaches the server intact, unicode included', () => {
	const data = { picture: null, questId: 'atoms_earned', username: 'Électron ⚛️ 原子' };
	const { data: encoded, signature, timestamp } = obfuscateClientData(data);
	expect(verifyAndDecryptClientData(encoded, signature, timestamp)).toEqual(data);
});

test('verifyAndDecryptClientData rejects an edited payload or signature', () => {
	const { data: encoded, signature, timestamp } = obfuscateClientData({ amount: 1 });
	const edited = btoa(JSON.stringify({ amount: 1000 }));
	expect(verifyAndDecryptClientData(edited, signature, timestamp)).toBeNull();
	expect(verifyAndDecryptClientData(encoded, `${signature}x`, timestamp)).toBeNull();
});

test('verifyAndDecryptClientData rejects payloads older than five minutes or from too far in the future', () => {
	setSystemTime(new Date('2026-01-01T00:00:00Z'));
	const { data: encoded, signature, timestamp } = obfuscateClientData({ amount: 1 });

	setSystemTime(new Date('2026-01-01T00:04:59Z'));
	expect(verifyAndDecryptClientData(encoded, signature, timestamp)).not.toBeNull();
	setSystemTime(new Date('2026-01-01T00:05:01Z'));
	expect(verifyAndDecryptClientData(encoded, signature, timestamp)).toBeNull();
	setSystemTime(new Date('2025-12-31T23:59:49Z'));
	expect(verifyAndDecryptClientData(encoded, signature, timestamp)).toBeNull();
});

test('RateLimiter answers 429 past the cap, per key, until the window passes', () => {
	setSystemTime(new Date('2026-01-01T00:00:00Z'));
	const limiter = new RateLimiter(60_000, 2);
	expect(limiter.reject('a')).toBeUndefined();
	expect(limiter.reject('a')).toBeUndefined();
	expect(limiter.reject('a')?.status).toBe(429);
	expect(limiter.reject('b')).toBeUndefined();

	setSystemTime(new Date('2026-01-01T00:01:01Z'));
	expect(limiter.reject('a')).toBeUndefined();
});
