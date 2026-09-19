// See https://kit.svelte.dev/docs/types#app
declare global {
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

export {};
