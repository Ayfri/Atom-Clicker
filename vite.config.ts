import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/** The newest changelog heading, so the Settings dot knows about unread changes without fetching the file. */
const changelogVersion = readFileSync('static/Changelog.md', 'utf8').match(/^# (.+)$/m)?.[1].trim() ?? '';

export default defineConfig({
	define: { __CHANGELOG_VERSION__: JSON.stringify(changelogVersion) },
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			preprocess: vitePreprocess(),
			version: {
				// A tab left open across a deploy asks Cloudflare for a chunk hash that no longer exists
				pollInterval: 300_000,
			},
		}),
	],
	worker: {
		// `svelte()` is also needed here so .svelte files pulled in transitively (e.g. icon
		// components imported by data files) compile instead of being parsed as plain JS.
		plugins: () => [svelte({ preprocess: vitePreprocess() })],
	},
});
