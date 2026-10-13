import { FeatureTypes } from '#data/features.js';
import { getDeviceInfo, isCrawler, isUuid, SESSION_ID } from '#helpers/clientInfo.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { INCIDENT_MIN_MS, INCIDENTS_SENT, stripUrlDetails } from '#helpers/perfIncidents.js';
import { EVENT_DURATION_THRESHOLD, isDegraded, rankSources, RESUME_WARMUP_MS, SLOW_INPUT_MS, WARMUP_MS } from '#helpers/perfStats.js';
import { perfTracker } from '#helpers/perfTracker.js';
import { realmManager } from '#helpers/RealmManager.svelte.js';
import type { LoafScript, PerfWindow, SessionGame, SessionPerf, SessionStartPayload, SessionStartResponse, SessionUpdatePayload } from '#lib/types/session.js';
import { getJSON, setItem } from '#lib/utils/safeLocalStorage.js';
import { privacy } from '#stores/privacy.svelte.js';
import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
import { ui } from '#stores/ui.svelte.js';
import { prefersReducedMotion } from 'svelte/motion';

/** `durationThreshold` is missing from the DOM lib. */
interface EventObserverInit extends PerformanceObserverInit {
	durationThreshold: number;
}

/** Long Animation Frames aren't in the DOM lib yet, and `sourceURL` is missing in some Chromium versions. */
interface LoafScriptTiming {
	duration: number;
	invoker: string;
	invokerType: string;
	sourceFunctionName: string;
	sourceURL?: string;
}

interface LoafTiming extends PerformanceEntry {
	scripts: readonly LoafScriptTiming[];
	styleAndLayoutStart: number;
}

const DAY_MS = 86_400_000;
const FINAL_BEACON_GAP_MS = 30_000;
const INTERACTION_EVENTS = new Set(['click', 'keydown', 'pointerdown', 'pointerup']);
const MAX_FILE_LENGTH = 60;
const MAX_INVOKER_LENGTH = 80;
const MAX_SCRIPTS = 3;
const MAX_TARGET_LENGTH = 60;
const MAX_FN_LENGTH = 60;
const MAX_TEXT_LENGTH = 24;
/** A large container's text is cut before it is scanned. */
const MAX_TEXT_SOURCE = 200;
/** Ten windows of 10 s a minute, so a periodic update goes out every five minutes of visible play. */
const PERIODIC_WINDOWS = 30;
const RING_SIZE = 12;
const SOURCES_SENT = 12;
const STORAGE_KEY = 'atomic-clicker-perf';
const TARGET_SELECTOR = '[aria-label],[data-hint],[title],[role="button"],a,button,canvas';

/** The nearest labelled element's name, digits masked so a counter that ticks does not make every label unique: `Atom`, `Buy # atoms`. */
function describeTarget(target: Element): string {
	const element = target.closest(TARGET_SELECTOR) ?? target;
	const label = element.getAttribute('aria-label') ?? element.getAttribute('data-hint') ?? element.getAttribute('title');
	if (label) return label.slice(0, MAX_TARGET_LENGTH);

	const text = element.textContent?.slice(0, MAX_TEXT_SOURCE).replace(/[\d.,]+/g, '#').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
	return text || element.tagName.toLowerCase();
}

const toScript = ({ duration, invoker, invokerType, sourceFunctionName, sourceURL }: LoafScriptTiming): LoafScript => ({
	durationMs: Math.round(duration),
	file: sourceURL?.split(/[?#]/)[0].split('/').pop()?.slice(0, MAX_FILE_LENGTH) || null,
	fn: sourceFunctionName.slice(0, MAX_FN_LENGTH) || null,
	invoker: stripUrlDetails(`${invokerType}:${invoker}`).slice(0, MAX_INVOKER_LENGTH),
});

/**
 * Watches the session for main thread blocks through the perf tracker and the browser's own entries (Event Timing, Long Animation
 * Frames), tags each with what the player did just before, and reports to `/api/sessions`. Everything respects the usage analytics switch.
 */
export class PerfMonitor {
	private awaitingKey = false;
	/** Set once a degraded report is due, the 24 h cooldown starts when the server accepts an update that carries it. */
	private cooldownPending = false;
	private dirty = false;
	private evidence: PerfWindow[] | null = null;
	private eventTiming = false;
	private lastBeaconAt = 0;
	private loafSupported = false;
	private observers: PerformanceObserver[] = [];
	private readonly onAction = (event: Event) => {
		if (event.target instanceof Element) perfTracker.action(event.type === 'keydown' ? 'key:' : 'tap:', event.target, event.timeStamp);
	};
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

	/** Idempotent, and a no-op for crawlers, non-UUID sessions (which is every server-side run), missing `performance` or analytics turned off. */
	start() {
		if (this.started || typeof performance === 'undefined' || isCrawler() || !isUuid(SESSION_ID) || !privacy.analytics) return;

		this.started = true;
		try {
			perfTracker.onWindow = closed => this.onWindow(closed);
			perfTracker.incidents.environment = { describe: describeTarget, modal: () => ui.activeModalId, realm: () => realmManager.selectedRealmId };
			document.addEventListener('visibilitychange', this.onVisibility);
			document.addEventListener('pointerdown', this.onAction, { capture: true, passive: true });
			document.addEventListener('keydown', this.onAction, { capture: true, passive: true });
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
		perfTracker.pause();
		perfTracker.onWindow = null;
		perfTracker.incidents.environment = null;
		document.removeEventListener('visibilitychange', this.onVisibility);
		document.removeEventListener('pointerdown', this.onAction, { capture: true });
		document.removeEventListener('keydown', this.onAction, { capture: true });
		window.removeEventListener('pagehide', this.onHide);
		window.removeEventListener('pageshow', this.onPageShow);
		for (const observer of this.observers) observer.disconnect();
		this.observers = [];
	}

	summary(): SessionPerf {
		return {
			evidence: this.evidence ?? [...this.ring],
			incidents: perfTracker.incidents.worst(INCIDENTS_SENT),
			sources: rankSources(perfTracker.sessionSources(), SOURCES_SENT),
			totals: { ...perfTracker.totals(), eventTiming: this.eventTiming, loaf: this.loafSupported },
		};
	}

	/** Game context is read at report time only, nothing here runs on a hot path. */
	private gameContext(): SessionGame {
		let canvasBytes = 0;
		const canvases = document.querySelectorAll('canvas');
		for (const canvas of canvases) canvasBytes += canvas.width * canvas.height * 4;

		return {
			animations: document.getAnimations?.().length ?? null,
			autoClicksPerSecond: gameManager.autoClicksPerSecond,
			backdrops: document.querySelectorAll('[class*="backdrop-blur"]').length,
			canvasBytes,
			canvases: canvases.length,
			covered: ui.covered,
			electronizes: gameManager.totalElectronizesAllTime,
			glows: document.querySelectorAll('[data-perf-layer="glow"]').length,
			ionizes: gameManager.totalIonizesAllTime,
			level: gameManager.features[FeatureTypes.LEVELS] ? gameManager.playerLevel : null,
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
		perfTracker.pause();
		if (this.dirty && Date.now() - this.lastBeaconAt >= FINAL_BEACON_GAP_MS) this.send(true);
	}

	private observe() {
		if (typeof PerformanceObserver === 'undefined') return;

		const supported = PerformanceObserver.supportedEntryTypes ?? [];
		this.eventTiming = supported.includes('event');
		this.loafSupported = supported.includes('long-animation-frame');

		if (this.eventTiming) {
			const init: EventObserverInit = { durationThreshold: EVENT_DURATION_THRESHOLD, type: 'event' };
			this.watch(init, entries => this.onEvents(entries as PerformanceEventTiming[]));
		}
		if (this.loafSupported) this.watch({ type: 'long-animation-frame' }, entries => this.onLoaf(entries as LoafTiming[]));
	}

	/** Every interaction feeds the latency p95, the slow ones become incidents with their three phases. */
	private onEvents(entries: PerformanceEventTiming[]) {
		if (perfTracker.paused) return;

		for (const entry of entries) {
			const interaction = entry.interactionId > 0 || (entry.interactionId === undefined && INTERACTION_EVENTS.has(entry.name));
			if (!interaction || entry.startTime < perfTracker.resumedAt) continue;

			perfTracker.input(entry.duration);
			if (entry.duration < SLOW_INPUT_MS) continue;

			const end = entry.startTime + entry.duration;
			perfTracker.incidents.observe({
				end,
				input: {
					delayMs: Math.max(0, Math.round(entry.processingStart - entry.startTime)),
					presentationMs: Math.max(0, Math.round(end - entry.processingEnd)),
					processingMs: Math.max(0, Math.round(entry.processingEnd - entry.processingStart)),
					target: entry.target instanceof Element ? describeTarget(entry.target) : null,
				},
				start: entry.startTime,
			});
		}
	}

	private onLoaf(entries: LoafTiming[]) {
		if (perfTracker.paused) return;

		for (const entry of entries) {
			if (entry.duration < INCIDENT_MIN_MS || entry.startTime < perfTracker.resumedAt) continue;

			const end = entry.startTime + entry.duration;
			const scripts = entry.scripts.map(toScript).sort((a, b) => b.durationMs - a.durationMs);
			const scriptMs = entry.scripts.reduce((sum, script) => sum + script.duration, 0);
			const styleLayoutMs = entry.styleAndLayoutStart > 0 ? Math.max(0, end - entry.styleAndLayoutStart) : 0;
			perfTracker.incidents.observe({
				end,
				loaf: {
					otherMs: Math.max(0, Math.round(entry.duration - scriptMs - styleLayoutMs)),
					scriptMs: Math.round(scriptMs),
					scripts: scripts.slice(0, MAX_SCRIPTS),
					styleLayoutMs: Math.round(styleLayoutMs),
				},
				start: entry.startTime,
			});
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
				this.reportDegraded();
				return;
			}
		}
		if (this.windowsSinceUpdate >= PERIODIC_WINDOWS) this.send(false);
	}

	/**
	 * One degraded report per page load, and one per 24 h per device: inside that day the periodic and final updates still carry the
	 * evidence, so the server still flags the session. The day only starts once the server took the report.
	 */
	private reportDegraded() {
		const { degradedAt = 0 } = getJSON<{ degradedAt?: number }>(STORAGE_KEY, {});
		if (this.reportedThisLoad || Date.now() - degradedAt < DAY_MS) return;

		this.reportedThisLoad = true;
		this.cooldownPending = true;
		this.send(false);
	}

	private resume(delay: number) {
		clearTimeout(this.warmup);
		this.warmup = setTimeout(() => {
			if (!document.hidden) perfTracker.resume();
		}, delay);
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
