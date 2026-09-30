/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
import { build, files } from '$service-worker';

const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

/**
 * Chunks are cached as pages request them rather than precached, so players never download the Cosmos or benchmark code they don't open.
 * Hashed chunks never change, so they stay cached across deploys and only the ones gone from the build get pruned.
 */
const IMMUTABLE_CACHE = 'immutable';
/** The game shell and static files always come from the network first, this cache only serves them offline. */
const STATIC_CACHE = 'static';

const buildPaths = new Set(build);
const staticPaths = new Set(['/', ...files]);

async function prune(cacheName: string, keep: Set<string>): Promise<void> {
	const cache = await caches.open(cacheName);
	const stale = (await cache.keys()).filter(request => !keep.has(new URL(request.url).pathname));
	await Promise.all(stale.map(request => cache.delete(request)));
}

async function fromNetwork(event: FetchEvent, cacheName: string, key: string): Promise<Response> {
	const response = await fetch(event.request);
	const storable = response.status === 200 && !response.headers.get('cache-control')?.includes('no-store');
	if (storable) event.waitUntil(caches.open(cacheName).then(cache => cache.put(key, response.clone())));
	return response;
}

self.addEventListener('install', event => {
	event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
	event.waitUntil(Promise.all([prune(IMMUTABLE_CACHE, buildPaths), prune(STATIC_CACHE, staticPaths)]).then(() => self.clients.claim()));
});

/** Receives the resources a page loaded before this worker controlled it, the chunks among them get cached for offline play. */
self.addEventListener('message', event => {
	const urls: unknown = event.data;
	if (!Array.isArray(urls)) return;
	const paths = urls.map(url => new URL(String(url)).pathname).filter(path => buildPaths.has(path));
	event.waitUntil(caches.open(IMMUTABLE_CACHE).then(cache => cache.addAll(paths)));
});

self.addEventListener('fetch', event => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	if (buildPaths.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then(cached => cached ?? fromNetwork(event, IMMUTABLE_CACHE, url.pathname)));
		return;
	}

	// Other routes hydrate with their own nodes, so only the game itself falls back to the cached shell
	const cacheable = request.mode === 'navigate' ? url.pathname === '/' : staticPaths.has(url.pathname);
	if (!cacheable) return;

	event.respondWith(
		fromNetwork(event, STATIC_CACHE, url.pathname).catch(async (error: unknown) => {
			const cached = await caches.match(url.pathname);
			if (cached) return cached;
			throw error;
		}),
	);
});
