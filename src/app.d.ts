declare global {
	const __CHANGELOG_VERSION__: string;

	interface Window {
		dataLayer: unknown[];
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
