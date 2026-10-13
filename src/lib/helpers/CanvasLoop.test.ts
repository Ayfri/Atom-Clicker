import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { CanvasLoop } from '#helpers/CanvasLoop.js';

const stubbed = new Map<string, PropertyDescriptor | undefined>();

/** Replaces a global for the length of a test, Bun shares globals across files so `afterEach` puts the originals back. */
function stub(name: string, value: unknown) {
	if (!stubbed.has(name)) stubbed.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
	Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
}

class FakeObserver {
	static instances: FakeObserver[] = [];
	disconnect = mock(() => {});
	observe = mock(() => {});

	constructor(readonly callback: (entries: unknown[]) => void) {
		FakeObserver.instances.push(this);
	}
}

class FakeResizeObserver extends FakeObserver {}
class FakeIntersectionObserver extends FakeObserver {}

class TestLoop extends CanvasLoop {
	pauses = 0;

	constructor() {
		super({} as HTMLCanvasElement, 'canvas:test');
		this.observe();
	}

	protected draw() {
		return true;
	}

	protected paused() {
		this.pauses++;
	}

	protected resize() {}
}

let listeners: Map<string, () => void>;
let frames: Map<number, FrameRequestCallback>;
let doc: { addEventListener: (type: string, listener: () => void) => void; hidden: boolean; removeEventListener: ReturnType<typeof mock> };
let requestAnimationFrameMock: ReturnType<typeof mock>;
let cancelAnimationFrameMock: ReturnType<typeof mock>;

function observed(type: typeof FakeObserver) {
	const observer = FakeObserver.instances.find(instance => instance instanceof type);
	if (!observer) throw new Error('No observer created');
	return observer;
}

/** Gives the loop its first size and puts its canvas on screen, as the observers do after layout. */
function show() {
	observed(FakeResizeObserver).callback([{ contentRect: { height: 50, width: 100 } }]);
	observed(FakeIntersectionObserver).callback([{ isIntersecting: true }]);
}

function setTabHidden(hidden: boolean) {
	doc.hidden = hidden;
	listeners.get('visibilitychange')?.();
}

beforeEach(() => {
	FakeObserver.instances = [];
	listeners = new Map();
	frames = new Map();
	let nextId = 0;
	doc = { addEventListener: (type, listener) => listeners.set(type, listener), hidden: false, removeEventListener: mock(() => {}) };
	requestAnimationFrameMock = mock((callback: FrameRequestCallback) => {
		frames.set(++nextId, callback);
		return nextId;
	});
	cancelAnimationFrameMock = mock((id: number) => frames.delete(id));
	stub('document', doc);
	stub('requestAnimationFrame', requestAnimationFrameMock);
	stub('cancelAnimationFrame', cancelAnimationFrameMock);
	stub('ResizeObserver', FakeResizeObserver);
	stub('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
	for (const [name, descriptor] of stubbed) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
	stubbed.clear();
});

describe('CanvasLoop tab visibility', () => {
	test('hiding the tab cancels the frame and pauses the loop once', () => {
		const loop = new TestLoop();
		show();
		expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

		setTabHidden(true);
		expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
		expect(loop.pauses).toBe(1);

		setTabHidden(true);
		expect(loop.pauses).toBe(1);
	});

	test('showing the tab again restarts the loop', () => {
		new TestLoop();
		show();
		setTabHidden(true);
		setTabHidden(false);
		expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);
	});

	test('a loop created in a hidden tab waits for the tab to show', () => {
		doc.hidden = true;
		new TestLoop();
		show();
		expect(requestAnimationFrameMock).not.toHaveBeenCalled();

		setTabHidden(false);
		expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
	});

	test('a frame running after the tab hid schedules no next frame and pauses the loop', () => {
		const loop = new TestLoop();
		show();
		const frame = frames.get(1);
		doc.hidden = true;
		frame?.(16);
		expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
		expect(loop.pauses).toBe(1);
	});

	test('destroy removes the handler it added', () => {
		const loop = new TestLoop();
		loop.destroy();
		expect(doc.removeEventListener).toHaveBeenCalledWith('visibilitychange', listeners.get('visibilitychange'));
	});
});
