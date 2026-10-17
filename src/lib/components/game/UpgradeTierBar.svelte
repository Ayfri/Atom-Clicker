<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';

	interface Props {
		/** Whether the balance pays for the next level, which outlines its segment in the currency color. */
		affordable: boolean;
		/** Fill of the bought segments, the cost currency color. */
		color: string;
		hasNext: boolean;
		level: number;
		/** Open levels only: a closed level has no segment. */
		segments: number;
	}

	let { affordable, color, hasNext, level, segments }: Props = $props();

	let bar = $state<HTMLDivElement>();
	let seen = -1;

	/** Segments fill in the purchase frame, so spam clicks never see a fill catching up. Each newly filled one flashes on its own animation. */
	$effect(() => {
		const before = seen;
		seen = level;
		if (before < 0 || level <= before || !bar || prefersReducedMotion.current) return;
		for (let i = before; i < level; i++) bar.children[i]?.animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 250 });
	});
</script>

<div bind:this={bar} class="mt-1.5 flex h-1.5 overflow-hidden rounded-full {segments > 20 ? 'gap-px' : 'gap-0.5'}" style:--c={color}>
	{#each { length: segments } as _, i (i)}
		<div
			class="flex-1 {i < level
				? 'bg-(--c) opacity-80'
				: i === level && hasNext
					? affordable
						? 'bg-(--c)/30 inset-ring-1 inset-ring-(--c)'
						: 'bg-white/10 inset-ring-1 inset-ring-white/25'
					: 'bg-white/10'}"
		></div>
	{/each}
</div>
