import type { CosmosScene } from './CosmosScene.svelte.js';

const STARTUP_BENCH_KEY = 'cosmos-startup-bench';

interface StartupBench {
	left: number;
	runs: { measures: Record<string, number>; variant: string }[];
	/** Surfaces each variant draws from their shaders instead of their baked maps, the runs alternate between variants. */
	variants: Record<string, string[]>;
}

const pendingStartupBench = () => JSON.parse(sessionStorage.getItem(STARTUP_BENCH_KEY) ?? 'null') as StartupBench | null;
const startupVariant = ({ runs, variants }: StartupBench) => Object.keys(variants)[runs.length % Object.keys(variants).length];

/** Surfaces drawn from their shaders: the startup benchmark's variant, else the followed object so an edit shows on reload. Never the Earth, too slow to compile. */
export function liveSurfaces(focus: string | undefined): string[] {
	const bench = pendingStartupBench();
	if (bench) return bench.variants[startupVariant(bench)];
	return focus && focus !== 'earth' ? [focus] : [];
}

/** The open Cosmos scene, so the DevTools panel can reach it. */
export const cosmosDev = $state<{ scene: CosmosScene | null }>({ scene: null });

/** Writes every surface map to `static/cosmos/` through the dev server, then reloads onto them. */
export async function bakeCosmos(scene: CosmosScene) {
	const form = new FormData();
	for (const { blob, id } of await scene.bakeSurfaces()) form.append(id, blob);
	await fetch('/__cosmos-bake', { body: form, method: 'POST' });
	location.reload();
}

/** Reloads `runs` times alternating variants and tables the mean of each `cosmos:*` startup measure, the first, cold run left out. */
export function startCosmosStartupBench(runs = 10, variants: Record<string, string[]> = { current: [] }) {
	sessionStorage.setItem(STARTUP_BENCH_KEY, JSON.stringify({ left: runs, runs: [], variants } satisfies StartupBench));
	location.reload();
}

/**
 * Dev console tools, also in the DevTools Cosmos tab. The Cosmos reopens on reload so the startup benchmark keeps running:
 * - `cosmosScene.bench(options?)` times the rendering variants
 * - `cosmosStartupBench(runs, variants?)`, see `startCosmosStartupBench`
 * - `cosmosBake()`, see `bakeCosmos`
 * - `cosmosGuestStar()` flares a guest star now, false while one is up or the view isn't a settled overview
 * Returns the uninstall to call when the scene is disposed.
 * @example cosmosStartupBench(21, { baked: [], live: ['sky', 'sun'] })
 */
export function installDevTools(scene: CosmosScene): () => void {
	const pending = pendingStartupBench();
	if (pending) {
		const measures = Object.fromEntries(performance.getEntriesByType('measure').flatMap(({ duration, name }) => (name.startsWith('cosmos:') ? [[name.slice(7), duration]] : [])));
		pending.runs.push({ measures, variant: startupVariant(pending) });
		if (--pending.left > 0) {
			sessionStorage.setItem(STARTUP_BENCH_KEY, JSON.stringify(pending));
			location.reload();
			return () => {};
		}
		sessionStorage.removeItem(STARTUP_BENCH_KEY);
		const warm = pending.runs.slice(1);
		const table = Object.keys(pending.variants).map(variant => {
			const runs = warm.filter(run => run.variant === variant);
			const means = Object.keys(runs[0]?.measures ?? {}).map(name => [name, Math.round(runs.reduce((sum, run) => sum + run.measures[name], 0) / runs.length)]);
			return { runs: runs.length, variant, ...Object.fromEntries(means) };
		});
		console.table(table);
		Object.assign(window, { cosmosStartupResult: { runs: pending.runs, table } });
	}
	Object.assign(window, { cosmosBake: () => bakeCosmos(scene), cosmosGuestStar: () => scene.spawnGuestStar(), cosmosScene: scene, cosmosStartupBench: startCosmosStartupBench });
	cosmosDev.scene = scene;
	return () => {
		if (cosmosDev.scene === scene) cosmosDev.scene = null;
	};
}
