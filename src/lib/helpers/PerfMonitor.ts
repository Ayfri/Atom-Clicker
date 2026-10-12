import { getDeviceInfo, isCrawler, isUuid, SESSION_ID } from '#helpers/clientInfo.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { EVENT_DURATION_THRESHOLD, isDegraded, MIN_PROBE_FRAMES, probeVerdict, rankSources, RESUME_WARMUP_MS, shouldProbe, WARMUP_MS } from '#helpers/perfStats.js';
import { perfTracker } from '#helpers/perfTracker.js';
import { realmManager } from '#helpers/RealmManager.svelte.js';
import type { PerfWindow, ProbeLayerResult, ProbeResult, SessionGame, SessionPerf, SessionStartPayload, SessionStartResponse, SessionUpdatePayload } from '#lib/types/session.js';
import { getJSON, setItem } from '#lib/utils/safeLocalStorage.js';
import { privacy } from '#stores/privacy.svelte.js';
import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
import { ui } from '#stores/ui.svelte.js';
import { prefersReducedMotion } from 'svelte/motion';

/** `durationThreshold` is missing from the DOM lib. */
interface EventObserverInit extends PerformanceObserverInit {
	durationThreshold: number;
}

interface LoafScript {
	duration: number;
	invoker: string;
	invokerType: string;
	sourceFunctionName: string;
}

/** Long Animation Frames aren't in the DOM lib yet. */
interface LoafTiming extends PerformanceEntry {
	renderStart: number;
	scripts: readonly LoafScript[];
	styleAndLayoutStart: number;
}

interface ProbePhase {
	/** Null below `MIN_PROBE_FRAMES`: a phase that drew almost nothing says nothing about jank. */
	jankRatio: number | null;
	lostMsPerS: number;
}

/** Decorative layers the probe can hide, each one is an element family the page marks or styles. */
const PROBE_LAYERS = [
	{ name: 'glows', selector: '[data-perf-layer="glow"]' },
	{ name: 'backdrop', selector: '[class*="backdrop-blur"]' },
	{ name: 'ambient', selector: '[data-perf-layer="ambient"]' },
	{ name: 'particles', selector: '[data-perf-layer="particles"]' },
	{ name: 'panels', selector: '[data-offscreen]' },
] as const;

const DAY_MS = 86_400_000;
const FINAL_BEACON_GAP_MS = 30_000;
const INTERACTION_EVENTS = new Set(['click', 'keydown', 'pointerdown', 'pointerup']);
const MAX_SCRIPT_LABEL = 120;
const MAX_TARGET_LABEL = 60;
const MAX_TOP_SCRIPTS = 3;
/** Ten windows of 10 s a minute, so a periodic update goes out every five minutes of visible play. */
const PERIODIC_WINDOWS = 30;
const PROBE_PHASE_MS = 2_000;
const PROBE_SETTLE_MS = 1_000;
const RING_SIZE = 12;
const SOURCES_SENT = 12;
const STORAGE_KEY = 'atomic-clicker-perf';
const TARGET_SELECTOR = '[aria-label],[data-hint],[data-photon-realm],button,canvas';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function describeTarget(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) return null;
	const element = target.closest(TARGET_SELECTOR);
	const label = element?.getAttribute('aria-label') ?? element?.getAttribute('data-hint') ?? element?.tagName.toLowerCase() ?? target.tagName.toLowerCase();
	return label.slice(0, MAX_TARGET_LABEL);
}

/**
 * Watches the session for sustained lag through the perf tracker and the browser's own entries (Event Timing, Long Animation Frames),
 * reports to `/api/sessions` and, on a degraded session whose lost time no tracked source explains or that hitches on screen, hides
 * decorative layers one at a time to name the one that costs frames. Everything respects the usage analytics switch.
 */
export class PerfMonitor {
	private awaitingKey = false;
	/** Set once a degraded report is due, the 24 h cooldown starts when the server accepts an update that carries it. */
	private cooldownPending = false;
	private dirty = false;
	private evidence: PerfWindow[] | null = null;
	private lastBeaconAt = 0;
	private loafRenderMs = 0;
	private loafScriptMs = 0;
	private loafStyleLayoutMs = 0;
	private loafSupported = false;
	private longTaskCount: number | null = null;
	private observers: PerformanceObserver[] = [];
	private probeResult: ProbeResult | null = null;
	private probing: Promise<ProbeResult> | null = null;
	private probedThisLoad = false;
	private readonly onPageShow = (event: PageTransitionEvent) => {
		if (event.persisted) this.resume(RESUME_WARMUP_MS);
	};
	private readonly onVisibility = () => {
		if (document.hidden) this.hide();
		else this.resume(RESUME_WARMUP_MS);
	};
	private readonly onHide = () => this.hide();
	private readonly ring: PerfWindow[] = [];
	/** The server refused the session (unknown, capped or too old), nothing more is sent for this page load. */
	private rejected = false;
	private reportedThisLoad = false;
	private started = false;
	private topScripts: { label: string; ms: number }[] = [];
	private warmup: ReturnType<typeof setTimeout> | undefined;
	private windowsSinceUpdate = 0;
	private writeKey: string | null = null;

	get degraded() {
		return this.evidence !== null;
	}

	/** Resolves the player once through `fetch` with the bearer token, `sendBeacon` cannot carry one, and keeps the write key. */
	async open() {
		if (!this.started || this.writeKey || !privacy.analytics) return;

		try {
			const device = getDeviceInfo();
			if (!device) return;

			const token = await supabaseAuth.getAccessToken().catch(() => null);
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (token) headers.Authorization = `Bearer ${token}`;
			const payload: SessionStartPayload = { device, game: this.gameContext() };

			const response = await fetch('/api/sessions', { body: JSON.stringify(payload), headers, method: 'POST' });
			if (!response.ok) return;
			this.writeKey = ((await response.json()) as SessionStartResponse).writeKey;
		} catch {
			return;
		}

		if (this.awaitingKey) this.send(false);
	}

	/** Forces the probe now, also exposed to the console in dev. One probe runs at a time. */
	probe(): Promise<ProbeResult> {
		return (this.probing ??= this.runProbe().finally(() => (this.probing = null)));
	}

	/** Idempotent, and a no-op for crawlers, non-UUID sessions (which is every server-side run), missing `performance` or analytics turned off. */
	start() {
		if (this.started || typeof performance === 'undefined' || isCrawler() || !isUuid(SESSION_ID) || !privacy.analytics) return;

		this.started = true;
		try {
			perfTracker.onWindow = closed => this.onWindow(closed);
			document.addEventListener('visibilitychange', this.onVisibility);
			window.addEventListener('pagehide', this.onHide);
			window.addEventListener('pageshow', this.onPageShow);
			this.observe();
			if (!document.hidden) this.resume(WARMUP_MS);
		} catch {
			this.stop();
		}
	}

	stop() {
		if (!this.started) return;

		this.started = false;
		clearTimeout(this.warmup);
		perfTracker.paused = true;
		perfTracker.onWindow = null;
		document.removeEventListener('visibilitychange', this.onVisibility);
		window.removeEventListener('pagehide', this.onHide);
		window.removeEventListener('pageshow', this.onPageShow);
		for (const observer of this.observers) observer.disconnect();
		this.observers = [];
		delete document.documentElement.dataset.perfProbe;
	}

	summary(): SessionPerf {
		const topScripts = this.topScripts.map(script => script.label);
		return {
			evidence: this.evidence ?? [...this.ring],
			probe: this.probeResult,
			sources: rankSources(perfTracker.sessionSources(), SOURCES_SENT),
			totals: {
				...perfTracker.totals(),
				loaf: this.loafSupported ? { renderMs: this.loafRenderMs, scriptMs: this.loafScriptMs, styleLayoutMs: this.loafStyleLayoutMs, topScripts } : null,
				longTaskCount: this.longTaskCount,
			},
		};
	}

	private abortReason(realm: SessionGame['realm']): string | null {
		if (document.hidden) return 'hidden';
		if (perfTracker.paused || !privacy.analytics) return 'paused';
		if (ui.activeModal || ui.covered) return 'modal';
		return realmManager.selectedRealmId === realm ? null : 'realm';
	}

	/** Game context is read at report time only, nothing here runs on a hot path. */
	private gameContext(): SessionGame {
		let canvasBytes = 0;
		const canvases = document.querySelectorAll('canvas');
		for (const canvas of canvases) canvasBytes += canvas.width * canvas.height * 4;

		return {
			animations: document.getAnimations?.().length ?? null,
			autoClicksPerSecond: gameManager.autoClicksPerSecond,
			canvasBytes,
			canvases: canvases.length,
			covered: ui.covered,
			electronizes: gameManager.totalElectronizesAllTime,
			glows: document.querySelectorAll('[data-perf-layer="glow"]').length,
			ionizes: gameManager.totalIonizesAllTime,
			level: gameManager.playerLevel,
			modal: ui.activeModalId,
			protonises: gameManager.totalProtonisesAllTime,
			realm: realmManager.selectedRealmId,
			realms: realmManager.availableRealms.map(({ id }) => id),
			reducedMotion: prefersReducedMotion.current,
		};
	}

	/** Pauses, drops the partial window and sends what changed since the last report, a closing tab gets one beacon per 30 s at most. */
	private hide() {
		clearTimeout(this.warmup);
		perfTracker.paused = true;
		if (this.dirty && Date.now() - this.lastBeaconAt >= FINAL_BEACON_GAP_MS) this.send(true);
	}

	private observe() {
		if (typeof PerformanceObserver === 'undefined') return;

		const supported = PerformanceObserver.supportedEntryTypes ?? [];
		this.loafSupported = supported.includes('long-animation-frame');

		if (supported.includes('event')) {
			const init: EventObserverInit = { durationThreshold: EVENT_DURATION_THRESHOLD, type: 'event' };
			this.watch(init, entries => this.onEvents(entries as PerformanceEventTiming[]));
		}
		if (this.loafSupported) {
			this.watch({ type: 'long-animation-frame' }, entries => this.onLoaf(entries as LoafTiming[]));
		} else if (supported.includes('longtask')) {
			this.longTaskCount = 0;
			this.watch({ type: 'longtask' }, entries => {
				if (!perfTracker.paused && this.longTaskCount !== null) this.longTaskCount += entries.length;
			});
		}
	}

	private onEvents(entries: PerformanceEventTiming[]) {
		if (perfTracker.paused) return;

		for (const entry of entries) {
			const interaction = entry.interactionId > 0 || (entry.interactionId === undefined && INTERACTION_EVENTS.has(entry.name));
			if (!interaction) continue;
			const target = entry.duration > perfTracker.inputMaxMs ? describeTarget(entry.target) : null;
			perfTracker.input(entry.duration, Math.max(0, entry.startTime + entry.duration - entry.processingEnd), target);
		}
	}

	private onLoaf(entries: LoafTiming[]) {
		if (perfTracker.paused) return;

		for (const entry of entries) {
			const end = entry.startTime + entry.duration;
			if (entry.styleAndLayoutStart > 0) this.loafStyleLayoutMs += Math.max(0, end - entry.styleAndLayoutStart);
			if (entry.renderStart > 0) this.loafRenderMs += Math.max(0, end - entry.renderStart);
			for (const script of entry.scripts) {
				this.loafScriptMs += script.duration;
				this.rememberScript(script);
			}
		}
	}

	private onWindow(closed: PerfWindow) {
		if (!privacy.analytics) {
			this.stop();
			return;
		}

		this.dirty = true;
		this.windowsSinceUpdate++;
		if (!this.evidence) {
			this.ring.push(closed);
			if (this.ring.length > RING_SIZE) this.ring.shift();
			if (isDegraded(this.ring)) {
				this.evidence = [...this.ring];
				void this.reportDegraded();
				return;
			}
		}
		if (this.windowsSinceUpdate >= PERIODIC_WINDOWS && !this.probing) this.send(false);
	}

	/**
	 * One degraded report and one probe per page load, and one per 24 h per device: inside that day the periodic and final updates
	 * still carry the evidence, so the server still flags the session. The day only starts once the server took the report.
	 */
	private async reportDegraded() {
		const { degradedAt = 0 } = getJSON<{ degradedAt?: number }>(STORAGE_KEY, {});
		if (this.reportedThisLoad || Date.now() - degradedAt < DAY_MS) return;

		this.reportedThisLoad = true;
		this.cooldownPending = true;
		if (this.evidence && shouldProbe(this.evidence) && !this.probedThisLoad && !ui.activeModal && !document.hidden) {
			this.probedThisLoad = true;
			await this.probe();
		}
		this.send(false);
	}

	private rememberScript({ duration, invoker, invokerType, sourceFunctionName }: LoafScript) {
		const label = `${invokerType}:${invoker}@${sourceFunctionName}`.replace(/\?[^\s@]*/g, '').slice(0, MAX_SCRIPT_LABEL);
		const known = this.topScripts.find(script => script.label === label);
		if (known) known.ms = Math.max(known.ms, duration);
		else this.topScripts.push({ label, ms: duration });
		this.topScripts.sort((a, b) => b.ms - a.ms);
		this.topScripts.splice(MAX_TOP_SCRIPTS);
	}

	private resume(delay: number) {
		clearTimeout(this.warmup);
		this.warmup = setTimeout(() => {
			if (document.hidden) return;
			perfTracker.resetWindow();
			perfTracker.paused = false;
		}, delay);
	}

	private async runProbe(): Promise<ProbeResult> {
		const realm = realmManager.selectedRealmId;
		const layers = PROBE_LAYERS.filter(({ selector }) => document.querySelector(selector));
		const results: ProbeLayerResult[] = [];
		const baselines: ProbePhase[] = [];
		let aborted: string | null = layers.length === 0 ? 'no-layers' : null;

		try {
			// A baseline first and last, so a drift over the probe cancels out of the verdict.
			const steps = aborted ? [] : [null, ...layers.map(({ name }) => name), null];
			for (const name of steps) {
				const phase = await this.measure(realm, name);
				if (!phase) {
					aborted = this.abortReason(realm) ?? 'aborted';
					break;
				}
				if (name === null) {
					baselines.push(phase);
					continue;
				}

				results.push({ jankRatio: phase.jankRatio, lostMsPerS: phase.lostMsPerS, name });
				await sleep(PROBE_SETTLE_MS);
				aborted = this.abortReason(realm);
				if (aborted) break;
			}
		} finally {
			delete document.documentElement.dataset.perfProbe;
		}

		const [first, second] = baselines;
		const complete = !aborted && baselines.length === 2;
		const baselineJank = first?.jankRatio != null && second?.jankRatio != null ? (first.jankRatio + second.jankRatio) / 2 : null;
		this.probeResult = {
			aborted,
			baselineLostMsPerS: baselines.length ? baselines.reduce((sum, phase) => sum + phase.lostMsPerS, 0) / baselines.length : 0,
			culprit: complete ? probeVerdict([first.lostMsPerS, second.lostMsPerS], results, baselineJank) : null,
			layers: results,
		};
		this.dirty = true;
		return this.probeResult;
	}

	/** One probe phase: the tracker counters across `PROBE_PHASE_MS` on a timer, with the layer hidden when one is given. */
	private async measure(realm: SessionGame['realm'], layer: string | null): Promise<ProbePhase | null> {
		if (this.abortReason(realm)) return null;

		const root = document.documentElement;
		if (layer) root.dataset.perfProbe = layer;
		const before = { ...perfTracker.counters() };
		const start = performance.now();
		await sleep(PROBE_PHASE_MS);
		delete root.dataset.perfProbe;
		const after = perfTracker.counters();
		if (this.abortReason(realm)) return null;

		const frames = after.frames - before.frames;
		return {
			jankRatio: frames >= MIN_PROBE_FRAMES ? (after.janks - before.janks) / frames : null,
			lostMsPerS: ((after.lostMs - before.lostMs) * 1000) / Math.max(1, performance.now() - start),
		};
	}

	/** `final` sends through `sendBeacon` for a closing page, anything else through a keepalive `fetch`. */
	private send(final: boolean) {
		if (!privacy.analytics || this.rejected) return;
		if (!this.writeKey) {
			this.awaitingKey = true;
			return;
		}

		this.awaitingKey = false;
		this.dirty = false;
		this.windowsSinceUpdate = 0;
		const payload: SessionUpdatePayload = { game: this.gameContext(), perf: this.summary(), sessionId: SESSION_ID, writeKey: this.writeKey };
		const body = JSON.stringify(payload);

		if (final) {
			this.lastBeaconAt = Date.now();
			navigator.sendBeacon('/api/sessions/update', new Blob([body], { type: 'application/json' }));
			return;
		}

		const carriesDegraded = this.degraded;
		fetch('/api/sessions/update', { body, headers: { 'Content-Type': 'application/json' }, keepalive: true, method: 'POST' })
			.then(response => {
				if (response.status === 404) this.rejected = true;
				if (response.ok && carriesDegraded && this.cooldownPending) {
					this.cooldownPending = false;
					setItem(STORAGE_KEY, JSON.stringify({ degradedAt: Date.now() }));
				}
			})
			.catch(() => {});
	}

	private watch(init: PerformanceObserverInit, handle: (entries: PerformanceEntryList) => void) {
		try {
			const observer = new PerformanceObserver(list => handle(list.getEntries()));
			observer.observe(init);
			this.observers.push(observer);
		} catch {
			// An entry type the browser lists but refuses to observe only costs its own numbers.
		}
	}
}

export const perfMonitor = new PerfMonitor();
