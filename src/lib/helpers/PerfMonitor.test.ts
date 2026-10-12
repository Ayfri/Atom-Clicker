import { afterEach, beforeEach, describe, expect, jest, mock, test } from 'bun:test';
import { perfTracker } from '#helpers/perfTracker.js';
import type { DeviceInfo, PerfWindow } from '#lib/types/session.js';
import { privacy } from '#stores/privacy.svelte.js';

const SESSION_ID = '3f2b8c1e-4d5a-4e6f-9a7b-1c2d3e4f5a6b';
const WRITE_KEY = '9a1d7c52-8e3b-4f10-b6a2-5d4c3b2a1f0e';
const STORAGE_KEY = 'atomic-clicker-perf';
const HOUR_MS = 3_600_000;

const device: DeviceInfo = {
	appVersion: 'build-1',
	cores: 6,
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
	userAgent: 'test agent',
	viewportHeight: 700,
	viewportWidth: 393,
};

/** The session id and device come from the browser, which these tests do not have: everything else of the module stays real. */
const clientInfo = await import('#helpers/clientInfo.js');
mock.module('#helpers/clientInfo.js', () => ({ ...clientInfo, SESSION_ID, getDeviceInfo: () => device, isCrawler: () => false }));
const { PerfMonitor } = await import('#helpers/PerfMonitor.js');

const badWindow: PerfWindow = {
	attributedMs: 0,
	commitLagP95Ms: 150,
	commitStallMs: 0,
	frameCount: 600,
	frameJankCount: 0,
	freezeCount: 0,
	freezeMs: 0,
	inputMaxMs: 0,
	inputSlowCount: 0,
	lostMs: 800,
	observedMs: 10_000,
	topSource: null,
};

const stubbed = new Map<object, Map<string, PropertyDescriptor | undefined>>();

/** Replaces a property for the length of a test, `restore` puts every original back. */
function stub(target: object, name: string, value: unknown) {
	const originals = stubbed.get(target) ?? new Map<string, PropertyDescriptor | undefined>();
	if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(target, name));
	stubbed.set(target, originals);
	Object.defineProperty(target, name, { configurable: true, value, writable: true });
}

function restore() {
	for (const [target, originals] of stubbed) {
		for (const [name, descriptor] of originals) {
			if (descriptor) Object.defineProperty(target, name, descriptor);
			else Reflect.deleteProperty(target, name);
		}
	}
	stubbed.clear();
}

class FakeObserver {
	static supportedEntryTypes = ['event', 'long-animation-frame'];
	disconnect = mock(() => {});
	observe = mock(() => {});
}

interface FetchCall {
	body: unknown;
	url: string;
}

let fetchCalls: FetchCall[] = [];
let updateStatus = 200;
let layers = new Set<string>();
let beacons: unknown[] = [];
let documentHandlers = new Map<string, () => void>();
let documentStub: { documentElement: { dataset: Record<string, string | undefined> }; hidden: boolean };
let monitor = new PerfMonitor();
let storage = new Map<string, string>();

const GLOWS = '[data-perf-layer="glow"]';
const updates = () => fetchCalls.filter(({ url }) => url === '/api/sessions/update');
/** Lets every pending promise continuation run. */
async function flush() {
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Bun's fake timers have no async advance: the probe chains a timer after each await, so time moves in short steps with a flush between. */
async function advance(ms: number) {
	for (let elapsed = 0; elapsed < ms; elapsed += 250) {
		jest.advanceTimersByTime(Math.min(250, ms - elapsed));
		await flush();
	}
}

const settle = flush;

async function startAndOpen() {
	monitor.start();
	await monitor.open();
	await advance(15_000);
}

/** Feeds the windows the tracker would close, `onWindow` is what the monitor registered on start. */
function feed(count: number, window: PerfWindow = badWindow) {
	for (let i = 0; i < count; i++) perfTracker.onWindow?.(window);
}

beforeEach(() => {
	jest.useFakeTimers();
	fetchCalls = [];
	updateStatus = 200;
	layers = new Set();
	beacons = [];
	documentHandlers = new Map();
	storage = new Map();
	documentStub = { documentElement: { dataset: {} }, hidden: false };
	stub(globalThis, 'document', {
		...documentStub,
		addEventListener: (type: string, handler: () => void) => documentHandlers.set(type, handler),
		documentElement: documentStub.documentElement,
		getAnimations: () => [],
		get hidden() {
			return documentStub.hidden;
		},
		querySelector: (selector: string) => (layers.has(selector) ? {} : null),
		querySelectorAll: () => [],
		removeEventListener: () => {},
	});
	stub(globalThis, 'window', { addEventListener: () => {}, removeEventListener: () => {} });
	stub(globalThis, 'localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		removeItem: (key: string) => storage.delete(key),
		setItem: (key: string, value: string) => storage.set(key, value),
	});
	stub(globalThis, 'PerformanceObserver', FakeObserver);
	stub(globalThis, 'fetch', async (url: string, init: { body: string }) => {
		fetchCalls.push({ body: JSON.parse(init.body), url });
		return url === '/api/sessions' ? Response.json({ writeKey: WRITE_KEY }) : new Response(null, { status: updateStatus });
	});
	stub(navigator, 'sendBeacon', (_url: string, body: Blob) => beacons.push(body));
	privacy.analytics = true;
	perfTracker.paused = true;
	perfTracker.onWindow = null;
	monitor = new PerfMonitor();
});

afterEach(() => {
	monitor.stop();
	perfTracker.paused = true;
	perfTracker.onWindow = null;
	privacy.analytics = true;
	jest.useRealTimers();
	restore();
});

describe('analytics switch', () => {
	test('nothing starts or opens while usage analytics are off', async () => {
		privacy.analytics = false;
		monitor.start();
		await monitor.open();
		expect(perfTracker.onWindow).toBeNull();
		expect(fetchCalls).toHaveLength(0);
	});

	test('turning it off mid-session stops the monitor and every send', async () => {
		await startAndOpen();
		privacy.analytics = false;
		feed(1, { ...badWindow, commitLagP95Ms: 4 });
		expect(perfTracker.onWindow).toBeNull();
		expect(perfTracker.paused).toBe(true);

		feed(3);
		await settle();
		expect(updates()).toHaveLength(0);
		expect(beacons).toHaveLength(0);
	});

	test('a session that opened carries the write key it got back', async () => {
		await startAndOpen();
		expect(fetchCalls[0].url).toBe('/api/sessions');
		feed(3);
		await settle();
		expect(updates()[0].body).toMatchObject({ sessionId: SESSION_ID, writeKey: WRITE_KEY });
	});

	test('start does not throw without PerformanceObserver', () => {
		stub(globalThis, 'PerformanceObserver', undefined);
		expect(() => monitor.start()).not.toThrow();
		expect(perfTracker.onWindow).not.toBeNull();
	});
});

describe('probe', () => {
	test('an abort removes the probe attribute and reports why', async () => {
		layers.add(GLOWS);
		perfTracker.paused = false;
		const run = monitor.probe();
		await advance(2_000);
		expect(document.documentElement.dataset.perfProbe).toBe('glows');

		documentStub.hidden = true;
		await advance(2_000);
		const result = await run;
		expect(document.documentElement.dataset.perfProbe).toBeUndefined();
		expect(result).toMatchObject({ aborted: 'hidden', culprit: null });
	});

	test('a probe that saw almost no frames reports no jank value instead of zero', async () => {
		layers.add(GLOWS);
		perfTracker.paused = false;
		const run = monitor.probe();
		await advance(7_000);
		const result = await run;
		expect(result.aborted).toBeNull();
		expect(result.layers.map(({ jankRatio }) => jankRatio)).toEqual([null]);
		expect(result.culprit).toBeNull();
	});

	test('a page without any decorative layer has nothing to probe', async () => {
		perfTracker.paused = false;
		expect(await monitor.probe()).toMatchObject({ aborted: 'no-layers', culprit: null, layers: [] });
	});
});

describe('degraded reports', () => {
	test('a day of cooldown holds the immediate report back', async () => {
		storage.set(STORAGE_KEY, JSON.stringify({ degradedAt: Date.now() - HOUR_MS }));
		await startAndOpen();
		feed(3);
		await settle();
		expect(monitor.degraded).toBe(true);
		expect(updates()).toHaveLength(0);
	});

	test('past the cooldown the report goes out and the day starts once it was accepted', async () => {
		const stale = Date.now() - 25 * HOUR_MS;
		storage.set(STORAGE_KEY, JSON.stringify({ degradedAt: stale }));
		await startAndOpen();
		feed(3);
		await settle();
		expect(updates()).toHaveLength(1);
		expect(JSON.parse(storage.get(STORAGE_KEY) ?? '{}').degradedAt).toBeGreaterThan(stale);
	});

	test('a refused report does not start the day', async () => {
		const stale = Date.now() - 25 * HOUR_MS;
		storage.set(STORAGE_KEY, JSON.stringify({ degradedAt: stale }));
		updateStatus = 500;
		await startAndOpen();
		feed(3);
		await settle();
		expect(updates()).toHaveLength(1);
		expect(JSON.parse(storage.get(STORAGE_KEY) ?? '{}').degradedAt).toBe(stale);
	});

	test('a 404 stops every further send of the page load', async () => {
		updateStatus = 404;
		await startAndOpen();
		feed(3);
		await settle();
		expect(updates()).toHaveLength(1);

		feed(30, { ...badWindow, commitLagP95Ms: 4 });
		await settle();
		documentStub.hidden = true;
		documentHandlers.get('visibilitychange')?.();
		expect(updates()).toHaveLength(1);
		expect(beacons).toHaveLength(0);
	});

	test('a closing tab sends one beacon with the new data', async () => {
		await startAndOpen();
		feed(1, { ...badWindow, commitLagP95Ms: 4 });
		documentStub.hidden = true;
		documentHandlers.get('visibilitychange')?.();
		documentHandlers.get('visibilitychange')?.();
		expect(beacons).toHaveLength(1);
	});

	test('the periodic send waits for a running probe to finish', async () => {
		layers.add(GLOWS);
		await startAndOpen();
		feed(3);
		await advance(1_000);
		expect(updates()).toHaveLength(0);

		feed(30, { ...badWindow, commitLagP95Ms: 4 });
		await advance(1_000);
		expect(updates()).toHaveLength(0);

		await advance(6_000);
		expect(updates()).toHaveLength(1);
	});
});
