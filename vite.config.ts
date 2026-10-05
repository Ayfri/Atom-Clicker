import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';

/** The newest changelog heading, so the Settings dot knows about unread changes without fetching the file. */
const changelogVersion = readFileSync('static/Changelog.md', 'utf8').match(/^# (.+)$/m)?.[1].trim() ?? '';

/** Dev server only: `cosmosBake()` in the console posts the planet surfaces it baked here, they are written to `static/cosmos/<id>.webp`. */
const cosmosBake: Plugin = {
	apply: 'serve',
	configureServer(server) {
		server.middlewares.use('/__cosmos-bake', async (request, response) => {
			const id = new URL(request.url ?? '', 'http://localhost').searchParams.get('id');
			if (request.method !== 'POST' || !id || !/^[a-z_]+$/.test(id)) {
				response.statusCode = 400;
				return response.end();
			}
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(chunk as Buffer);
			await mkdir('static/cosmos', { recursive: true });
			await writeFile(`static/cosmos/${id}.webp`, Buffer.concat(chunks));
			response.end();
		});
	},
	name: 'cosmos-bake',
};

export default defineConfig({
	define: { __CHANGELOG_VERSION__: JSON.stringify(changelogVersion) },
	plugins: [
		cosmosBake,
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
