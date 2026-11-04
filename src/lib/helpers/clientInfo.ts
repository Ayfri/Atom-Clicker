import { browser, version } from '$app/env';
import type { DeviceInfo, InAppBrowser } from '#lib/types/session.js';
import { prefersReducedMotion } from 'svelte/motion';

/** Client context, stored as `browser_info`, everything here identifies the runtime rather than the player. */
export interface BrowserInfo {
	/** SvelteKit build id, so a report can be tied back to the deploy that produced it. */
	appVersion: string;
	language: string;
	screenHeight: number;
	screenWidth: number;
	/** Groups every report coming from the same page load. */
	sessionId: string;
	userAgent: string;
}

/** Also the page speed probes (Cloudflare Observatory, Lighthouse) and read-aloud fetchers, which load the game without a player. */
const CRAWLER_UA_PATTERN = /bot|crawler|spider|crawling|bingpreview|slurp|headlesschrome|observatory|lighthouse|read-aloud/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Display modes an installed app opens in. Fullscreen is left out because a fullscreen browser tab can match it. */
export const APP_DISPLAY_QUERY = '(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)';

/** Named in-app browsers first, the generic webview checks last since they match all of them. */
const IN_APP_BROWSERS: [InAppBrowser, RegExp][] = [
	['tiktok', /musical_ly|BytedanceWebview|TikTok/i],
	['instagram', /Instagram/],
	['facebook', /FBAN|FBAV|FB_IAB|FBIOS/],
	['snapchat', /Snapchat/],
	['twitter', /Twitter/],
	['linkedin', /LinkedInApp/],
	['line', /\bLine\//],
	['wechat', /MicroMessenger/],
];

function createSessionId(): string {
	if (!browser) return '';

	try {
		return crypto.randomUUID();
	} catch {
		return `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	}
}

export const SESSION_ID = createSessionId();

/** A bot hitting a dead chunk or a broken page is not actionable. */
export function isCrawler(): boolean {
	return browser && CRAWLER_UA_PATTERN.test(navigator.userAgent);
}

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** iOS has no `wv` marker: an embedded WKWebView simply lacks the `Safari/` token of the real browser, which a home screen app lacks too. */
export function detectInAppBrowser(userAgent: string, standalone = false): InAppBrowser | null {
	for (const [name, pattern] of IN_APP_BROWSERS) {
		if (pattern.test(userAgent)) return name;
	}
	if (/Android/.test(userAgent) && /; wv\)/.test(userAgent)) return 'other-webview';
	if (/iPhone|iPad|iPod/.test(userAgent) && !/Safari\//.test(userAgent) && !standalone) return 'other-webview';
	return null;
}

export function getBrowserInfo(): BrowserInfo | null {
	if (!browser) return null;

	return {
		appVersion: version,
		language: navigator.language,
		screenHeight: window.screen.height,
		screenWidth: window.screen.width,
		sessionId: SESSION_ID,
		userAgent: navigator.userAgent
	};
}

/** A browser that installs the game from its own menu, as no `beforeinstallprompt` ever fires there. */
export type ManualInstall = 'firefox' | 'ios' | 'safari';

/**
 * Only browsers whose installed window `isInstalledApp()` recognizes, so the steps always lead to the bonus: a Firefox 143+ taskbar
 * tab on Windows reports `minimal-ui`, a Safari 17+ Dock app on macOS `standalone`, an iOS home screen app `navigator.standalone`.
 * iPadOS reports a Mac user agent and is told apart by its touch points, the `Safari/` token leaving out iPad web views. Safari's user
 * agent freezes macOS at 10.15, so Safari 17 and 18 on Ventura and older, which have no Add to Dock, get steps naming Sonoma.
 */
export function detectManualInstall(userAgent: string, maxTouchPoints: number): ManualInstall | null {
	if (detectInAppBrowser(userAgent)) return null;
	if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1 && /Safari\//.test(userAgent))) return 'ios';
	if (/Windows/.test(userAgent) && Number(/Firefox\/(\d+)/.exec(userAgent)?.[1]) >= 143) return 'firefox';
	if (/Macintosh/.test(userAgent) && Number(/Version\/(\d+)[\d.]* Safari\//.exec(userAgent)?.[1]) >= 17) return 'safari';
	return null;
}

/** `navigator.standalone` is the iOS home screen app, which has no display-mode query. */
export function isInstalledApp(): boolean {
	return matchMedia(APP_DISPLAY_QUERY).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function getDeviceInfo(): DeviceInfo | null {
	const info = getBrowserInfo();
	if (!info) return null;

	const standalone = isInstalledApp();

	return {
		...info,
		cores: navigator.hardwareConcurrency || null,
		inAppBrowser: detectInAppBrowser(info.userAgent, standalone),
		maxTouchPoints: navigator.maxTouchPoints,
		memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
		pixelRatio: window.devicePixelRatio,
		reducedMotion: prefersReducedMotion.current,
		standalone,
		viewportHeight: window.innerHeight,
		viewportWidth: window.innerWidth
	};
}
