import { describe, expect, test } from 'bun:test';
import { deviceKey, parseSessionStart, parseSessionUpdate, readJsonBody } from '#lib/server/sessionPayload.server.js';
import type { DeviceInfo, PerfWindow, SessionGame, SessionPerf } from '#lib/types/session.js';

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

const perfWindow: PerfWindow = { attributedMs: 100, commitLagP95Ms: 20, commitStallMs: 5, frameCount: 600, frameJankCount: 3, freezeCount: 1, freezeMs: 2_500, inputMaxMs: 120, inputSlowCount: 0, lostMs: 300, observedMs: 10_000, topSource: 'loop:commit' };

const perf: SessionPerf = {
	evidence: [perfWindow],
	probe: { aborted: null, baselineLostMsPerS: 80, culprit: 'glows', layers: [{ jankRatio: 0.1, lostMsPerS: 20, name: 'glows' }] },
	sources: [{ calls: 10, maxMs: 4, name: 'loop:commit', totalMs: 40 }],
	totals: {
		commitLagMaxMs: 90,
		commitLagP95Ms: 20,
		frameP95GapMs: 33,
		freezeCount: 1,
		freezeMs: 2_500,
		inputMaxMs: 120,
		inputP95Ms: 100,
		inputPresentationShare: 0.5,
		jankRatio: 0.01,
		loaf: { renderMs: 1, scriptMs: 2, styleLayoutMs: 3, topScripts: ['event-listener:button@onclick'] },
		longTaskCount: null,
		observedMs: 10_000,
		stallMsPer10s: 5,
		unaccountedShare: 0.6,
		windows: 1,
		worstTarget: 'button',
	},
};

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
			game: { ...game, level: NaN, protonises: 1e12 },
		});
		expect(parsed?.device).toMatchObject({ cores: 512, pixelRatio: 0.1, screenHeight: 0, screenWidth: 20_000 });
		expect(parsed?.game).toMatchObject({ level: 0, protonises: 1_000_000 });
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
		expect(parseSessionUpdate({ game, perf, sessionId: SESSION_ID, writeKey: WRITE_KEY })).toEqual({ game, perf, sessionId: SESSION_ID, writeKey: WRITE_KEY });
	});

	test('the degraded flag and top source of the client are not read', () => {
		const parsed = parseSessionUpdate({ degraded: true, game, perf: { ...perf, degraded: true, topSource: 'evil' }, sessionId: SESSION_ID, topSource: 'evil', writeKey: WRITE_KEY });
		expect(JSON.stringify(parsed)).not.toContain('evil');
		expect(parsed).not.toHaveProperty('degraded');
	});

	test('a bad session id, write key or realm is refused', () => {
		expect(parseSessionUpdate({ game, perf, sessionId: 'nope', writeKey: WRITE_KEY })).toBeNull();
		expect(parseSessionUpdate({ game, perf, sessionId: SESSION_ID, writeKey: 'nope' })).toBeNull();
		expect(parseSessionUpdate({ game: { ...game, realm: 'x' }, perf, sessionId: SESSION_ID, writeKey: WRITE_KEY })).toBeNull();
		expect(parseSessionUpdate({ game, sessionId: SESSION_ID, writeKey: WRITE_KEY })).toBeNull();
	});

	test('a source name that is not a plain identifier is dropped', () => {
		const parsed = parseSessionUpdate({
			game,
			perf: { ...perf, sources: [{ calls: 1, maxMs: 1, name: '<script>alert(1)</script>', totalMs: 1 }, perf.sources[0]], evidence: [{ ...perfWindow, topSource: '<script>' }] },
			sessionId: SESSION_ID,
			writeKey: WRITE_KEY,
		});
		expect(parsed?.perf.sources.map(({ name }) => name)).toEqual(['loop:commit']);
		expect(parsed?.perf.evidence[0].topSource).toBeNull();
	});

	test('evidence, sources, layers and top scripts are capped', () => {
		const parsed = parseSessionUpdate({
			game,
			perf: {
				evidence: Array.from({ length: 30 }, () => perfWindow),
				probe: { aborted: null, baselineLostMsPerS: 80, culprit: null, layers: Array.from({ length: 20 }, () => ({ jankRatio: 0.1, lostMsPerS: 20, name: 'glows' })) },
				sources: Array.from({ length: 40 }, () => perf.sources[0]),
				totals: { ...perf.totals, loaf: { ...perf.totals.loaf, topScripts: ['a'.repeat(500), 'b', 'c', 'd'] }, worstTarget: 'w'.repeat(200) },
			},
			sessionId: SESSION_ID,
			writeKey: WRITE_KEY,
		});
		expect(parsed?.perf.evidence).toHaveLength(12);
		expect(parsed?.perf.sources).toHaveLength(12);
		expect(parsed?.perf.probe?.layers).toHaveLength(8);
		expect(parsed?.perf.totals.loaf?.topScripts).toHaveLength(3);
		expect(parsed?.perf.totals.loaf?.topScripts[0]).toHaveLength(160);
		expect(parsed?.perf.totals.worstTarget).toHaveLength(80);
	});

	test('shares stay in 0 to 1 and milliseconds in range', () => {
		const parsed = parseSessionUpdate({
			game,
			perf: { ...perf, evidence: [{ ...perfWindow, lostMs: 1e9 }], totals: { ...perf.totals, jankRatio: 5, unaccountedShare: -2 } },
			sessionId: SESSION_ID,
			writeKey: WRITE_KEY,
		});
		expect(parsed?.perf.evidence[0].lostMs).toBe(600_000);
		expect(parsed?.perf.totals).toMatchObject({ jankRatio: 1, unaccountedShare: 0 });
	});
});

describe('probe results', () => {
	const withLayers = (layers: unknown[]) => parseSessionUpdate({ game, perf: { ...perf, probe: { aborted: null, baselineLostMsPerS: 50, culprit: null, layers } }, sessionId: SESSION_ID, writeKey: WRITE_KEY });

	test('a layer without enough frames keeps a null jank ratio instead of 0', () => {
		const parsed = withLayers([{ jankRatio: null, lostMsPerS: 10, name: 'glows' }, { jankRatio: 0.04, lostMsPerS: 10, name: 'panels' }]);
		expect(parsed?.perf.probe?.layers.map(({ jankRatio }) => jankRatio)).toEqual([null, 0.04]);
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
