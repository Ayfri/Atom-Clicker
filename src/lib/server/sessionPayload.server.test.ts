import { describe, expect, test } from 'bun:test';
import { deviceKey, parseSessionStart, parseSessionUpdate, readJsonBody } from '#lib/server/sessionPayload.server.js';
import type { DeviceInfo, PerfIncident, PerfWindow, SessionGame, SessionPerf } from '#lib/types/session.js';

const SESSION_ID = '3f2b8c1e-4d5a-4e6f-9a7b-1c2d3e4f5a6b';
const WRITE_KEY = '9a1d7c52-8e3b-4f10-b6a2-5d4c3b2a1f0e';

const device: DeviceInfo = {
	appVersion: '1760000000000',
	cores: 8,
	inAppBrowser: 'tiktok',
	language: 'en-US',
	maxTouchPoints: 5,
	memoryGb: 4,
	pixelRatio: 3,
	reducedMotion: false,
	screenHeight: 852,
	screenWidth: 393,
	sessionId: SESSION_ID,
	standalone: false,
	userAgent: 'Mozilla/5.0 (iPhone)',
	viewportHeight: 700,
	viewportWidth: 393,
};

const game: SessionGame = {
	animations: 12,
	autoClicksPerSecond: 3,
	backdrops: 2,
	canvasBytes: 4_000_000,
	canvases: 4,
	covered: false,
	electronizes: 1,
	glows: 3,
	ionizes: 0,
	level: 40,
	modal: null,
	protonises: 2,
	realm: 'photons',
	realms: ['atoms', 'photons'],
	reducedMotion: false,
};

const perfWindow: PerfWindow = { blockedMs: 1_600, commitLagP95Ms: 20, frameCount: 600, frameJankCount: 3, freezeCount: 1, observedMs: 10_000, slowInputCount: 2 };

const incident: PerfIncident = {
	action: 'tap:Atom',
	actionAgoMs: 12,
	atMs: 34_000,
	durationMs: 992,
	input: { delayMs: 6, presentationMs: 446, processingMs: 540, target: 'Atom' },
	loaf: { otherMs: 4, scriptMs: 540, scripts: [{ durationMs: 512, file: 'Atom.js', fn: 'Gr', invoker: 'event-listener:DIV.onclick' }], styleLayoutMs: 40 },
	modal: 'skill-tree',
	realm: 'atoms',
	sources: [{ ms: 38, name: 'svelte:flush' }],
	timerLate: true,
};

const perf: SessionPerf = {
	evidence: [perfWindow],
	incidents: [incident],
	sources: [{ calls: 10, maxMs: 4, name: 'loop:commit', totalMs: 40 }],
	totals: {
		blocked: { frame: { count: 1, ms: 200 }, freeze: { count: 1, ms: 1_200 }, input: { count: 21, ms: 9_800 }, stall: { count: 0, ms: 0 } },
		commitLagP95Ms: 20,
		eventTiming: true,
		inputP95Ms: 100,
		jankRatio: 0.01,
		loaf: true,
		visibleMs: 51_000,
	},
};

const update = (body: Record<string, unknown>) => parseSessionUpdate({ game, perf, sessionId: SESSION_ID, writeKey: WRITE_KEY, ...body });
const withIncident = (overrides: Record<string, unknown>) => update({ perf: { ...perf, incidents: [{ ...incident, ...overrides }] } });

describe('parseSessionStart', () => {
	test('a clean payload round trips', () => {
		expect(parseSessionStart({ device, game })).toEqual({ device, game });
	});

	test('unknown keys are dropped, a client user id never gets through', () => {
		const parsed = parseSessionStart({ device: { ...device, evil: 1 }, game: { ...game, extra: 'x' }, userId: 'someone' });
		expect(parsed).toEqual({ device, game });
		expect(JSON.stringify(parsed)).not.toContain('someone');
	});

	test('non-finite, negative and huge numbers are clamped', () => {
		const parsed = parseSessionStart({
			device: { ...device, cores: 99_999, pixelRatio: Infinity, screenHeight: -5, screenWidth: 1e12 },
			game: { ...game, backdrops: 1e12, level: NaN, protonises: 1e12 },
		});
		expect(parsed?.device).toMatchObject({ cores: 512, pixelRatio: 0.1, screenHeight: 0, screenWidth: 20_000 });
		expect(parsed?.game).toMatchObject({ backdrops: 1_000_000, level: 0, protonises: 1_000_000 });
	});

	test('a locked level round trips as null', () => {
		expect(parseSessionStart({ device, game: { ...game, level: null } })?.game.level).toBeNull();
		expect(parseSessionStart({ device, game: { ...game, level: 'x' } })?.game.level).toBeNull();
	});

	test('numbers are rounded to 0.1', () => {
		expect(parseSessionStart({ device: { ...device, pixelRatio: 2.6666 }, game })?.device.pixelRatio).toBe(2.7);
	});

	test('strings are truncated and arrays capped', () => {
		const parsed = parseSessionStart({
			device: { ...device, language: 'x'.repeat(100), userAgent: 'u'.repeat(1_000) },
			game: { ...game, modal: 'm'.repeat(100), realms: Array.from({ length: 20 }, () => 'atoms') },
		});
		expect(parsed?.device.language).toHaveLength(35);
		expect(parsed?.device.userAgent).toHaveLength(400);
		expect(parsed?.game.modal).toHaveLength(40);
		expect(parsed?.game.realms).toHaveLength(8);
	});

	test('a bad in-app browser becomes null and a bad realm in the list is dropped', () => {
		const parsed = parseSessionStart({ device: { ...device, inAppBrowser: '<b>x</b>' }, game: { ...game, realms: ['atoms', 'hell'] } });
		expect(parsed?.device.inAppBrowser).toBeNull();
		expect(parsed?.game.realms).toEqual(['atoms']);
	});

	test('a root that is not an object, a bad session id, build or realm is refused', () => {
		expect(parseSessionStart(null)).toBeNull();
		expect(parseSessionStart([])).toBeNull();
		expect(parseSessionStart({ device: { ...device, sessionId: 'fallback-1' }, game })).toBeNull();
		expect(parseSessionStart({ device: { ...device, appVersion: 'a b<' }, game })).toBeNull();
		expect(parseSessionStart({ device, game: { ...game, realm: 'cosmos' } })).toBeNull();
		expect(parseSessionStart({ device })).toBeNull();
	});
});

describe('parseSessionUpdate', () => {
	test('a clean payload round trips', () => {
		expect(update({})).toEqual({ game, perf, sessionId: SESSION_ID, writeKey: WRITE_KEY });
	});

	test('the degraded flag, problem and cause of the client are not read', () => {
		const parsed = update({ cause: 'evil', degraded: true, perf: { ...perf, cause: 'evil', degraded: true, problem: 'evil', summary: 'evil' }, problem: 'evil', summary: 'evil' });
		expect(JSON.stringify(parsed)).not.toContain('evil');
		expect(parsed).not.toHaveProperty('degraded');
	});

	test('a bad session id, write key or realm is refused', () => {
		expect(update({ sessionId: 'nope' })).toBeNull();
		expect(update({ writeKey: 'nope' })).toBeNull();
		expect(update({ game: { ...game, realm: 'x' } })).toBeNull();
		expect(parseSessionUpdate({ game, sessionId: SESSION_ID, writeKey: WRITE_KEY })).toBeNull();
	});

	test('totals of the older report shape are refused', () => {
		const { blocked: _, ...old } = perf.totals;
		expect(update({ perf: { ...perf, totals: old } })).toBeNull();
		expect(update({ perf: { ...perf, totals: { ...old, blocked: 'x' } } })).toBeNull();
	});

	test('a source name that is not a plain identifier is dropped', () => {
		const parsed = update({
			perf: {
				...perf,
				incidents: [{ ...incident, sources: [{ ms: 5, name: '<script>' }, { ms: 5, name: 'canvas:atom' }] }],
				sources: [{ calls: 1, maxMs: 1, name: '<script>alert(1)</script>', totalMs: 1 }, perf.sources[0]],
			},
		});
		expect(parsed?.perf.sources.map(({ name }) => name)).toEqual(['loop:commit']);
		expect(parsed?.perf.incidents[0].sources).toEqual([{ ms: 5, name: 'canvas:atom' }]);
	});

	test('evidence, incidents, sources, scripts and spans are capped', () => {
		const spans = Array.from({ length: 6 }, (_, i) => ({ ms: i, name: `s${i}` }));
		const scripts = Array.from({ length: 6 }, () => incident.loaf?.scripts[0]);
		const parsed = update({
			perf: {
				evidence: Array.from({ length: 30 }, () => perfWindow),
				incidents: Array.from({ length: 10 }, () => ({ ...incident, loaf: { ...incident.loaf, scripts }, sources: spans })),
				sources: Array.from({ length: 40 }, () => perf.sources[0]),
				totals: perf.totals,
			},
		});
		expect(parsed?.perf.evidence).toHaveLength(12);
		expect(parsed?.perf.incidents).toHaveLength(6);
		expect(parsed?.perf.sources).toHaveLength(12);
		expect(parsed?.perf.incidents[0].loaf?.scripts).toHaveLength(3);
		expect(parsed?.perf.incidents[0].sources).toHaveLength(3);
	});

	test('text is truncated, control characters dropped and query strings stripped from scripts', () => {
		const parsed = withIncident({
			action: 'a'.repeat(200),
			input: { ...incident.input, target: 't'.repeat(200) },
			loaf: {
				...incident.loaf,
				scripts: [
					{ durationMs: 5, file: 'app.js?token=secret', fn: 'f'.repeat(200), invoker: 'classic-script:https://x.test/app.js?token=secret' },
					{ durationMs: 4, file: null, fn: null, invoker: 'event-listener:#document.onclick' },
					{ durationMs: 3, file: null, fn: null, invoker: 'classic-script:https://x.test/app.js#secret' },
				],
			},
			modal: 'm\u0000odal',
		});
		const [parsedIncident] = parsed?.perf.incidents ?? [];
		expect(parsedIncident.action).toHaveLength(80);
		expect(parsedIncident.input?.target).toHaveLength(60);
		expect(parsedIncident.loaf?.scripts[0]).toMatchObject({ file: 'app.js', invoker: 'classic-script:https://x.test/app.js' });
		expect(parsedIncident.loaf?.scripts[0].fn).toHaveLength(60);
		expect(parsedIncident.loaf?.scripts[1].invoker).toBe('event-listener:#document.onclick');
		expect(parsedIncident.loaf?.scripts[2].invoker).toBe('classic-script:https://x.test/app.js');
		expect(parsedIncident.modal).toBe('modal');
		expect(JSON.stringify(parsed)).not.toContain('secret');
	});

	test('a kind sent by the client is ignored', () => {
		const parsed = withIncident({ kind: 'freeze' });
		expect(parsed?.perf.incidents[0]).not.toHaveProperty('kind');
	});

	test('an incident without a known realm is dropped and a missing breakdown stays null', () => {
		expect(withIncident({ realm: 'hell' })?.perf.incidents).toEqual([]);
		const bare = withIncident({ input: undefined, loaf: 'x' });
		expect(bare?.perf.incidents[0]).toMatchObject({ input: null, loaf: null });
	});

	test('shares stay in 0 to 1 and milliseconds in range', () => {
		const parsed = update({
			perf: { ...perf, evidence: [{ ...perfWindow, blockedMs: 1e9 }], incidents: [{ ...incident, durationMs: 1e9 }], totals: { ...perf.totals, jankRatio: 5 } },
		});
		expect(parsed?.perf.evidence[0].blockedMs).toBe(600_000);
		expect(parsed?.perf.incidents[0].durationMs).toBe(60_000);
		expect(parsed?.perf.totals.jankRatio).toBe(1);
	});

	test('a payload at every maximum stays under the 16 KB body cap', () => {
		const long = (length: number) => 'x'.repeat(length);
		const script = { durationMs: 59_999, file: long(60), fn: long(60), invoker: long(80) };
		const full = {
			game: { ...game, modal: long(40) },
			perf: {
				evidence: Array.from({ length: 12 }, () => ({ ...perfWindow, blockedMs: 599_999.9, commitLagP95Ms: 599_999.9, frameCount: 999_999, frameJankCount: 999_999, observedMs: 599_999.9 })),
				incidents: Array.from({ length: 6 }, () => ({
					...incident,
					action: long(80),
					atMs: 999_999_999.9,
					input: { delayMs: 59_999.9, presentationMs: 59_999.9, processingMs: 59_999.9, target: long(60) },
					loaf: { otherMs: 59_999.9, scriptMs: 59_999.9, scripts: [script, script, script], styleLayoutMs: 59_999.9 },
					modal: long(40),
					sources: Array.from({ length: 3 }, () => ({ ms: 59_999.9, name: long(40) })),
				})),
				sources: Array.from({ length: 12 }, () => ({ calls: 9_999_999_999, maxMs: 599_999.9, name: long(40), totalMs: 9_999_999_999 })),
				totals: perf.totals,
			},
			sessionId: SESSION_ID,
			writeKey: WRITE_KEY,
		};
		expect(new TextEncoder().encode(JSON.stringify(full)).length).toBeLessThan(16 * 1024);
		expect(parseSessionUpdate(full)?.perf.incidents).toHaveLength(6);
	});
});

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

	test('invalid JSON is a 400', async () => {
		const result = await readJsonBody(post('{nope'), 100);
		expect('error' in result && result.error.status).toBe(400);
	});
});

describe('deviceKey', () => {
	test('is a stable 32 character hex string that changes with the device', async () => {
		const parsed = parseSessionStart({ device, game });
		if (!parsed) throw new Error('fixture refused');
		const key = await deviceKey(parsed.device);
		expect(key).toMatch(/^[0-9a-f]{32}$/);
		expect(await deviceKey(parsed.device)).toBe(key);
		expect(await deviceKey({ ...parsed.device, screenWidth: 400 })).not.toBe(key);
	});
});
