import type { RealmType } from '#data/realms.js';
import type { BrowserInfo } from '#helpers/clientInfo.js';

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
	/** Sum of `width * height * 4` over the DOM canvases. */
	canvasBytes: number;
	canvases: number;
	/** `ui.covered`. */
	covered: boolean;
	electronizes: number;
	/** Elements marked `data-perf-layer="glow"`. */
	glows: number;
	ionizes: number;
	level: number;
	/** `ui.activeModalId`. */
	modal: string | null;
	protonises: number;
	realm: RealmType;
	realms: RealmType[];
	reducedMotion: boolean;
}

export interface PerfWindow {
	attributedMs: number;
	commitLagP95Ms: number;
	commitStallMs: number;
	frameCount: number;
	frameJankCount: number;
	/** Timer gaps past the ignore threshold but short enough to be a visible freeze rather than a suspended tab. */
	freezeCount: number;
	freezeMs: number;
	inputMaxMs: number;
	inputSlowCount: number;
	lostMs: number;
	observedMs: number;
	topSource: string | null;
}

export interface PerfSourceStat {
	calls: number;
	maxMs: number;
	name: string;
	totalMs: number;
}

export interface PerfTotals {
	commitLagMaxMs: number;
	commitLagP95Ms: number;
	frameP95GapMs: number;
	freezeCount: number;
	freezeMs: number;
	inputMaxMs: number;
	inputP95Ms: number;
	/** Share of slow-input time spent after the handlers, on the rendering side. */
	inputPresentationShare: number;
	jankRatio: number;
	loaf: { renderMs: number; scriptMs: number; styleLayoutMs: number; topScripts: string[] } | null;
	longTaskCount: number | null;
	observedMs: number;
	stallMsPer10s: number;
	unaccountedShare: number;
	windows: number;
	worstTarget: string | null;
}

export interface ProbeLayerResult {
	/** Null when too few frames ran during the phase to tell. */
	jankRatio: number | null;
	lostMsPerS: number;
	name: string;
}

export interface ProbeResult {
	aborted: string | null;
	baselineLostMsPerS: number;
	culprit: string | null;
	layers: ProbeLayerResult[];
}

/** `evidence` holds the windows that triggered degraded (frozen once detected), otherwise the last 12 windows or fewer. */
export interface SessionPerf {
	evidence: PerfWindow[];
	probe: ProbeResult | null;
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
