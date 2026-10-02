<script lang="ts">
	import { ICONS, type IconName } from '#data/icons.js';
	import { MAX_STACK_COUNT } from '#helpers/iconStacks.js';

	interface Props {
		class?: string;
		color?: string;
		count?: number;
		icon: IconName;
		label?: string;
		size?: number;
	}

	let { class: className = '', color = '#ffffff', count = 1, icon, label, size = 40 }: Props = $props();

	interface StackLayout {
		positions: { x: number; y: number }[];
		scale: number;
	}

	// Positions and scales are fractions of the container, so a stack always occupies the same footprint
	// whatever `size` is: one full-size icon, two fanned on a diagonal, three arranged as a triangle.
	// Copies are drawn back to front, so the last position is the one on top.
	const LAYOUTS: Record<number, StackLayout> = {
		1: { positions: [{ x: 0, y: 0 }], scale: 1 },
		2: { positions: [{ x: 0.3, y: 0 }, { x: 0, y: 0.3 }], scale: 0.7 },
		3: { positions: [{ x: 0.21, y: 0 }, { x: 0.42, y: 0.42 }, { x: 0, y: 0.42 }], scale: 0.58 },
	};

	const stackCount = $derived(Math.min(Math.max(Math.round(count), 1), MAX_STACK_COUNT));
	const layout = $derived(LAYOUTS[stackCount]);
	const Icon = $derived(ICONS[icon]);
	// A label needs a free bottom-right corner, so the stack shrinks slightly to make room for it.
	const stackScale = $derived(label ? 0.76 : 1);
	const iconSize = $derived(size * layout.scale * stackScale);
	const labelSize = $derived(Math.max(9, Math.round(size * 0.28)));
</script>

<span
	class="relative inline-block shrink-0 align-middle {className}"
	style:height="{size}px"
	style:width="{size}px"
>
	{#each layout.positions as position, index (index)}
		<span
			class="icon-layer absolute"
			style:left="{position.x * size * stackScale}px"
			style:opacity={index === layout.positions.length - 1 ? 1 : 0.82}
			style:top="{position.y * size * stackScale}px"
		>
			<Icon {color} size={iconSize} />
		</span>
	{/each}

	{#if label}
		<span
			class="absolute -right-0.5 -bottom-0.5 rounded-md border bg-neutral-950/90 px-1 font-mono font-bold leading-[1.35] tabular-nums"
			style:border-color="{color}66"
			style:color
			style:font-size="{labelSize}px"
		>
			{label}
		</span>
	{/if}
</span>

<style>
	/* Dark halo so overlapping copies stay readable on any background, without needing an opaque backdrop. */
	.icon-layer {
		filter: drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.85)) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
	}
</style>
