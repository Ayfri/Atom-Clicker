import { plugin, Transpiler } from 'bun';
import { readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const shimUrl = (name: string) => fileURLToPath(new URL(`./shims/${name}.ts`, import.meta.url)).split(sep).join('/');

const VIRTUAL_MODULES: [RegExp, string][] = [
	[/(['"])\$app\/env\1/g, shimUrl('app-env')],
	[/(['"])\$app\/env\/public\1/g, shimUrl('app-env-public')],
];

const transpiler = new Transpiler({ loader: 'ts' });
/** Loaded on the first rune file only, so tests of plain modules skip the compiler startup. */
let compiler: Promise<typeof import('svelte/compiler')> | undefined;

/**
 * Bun resolves the `#` subpath imports on its own; SvelteKit's virtual modules and the rune compiler are what it cannot do.
 * Runtime plugins get no working `onResolve`, so the virtual specifiers are rewritten to shim paths in `onLoad` instead.
 */
plugin({
	name: 'svelte-runes',
	setup(build) {
		build.onLoad({ filter: /\.(ts|svelte)$/ }, async args => {
			// Nothing headless renders, and compiling the ~1900 @lucide/svelte icons would add seconds to every run.
			if (args.path.endsWith('.svelte') && args.path.includes('node_modules')) return { contents: 'export default function Component() {}', loader: 'js' };
			let source = readFileSync(args.path, 'utf8');
			for (const [pattern, replacement] of VIRTUAL_MODULES) source = source.replace(pattern, `'${replacement}'`);
			if (!args.path.endsWith('.svelte') && !args.path.endsWith('.svelte.ts')) return { contents: source, loader: 'ts' };

			const { compile, compileModule } = await (compiler ??= import('svelte/compiler'));
			// Components compile too, so headless code can import the helpers their module scripts export
			if (args.path.endsWith('.svelte')) return { contents: compile(source, { css: 'external', filename: args.path, generate: 'client' }).js.code, loader: 'js' };
			// compileModule only parses JS, so the types come off first.
			return { contents: compileModule(transpiler.transformSync(source), { filename: args.path, generate: 'client' }).js.code, loader: 'js' };
		});
	},
});
