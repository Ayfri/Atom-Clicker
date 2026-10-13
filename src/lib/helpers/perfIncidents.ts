import { RealmTypes, type RealmType } from '#data/realms.js';
import { MAX_FREEZE_MS, SLOW_INPUT_MS } from '#helpers/perfStats.js';
import type { IncidentKind, InputBreakdown, LoafBreakdown, PerfIncident } from '#lib/types/session.js';

/** About nine dropped frames, the 50 ms Long Animation Frame default would flood low-end devices where one atom frame is 82 ms. */
export const INCIDENT_MIN_MS = 150;
export const INCIDENTS_SENT = 6;
/** A named call this long is worth remembering as something that ran inside an incident. */
export const SPAN_MIN_MS = 10;
const ACTION_RING = 4;
const ACTION_WINDOW_MS = 1_000;
const FREEZE_MS = 1_000;
const MAX_KEPT = 12;
const MAX_SPANS = 3;
/** The 20 ms commit step, a 16 ms frame and the 8 ms Event Timing rounding. */
const MERGE_SLACK_MS = 50;
/** Blocks that can still receive a late view, apart from the worst ones that are reported. */
const RECENT_MAX = 8;
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
	long: boolean;
	modal: string | null;
	realm: RealmType;
	sources: { ms: number; name: string }[];
	start: number;
	timerLate: boolean;
	views: number;
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
 * Input beats freeze beats stall: a late timer or a Long Animation Frame is JavaScript, otherwise only the frames were late (compositor or
 * GPU). An interaction only names a block it covers at least half of, a 200 ms click inside a 5 s freeze stays a freeze.
 */
export function incidentKind({ durationMs, input, loaf, timerLate }: Pick<PerfIncident, 'durationMs' | 'input' | 'loaf' | 'timerLate'>): IncidentKind {
	if (input && inputMs(input) >= SLOW_INPUT_MS && inputMs(input) * 2 >= durationMs) return IncidentKinds.INPUT;
	if (durationMs >= FREEZE_MS) return IncidentKinds.FREEZE;
	return timerLate || loaf ? IncidentKinds.STALL : IncidentKinds.FRAME;
}

const kindOf = (block: Block) => incidentKind({ durationMs: block.end - block.start, input: block.input, loaf: block.loaf, timerLate: block.timerLate });

const lengthOf = (block: Block) => block.end - block.start;

const emptyBlocked = (): Record<IncidentKind, { count: number; ms: number }> => ({
	[IncidentKinds.FRAME]: { count: 0, ms: 0 },
	[IncidentKinds.FREEZE]: { count: 0, ms: 0 },
	[IncidentKinds.INPUT]: { count: 0, ms: 0 },
	[IncidentKinds.STALL]: { count: 0, ms: 0 },
});

/** The view an observation is: Event Timing carries an input, a Long Animation Frame a breakdown, a commit gap a late timer, anything else a rAF gap. */
const viewOf = ({ input, loaf, timerLate }: Resolved) => (input ? Views.INPUT : loaf ? Views.LOAF : timerLate ? Views.COMMIT : Views.FRAME);

/**
 * Keeps the worst main thread blocks of the session, each counted once however many observers saw it (commit timer, rAF gap, Long
 * Animation Frame, Event Timing), which deliver late and in any order, so views merge by time overlap into the recent blocks, whether
 * or not they made the worst list. Allocates only when an incident is created or widened, `span` and `action` are O(1) writes into
 * preallocated slots.
 */
export class IncidentLog {
	environment: IncidentEnvironment | null = null;
	readonly blocked = emptyBlocked();
	/** Incidents that crossed one second, counted once each. */
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
		const target = this.recent.find(block => this.fits(block, resolved.start, resolved.end, views));
		if (!target) {
			this.create(resolved, views);
			return;
		}

		this.release(target);
		const earlier = resolved.start < target.start;
		target.start = Math.min(target.start, resolved.start);
		target.end = Math.max(target.end, resolved.end);
		target.timerLate ||= resolved.timerLate;
		target.views |= views;
		if (resolved.input && (!target.input || inputMs(resolved.input) > inputMs(target.input))) target.input = resolved.input;
		if (resolved.loaf) target.loaf = resolved.loaf;
		target.sources = this.collect(target.start, target.end);
		if (earlier && !target.action) this.readAction(target);
		this.claim(target);

		// A view can bridge two blocks that were separate until it widened this one.
		for (let index = this.recent.length - 1; index >= 0; index--) {
			const other = this.recent[index];
			if (other === target || !this.fits(target, other.start, other.end, other.views)) continue;
			this.recent.splice(index, 1);
			this.absorb(target, other);
		}
		this.retain(target);
	}

	reset() {
		this.actionHead = 0;
		this.head = 0;
		this.kept.length = 0;
		this.recent.length = 0;
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
		return this.kept
			.toSorted((a, b) => lengthOf(b) - lengthOf(a))
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
		if (other.start < target.start && other.action) {
			target.action = other.action;
			target.actionAgoMs = other.actionAgoMs;
		}
		target.start = Math.min(target.start, other.start);
		target.end = Math.max(target.end, other.end);
		target.timerLate ||= other.timerLate;
		target.views |= other.views;
		if (other.input && (!target.input || inputMs(other.input) > inputMs(target.input))) target.input = other.input;
		target.loaf ??= other.loaf;
		if (other.long && target.long) this.longBlocks--;
		else if (other.long) target.long = true;
		if (other.kept) this.kept.splice(this.kept.indexOf(other), 1);
		target.sources = this.collect(target.start, target.end);
		if (!target.action) this.readAction(target);
		this.claim(target);
	}

	/** Adds the block to `blocked` under its current kind, `release` takes it back before the kind or span changes. */
	private claim(block: Block) {
		const stat = this.blocked[kindOf(block)];
		stat.count++;
		stat.ms += lengthOf(block);
		if (!block.long && lengthOf(block) >= FREEZE_MS) {
			block.long = true;
			this.longBlocks++;
		}
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
			long: false,
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
		this.retain(block);
	}

	/**
	 * Views only merge when they really overlap (the overlap, slack included, covers half of the shorter span), come from different
	 * observers, and the union stays under `MAX_FREEZE_MS`: gaps that merely touch are separate incidents.
	 */
	private fits(block: Block, start: number, end: number, views: number): boolean {
		if (block.views & views & EXCLUSIVE_VIEWS) return false;
		if (Math.max(end, block.end) - Math.min(start, block.start) > MAX_FREEZE_MS) return false;
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
		const stat = this.blocked[kindOf(block)];
		stat.count--;
		stat.ms -= lengthOf(block);
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
}
