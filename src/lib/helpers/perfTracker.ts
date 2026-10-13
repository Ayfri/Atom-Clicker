import { INCIDENT_MIN_MS, IncidentKinds, IncidentLog, SPAN_MIN_MS } from '#helpers/perfIncidents.js';
import { IGNORE_GAP_MS, JANK_GAP_MS, LatencyHistogram, MAX_FREEZE_MS, MAX_SOURCE_NAMES, WINDOW_MS } from '#helpers/perfStats.js';
import type { PerfSourceStat, PerfTotals, PerfWindow } from '#lib/types/session.js';

/** Preallocated per source, so tracking a call never allocates. */
interface Slot {
	calls: number;
	maxMs: number;
	name: string;
	totalMs: number;
}

const OTHER_SOURCE = 'other';

const newSlot = (name: string): Slot => ({ calls: 0, maxMs: 0, name, totalMs: 0 });

/**
 * Records where the main thread time goes: named hot paths report `performance.now() - start`, the commit loop its lateness, rAF
 * loops their frame gaps, and blocks of 150 ms or more become incidents. Nothing runs until the monitor resumes it, so importing it
 * costs nothing, and every call is O(1) without allocation. iOS rounds `performance.now()` to about 1 ms, so totals average out and
 * per-call maximums stay coarse. Everything counts unpaused time only, which `visibleMs` adds up.
 */
export class PerfTracker {
	readonly incidents = new IncidentLog();
	onWindow: ((window: PerfWindow) => void) | null = null;

	private flushMark = 0;
	private flushPending = false;
	private readonly inputs = new LatencyHistogram();
	private isPaused = true;
	private lastFrameStamp = 0;
	private readonly measureFlush = () => {
		this.flushPending = false;
		this.track('svelte:flush', this.flushMark);
	};
	private readonly other = newSlot(OTHER_SOURCE);
	private resumeStamp = 0;
	private sessionFrames = 0;
	private sessionJanks = 0;
	private readonly sessionLag = new LatencyHistogram();
	private readonly slots = new Map<string, Slot>();
	private visibleMs = 0;
	private windowFrames = 0;
	private windowJanks = 0;
	private readonly windowLag = new LatencyHistogram();
	private windowStart = 0;
	/** What the incident log held when the window began, so a window reports what happened inside it. */
	private windowStartBlockedMs = 0;
	private windowStartLongBlocks = 0;
	private windowStartSlowInputs = 0;

	/** True while hidden, warming up or not started: every call returns at once. */
	get paused() {
		return this.isPaused;
	}

	/** The `PerfTotals` fields the monitor cannot know, `eventTiming` and `loaf` say which observers the browser offers. */
	totals(): Omit<PerfTotals, 'eventTiming' | 'loaf'> {
		const { blocked } = this.incidents;
		return {
			blocked: {
				[IncidentKinds.FRAME]: { ...blocked[IncidentKinds.FRAME] },
				[IncidentKinds.FREEZE]: { ...blocked[IncidentKinds.FREEZE] },
				[IncidentKinds.INPUT]: { ...blocked[IncidentKinds.INPUT] },
				[IncidentKinds.STALL]: { ...blocked[IncidentKinds.STALL] },
			},
			commitLagP95Ms: this.sessionLag.percentile(0.95),
			inputP95Ms: this.inputs.percentile(0.95),
			jankRatio: this.sessionFrames > 0 ? this.sessionJanks / this.sessionFrames : 0,
			visibleMs: this.isPaused ? this.visibleMs : this.visibleMs + performance.now() - this.resumeStamp,
		};
	}

	/** When the tracker last resumed: browser entries that started before it come from a warm-up or a hidden tab. */
	get resumedAt() {
		return this.resumeStamp;
	}

	/**
	 * The player's latest action, kept so an incident that starts right after can name it. With a `target`, `label` prefixes its
	 * description. `at` is the event's own timestamp when the event was queued behind a block.
	 */
	action(label: string | null, target: Element | null = null, at = performance.now()) {
		if (this.isPaused) return;
		this.incidents.action(label, target, at);
	}

	/**
	 * `lagMs` is how late the 20 ms commit timer fired. Also closes the window once `WINDOW_MS` of unpaused time elapsed. A lag of
	 * 150 ms or more is an incident, past `MAX_FREEZE_MS` it is a suspended device and counts as nothing.
	 */
	commit(lagMs: number) {
		if (this.isPaused) return;

		const now = performance.now();
		if (lagMs <= IGNORE_GAP_MS) {
			const lag = Math.max(0, lagMs);
			this.sessionLag.add(lag);
			this.windowLag.add(lag);
		}
		if (lagMs >= INCIDENT_MIN_MS && lagMs <= MAX_FREEZE_MS) this.incidents.observe({ end: now, start: now - lagMs, timerLate: true });

		const elapsed = now - this.windowStart;
		if (elapsed >= WINDOW_MS) this.closeWindow(elapsed);
	}

	/** Measures from now to the Svelte flush that follows the writes just made, one pending measure at a time. */
	flushAfter() {
		if (this.isPaused || this.flushPending) return;
		this.flushPending = true;
		this.flushMark = performance.now();
		queueMicrotask(this.measureFlush);
	}

	/** Several loops share one rAF timestamp, so only the first of them counts the frame. A gap of 150 ms or more is an incident. */
	frame(now: number, previous: number) {
		if (this.isPaused || previous === 0 || now === this.lastFrameStamp) return;

		const gap = now - previous;
		if (gap <= 0) return;

		this.lastFrameStamp = now;
		if (gap >= INCIDENT_MIN_MS && gap <= MAX_FREEZE_MS) this.incidents.observe({ end: now, start: previous });
		if (gap > IGNORE_GAP_MS) return;

		this.sessionFrames++;
		this.windowFrames++;
		if (gap > JANK_GAP_MS) {
			this.sessionJanks++;
			this.windowJanks++;
		}
	}

	/** Every interaction latency feeds the p95, the slow ones come in through the incident log. */
	input(durationMs: number) {
		if (this.isPaused) return;
		this.inputs.add(durationMs);
	}

	/** Adds the time since `resume` to `visibleMs`. */
	pause() {
		if (this.isPaused) return;
		this.visibleMs += performance.now() - this.resumeStamp;
		this.isPaused = true;
	}

	/** Drops the window in progress, it starts over from now. */
	resetWindow() {
		this.windowFrames = 0;
		this.windowJanks = 0;
		this.windowStart = performance.now();
		this.windowStartBlockedMs = this.blockedMs();
		this.windowStartLongBlocks = this.incidents.longBlocks;
		this.windowStartSlowInputs = this.incidents.blocked[IncidentKinds.INPUT].count;
		this.windowLag.reset();
	}

	resume() {
		this.pause();
		this.resetWindow();
		this.resumeStamp = performance.now();
		this.isPaused = false;
	}

	sessionSources(): PerfSourceStat[] {
		const slots = this.other.calls > 0 ? [...this.slots.values(), this.other] : [...this.slots.values()];
		return slots.filter(slot => slot.calls > 0).map(({ calls, maxMs, name, totalMs }) => ({ calls, maxMs, name, totalMs }));
	}

	/** `start` is a `performance.now()` taken before the work, the source name is always a constant. */
	track(source: string, start: number) {
		if (this.isPaused) return;

		const now = performance.now();
		const ms = now - start;
		const slot = this.slots.get(source) ?? this.createSlot(source);
		slot.calls++;
		slot.totalMs += ms;
		if (ms > slot.maxMs) slot.maxMs = ms;
		if (ms >= SPAN_MIN_MS) this.incidents.span(source, start, now);
	}

	private blockedMs() {
		const { blocked } = this.incidents;
		return blocked[IncidentKinds.FRAME].ms + blocked[IncidentKinds.FREEZE].ms + blocked[IncidentKinds.INPUT].ms + blocked[IncidentKinds.STALL].ms;
	}

	private closeWindow(observedMs: number) {
		const closed: PerfWindow = {
			blockedMs: this.blockedMs() - this.windowStartBlockedMs,
			commitLagP95Ms: this.windowLag.percentile(0.95),
			frameCount: this.windowFrames,
			frameJankCount: this.windowJanks,
			freezeCount: this.incidents.longBlocks - this.windowStartLongBlocks,
			observedMs,
			slowInputCount: this.incidents.blocked[IncidentKinds.INPUT].count - this.windowStartSlowInputs,
		};
		this.resetWindow();
		this.onWindow?.(closed);
	}

	/** Past `MAX_SOURCE_NAMES` names the extra ones share the `other` slot. */
	private createSlot(source: string): Slot {
		if (this.slots.size >= MAX_SOURCE_NAMES) return this.other;

		const slot = newSlot(source);
		this.slots.set(source, slot);
		return slot;
	}
}

export const perfTracker = new PerfTracker();
