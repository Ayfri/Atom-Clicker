import { flushSync } from 'svelte';

/**
 * Svelte only marks a derived CONNECTED when it is first read from inside an effect; a derived read from plain code
 * never gets that flag, so `is_dirty` walks its whole dependency tree on every single read instead of caching CLEAN.
 * Holding one effect that reads every derived of the manager singletons connects the graph for the rest of the process.
 */
export function connectDeriveds(targets: object[]): () => void {
	const stop = $effect.root(() => {
		$effect.pre(() => {
			for (const target of targets) {
				const prototype = Object.getPrototypeOf(target) as object;
				for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(prototype))) {
					if (!descriptor.get) continue;
					try {
						(target as Record<string, unknown>)[key];
					} catch {
						// A getter that needs the browser is not a derived worth connecting.
					}
				}
			}
		});
	});

	flushSync();
	return stop;
}
