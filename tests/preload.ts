import { plugin, Transpiler } from 'bun';
import { readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, compileModule } from 'svelte/compiler';

const shimUrl = (name: string) => fileURLToPath(new URL(`./shims/${name}.ts`, import.meta.url)).split(sep).join('/');

const VIRTUAL_MODULES: [RegExp, string][] = [
	[/(['"])\$app\/env\1/g, shimUrl('app-env')],
	[/(['"])\$app\/env\/public\1/g, shimUrl('app-env-public')],
];

const transpiler = new Transpiler({ loader: 'ts' });

/**
 * Bun resolves the `#` subpath imports on its own; SvelteKit's virtual modules and the rune compiler are what it cannot do.
 * Runtime plugins get no working `onResolve`, so the virtual specifiers are rewritten to shim paths in `onLoad` instead.
 */
plugin({
	name: 'svelte-runes',
	setup(build) {
		build.onLoad({ filter: /\.(ts|svelte)$/ }, args => {
			// Nothing headless renders, and compiling the ~1900 @lucide/svelte icons would add seconds to every run.
			if (args.path.endsWith('.svelte') && args.path.includes('node_modules')) return { contents: 'export default function Component() {}', loader: 'js' };
			let source = readFileSync(args.path, 'utf8');
			for (const [pattern, replacement] of VIRTUAL_MODULES) source = source.replace(pattern, `'${replacement}'`);
			// Components compile too, so headless code can import the helpers their module scripts export
			if (args.path.endsWith('.svelte')) return { contents: compile(source, { css: 'external', filename: args.path, generate: 'client' }).js.code, loader: 'js' };
			if (!args.path.endsWith('.svelte.ts')) return { contents: source, loader: 'ts' };

			// compileModule only parses JS, so the types come off first.
			const compiled = compileModule(transpiler.transformSync(source), { filename: args.path, generate: 'client' });
			return { contents: compiled.js.code, loader: 'js' };
		});
	},
});
