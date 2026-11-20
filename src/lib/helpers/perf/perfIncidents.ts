import { RealmTypes, type RealmType } from '#data/realms.js';
import { MAX_FREEZE_MS, MAX_SPANS, SLOW_INPUT_MS } from '#helpers/perf/perfStats.js';
import type { IncidentKind, InputBreakdown, LoafBreakdown, PerfIncident } from '#lib/types/session.js';

/** About nine dropped frames, the 50 ms Long Animation Frame default would flood low-end devices where one atom frame is 82 ms. */
export const INCIDENT_MIN_MS = 150;
/** A named call this long is worth remembering as something that ran inside an incident. */
export const SPAN_MIN_MS = 10;
const ACTION_RING = 4;
const ACTION_WINDOW_MS = 1_000;
/** `blockingDuration` leaves out the first 50 ms of each task, so one 150 ms task blocks 100 ms. */
const BLOCKING_MIN_MS = 100;
const FREEZE_MS = 1_000;
const MAX_KEPT = 12;
/** The 20 ms commit step, a 16 ms frame and the 8 ms Event Timing rounding. */
const MERGE_SLACK_MS = 50;
/**
 * Blocks that can still receive a late view, apart from the worst ones that are reported. A Long Animation Frame can arrive many blocks late
 * on a saturated main thread, and one that finds its block gone from this list counts as a second block.
 */
const RECENT_MAX = 32;
const SPAN_RING = 32;

/** Which observer saw a block. A block takes one view of the exclusive kinds, so consecutive gaps of one observer never chain into one. */
const Views = { COMMIT: 1, FRAME: 2, INPUT: 8, LOAF: 4 } as const;
const EXCLUSIVE_VIEWS = Views.COMMIT | Views.FRAME | Views.LOAF;

export const IncidentKinds = { FRAME: 'frame', FREEZE: 'freeze', INPUT: 'input', STALL: 'stall' } as const;

export interface IncidentEnvironment {
	describe(target: Element): string | null;
	modal(): string | null;
	realm(): RealmType;
}

/** One view of a block on the shared `performance.now()` timeline: Event Timing, a Long Animation Frame, a late commit or a late frame. */
export interface IncidentObservation {
	end: number;
	input?: InputBreakdown;
	loaf?: LoafBreakdown;
	start: number;
	timerLate?: boolean;
}

interface ActionEntry {
	at: number;
	label: string | null;
	target: Element | null;
}

interface Block {
	action: string | null;
	actionAgoMs: number | null;
	end: number;
	input: InputBreakdown | null;
	kept: boolean;
	loaf: LoafBreakdown | null;
	modal: string | null;
	realm: RealmType;
	sources: { ms: number; name: string }[];
	start: number;
	timerLate: boolean;
	views: number;
}

/** What `merge` reads from a view or a block: only a block has an action. */
interface Part {
	action?: string | null;
	actionAgoMs?: number | null;
	end: number;
	input?: InputBreakdown | null;
	loaf?: LoafBreakdown | null;
	start: number;
	timerLate: boolean;
}

type Resolved = IncidentObservation & { timerLate: boolean };

interface Span {
	end: number;
	ms: number;
	name: string;
}

const inputMs = ({ delayMs, presentationMs, processingMs }: InputBreakdown) => delayMs + presentationMs + processingMs;

/** Script files and invokers are URLs: the fragment after one and any query string can carry tokens, `#document.onclick` stays. */
export const stripUrlDetails = (value: string) => value.replace(/(https?:\/\/[^\s?#]*)#\S*/g, '$1').replace(/\?\S*/g, '');

/**
 * The main thread is proven busy by a late timer, by a Long Animation Frame that blocked (`BLOCKING_MIN_MS`) or by handlers that ran
 * `INCIDENT_MIN_MS`. A Long Animation Frame alone proves nothing: its duration includes the wait for the frame to be presented (2,294 kept
 * incidents had the timer on time and a frame that was 95% wait), and its `blockingDuration` alone cannot clear a late timer (0 for a 1.74 s
 * scene build that ran after a WebGPU promise). With a free main thread, a gap under a second is a `frame` (compositor or GPU) and a gap of a
 * second or more counts as nothing (`null`): the window is not painting (occluded, display off, throttled: 500 of 4,018 timer-on-time
 * incidents lasted 1 s or more, among them 10 s Event Timing entries of an occluded Safari window, and a GPU hang that long with a free main
 * thread is dropped with them). A busy block is an input, a freeze (a second or more) or a stall. An interaction only names a block it covers
 * at least half of, a 200 ms click inside a 5 s freeze stays a freeze.
 */
export function incidentKind({ durationMs, input, loaf, timerLate }: Pick<PerfIncident, 'durationMs' | 'input' | 'loaf' | 'timerLate'>): IncidentKind | null {
	const busy = timerLate || (loaf?.blockingMs ?? 0) >= BLOCKING_MIN_MS || (input?.processingMs ?? 0) >= INCIDENT_MIN_MS;
	if (!busy && durationMs >= FREEZE_MS) return null;
	if (input && inputMs(input) >= SLOW_INPUT_MS && inputMs(input) * 2 >= durationMs) return IncidentKinds.INPUT;
	if (!busy) return IncidentKinds.FRAME;
	return durationMs >= FREEZE_MS ? IncidentKinds.FREEZE : IncidentKinds.STALL;
}

const lengthOf = (block: Block) => block.end - block.start;

/** The length is rounded like the `durationMs` of a reported incident, the server reruns `incidentKind` on it and a 999.6 ms block must get the same kind there. */
const kindOf = ({ end, input, loaf, start, timerLate }: Part) => incidentKind({ durationMs: Math.round(end - start), input: input ?? null, loaf: loaf ?? null, timerLate });

/** Handlers that ran `INCIDENT_MIN_MS` prove the main thread was busy, the kind the server derives from the sent input needs that proof to stay in it. */
const proves = ({ processingMs }: InputBreakdown) => processingMs >= INCIDENT_MIN_MS;

/** An input beats another when it proves busy handlers and the other does not, between two of the same sort the longer one wins. */
const outranks = (input: InputBreakdown, other: InputBreakdown) => (proves(input) === proves(other) ? inputMs(input) > inputMs(other) : proves(input));

const unionOf = (block: Block, start: number, end: number) => Math.max(end, block.end) - Math.min(start, block.start);

const emptyBlocked = (): Record<IncidentKind, { count: number; ms: number }> => ({
	[IncidentKinds.FRAME]: { count: 0, ms: 0 },
	[IncidentKinds.FREEZE]: { count: 0, ms: 0 },
	[IncidentKinds.INPUT]: { count: 0, ms: 0 },
	[IncidentKinds.STALL]: { count: 0, ms: 0 },
});

/** The view an observation is: Event Timing carries an input, a Long Animation Frame a breakdown, a commit gap a late timer, anything else a rAF gap. */
const viewOf = ({ input, loaf, timerLate }: Resolved) => (input ? Views.INPUT : loaf ? Views.LOAF : timerLate ? Views.COMMIT : Views.FRAME);

/**
 * Keeps the worst counted main thread blocks of the session, each counted once however many observers saw it (commit timer, rAF gap, Long
 * Animation Frame, Event Timing), which deliver late and in any order, so views merge by time overlap into the recent blocks, whether
 * or not they made the worst list. Allocates only when an incident is created or widened, `span` and `action` are O(1) writes into
 * preallocated slots.
 */
export class IncidentLog {
	environment: IncidentEnvironment | null = null;
	readonly blocked = emptyBlocked();
	/** Blocks the main thread was free in, they count as nothing (see `incidentKind`). */
	readonly ignored = { count: 0, ms: 0 };
	/** Counted incidents that crossed one second, counted once each. */
	longBlocks = 0;

	private readonly actions: ActionEntry[] = Array.from({ length: ACTION_RING }, () => ({ at: -1, label: null, target: null }));
	private actionHead = 0;
	private head = 0;
	private readonly kept: Block[] = [];
	private readonly recent: Block[] = [];
	private readonly ring: Span[] = Array.from({ length: SPAN_RING }, () => ({ end: 0, ms: 0, name: '' }));

	/**
	 * What the player just did, at `at` on the `performance.now()` timeline (an event's own timestamp when it was queued behind a
	 * block). With a `target`, `label` is the prefix of its description (`tap:` then `Atom`), without one it is the whole name.
	 */
	action(label: string | null, target: Element | null, at: number) {
		const slot = this.actions[this.actionHead];
		slot.at = at;
		slot.label = label;
		slot.target = target;
		this.actionHead = (this.actionHead + 1) % ACTION_RING;
	}

	observe(observation: IncidentObservation) {
		const resolved: Resolved = { ...observation, timerLate: observation.timerLate ?? false };
		const views = viewOf(resolved);
		let target: Block | null = null;
		let tooLong = false;
		for (let index = 0; index < this.recent.length; index++) {
			const block = this.recent[index];
			if (!this.joins(block, resolved, views)) continue;
			if (unionOf(block, resolved.start, resolved.end) > MAX_FREEZE_MS) {
				tooLong = true;
				continue;
			}
			target = block;
			break;
		}

		if (!target) {
			/**
			 * A view that can only join blocks it would stretch past `MAX_FREEZE_MS` is dropped: such a block already counts the time they share,
			 * and Event Timing gives one entry per event of an interaction, each as long as the gap, so counting one apart counts that time again.
			 */
			if (!tooLong) this.create(resolved, views);
			return;
		}

		this.release(target);
		this.merge(target, resolved, views);

		// A view can bridge two blocks that were separate until it widened this one.
		for (let index = this.recent.length - 1; index >= 0; index--) {
			const other = this.recent[index];
			if (other === target || !this.joins(target, other, other.views) || unionOf(target, other.start, other.end) > MAX_FREEZE_MS) continue;
			this.recent.splice(index, 1);
			this.absorb(target, other);
		}
	}

	reset() {
		this.actionHead = 0;
		this.head = 0;
		this.kept.length = 0;
		this.recent.length = 0;
		this.ignored.count = 0;
		this.ignored.ms = 0;
		this.longBlocks = 0;
		for (const entry of this.actions) {
			entry.at = -1;
			entry.label = null;
			entry.target = null;
		}
		for (const span of this.ring) span.ms = 0;
		for (const stat of Object.values(this.blocked)) {
			stat.count = 0;
			stat.ms = 0;
		}
	}

	/** A named call that ran from `start` to `end`, kept in a ring so an incident can name what ran inside it. */
	span(name: string, start: number, end: number) {
		const slot = this.ring[this.head];
		slot.end = end;
		slot.ms = end - start;
		slot.name = name;
		this.head = (this.head + 1) % SPAN_RING;
	}

	worst(limit: number): PerfIncident[] {
		/** `toSorted` is missing on Chrome before 110 and Safari before 16, a copy and `sort` run everywhere. */
		return [...this.kept]
			.sort((a, b) => lengthOf(b) - lengthOf(a))
			.slice(0, limit)
			.map(block => ({
				action: block.action,
				actionAgoMs: block.actionAgoMs,
				atMs: Math.round(block.start),
				durationMs: Math.round(lengthOf(block)),
				input: block.input,
				loaf: block.loaf,
				modal: block.modal,
				realm: block.realm,
				sources: block.sources.map(({ ms, name }) => ({ ms: Math.round(ms), name })),
				timerLate: block.timerLate,
			}));
	}

	/** Joins `other` into `target`, both counted until now: the pair is released, joined and counted once. */
	private absorb(target: Block, other: Block) {
		this.release(other);
		this.release(target);
		if (other.kept) this.unkeep(other);
		this.merge(target, other, other.views);
	}

	/**
	 * Adds the block to `blocked` under its current kind (or to `ignored`), and to the worst list when it counts. `release` takes
	 * exactly this back and is always called before a block changes, so a late view that changes its kind or length keeps the numbers exact.
	 */
	private claim(block: Block) {
		const kind = kindOf(block);
		const stat = kind ? this.blocked[kind] : this.ignored;
		stat.count++;
		stat.ms += lengthOf(block);
		if (!kind) {
			if (block.kept) this.unkeep(block);
			return;
		}

		if (lengthOf(block) >= FREEZE_MS) this.longBlocks++;
		this.retain(block);
	}

	/** The spans that overlap `[start, end]`, summed by name over their overlapping part, the longest few. */
	private collect(start: number, end: number): Block['sources'] {
		const sums: Block['sources'] = [];
		for (const span of this.ring) {
			const ms = Math.min(span.end, end) - Math.max(span.end - span.ms, start);
			if (span.ms <= 0 || ms <= 0) continue;

			const known = sums.find(sum => sum.name === span.name);
			if (known) known.ms += ms;
			else sums.push({ ms, name: span.name });
		}
		return sums.sort((a, b) => b.ms - a.ms).slice(0, MAX_SPANS);
	}

	private create({ end, input, loaf, start, timerLate }: Resolved, views: number) {
		const block: Block = {
			action: null,
			actionAgoMs: null,
			end,
			input: input ?? null,
			kept: false,
			loaf: loaf ?? null,
			modal: this.environment?.modal() ?? null,
			realm: this.environment?.realm() ?? RealmTypes.ATOMS,
			sources: this.collect(start, end),
			start,
			timerLate,
			views,
		};
		this.readAction(block);
		this.claim(block);
		this.recent.push(block);
		if (this.recent.length > RECENT_MAX) this.recent.shift();
	}

	/** Widens `target` over a view or another block and counts it again, the caller released it first. A part that starts earlier brings its action along. */
	private merge(target: Block, part: Part, views: number) {
		if (part.start < target.start && part.action) {
			target.action = part.action;
			target.actionAgoMs = part.actionAgoMs ?? null;
		}
		target.start = Math.min(target.start, part.start);
		target.end = Math.max(target.end, part.end);
		target.timerLate ||= part.timerLate;
		target.views |= views;
		if (part.input && (!target.input || outranks(part.input, target.input))) target.input = part.input;
		target.loaf = part.loaf ?? target.loaf;
		target.sources = this.collect(target.start, target.end);
		if (!target.action) this.readAction(target);
		this.claim(target);
	}

	/**
	 * A part joins a block when they overlap, and when exactly one of them is an idle gap (counts as nothing alone) only if the other covers
	 * half of their union: a few hundred ms of proof must not turn a 10 s gap the main thread was free in into a counted block.
	 */
	private joins(block: Block, part: Part, views: number): boolean {
		if (!this.overlaps(block, part.start, part.end, views)) return false;

		const blockIdle = kindOf(block) === null;
		if (blockIdle === (kindOf(part) === null)) return true;

		const busy = blockIdle ? part : block;
		return (busy.end - busy.start) * 2 >= unionOf(block, part.start, part.end);
	}

	/** Views only merge when they come from different observers and the overlap, slack included, covers half of the shorter span: gaps that merely touch stay apart. */
	private overlaps(block: Block, start: number, end: number, views: number): boolean {
		if (block.views & views & EXCLUSIVE_VIEWS) return false;
		return Math.min(end, block.end) - Math.max(start, block.start) + MERGE_SLACK_MS >= Math.min(end - start, lengthOf(block)) / 2;
	}

	/** The latest action up to the block's start (an action during the block, such as a tap queued behind it, doesn't explain it). */
	private readAction(block: Block) {
		let found: ActionEntry | null = null;
		for (const entry of this.actions) {
			if (entry.at < 0 || entry.at > block.start + MERGE_SLACK_MS || block.start - entry.at > ACTION_WINDOW_MS) continue;
			if (!found || entry.at > found.at) found = entry;
		}
		if (!found) return;

		const described = found.target && this.environment ? this.environment.describe(found.target) : null;
		const action = found.target ? described && (found.label ?? '') + described : found.label;
		if (!action) return;

		block.action = action;
		block.actionAgoMs = Math.max(0, Math.round(block.start - found.at));
	}

	private release(block: Block) {
		const kind = kindOf(block);
		const stat = kind ? this.blocked[kind] : this.ignored;
		stat.count--;
		stat.ms -= lengthOf(block);
		if (kind && lengthOf(block) >= FREEZE_MS) this.longBlocks--;
	}

	/** A block joins the worst list when there is room or it is longer than the shortest one, which then drops out of the report. */
	private retain(block: Block) {
		if (block.kept) return;
		if (this.kept.length < MAX_KEPT) {
			block.kept = true;
			this.kept.push(block);
			return;
		}

		let smallest = 0;
		for (let index = 1; index < this.kept.length; index++) {
			if (lengthOf(this.kept[index]) < lengthOf(this.kept[smallest])) smallest = index;
		}
		if (lengthOf(this.kept[smallest]) >= lengthOf(block)) return;

		this.kept[smallest].kept = false;
		this.kept[smallest] = block;
		block.kept = true;
	}

	private unkeep(block: Block) {
		this.kept.splice(this.kept.indexOf(block), 1);
		block.kept = false;
	}
}
