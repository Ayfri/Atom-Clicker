import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			'@': 'src/*',
			'@components': 'src/lib/components/*',
			'$data': 'src/lib/data/*',
			'$helpers': 'src/lib/helpers/*',
			'$stores': 'src/lib/stores/*',
		},
		version: {
			// A tab left open across a deploy asks Cloudflare for a chunk hash that no longer exists
			pollInterval: 300_000,
		},
	},
	preprocess: vitePreprocess(),
};

export default config;
