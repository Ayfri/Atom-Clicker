import { afterEach, describe, expect, test } from 'bun:test';
import { APP_DISPLAY_QUERY, detectInAppBrowser, isInstalledApp, isUuid } from '#helpers/clientInfo.js';

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const IOS_WEBVIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

describe('detectInAppBrowser', () => {
	test('TikTok on iOS and Android', () => {
		expect(detectInAppBrowser(`${IOS_WEBVIEW} musical_ly_39.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US`)).toBe('tiktok');
		expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 BytedanceWebview/d8a21c6')).toBe('tiktok');
	});

	test('Instagram, Facebook, Snapchat, LinkedIn, WeChat, Twitter and Line', () => {
		expect(detectInAppBrowser(`${IOS_WEBVIEW} Instagram 350.0.0.20.100 (iPhone15,2; iOS 18_6)`)).toBe('instagram');
		expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.40.100;]')).toBe('facebook');
		expect(detectInAppBrowser(`${IOS_WEBVIEW} [FBAN/FBIOS;FBAV/480.0.0.40.100;FBBV/1;FBDV/iPhone15,2]`)).toBe('facebook');
		expect(detectInAppBrowser(`${IOS_WEBVIEW} Snapchat/12.80.0.30 (iPhone15,2; iOS 18.6; gzip)`)).toBe('snapchat');
		expect(detectInAppBrowser(`${IOS_WEBVIEW} LinkedInApp`)).toBe('linkedin');
		expect(detectInAppBrowser(`${IOS_WEBVIEW} MicroMessenger/8.0.50 NetType/WIFI Language/en`)).toBe('wechat');
		expect(detectInAppBrowser(`${IOS_WEBVIEW} Twitter for iPhone`)).toBe('twitter');
		expect(detectInAppBrowser(`${IOS_SAFARI} Line/14.0.0`)).toBe('line');
	});

	test('an Android WebView and an iOS web view without Safari are generic webviews', () => {
		expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36')).toBe('other-webview');
		expect(detectInAppBrowser(IOS_WEBVIEW)).toBe('other-webview');
	});

	test('a home screen app on iOS is not a webview', () => {
		expect(detectInAppBrowser(IOS_WEBVIEW, true)).toBeNull();
	});

	test('real browsers are not in-app browsers', () => {
		expect(detectInAppBrowser(IOS_SAFARI)).toBeNull();
		expect(detectInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1')).toBeNull();
		expect(detectInAppBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')).toBeNull();
		expect(detectInAppBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0')).toBeNull();
	});
});

describe('isInstalledApp', () => {
	const original = { matchMedia: globalThis.matchMedia, navigator: globalThis.navigator };

	/** The browser evaluates the whole app query as one: it matches when the page is in any of its display modes. */
	function stub(inAppDisplayMode: boolean, standalone?: boolean) {
		globalThis.matchMedia = ((query: string) => ({ matches: query === APP_DISPLAY_QUERY && inAppDisplayMode })) as typeof matchMedia;
		Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { standalone } });
	}

	afterEach(() => {
		globalThis.matchMedia = original.matchMedia;
		Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original.navigator });
	});

	test('a page in an app display mode is the app', () => {
		stub(true);
		expect(isInstalledApp()).toBe(true);
		for (const mode of ['standalone', 'minimal-ui', 'window-controls-overlay']) expect(APP_DISPLAY_QUERY).toContain(`(display-mode: ${mode})`);
	});

	test('the iOS home screen app only has navigator.standalone', () => {
		stub(false, true);
		expect(isInstalledApp()).toBe(true);
	});

	test('a browser tab, fullscreen included, is not the app', () => {
		stub(false);
		expect(isInstalledApp()).toBe(false);
		stub(false, false);
		expect(isInstalledApp()).toBe(false);
		expect(APP_DISPLAY_QUERY).not.toContain('fullscreen');
	});
});

describe('isUuid', () => {
	test('accepts a v4 UUID only', () => {
		expect(isUuid('3f2b8c1e-4d5a-4e6f-9a7b-1c2d3e4f5a6b')).toBe(true);
		expect(isUuid('fallback-lx3k9-ab12cd34')).toBe(false);
		expect(isUuid('')).toBe(false);
		expect(isUuid(42)).toBe(false);
		expect(isUuid(null)).toBe(false);
	});
});
