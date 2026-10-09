declare global {
	const __CHANGELOG_VERSION__: string;

	namespace App {
		interface Error {
			message: string;
			/** Only filled in dev, so the error page shows the trace without it ever reaching players. */
			stack?: string;
		}
	}

	interface Window {
		dataLayer: unknown[];
		/** Google Identity Services, set once `https://accounts.google.com/gsi/client` loads. */
		google?: {
			accounts: {
				id: {
					initialize: (config: {
						callback: (response: { credential: string }) => void;
						client_id: string;
						context: 'signin' | 'signup' | 'use';
						itp_support: boolean;
						nonce: string;
						use_fedcm_for_prompt: boolean;
					}) => void;
					prompt: () => void;
				};
			};
		};
		gtag: (...args: unknown[]) => void;
	}
}

declare module 'svelte/elements' {
	interface SvelteWindowAttributes {
		/** Dispatched by the dev tools to spawn a Higgs Boson right away. */
		'onforce-bonus'?: (event: Event) => void;
	}
}

export {};
