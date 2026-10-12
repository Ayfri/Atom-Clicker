import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { PerfWindow } from '#lib/types/session.js';

class SessionConflictError extends Error {}

const service = {
	start: mock(async (_row: Record<string, unknown>): Promise<string> => 'write-key'),
	update: mock(async (_args: Record<string, unknown>): Promise<boolean> => true),
};

/** The real modules open a Supabase client from private env vars, the routes only need the service and the caller's id. */
mock.module('#lib/server/sessions.server.js', () => ({ SessionConflictError, sessionsService: service }));
mock.module('#lib/server/supabase.server.js', () => ({
	resolveUserFromRequest: async (request: Request) => (request.headers.has('Authorization') ? 'user-1' : null),
}));

const { POST: start } = await import('./+server.js');
const { POST: update } = await import('./update/+server.js');

const SESSION_ID = '3f2b8c1e-4d5a-4e6f-9a7b-1c2d3e4f5a6b';
const WRITE_KEY = '9a1d7c52-8e3b-4f10-b6a2-5d4c3b2a1f0e';

const device = {
	appVersion: 'build-1',
	cores: 8,
	inAppBrowser: null,
	language: 'en-US',
	maxTouchPoints: 5,
	memoryGb: null,
	pixelRatio: 3,
	reducedMotion: false,
	screenHeight: 852,
	screenWidth: 393,
	sessionId: SESSION_ID,
	standalone: false,
	userAgent: 'client-supplied agent',
	viewportHeight: 700,
	viewportWidth: 393,
};

const game = {
	animations: null,
	autoClicksPerSecond: 0,
	canvasBytes: 0,
	canvases: 1,
	covered: false,
	electronizes: 0,
	glows: 0,
	ionizes: 0,
	level: 3,
	modal: null,
	protonises: 0,
	realm: 'atoms',
	realms: ['atoms'],
	reducedMotion: false,
};

const calm: PerfWindow = { attributedMs: 100, commitLagP95Ms: 4, commitStallMs: 0, frameCount: 600, frameJankCount: 0, freezeCount: 0, freezeMs: 0, inputMaxMs: 0, inputSlowCount: 0, lostMs: 100, observedMs: 10_000, topSource: 'loop:commit' };
const bad: PerfWindow = { ...calm, commitLagP95Ms: 150 };

const totals = {
	commitLagMaxMs: 0,
	commitLagP95Ms: 0,
	frameP95GapMs: 0,
	freezeCount: 0,
	freezeMs: 0,
	inputMaxMs: 0,
	inputP95Ms: 0,
	inputPresentationShare: 0,
	jankRatio: 0,
	loaf: null,
	longTaskCount: null,
	observedMs: 10_000,
	stallMsPer10s: 0,
	unaccountedShare: 0,
	windows: 1,
	worstTarget: null,
};

const perf = (evidence: PerfWindow[]) => ({ evidence, probe: null, sources: [{ calls: 1, maxMs: 1, name: 'loop:commit', totalMs: 80 }], totals });

let address = 0;

/** Every call comes from its own address, the per-address limit has its own test. */
function call(handler: (event: never) => Response | Promise<Response>, body: unknown, { auth = false, headers = {}, ip = `10.0.0.${address++}`, raw }: { auth?: boolean; headers?: Record<string, string>; ip?: string; raw?: string } = {}) {
	const request = new Request('http://localhost/api/sessions', {
		body: raw ?? JSON.stringify(body),
		headers: { ...(auth ? { Authorization: 'Bearer token' } : {}), ...headers },
		method: 'POST',
	});
	return Promise.resolve(handler({ getClientAddress: () => ip, request } as never));
}

beforeEach(() => {
	service.start.mockClear();
	service.update.mockClear();
	service.start.mockImplementation(async () => 'write-key');
	service.update.mockImplementation(async () => true);
});

describe('start', () => {
	test('the player comes from the bearer token, the user agent from the header', async () => {
		const response = await call(start, { device, game }, { auth: true, headers: { 'user-agent': 'Real Agent/1.0' } });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ writeKey: 'write-key' });
		const [row] = service.start.mock.calls[0];
		expect(row).toMatchObject({ app_version: 'build-1', id: SESSION_ID, user_agent: 'Real Agent/1.0', user_id: 'user-1' });
		expect(row.device_key).toMatch(/^[0-9a-f]{32}$/);
	});

	test('a user id in the payload is ignored and no header means anonymous', async () => {
		await call(start, { device, game, userId: 'someone-else' });
		expect(service.start.mock.calls[0][0].user_id).toBeNull();
	});

	test('a bad body is a 400, a big one a 413', async () => {
		expect((await call(start, null, { raw: '{nope' })).status).toBe(400);
		expect((await call(start, { device: { ...device, sessionId: 'x' }, game })).status).toBe(400);
		expect((await call(start, null, { raw: ' '.repeat(9_000) })).status).toBe(413);
		expect(service.start).not.toHaveBeenCalled();
	});

	test('the seventh start from one address within a minute is a 429', async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 7; i++) statuses.push((await call(start, { device, game }, { ip: '10.9.9.9' })).status);
		expect(statuses).toEqual([200, 200, 200, 200, 200, 200, 429]);
	});

	test('an id that is already stored is a 409', async () => {
		service.start.mockImplementation(async () => {
			throw new SessionConflictError('duplicate');
		});
		expect((await call(start, { device, game })).status).toBe(409);
	});
});

describe('update', () => {
	const send = (evidence: PerfWindow[], extra: Record<string, unknown> = {}) => call(update, { game, perf: perf(evidence), sessionId: SESSION_ID, writeKey: WRITE_KEY, ...extra });

	test('degraded is recomputed from the evidence, both ways, whatever the client says', async () => {
		expect((await send([bad, bad, bad, calm], { degraded: false })).status).toBe(204);
		expect(service.update.mock.calls[0][0].degraded).toBe(true);

		await send([calm, calm, calm], { degraded: true });
		expect(service.update.mock.calls[1][0].degraded).toBe(false);
	});

	test('the write key and session id are passed through', async () => {
		await send([calm]);
		expect(service.update.mock.calls[0][0]).toMatchObject({ id: SESSION_ID, topSource: 'loop:commit', writeKey: WRITE_KEY });
	});

	test('a session or key the database does not know is a 404', async () => {
		service.update.mockImplementation(async () => false);
		expect((await send([calm])).status).toBe(404);
	});

	test('a bad body is a 400, a big one a 413', async () => {
		expect((await call(update, null, { raw: 'nope' })).status).toBe(400);
		expect((await call(update, { game, perf: perf([calm]), sessionId: 'x', writeKey: WRITE_KEY })).status).toBe(400);
		expect((await call(update, null, { raw: ' '.repeat(17_000) })).status).toBe(413);
		expect(service.update).not.toHaveBeenCalled();
	});

	test('the twenty-first update from one address within a minute is a 429', async () => {
		let last = 0;
		for (let i = 0; i < 21; i++) last = (await call(update, { game, perf: perf([calm]), sessionId: SESSION_ID, writeKey: WRITE_KEY }, { ip: '10.8.8.8' })).status;
		expect(last).toBe(429);
	});
});
