import { IGNORE_GAP_MS, JANK_GAP_MS, LatencyHistogram, MAX_FREEZE_MS, MAX_SOURCES, SLOW_INPUT_MS, STALL_LAG_MS, WINDOW_MS } from '#helpers/perfStats.js';
import type { PerfSourceStat, PerfTotals, PerfWindow } from '#lib/types/session.js';

interface PerfCounters {
	frames: number;
	janks: number;
	lostMs: number;
	ticks: number;
}

/** Preallocated per source, so tracking a call never allocates. The `window` fields join the session totals once the window closes. */
interface Slot {
	calls: number;
	maxMs: number;
	name: string;
	totalMs: number;
	windowCalls: number;
	windowMaxMs: number;
	windowMs: number;
}

const OTHER_SOURCE = 'other';

const newSlot = (name: string): Slot => ({ calls: 0, maxMs: 0, name, totalMs: 0, windowCalls: 0, windowMaxMs: 0, windowMs: 0 });

/**
 * Records where the main thread time goes: named hot paths report `performance.now() - start`, the commit loop its lateness, rAF
 * loops their frame gaps. Nothing runs until the monitor unpauses it, so importing it costs nothing, and every call is O(1)
 * without allocation. iOS rounds `performance.now()` to about 1 ms, so totals average out and per-call maximums stay coarse.
 * Session totals only hold closed windows: the partial window a hidden tab drops never reaches them.
 */
export class PerfTracker {
	/** Set by the monitor: hidden tab, warm-up, or not started. Every call returns at once while paused. */
	paused = true;
	onWindow: ((window: PerfWindow) => void) | null = null;

	private readonly cumulative: PerfCounters = { frames: 0, janks: 0, lostMs: 0, ticks: 0 };
	private flushMark = 0;
	private flushPending = false;
	private readonly inputs = new LatencyHistogram();
	private lastFrameStamp = 0;
	private readonly measureFlush = () => {
		this.flushPending = false;
		this.track('svelte:flush', this.flushMark);
	};
	private readonly other = newSlot(OTHER_SOURCE);
	private sessionAttributedMs = 0;
	private sessionFrames = 0;
	private readonly sessionFrameGaps = new LatencyHistogram();
	private sessionFreezeCount = 0;
	private sessionFreezeMs = 0;
	private sessionJanks = 0;
	private readonly sessionLag = new LatencyHistogram();
	private sessionLostMs = 0;
	private sessionObservedMs = 0;
	private sessionPresentationMs = 0;
	private sessionSlowInputMs = 0;
	private sessionStallMs = 0;
	private sessionWindows = 0;
	private readonly slots = new Map<string, Slot>();
	private windowAttributedMs = 0;
	private windowFrames = 0;
	private readonly windowFrameGaps = new LatencyHistogram();
	private windowFreezeCount = 0;
	private windowFreezeMs = 0;
	private windowInputMaxMs = 0;
	private windowInputSlow = 0;
	private windowJanks = 0;
	private readonly windowLag = new LatencyHistogram();
	private windowLostMs = 0;
	private windowStallMs = 0;
	private windowStart = 0;
	private worstTarget: string | null = null;

	/** Largest input latency of the session, so the monitor only describes a target when it beats it. */
	get inputMaxMs() {
		return this.inputs.max;
	}

	/** Cumulative counts for the probe phases to subtract, the same object is returned every time. */
	counters(): Readonly<PerfCounters> {
		return this.cumulative;
	}

	/**
	 * `lagMs` is how late the 20 ms commit timer fired. Also closes the window once `WINDOW_MS` of unpaused time elapsed.
	 * Past a second the gap counts as a freeze, past `MAX_FREEZE_MS` it is a suspended device and counts as nothing.
	 */
	commit(lagMs: number) {
		if (this.paused) return;

		this.cumulative.ticks++;
		if (lagMs <= IGNORE_GAP_MS) {
			const lag = Math.max(0, lagMs);
			this.cumulative.lostMs += lag;
			this.windowLostMs += lag;
			this.windowLag.add(lag);
			if (lag > STALL_LAG_MS) this.windowStallMs += lag - STALL_LAG_MS;
		} else if (lagMs <= MAX_FREEZE_MS) {
			this.windowFreezeCount++;
			this.windowFreezeMs += lagMs;
		}

		const elapsed = performance.now() - this.windowStart;
		if (elapsed >= WINDOW_MS) this.closeWindow(elapsed);
	}

	/** Measures from now to the Svelte flush that follows the writes just made, one pending measure at a time. */
	flushAfter() {
		if (this.paused || this.flushPending) return;
		this.flushPending = true;
		this.flushMark = performance.now();
		queueMicrotask(this.measureFlush);
	}

	/** Several loops share one rAF timestamp, so only the first of them counts the frame. */
	frame(now: number, previous: number) {
		if (this.paused || previous === 0 || now === this.lastFrameStamp) return;

		const gap = now - previous;
		if (gap <= 0 || gap > IGNORE_GAP_MS) return;

		this.lastFrameStamp = now;
		this.cumulative.frames++;
		this.windowFrames++;
		this.windowFrameGaps.add(gap);
		if (gap > JANK_GAP_MS) {
			this.cumulative.janks++;
			this.windowJanks++;
		}
	}

	/** `presentationMs` is the part of the latency after the handlers ran, spent rendering. */
	input(durationMs: number, presentationMs: number, target: string | null) {
		if (this.paused) return;

		this.inputs.add(durationMs);
		if (durationMs > this.windowInputMaxMs) this.windowInputMaxMs = durationMs;
		if (durationMs >= SLOW_INPUT_MS) {
			this.windowInputSlow++;
			this.sessionSlowInputMs += durationMs;
			this.sessionPresentationMs += presentationMs;
		}
		if (target !== null && durationMs >= this.inputs.max) this.worstTarget = target;
	}

	/** Drops the window in progress, it starts over from now. */
	resetWindow() {
		this.windowAttributedMs = 0;
		this.windowFrames = 0;
		this.windowFreezeCount = 0;
		this.windowFreezeMs = 0;
		this.windowInputMaxMs = 0;
		this.windowInputSlow = 0;
		this.windowJanks = 0;
		this.windowLostMs = 0;
		this.windowStallMs = 0;
		this.windowStart = performance.now();
		this.windowFrameGaps.reset();
		this.windowLag.reset();
		for (const slot of this.slots.values()) this.dropSlotWindow(slot);
		this.dropSlotWindow(this.other);
	}

	sessionSources(): PerfSourceStat[] {
		const slots = this.other.calls > 0 ? [...this.slots.values(), this.other] : [...this.slots.values()];
		return slots.filter(slot => slot.calls > 0).map(({ calls, maxMs, name, totalMs }) => ({ calls, maxMs, name, totalMs }));
	}

	totals(): Omit<PerfTotals, 'loaf' | 'longTaskCount'> {
		return {
			commitLagMaxMs: this.sessionLag.max,
			commitLagP95Ms: this.sessionLag.percentile(0.95),
			frameP95GapMs: this.sessionFrameGaps.percentile(0.95),
			freezeCount: this.sessionFreezeCount,
			freezeMs: this.sessionFreezeMs,
			inputMaxMs: this.inputs.max,
			inputP95Ms: this.inputs.percentile(0.95),
			inputPresentationShare: this.sessionSlowInputMs > 0 ? this.sessionPresentationMs / this.sessionSlowInputMs : 0,
			jankRatio: this.sessionFrames > 0 ? this.sessionJanks / this.sessionFrames : 0,
			observedMs: this.sessionObservedMs,
			stallMsPer10s: this.sessionObservedMs > 0 ? (this.sessionStallMs / this.sessionObservedMs) * WINDOW_MS : 0,
			unaccountedShare: this.sessionLostMs > 0 ? Math.max(0, this.sessionLostMs - this.sessionAttributedMs) / this.sessionLostMs : 0,
			windows: this.sessionWindows,
			worstTarget: this.worstTarget,
		};
	}

	/** `start` is a `performance.now()` taken before the work, the source name is always a constant. */
	track(source: string, start: number) {
		if (this.paused) return;

		const ms = performance.now() - start;
		const slot = this.slots.get(source) ?? this.createSlot(source);
		slot.windowCalls++;
		slot.windowMs += ms;
		if (ms > slot.windowMaxMs) slot.windowMaxMs = ms;
		this.windowAttributedMs += ms;
	}

	private closeWindow(observedMs: number) {
		let top: Slot | null = null;
		for (const slot of this.slots.values()) {
			if (slot.windowMs > 0 && (!top || slot.windowMs > top.windowMs)) top = slot;
		}
		if (this.other.windowMs > (top?.windowMs ?? 0)) top = this.other;

		const closed: PerfWindow = {
			attributedMs: this.windowAttributedMs,
			commitLagP95Ms: this.windowLag.percentile(0.95),
			commitStallMs: this.windowStallMs,
			frameCount: this.windowFrames,
			frameJankCount: this.windowJanks,
			freezeCount: this.windowFreezeCount,
			freezeMs: this.windowFreezeMs,
			inputMaxMs: this.windowInputMaxMs,
			inputSlowCount: this.windowInputSlow,
			lostMs: this.windowLostMs,
			observedMs,
			topSource: top?.name ?? null,
		};
		this.sessionAttributedMs += closed.attributedMs;
		this.sessionFrames += closed.frameCount;
		this.sessionFreezeCount += closed.freezeCount;
		this.sessionFreezeMs += closed.freezeMs;
		this.sessionJanks += closed.frameJankCount;
		this.sessionLostMs += closed.lostMs;
		this.sessionObservedMs += observedMs;
		this.sessionStallMs += closed.commitStallMs;
		this.sessionWindows++;
		this.sessionFrameGaps.merge(this.windowFrameGaps);
		this.sessionLag.merge(this.windowLag);
		for (const slot of this.slots.values()) this.foldSlotWindow(slot);
		this.foldSlotWindow(this.other);
		this.resetWindow();
		this.onWindow?.(closed);
	}

	/** Past `MAX_SOURCES` names the extra ones share the `other` slot. */
	private createSlot(source: string): Slot {
		if (this.slots.size >= MAX_SOURCES) return this.other;

		const slot = newSlot(source);
		this.slots.set(source, slot);
		return slot;
	}

	private dropSlotWindow(slot: Slot) {
		slot.windowCalls = 0;
		slot.windowMaxMs = 0;
		slot.windowMs = 0;
	}

	private foldSlotWindow(slot: Slot) {
		slot.calls += slot.windowCalls;
		slot.totalMs += slot.windowMs;
		if (slot.windowMaxMs > slot.maxMs) slot.maxMs = slot.windowMaxMs;
	}
}

export const perfTracker = new PerfTracker();
