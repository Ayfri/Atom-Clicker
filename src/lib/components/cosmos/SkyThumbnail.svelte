<script lang="ts">
	import { DEEP_MAPS, skyThumbnails } from '#components/cosmos/SkyThumbnails.svelte.js';

	interface Props {
		color: string;
		id: string;
		small?: boolean;
	}

	let { color, id, small = false }: Props = $props();

	/** Saturn's rings from the outside in (A, then B past the Cassini Division), in pixels of a 32 x 32 box. */
	const SATURN_RINGS = [
		{ rx: 14.7, ry: 4.6, stroke: '#a9a59d', width: 1.1 },
		{ rx: 12.5, ry: 3.9, stroke: '#d8d2c4', width: 2.5 },
	] as const;
	const URANUS_RINGS = [10.5, 11.5, 12.5, 13] as const;

	let ready = $state(false);

	const flat = $derived(id in DEEP_MAPS);
	const size = $derived(small ? 24 : 32);
	const radius = $derived(id === 'saturn' ? size * 0.32 : size / 2);
</script>

{#snippet saturnRings(half: 'back' | 'both' | 'front', disc = false)}
	<svg
		class="absolute inset-0 size-full"
		fill="none"
		viewBox="0 0 32 32"
	>
		{#if disc}
			<circle
				cx="16"
				cy="16"
				fill="#c9a96b"
				opacity="0.35"
				r="9"
			/>
		{/if}
		<g transform="rotate(-20 16 16)">
			{#each SATURN_RINGS as { rx, ry, stroke, width } (stroke)}
				{#if half === 'both'}
					<ellipse
						cx="16"
						cy="16"
						{rx}
						{ry}
						{stroke}
						opacity="0.8"
						stroke-width={width}
					/>
				{:else}
					<path
						d="M {16 - rx} 16 A {rx} {ry} 0 0 {half === 'back' ? 1 : 0} {16 + rx} 16"
						{stroke}
						opacity="0.8"
						stroke-width={width}
					/>
				{/if}
			{/each}
		</g>
	</svg>
{/snippet}

<span
	class={[
		'relative grid shrink-0 place-items-center',
		small ? 'size-6' : 'size-8',
		ready && id === 'earth' && 'rounded-full shadow-[0_0_3px_1px_#6fb0ff59]',
		ready && flat && 'overflow-hidden rounded-full bg-black ring-1 ring-white/10',
	]}
	aria-hidden="true"
>
	{#if id === 'sun'}
		<span class="size-[70%] rounded-full bg-[radial-gradient(circle,#fffdf6_0%,#ffe4ad_55%,#ffc88a_78%,transparent_100%)] shadow-[0_0_8px_#ffc88a80]"></span>
	{:else if id === 'saturn_rings'}
		{@render saturnRings('both', true)}
	{:else if id === 'uranus_rings'}
		<svg
			class="absolute inset-0 size-full"
			fill="none"
			viewBox="0 0 32 32"
		>
			<circle
				cx="16"
				cy="16"
				fill="#a8e2e8"
				opacity="0.4"
				r="7"
			/>
			<g transform="rotate(80 16 16)">
				{#each URANUS_RINGS as rx (rx)}
					<ellipse
						cx="16"
						cy="16"
						{rx}
						ry={(rx * 3) / 13}
						stroke="#a3a9b2"
						stroke-width="0.5"
					/>
				{/each}
			</g>
		</svg>
	{:else}
		{#if !ready}
			<span
				class={['col-start-1 row-start-1 rounded-full', small ? 'size-2' : 'size-2.5']}
				style:background-color={color}
			></span>
		{/if}
		{#if ready && id === 'saturn'}
			{@render saturnRings('back')}
		{:else if ready && id === 'halley'}
			<span class="absolute top-[calc(50%-1px)] left-1/2 h-0.5 w-5 origin-left rotate-[30deg] bg-linear-to-r from-[#d8ecff]/70 to-transparent"></span>
		{/if}
		<canvas
			class={['pointer-events-none relative z-auto col-start-1 row-start-1 size-full', !ready && 'invisible']}
			{@attach canvas => skyThumbnails.attach(canvas, id, flat ? 'flat' : 'globe', size, radius, () => (ready = true))}
		></canvas>
		{#if ready && id === 'saturn'}
			{@render saturnRings('front')}
		{/if}
	{/if}
</span>
