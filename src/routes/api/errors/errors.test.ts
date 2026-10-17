import { beforeEach, expect, mock, test } from 'bun:test';

const logError = mock(async () => ({ id: 'e1' }));

/** Bun keeps one export list per mocked module for the whole run, so every export of the real one is declared or other test files lose theirs. */
mock.module('#lib/server/supabase.server.js', () => ({
	colliderService: {},
	leaderboardService: {},
	quarksService: {},
	resolveUserFromRequest: async () => null,
	supabaseAdmin: {},
}));
mock.module('#lib/server/errorHandler.server.js', () => ({ logError }));

const { POST } = await import('./+server.js');

let ip = 0;

async function report(body: BodyInit, init: RequestInit = {}) {
	const request = new Request('http://localhost/api/errors', { body, method: 'POST', ...init });
	const response = await POST({ getClientAddress: () => `10.0.0.${++ip}`, request } as never);
	return { body: await response.json(), status: response.status };
}

beforeEach(() => logError.mockClear());

test('a valid report is logged and answered with its id', async () => {
	expect(await report(JSON.stringify({ errorMessage: 'boom', url: 'http://localhost/' }))).toEqual({ body: { id: 'e1', success: true }, status: 200 });
	expect(logError).toHaveBeenCalledTimes(1);
});

test('broken JSON, a null body and a missing message are bad requests', async () => {
	expect((await report('{nope')).status).toBe(400);
	expect((await report('null')).status).toBe(400);
	expect((await report('{}')).status).toBe(400);
	expect(logError).not.toHaveBeenCalled();
});

test('an oversized body is refused, chunked or not', async () => {
	const huge = JSON.stringify({ errorMessage: 'x', padding: 'x'.repeat(70_000) });
	const bytes = new TextEncoder().encode(huge);
	const chunked = new ReadableStream<Uint8Array>({
		start(controller) {
			for (let i = 0; i < bytes.length; i += 16_384) controller.enqueue(bytes.slice(i, i + 16_384));
			controller.close();
		},
	});

	expect((await report(huge)).status).toBe(413);
	expect((await report(chunked, { duplex: 'half' } as RequestInit)).status).toBe(413);
	expect(logError).not.toHaveBeenCalled();
});

test('the cap is in UTF-8 bytes, not characters', async () => {
	const body = JSON.stringify({ errorMessage: 'é'.repeat(40_000) });
	expect(body.length).toBeLessThan(64 * 1024);
	expect((await report(body)).status).toBe(413);
	expect(logError).not.toHaveBeenCalled();
});

test('the 11th report from one address in a minute is rate limited', async () => {
	const send = async () => {
		const request = new Request('http://localhost/api/errors', { body: JSON.stringify({ errorMessage: 'boom' }), method: 'POST' });
		return (await POST({ getClientAddress: () => '192.168.0.1', request } as never)).status;
	};
	for (let i = 0; i < 10; i++) expect(await send()).toBe(200);
	expect(await send()).toBe(429);
});
