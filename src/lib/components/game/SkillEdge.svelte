<script lang="ts" module>
	import type { Attachment } from 'svelte/attachments';
	import { SKILL_NODE_SIZE } from '#data/skillTree.js';
	import type { SkillUpgrade } from '#lib/types.js';

	/** How long the liquid takes to flow from a skill into the one just bought, the node bursts when it arrives. */
	export const FILL_MS = 800;

	export type SkillLinkState = 'locked' | 'owned' | 'ready';

	interface Point {
		x: number;
		y: number;
	}

	export interface SkillLink {
		length: number;
		path: string;
		/** Corners of the path with each rounded turn cut into a chord, close enough for particles to follow. */
		points: Point[];
	}

	const BUBBLES = Array.from({ length: 9 }, (_, i) => ({
		dx: Math.random() * 8 - 4,
		dy: Math.random() * 8 - 4,
		r: 1.5 + Math.random() * 2.5,
		speed: 1 + i * 0.045,
	}));

	/**
	 * Right-angled link between two node centers that leaves along the longer axis and turns halfway on rounded corners.
	 * `u` runs along that axis and `v` across it.
	 */
	export function skillLink(from: SkillUpgrade, to: SkillUpgrade, radius = 28): SkillLink {
		const horizontal = Math.abs(to.position.x - from.position.x) > Math.abs(to.position.y - from.position.y);
		const axis = horizontal ? (['x', 'y', 'width', 'height'] as const) : (['y', 'x', 'height', 'width'] as const);
		const [su, sv, tu, tv] = [from.position[axis[0]], from.position[axis[1]], to.position[axis[0]], to.position[axis[1]]];
		const [cu, cv] = [SKILL_NODE_SIZE[axis[2]] / 2, SKILL_NODE_SIZE[axis[3]] / 2];
		const point = (u: number, v: number): Point => (horizontal ? { x: u + cu, y: v + cv } : { x: v + cv, y: u + cu });
		const svg = ({ x, y }: Point) => `${x},${y}`;
		const mid = (su + tu) / 2;
		const r = Math.min(radius, Math.abs(tu - su) / 2, Math.abs(tv - sv) / 2);
		const du = Math.sign(tu - su) * r;
		const dv = Math.sign(tv - sv) * r;
		const points =
			r < 1
				? [point(su, sv), point(tu, tv)]
				: [point(su, sv), point(mid - du, sv), point(mid, sv + dv), point(mid, tv - dv), point(mid + du, tv), point(tu, tv)];
		const path =
			r < 1
				? `M${svg(points[0])}L${svg(points[1])}`
				: `M${svg(points[0])}L${svg(points[1])}Q${svg(point(mid, sv))} ${svg(points[2])}L${svg(points[3])}Q${svg(point(mid, tv))} ${svg(points[4])}L${svg(points[5])}`;
		const length = points.slice(1).reduce((sum, { x, y }, i) => sum + Math.hypot(x - points[i].x, y - points[i].y), 0);
		return { length, path, points };
	}

	/**
	 * Loops an element along a link with a transform-only Web Animation, which the compositor runs without repainting the links.
	 * `speed` is in px/s, `phase` (0 to 1) spreads several particles along the same link.
	 */
	export function flowAlong({ length, points }: SkillLink, speed: number, phase: number): Attachment<HTMLElement> {
		return element => {
			let travelled = 0;
			const keyframes = points.map((point, i) => {
				if (i > 0) travelled += Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y);
				return { offset: travelled / length, transform: `translate(${point.x}px, ${point.y}px)` };
			});
			const duration = (length / speed) * 1000;
			const animation = element.animate(keyframes, { delay: -phase * duration, duration, iterations: Infinity });
			return () => animation.cancel();
		};
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		color: string;
		/** Delay before the link draws in, only read when it mounts. */
		enterDelay: number;
		path: string;
		state: SkillLinkState;
	}

	let { color, enterDelay, path, state }: Props = $props();

	/** Bought while the tree is open: the liquid flows in, otherwise it draws in with the rest of the tree. */
	const ownedAtMount = untrack(() => state === 'owned');
	const filled = $derived(state === 'owned' && !ownedAtMount);
	const liquidAnimation = $derived(
		filled
			? 'animate-[skill-draw_var(--fill)_cubic-bezier(0.45,0,0.25,1)_backwards]'
			: 'motion-safe:animate-[skill-draw_700ms_ease-out_var(--delay)_backwards]',
	);

	const begin = (element: SVGAnimationElement) => element.beginElement();
</script>

<!-- Nothing here loops: the links share one large SVG, so any endless animation in it would repaint all of them every frame. -->
<g class="fill-none" stroke-linecap="round" style:--c={color} style:--delay="{enterDelay}ms" style:--fill="{FILL_MS}ms">
	<path
		class="stroke-accent-800 stroke-6 [stroke-dasharray:1] motion-safe:animate-[skill-draw_700ms_ease-out_var(--delay)_backwards]"
		d={path}
		pathLength="1"
	/>
	{#if state === 'ready'}
		<path
			class="stroke-(color:--c) stroke-3 opacity-55 [stroke-dasharray:10_14] motion-safe:animate-[skill-appear_500ms_ease-out_var(--delay)_backwards]"
			d={path}
		/>
	{:else if state === 'owned'}
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
	{/if}
</g>
