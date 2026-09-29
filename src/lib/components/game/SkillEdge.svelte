<script lang="ts" module>
	/** How long the liquid takes to flow from a skill into the one just bought, the node bursts when it arrives. */
	export const FILL_MS = 800;

	export interface SkillEdgeData {
		color: string;
		enterDelay: number;
		state: 'locked' | 'owned' | 'ready';
	}

	const BUBBLES = Array.from({ length: 9 }, (_, i) => ({
		dx: Math.random() * 8 - 4,
		dy: Math.random() * 8 - 4,
		r: 1.5 + Math.random() * 2.5,
		speed: 1 + i * 0.045,
	}));

	const MOTES = [0, 1, 2];
</script>

<script lang="ts">
	import { getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { untrack } from 'svelte';

	let { data, sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY }: EdgeProps = $props();

	const edge = $derived(data as unknown as SkillEdgeData);
	const enterDelay = untrack(() => edge.enterDelay);
	const owned = $derived(edge.state === 'owned');
	const path = $derived(getSmoothStepPath({ borderRadius: 28, sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY })[0]);

	/** Bought while the tree is open: the liquid flows in, otherwise it draws in with the rest of the tree. */
	const ownedAtMount = untrack(() => owned);
	const filled = $derived(owned && !ownedAtMount);
	const liquidAnimation = $derived(
		filled
			? 'animate-[skill-draw_var(--fill)_cubic-bezier(0.45,0,0.25,1)_backwards]'
			: 'motion-safe:animate-[skill-draw_700ms_ease-out_var(--delay)_backwards]',
	);

	const begin = (element: SVGAnimationElement) => element.beginElement();
</script>

<g class="fill-none" stroke-linecap="round" style:--c={edge.color} style:--delay="{enterDelay}ms" style:--fill="{FILL_MS}ms">
	<path
		class="stroke-accent-800 stroke-6 [stroke-dasharray:1] motion-safe:animate-[skill-draw_700ms_ease-out_var(--delay)_backwards]"
		d={path}
		pathLength="1"
	/>
	{#if edge.state === 'ready'}
		<path
			class="stroke-(color:--c) stroke-3 opacity-55 [stroke-dasharray:10_14] motion-safe:animate-[skill-appear_500ms_ease-out_var(--delay)_backwards,skill-march_1.2s_linear_infinite]"
			d={path}
		/>
	{:else if owned}
		<path class={['stroke-(color:--c) stroke-16 opacity-22 [stroke-dasharray:1]', liquidAnimation]} d={path} pathLength="1" />
		<path class={['stroke-(color:--c) stroke-6 [stroke-dasharray:1]', liquidAnimation]} d={path} pathLength="1" />
		{#if filled}
			<!-- A bright short dash riding the fill front, the liquid's meniscus. -->
			<path
				class="animate-[skill-head_var(--fill)_cubic-bezier(0.45,0,0.25,1)_forwards,skill-appear_300ms_ease-in_var(--fill)_reverse_forwards] stroke-white stroke-8 [stroke-dasharray:0.04_2]"
				d={path}
				pathLength="1"
			/>
			{#each BUBBLES as { dx, dy, r, speed }, i (i)}
				<g transform="translate({dx} {dy})">
					<circle
						class="animate-[skill-bubble-pop_350ms_ease-out_calc(var(--fill)*var(--speed))_forwards] fill-[color-mix(in_oklab,var(--c)_45%,white)]"
						{r}
						style:--speed={speed}
					>
						<animateMotion
							{@attach begin}
							begin="indefinite"
							calcMode="spline"
							dur="{FILL_MS * speed}ms"
							fill="freeze"
							keySplines="0.45 0 0.25 1"
							keyTimes="0;1"
							{path}
						/>
					</circle>
				</g>
			{/each}
		{/if}
		{#if !prefersReducedMotion.current}
			{#each MOTES as i (i)}
				<circle
					class={[
						'fill-[color-mix(in_oklab,var(--c)_35%,white)] opacity-85',
						filled && 'animate-[skill-appear_400ms_calc(var(--fill)*1.5)_backwards]',
					]}
					r="2.5"
				>
					<animateMotion begin="-{i}s" dur="3s" {path} repeatCount="indefinite" />
				</circle>
			{/each}
		{/if}
	{/if}
</g>
