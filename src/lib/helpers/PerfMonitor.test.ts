import { afterEach, beforeEach, describe, expect, jest, mock, spyOn, test } from 'bun:test';
import { perfTracker } from '#helpers/perfTracker.js';
import type { DeviceInfo, PerfWindow } from '#lib/types/session.js';
import { privacy } from '#stores/privacy.svelte.js';
import { ui } from '#stores/ui.svelte.js';

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

const badWindow: PerfWindow = { blockedMs: 0, commitLagP95Ms: 150, frameCount: 600, frameJankCount: 0, freezeCount: 0, observedMs: 10_000, slowInputCount: 0 };

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
	static instances: FakeObserver[] = [];
	static supportedEntryTypes = ['event', 'long-animation-frame'];
	disconnect = mock(() => {});
	observe = mock(() => {});

	constructor(private readonly callback: (list: { getEntries(): unknown[] }) => void) {
		FakeObserver.instances.push(this);
	}

	deliver(...entries: unknown[]) {
		this.callback({ getEntries: () => entries });
	}
}

/** The few things the monitor reads from an element: a closest match, attributes and text. */
class FakeElement {
	constructor(private readonly attributes: Record<string, string> = {}) {}

	closest() {
		return this;
	}

	getAttribute(name: string) {
		return this.attributes[name] ?? null;
	}

	tagName = 'DIV';
	textContent = '';
}

interface FetchCall {
	body: unknown;
	url: string;
}

type Handler = (event?: unknown) => void;

let fetchCalls: FetchCall[] = [];
let updateStatus = 200;
let beacons: unknown[] = [];
let documentHandlers = new Map<string, Handler>();
let listenerOptions = new Map<string, unknown>();
let removedListeners: string[] = [];
let documentStub: { hidden: boolean };
let monitor = new PerfMonitor();
let storage = new Map<string, string>();

const updates = () => fetchCalls.filter(({ url }) => url === '/api/sessions/update');
/** Lets every pending promise continuation run. */
async function flush() {
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Bun's fake timers have no async advance, so time moves in short steps with a flush between. */
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
	beacons = [];
	documentHandlers = new Map();
	listenerOptions = new Map();
	removedListeners = [];
	storage = new Map();
	documentStub = { hidden: false };
	stub(globalThis, 'document', {
		addEventListener: (type: string, handler: Handler, options?: unknown) => {
			documentHandlers.set(type, handler);
			listenerOptions.set(type, options);
		},
		getAnimations: () => [],
		get hidden() {
			return documentStub.hidden;
		},
		querySelectorAll: () => [],
		removeEventListener: (type: string) => removedListeners.push(type),
	});
	stub(globalThis, 'window', { addEventListener: () => {}, removeEventListener: () => {} });
	stub(globalThis, 'Element', FakeElement);
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
	FakeObserver.instances = [];
	perfTracker.pause();
	perfTracker.onWindow = null;
	perfTracker.incidents.reset();
	monitor = new PerfMonitor();
});

afterEach(() => {
	monitor.stop();
	perfTracker.pause();
	perfTracker.onWindow = null;
	perfTracker.incidents.reset();
	ui.closeModal();
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
		expect(perfTracker.incidents.environment).toBeNull();
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

describe('listeners and environment', () => {
	test('start registers the capture listeners and the environment, stop removes them', () => {
		monitor.start();
		expect(perfTracker.incidents.environment).not.toBeNull();
		expect(listenerOptions.get('pointerdown')).toEqual({ capture: true, passive: true });
		expect(listenerOptions.get('keydown')).toEqual({ capture: true, passive: true });

		monitor.stop();
		expect(perfTracker.incidents.environment).toBeNull();
		expect(removedListeners).toEqual(expect.arrayContaining(['keydown', 'pointerdown', 'visibilitychange']));
	});

	test('a pointerdown on the atom followed by a 300 ms late commit is an incident after tap:Atom', async () => {
		await startAndOpen();
		documentHandlers.get('pointerdown')?.({ target: new FakeElement({ 'aria-label': 'Atom' }), timeStamp: performance.now() - 400, type: 'pointerdown' });
		perfTracker.commit(300);
		expect(perfTracker.incidents.worst(1)[0]).toMatchObject({ action: 'tap:Atom', modal: null, realm: 'atoms', timerLate: true });
		expect(monitor.summary().incidents).toHaveLength(1);
	});

	test('a key press is described with the key prefix and digits in a label are masked', async () => {
		await startAndOpen();
		const button = new FakeElement();
		button.textContent = 'Buy 1,234.5 atoms';
		documentHandlers.get('keydown')?.({ target: button, timeStamp: performance.now() - 400, type: 'keydown' });
		perfTracker.commit(300);
		expect(perfTracker.incidents.worst(1)[0].action).toBe('key:Buy # atoms');
	});

	test('an event that is not an element names nothing', async () => {
		await startAndOpen();
		documentHandlers.get('pointerdown')?.({ target: null, timeStamp: performance.now() - 400, type: 'pointerdown' });
		perfTracker.commit(300);
		expect(perfTracker.incidents.worst(1)[0].action).toBeNull();
	});

	test('the lazy modal labels the action again once its loader resolved', async () => {
		await startAndOpen();
		const action = spyOn(perfTracker, 'action');
		const loaded = ui.openModalLazy('skill-tree', () => Promise.resolve({ default: (() => {}) as never }));
		expect(action).toHaveBeenCalledTimes(1);
		await loaded;
		expect(action.mock.calls.map(([label]) => label)).toEqual(['modal:skill-tree', 'modal:skill-tree']);

		perfTracker.commit(300);
		expect(perfTracker.incidents.worst(1)[0].modal).toBe('skill-tree');
		action.mockRestore();
	});

	test('observer entries that started before the last resume are dropped, later ones become incidents', async () => {
		await startAndOpen();
		const [events, frames] = FakeObserver.instances;
		const entry = (startTime: number) => ({ duration: 300, interactionId: 1, name: 'click', processingEnd: startTime + 200, processingStart: startTime + 10, startTime, target: null });
		events.deliver(entry(perfTracker.resumedAt - 100));
		frames.deliver({ duration: 400, scripts: [], startTime: perfTracker.resumedAt - 500, styleAndLayoutStart: 0 });
		expect(perfTracker.incidents.worst(1)).toEqual([]);

		events.deliver(entry(perfTracker.resumedAt + 100));
		expect(perfTracker.incidents.worst(1)[0]).toMatchObject({ durationMs: 300, input: { delayMs: 10, processingMs: 190, presentationMs: 100 } });
	});

	test('a modal replaced while its loader runs is not labelled again', async () => {
		await startAndOpen();
		const action = spyOn(perfTracker, 'action');
		const loaded = ui.openModalLazy('skill-tree', () => Promise.resolve({ default: (() => {}) as never }));
		ui.closeModal();
		await loaded;
		expect(action.mock.calls.map(([label]) => label)).toEqual(['modal:skill-tree', 'modal:close']);
		action.mockRestore();
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

	test('a periodic update goes out after thirty calm windows', async () => {
		await startAndOpen();
		feed(29, { ...badWindow, commitLagP95Ms: 4 });
		await settle();
		expect(updates()).toHaveLength(0);

		feed(1, { ...badWindow, commitLagP95Ms: 4 });
		await settle();
		expect(updates()).toHaveLength(1);
	});

	test('the update carries incidents and the totals the server judges', async () => {
		await startAndOpen();
		perfTracker.commit(400);
		feed(3);
		await settle();
		expect(updates()[0].body).toMatchObject({
			perf: { incidents: [{ durationMs: 400, timerLate: true }], totals: { blocked: { stall: { count: 1 } }, eventTiming: true, loaf: true } },
		});
	});
});
