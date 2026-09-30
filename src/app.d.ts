// See https://kit.svelte.dev/docs/types#app
declare global {
	const __CHANGELOG_VERSION__: string;

	namespace App {
		interface Platform {
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & {
				default: Cache
			}
		}
	}

	interface Window {
		dataLayer: unknown[];
		gtag: (...args: unknown[]) => void;
	}

	namespace NodeJS {
		interface ProcessEnv {
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
			PUBLIC_SUPABASE_URL: string;
			SUPABASE_SECRET_KEY: string;
		}
	}
}

declare module 'svelte/elements' {
	interface SvelteWindowAttributes {
		/** Dispatched by the dev tools to spawn a Higgs Boson right away. */
		'onforce-bonus'?: (event: Event) => void;
	}
}

export {};
