import { describe, expect, test } from 'bun:test';
import { readJsonBody } from '#lib/server/requestBody.server.js';

describe('readJsonBody', () => {
	const post = (body: string, headers: Record<string, string> = {}) => new Request('http://localhost/api', { body, headers, method: 'POST' });

	test('parses a body within the cap', async () => {
		expect(await readJsonBody(post('{"a":1}'), 100)).toEqual({ body: { a: 1 } });
	});

	test('a declared length over the cap is refused before the body is read', async () => {
		const result = await readJsonBody(post('{}', { 'content-length': '500' }), 100);
		expect('error' in result && result.error.status).toBe(413);
	});

	test('the cap is in UTF-8 bytes, not characters', async () => {
		const body = JSON.stringify({ a: 'é'.repeat(60) });
		expect(body.length).toBeLessThan(100);
		const result = await readJsonBody(post(body), 100);
		expect('error' in result && result.error.status).toBe(413);
	});

	test('a chunked body without Content-Length is counted while it streams', async () => {
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

	test('invalid JSON is a 400', async () => {
		const result = await readJsonBody(post('{nope'), 100);
		expect('error' in result && result.error.status).toBe(400);
	});

	test('a request with no body is a 400', async () => {
		const result = await readJsonBody(new Request('http://localhost/api', { method: 'POST' }), 100);
		expect('error' in result && result.error.status).toBe(400);
	});
});
