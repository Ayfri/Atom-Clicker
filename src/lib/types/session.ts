import type { RealmType } from '#data/realms.js';
import type { BrowserInfo } from '#helpers/clientInfo.js';
import type { IncidentKinds } from '#helpers/perfIncidents.js';

export type InAppBrowser = 'facebook' | 'instagram' | 'line' | 'linkedin' | 'other-webview' | 'snapchat' | 'tiktok' | 'twitter' | 'wechat';

export interface DeviceInfo extends BrowserInfo {
	cores: number | null;
	inAppBrowser: InAppBrowser | null;
	maxTouchPoints: number;
	memoryGb: number | null;
	pixelRatio: number;
	reducedMotion: boolean;
	standalone: boolean;
	viewportHeight: number;
	viewportWidth: number;
}

export interface SessionGame {
	/** `document.getAnimations().length` at report time. */
	animations: number | null;
	autoClicksPerSecond: number;
	/** Elements with a `backdrop-blur` class. */
	backdrops: number;
	/** Sum of `width * height * 4` over the DOM canvases. */
	canvasBytes: number;
	canvases: number;
	/** `ui.covered`. */
	covered: boolean;
	electronizes: number;
	/** Elements marked `data-perf-layer="glow"`. */
	glows: number;
	ionizes: number;
	/** Null while levels are locked. */
	level: number | null;
	/** `ui.activeModalId`. */
	modal: string | null;
	protonises: number;
	realm: RealmType;
	realms: RealmType[];
	reducedMotion: boolean;
}

export type IncidentKind = (typeof IncidentKinds)[keyof typeof IncidentKinds];

export type SessionProblem = 'freezes' | 'low-frame-rate' | 'render-bound' | 'slow-interactions';

/** The Event Timing phases of one interaction: input delay, handlers, then everything until the next paint. */
export interface InputBreakdown {
	delayMs: number;
	presentationMs: number;
	processingMs: number;
	target: string | null;
}

export interface LoafScript {
	durationMs: number;
	file: string | null;
	fn: string | null;
	invoker: string;
}

export interface LoafBreakdown {
	otherMs: number;
	scriptMs: number;
	scripts: LoafScript[];
	styleLayoutMs: number;
}

/** A main thread block of 150 ms or more, with what the player did just before and what ran inside it. */
export interface PerfIncident {
	action: string | null;
	actionAgoMs: number | null;
	/** Start of the block in ms since the page loaded. */
	atMs: number;
	durationMs: number;
	input: InputBreakdown | null;
	loaf: LoafBreakdown | null;
	modal: string | null;
	realm: RealmType;
	sources: { ms: number; name: string }[];
	timerLate: boolean;
}

export interface PerfWindow {
	blockedMs: number;
	commitLagP95Ms: number;
	frameCount: number;
	frameJankCount: number;
	/** Incidents that crossed one second inside the window. */
	freezeCount: number;
	observedMs: number;
	slowInputCount: number;
}

export interface PerfSourceStat {
	calls: number;
	maxMs: number;
	name: string;
	totalMs: number;
}

export interface PerfTotals {
	blocked: Record<IncidentKind, { count: number; ms: number }>;
	commitLagP95Ms: number;
	eventTiming: boolean;
	inputP95Ms: number;
	jankRatio: number;
	loaf: boolean;
	/** Unpaused time of the session, the base of every share. */
	visibleMs: number;
}

/** `evidence` holds the windows that triggered degraded (frozen once detected), otherwise the last 12 windows or fewer. */
export interface SessionPerf {
	evidence: PerfWindow[];
	incidents: PerfIncident[];
	sources: PerfSourceStat[];
	totals: PerfTotals;
}

export interface SessionStartPayload {
	device: DeviceInfo;
	game: SessionGame;
}

export interface SessionStartResponse {
	writeKey: string | null;
}

export interface SessionUpdatePayload {
	game: SessionGame;
	perf: SessionPerf;
	sessionId: string;
	writeKey: string;
}
