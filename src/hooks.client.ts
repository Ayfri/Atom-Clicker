import type { HandleClientError } from '@sveltejs/kit/hooks';
import { initGlobalErrorHandlers, reportError } from '#lib/helpers/errorReporting.js';
import { getItem, setItem } from '#lib/utils/safeLocalStorage.js';

initGlobalErrorHandlers();

/** A first visit loads its chunks before the service worker takes over, so their URLs are handed to it to make the game playable offline. */
if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
	navigator.serviceWorker.ready.then(({ active }) => active?.postMessage(performance.getEntriesByType('resource').map(({ name }) => name)));
}

/** Cloudflare Workers serves only the current build, so a tab left open across a deploy asks for a chunk that is gone. */
const STALE_CHUNK_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const RELOAD_GUARD_KEY = 'stale-chunk-reload';
const RELOAD_GUARD_WINDOW = 60_000;

let reloadAttempted = false;

/** Reloads once to pick up the new build, guarded on both sides so a genuinely broken chunk cannot loop. */
function recoverFromStaleChunk(): boolean {
	if (reloadAttempted) return false;
	reloadAttempted = true;

	const lastReload = Number(getItem(RELOAD_GUARD_KEY) ?? 0);
	if (Number.isFinite(lastReload) && Date.now() - lastReload < RELOAD_GUARD_WINDOW) return false;

	setItem(RELOAD_GUARD_KEY, String(Date.now()));
	location.reload();
	return true;
}

export const handleError: HandleClientError = async ({ error, kind }) => {
	// Errors thrown with `error(...)` are expected and keep their own status and message
	if (kind === 'app') return;
	if (kind === 'framework' && error.status === 404) return { message: 'Page not found' };

	const reported = error instanceof Error ? error : new Error(kind === 'framework' ? error.message : 'Unknown client error');
	if (STALE_CHUNK_PATTERN.test(reported.message) && recoverFromStaleChunk()) {
		return { message: 'A new version was deployed, reloading...' };
	}

	console.error('[Client Error]', error);
	await reportError(reported);

	return {
		message: 'An unexpected error occurred. The error has been reported.'
	};
};
