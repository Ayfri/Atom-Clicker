<script lang="ts">
	import { BLUEPRINTS } from '#components/cosmos/blueprints.js';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		class?: ClassValue;
		id: string;
		progress: number;
	}

	let { class: className, id, progress }: Props = $props();

	const paths = $derived(BLUEPRINTS[id] ?? []);
</script>

<!-- The 1 s transition matches the tick that moves `progress`. -->
<span
	class={[
		'grid shrink-0 place-items-center overflow-hidden rounded-lg bg-cosmos-sky/80 ring-1 ring-cosmos-workshop/30 [background-image:linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:6px_6px]',
		className,
	]}
	aria-hidden="true"
>
	<svg
		class="size-full p-[8%]"
		fill="none"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="1.5"
		viewBox="0 0 24 24"
	>
		<g class="stroke-white/10">
			{#each paths as d, i (i)}
				<path {d} />
			{/each}
		</g>
		<g class="stroke-cosmos-workshop">
			{#each paths as d, i (i)}
				<path
					class="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
					{d}
					pathLength="1"
					stroke-dasharray="1"
					stroke-dashoffset={1.01 * (1 - Math.min(1, Math.max(0, progress * paths.length - i)))}
				/>
			{/each}
		</g>
	</svg>
</span>
