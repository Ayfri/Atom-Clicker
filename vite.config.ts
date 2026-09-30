import { sveltekit } from '@sveltejs/kit/vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { loadEnv, defineConfig, type Plugin } from 'vite';

/** The newest changelog heading, so the Settings dot knows about unread changes without fetching the file. */
const changelogVersion = readFileSync('static/Changelog.md', 'utf8').match(/^# (.+)$/m)?.[1].trim() ?? '';

/**
 * Workaround for https://github.com/sveltejs/kit/issues/12394.
 * Rolldown's worker bundler skips SvelteKit's plugin chain, so `__sveltekit/environment`
 * and `$env/*` are unresolvable. Shims them with safe defaults (workers are always
 * browser-side, never auth/env-aware).
 */
function skitWorkerShim(publicEnv: Record<string, string>): Plugin {
	const publicEnvExports =
		Object.entries(publicEnv)
			.filter(([k]) => k.startsWith('PUBLIC_'))
			.map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`)
			.join('\n') || `export {};`;

	return {
		name: 'sveltekit-worker-shim',
		resolveId(id) {
			if (id === '__sveltekit/environment' || id.startsWith('$env/')) return `\0sveltekit-shim:${id}`;
		},
		load(id) {
			if (id === '\0sveltekit-shim:__sveltekit/environment') {
				return `export const browser = true; export const building = false; export const dev = false; export const version = '';`;
			}
			if (id === '\0sveltekit-shim:$env/static/public' || id === '\0sveltekit-shim:$env/dynamic/public') {
				return publicEnvExports;
			}
			if (id.startsWith('\0sveltekit-shim:$env/')) {
				return `export {};`;
			}
		},
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		define: { __CHANGELOG_VERSION__: JSON.stringify(changelogVersion) },
		plugins: [tailwindcss(), sveltekit()],
		worker: {
			// `svelte()` is also needed here so .svelte files pulled in transitively (e.g. icon
			// components imported by data files) compile instead of being parsed as plain JS.
			plugins: () => [skitWorkerShim(env), svelte({ preprocess: vitePreprocess() })],
		},
	};
});
