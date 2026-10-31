<script
	lang="ts"
	module
>
	import type { SiteId } from '#data/sites.js';

	/** Sky object whose map each source shows, the same crop as the Cosmos sky list. */
	const SKY_OBJECTS: Partial<Record<SiteId, string>> = {
		bigbang: 'cmb',
		cosmic: 'cosmic_rays',
		lowmass: 'mira',
		massive: 'crab_nebula',
		neutron: 'kilonova',
		whitedwarf: 'tycho',
	};
	/** Map resolution in CSS pixels, the largest size a source is drawn at, so every use shares one decode. */
	const MAP_PIXELS = 84;
	/** The reactor's chamber is a 100 unit square around 0, nucleons sit at these offsets. */
	const NUCLEONS = [
		[0, 0],
		[-8, -4],
		[7, -6],
		[6, 7],
		[-6, 7],
		[0, -11],
		[-12, 6],
	] as const;
	const RODS = Array.from({ length: 6 }, (_, i) => i * 60);
</script>

<script lang="ts">
	import SkyThumbnail from '#components/cosmos/SkyThumbnail.svelte';
	import { MAJOR_TICKS, MINOR_TICKS, RING_PARTICLES } from '#components/modals/colliderRing.js';
	import Currency from '#components/ui/Currency.svelte';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { NEUTRON_COLOR } from '#helpers/nucleus.js';

	interface Props {
		class?: string;
		id: SiteId;
	}

	let { class: className, id }: Props = $props();

	const object = $derived(SKY_OBJECTS[id]);
</script>

<!-- Sky objects show their Cosmos map, the others the game's own look: the Decay icon, the reactor vessel and the Collider ring. -->
<span
	class={['grid place-items-center overflow-hidden rounded-full bg-[#0b0f1c]', className]}
	aria-hidden="true"
>
	{#if object}
		<SkyThumbnail
			id={object}
			color="transparent"
			size={MAP_PIXELS}
		/>
	{:else if id === 'decay'}
		<Currency
			class="size-3/5"
			name={CurrenciesTypes.DECAY_EVENTS}
		/>
	{:else if id === 'reactor'}
		<svg
			class="size-full"
			viewBox="-50 -50 100 100"
		>
			<path
				class="fill-none stroke-white/12"
				d="M -31.47 31.47 A 44.5 44.5 0 1 1 31.47 31.47"
				stroke-linecap="round"
				stroke-width="2.2"
			/>
			<circle
				class="stroke-white/12"
				r="41.5"
				stroke-width="0.6"
				style:fill="color-mix(in srgb, var(--color-radiation) 14%, #12161a)"
			/>
			{#each RODS as angle (angle)}
				<rect
					height="6.6"
					transform="rotate({angle})"
					width="8.5"
					x="33"
					y="-3.3"
					fill="#07090b"
				/>
			{/each}
			<circle
				fill="#05080a"
				r="34"
				stroke-opacity="0.25"
				stroke-width="0.5"
				style:stroke="var(--color-radiation)"
			/>
			{#each NUCLEONS as [cx, cy], i (i)}
				<circle
					{cx}
					{cy}
					r="5.2"
					style:fill={i % 3 === 2 ? NEUTRON_COLOR : 'color-mix(in srgb, var(--color-radiation) 70%, #c3cad6)'}
				/>
			{/each}
		</svg>
	{:else}
		<svg
			class="size-full"
			viewBox="0 0 100 100"
		>
			<path
				class="fill-none stroke-white/15"
				d={MINOR_TICKS}
				stroke-width="0.4"
			/>
			<path
				class="fill-none stroke-white/35"
				d={MAJOR_TICKS}
				stroke-width="0.6"
			/>
			<circle
				class="fill-none stroke-accent-400"
				cx="50"
				cy="50"
				r="44"
				stroke-width="3"
			/>
			{#each { length: RING_PARTICLES }, i (i)}
				<circle
					class="fill-white/70"
					cx={50 + 44 * Math.cos((i / RING_PARTICLES) * 2 * Math.PI)}
					cy={50 + 44 * Math.sin((i / RING_PARTICLES) * 2 * Math.PI)}
					r="1.2"
				/>
			{/each}
		</svg>
	{/if}
</span>
