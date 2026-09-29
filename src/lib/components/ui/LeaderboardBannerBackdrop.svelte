<script lang="ts">
	import type { BannerDefinition } from '$data/quarkShop';

	interface Props {
		banner: BannerDefinition;
		class?: string;
	}

	let { banner, class: className = '' }: Props = $props();
</script>

<div
	aria-hidden="true"
	class="pointer-events-none absolute inset-0 overflow-hidden bg-[#080a0f] {className}"
	style="background-image: linear-gradient(90deg, rgba(3, 5, 9, 0.22), transparent 45%, rgba(3, 5, 9, 0.38)), linear-gradient(120deg, {banner.gradient.join(', ')})"
>
	<div
		class="absolute inset-0 opacity-12 mix-blend-soft-light"
		style="background-image: repeating-linear-gradient(105deg, transparent 0, transparent 12px, rgba(255, 255, 255, 0.18) 13px, transparent 14px)"
	></div>
	<svg class="absolute inset-0 size-full opacity-65 mix-blend-soft-light" viewBox="0 0 240 72" preserveAspectRatio="none" fill="none">
		{#if banner.pattern === 'rays'}
			<!-- Up quark: precise ascending particle trajectories. -->
			<path d="M8 68 62 14m-26 54 54-54M64 68l54-54M92 68l54-54m-26 54 54-54m-26 54 54-54" stroke="white" stroke-width="1.25" opacity=".34" />
			<path d="m52 25 10-11 11 10m35 1 10-11 11 10m35 1 10-11 11 10" stroke="white" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" opacity=".82" />
			<circle cx="42" cy="34" r="2" fill="white" opacity=".6" /><circle cx="136" cy="24" r="1.5" fill="white" opacity=".5" /><circle cx="194" cy="42" r="2" fill="white" opacity=".55" />
		{:else if banner.pattern === 'cells'}
			<!-- Down quark: matter settling into dense lower strata. -->
			<path d="M0 49c26-7 48 7 75 0s48 7 76 0 48 7 89-1M0 60c26-6 48 6 75 0s48 6 76 0 48 6 89-1" stroke="white" stroke-width="1.5" opacity=".38" />
			<path d="M32 8v27m-7-7 7 7 7-7M96 3v35m-7-7 7 7 7-7m57-23v27m-7-7 7 7 7-7m45-25v34m-7-7 7 7 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".74" />
			<circle cx="32" cy="8" r="2.5" fill="white" opacity=".62" /><circle cx="96" cy="3" r="2" fill="white" opacity=".5" /><circle cx="160" cy="8" r="2.5" fill="white" opacity=".58" /><circle cx="205" cy="4" r="2" fill="white" opacity=".46" />
		{:else if banner.pattern === 'waves'}
			<!-- Charm quark: elegant paired orbits around a shared core. -->
			<ellipse cx="120" cy="36" rx="84" ry="20" stroke="white" stroke-width="1.5" opacity=".38" transform="rotate(-9 120 36)" />
			<ellipse cx="120" cy="36" rx="84" ry="20" stroke="white" stroke-width="1.5" opacity=".38" transform="rotate(9 120 36)" />
			<path d="M48 36c22-28 50-28 72 0s50 28 72 0c-22-28-50-28-72 0s-50 28-72 0Z" stroke="white" stroke-width="1.75" opacity=".56" />
			<circle cx="120" cy="36" r="4.5" fill="white" opacity=".84" /><circle cx="57" cy="17" r="2.5" fill="white" opacity=".65" /><circle cx="183" cy="55" r="2.5" fill="white" opacity=".65" />
		{:else if banner.pattern === 'constellation'}
			<!-- Strange quark: an asymmetric, unfamiliar particle signature. -->
			<path d="m18 54 38-34 29 19 36-27 26 42 38-31 37 17" stroke="white" stroke-width="1.25" stroke-dasharray="2 4" opacity=".48" />
			<path d="m56 20 65-8 64 11M85 39l62 15 75-14" stroke="white" stroke-width=".75" opacity=".25" />
			<g fill="white"><circle cx="18" cy="54" r="2" opacity=".6" /><circle cx="56" cy="20" r="3.5" /><circle cx="85" cy="39" r="2" opacity=".75" /><circle cx="121" cy="12" r="3" /><circle cx="147" cy="54" r="2.5" opacity=".8" /><circle cx="185" cy="23" r="3.5" /><circle cx="222" cy="40" r="2" opacity=".65" /></g>
		{:else if banner.pattern === 'chevrons'}
			<!-- Top quark: the heaviest quark represented by a restrained crown. -->
			<path d="M45 55 34 20l35 17 21-27 30 25 30-25 21 27 35-17-11 35H45Z" fill="white" opacity=".12" />
			<path d="M45 55 34 20l35 17 21-27 30 25 30-25 21 27 35-17-11 35H45Z" stroke="white" stroke-width="1.75" stroke-linejoin="round" opacity=".68" />
			<path d="M54 62h132" stroke="white" stroke-width="3" stroke-linecap="round" opacity=".48" />
			<circle cx="90" cy="10" r="2.5" fill="white" /><circle cx="150" cy="10" r="2.5" fill="white" />
		{:else if banner.pattern === 'hazard'}
			<!-- Bottom quark: broad descending chevrons with a heavy base. -->
			<path d="m12 8 28 25L68 8m18 0 28 25 28-25m18 0 28 25 28-25" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".42" />
			<path d="m12 31 28 25 28-25m18 0 28 25 28-25m18 0 28 25 28-25" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".72" />
			<path d="M0 66h240" stroke="white" stroke-width="2" opacity=".28" />
		{:else if banner.pattern === 'lattice'}
			<!-- Gluon: flowing exchange lines between the three colour charges. -->
			<path d="M24 36c20-30 42-30 62 0s42 30 62 0 42-30 68 0M24 36c20 30 42 30 62 0s42-30 62 0 42 30 68 0" stroke="white" stroke-width="1.5" opacity=".48" />
			<path d="M24 36h192" stroke="white" stroke-width=".75" stroke-dasharray="3 5" opacity=".28" />
			<circle cx="24" cy="36" r="6" fill="#ef4444" /><circle cx="86" cy="36" r="6" fill="#22c55e" /><circle cx="148" cy="36" r="6" fill="#3b82f6" /><circle cx="216" cy="36" r="6" fill="#ef4444" />
			<g fill="white"><circle cx="24" cy="36" r="2" /><circle cx="86" cy="36" r="2" /><circle cx="148" cy="36" r="2" /><circle cx="216" cy="36" r="2" /></g>
		{:else if banner.pattern === 'rings'}
			<!-- Higgs boson: a field excitation around a dense central mass. -->
			<circle cx="168" cy="36" r="7" fill="white" opacity=".88" /><circle cx="168" cy="36" r="15" stroke="white" stroke-width="1.5" opacity=".72" /><circle cx="168" cy="36" r="27" stroke="white" stroke-width="1.25" opacity=".5" /><circle cx="168" cy="36" r="41" stroke="white" stroke-width="1" opacity=".32" /><circle cx="168" cy="36" r="58" stroke="white" stroke-width=".75" opacity=".18" />
			<path d="M16 36h94m116 0h14" stroke="white" stroke-width="1" stroke-dasharray="2 6" opacity=".38" />
			<circle cx="110" cy="36" r="2.5" fill="white" opacity=".7" /><circle cx="226" cy="36" r="2.5" fill="white" opacity=".7" />
		{:else if banner.pattern === 'aurora'}
			<!-- Neutrino: sparse tracks passing almost untouched through matter. -->
			<path d="M-8 62 72 5m-35 71L132 7m-10 64L246-5" stroke="white" stroke-width="1.25" stroke-dasharray="2 7" stroke-linecap="round" opacity=".72" />
			<path d="M0 19h240M0 51h240" stroke="white" stroke-width=".5" opacity=".14" />
			<circle cx="72" cy="5" r="2.5" fill="white" opacity=".78" /><circle cx="132" cy="7" r="2" fill="white" opacity=".68" /><circle cx="199" cy="22" r="1.5" fill="white" opacity=".62" />
		{:else if banner.pattern === 'stripes'}
			<!-- Hadron jet: two composite particles colliding into fragmented jets. -->
			<path d="M8 36h88m48 0h88" stroke="white" stroke-width="2" opacity=".58" />
			<path d="m96 36 88-28m-88 28 100-12M96 36l88 28m-88-28 100 12" stroke="white" stroke-width="1.5" opacity=".52" />
			<circle cx="96" cy="36" r="7" fill="white" opacity=".84" /><circle cx="82" cy="36" r="5" stroke="white" stroke-width="2" opacity=".55" />
			<g fill="white"><circle cx="152" cy="18" r="2.5" /><circle cx="176" cy="27" r="1.75" /><circle cx="161" cy="53" r="2" /><circle cx="206" cy="56" r="2.5" /><circle cx="216" cy="14" r="1.75" /></g>
		{:else if banner.pattern === 'orbitals'}
			<!-- Atom: a nucleus wrapped in three crossing electron shells. -->
			<g stroke="white" fill="none">
				<ellipse cx="120" cy="36" rx="104" ry="24" stroke-width="1.5" opacity=".46" />
				<ellipse cx="120" cy="36" rx="104" ry="24" stroke-width="1.5" opacity=".46" transform="rotate(-11 120 36)" />
				<ellipse cx="120" cy="36" rx="104" ry="24" stroke-width="1.5" opacity=".46" transform="rotate(11 120 36)" />
				<circle cx="120" cy="36" r="16" stroke-width=".75" stroke-dasharray="2 5" opacity=".3" />
			</g>
			<circle cx="120" cy="36" r="7" fill="white" opacity=".9" /><circle cx="120" cy="36" r="10.5" stroke="white" stroke-width="1.25" opacity=".5" />
			<g fill="white"><circle cx="24" cy="30" r="2.75" opacity=".82" /><circle cx="72" cy="17" r="2.25" opacity=".7" /><circle cx="182" cy="17" r="2.25" opacity=".7" /><circle cx="216" cy="42" r="2.75" opacity=".82" /><circle cx="150" cy="57" r="2" opacity=".6" /></g>
		{:else if banner.pattern === 'nucleus'}
			<!-- Proton: two up quarks and one down quark bound by the strong force. -->
			<circle cx="120" cy="36" r="27" fill="white" opacity=".1" />
			<circle cx="120" cy="36" r="27" stroke="white" stroke-width="1.75" opacity=".7" />
			<circle cx="120" cy="36" r="35" stroke="white" stroke-width=".75" stroke-dasharray="3 6" opacity=".34" />
			<path d="M108 27h24m-12 25 12-21m-24 0 12 21" stroke="white" stroke-width="1.25" opacity=".45" />
			<g fill="white"><circle cx="108" cy="27" r="5.5" opacity=".92" /><circle cx="132" cy="27" r="5.5" opacity=".76" /><circle cx="120" cy="48" r="5.5" opacity=".62" /></g>
			<path d="M28 30h14m-7-7v14m170 0h14m-7-7v14" stroke="white" stroke-width="2.5" stroke-linecap="round" opacity=".66" />
			<g fill="white"><circle cx="66" cy="52" r="2" opacity=".5" /><circle cx="176" cy="18" r="2" opacity=".5" /></g>
		{:else if banner.pattern === 'cloud'}
			<!-- Electron: a diffuse probability cloud around a single charge. -->
			<g stroke="white" fill="none" stroke-dasharray="2 6">
				<ellipse cx="120" cy="36" rx="96" ry="28" stroke-width="1.25" opacity=".44" />
				<ellipse cx="120" cy="36" rx="62" ry="18" stroke-width="1" opacity=".32" />
			</g>
			<circle cx="120" cy="36" r="46" fill="white" opacity=".07" /><circle cx="120" cy="36" r="26" fill="white" opacity=".08" />
			<circle cx="216" cy="36" r="5" fill="white" opacity=".9" /><path d="M209 36h14" stroke="white" stroke-width="2.5" stroke-linecap="round" opacity=".7" />
			<g fill="white"><circle cx="48" cy="24" r="1.5" opacity=".55" /><circle cx="76" cy="47" r="2" opacity=".62" /><circle cx="99" cy="18" r="1.25" opacity=".45" /><circle cx="118" cy="55" r="1.75" opacity=".58" /><circle cx="143" cy="24" r="1.5" opacity=".5" /><circle cx="166" cy="49" r="2" opacity=".6" /><circle cx="188" cy="22" r="1.25" opacity=".45" /><circle cx="30" cy="45" r="1.25" opacity=".4" /></g>
		{:else if banner.pattern === 'beam'}
			<!-- Photon: an oscillating wave packet travelling to the right at c. -->
			<path
				d="M-4 36c8-20 16-20 24 0s16 20 24 0 16-20 24 0 16 20 24 0 16-20 24 0 16 20 24 0 16-20 24 0 16 20 24 0 16-20 24 0 16 20 24 0"
				stroke="white"
				stroke-width="2"
				opacity=".76"
			/>
			<path
				d="M-4 36c8 12 16 12 24 0s16-12 24 0 16 12 24 0 16-12 24 0 16 12 24 0 16-12 24 0 16 12 24 0 16-12 24 0 16 12 24 0 16-12 24 0"
				stroke="white"
				stroke-width="1"
				opacity=".34"
			/>
			<path d="M0 36h240" stroke="white" stroke-width=".5" stroke-dasharray="4 6" opacity=".28" />
			<path d="m226 27 10 9-10 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".82" />
			<g fill="white"><circle cx="20" cy="16" r="2" opacity=".6" /><circle cx="116" cy="56" r="2" opacity=".55" /><circle cx="164" cy="16" r="1.75" opacity=".5" /></g>
		{:else if banner.pattern === 'facets'}
			<!-- Red Light: the triangle facet of a tough Red photon inside its HP ring, chipped shards drifting off. -->
			<circle cx="120" cy="36" r="26" fill="white" opacity=".08" />
			<circle cx="120" cy="36" r="26" stroke="white" stroke-width="1" opacity=".45" />
			<path d="M120 4a32 32 0 1 1-30.4 42" stroke="white" stroke-width="3" stroke-linecap="round" opacity=".7" />
			<path d="m120 17 16.5 28.5h-33Z" fill="white" opacity=".16" />
			<path d="m120 17 16.5 28.5h-33Z" stroke="white" stroke-width="2" stroke-linejoin="round" opacity=".82" />
			<g stroke="white" stroke-width="1.5" stroke-linejoin="round">
				<path d="m42 16 6 10H36Z" opacity=".6" /><path d="m68 46 5 8.5H63Z" opacity=".45" /><path d="m176 12 5 8.5h-10Z" opacity=".5" /><path d="m204 44 6 10h-12Z" opacity=".62" />
			</g>
			<path d="M16 36h58m92 0h58" stroke="white" stroke-width=".75" stroke-dasharray="2 6" opacity=".3" />
		{:else if banner.pattern === 'weave'}
			<!-- Green Light: a darting Green photon weaving a trail that never runs straight, its diamond facet in the lead. -->
			<path d="M-6 52C18 14 44 66 76 38s50-34 80 0 44 30 62-10" stroke="white" stroke-width="2" stroke-linecap="round" opacity=".72" />
			<path d="M-6 58C20 24 46 72 78 46s48-30 78 2 42 24 58-14" stroke="white" stroke-width="1" stroke-dasharray="2 5" opacity=".34" />
			<path d="m218 18 10 10-10 10-10-10Z" fill="white" opacity=".2" />
			<path d="m218 18 10 10-10 10-10-10Z" stroke="white" stroke-width="2" stroke-linejoin="round" opacity=".86" />
			<g fill="white"><circle cx="30" cy="34" r="1.75" opacity=".5" /><circle cx="76" cy="38" r="2.25" opacity=".62" /><circle cx="118" cy="22" r="1.5" opacity=".45" /><circle cx="156" cy="38" r="2" opacity=".58" /><circle cx="192" cy="50" r="1.5" opacity=".48" /></g>
		{:else if banner.pattern === 'split'}
			<!-- Blue Light: a Blue photon breaking into the two halves that fly apart from it. -->
			<circle cx="90" cy="36" r="27" stroke="white" stroke-width=".75" opacity=".2" />
			<path d="M90 16 107.3 26v20L90 56 72.7 46V26Z" stroke="white" stroke-width="1.5" stroke-dasharray="3 4" stroke-linejoin="round" opacity=".4" />
			<path d="m112 31 34-8m-34 18 42 10" stroke="white" stroke-width="1" stroke-dasharray="2 5" opacity=".42" />
			<g stroke="white" stroke-width="2" stroke-linejoin="round">
				<path d="m160 9 9.5 5.5v11L160 31l-9.5-5.5v-11Z" fill="white" fill-opacity=".16" opacity=".86" />
				<path d="m172 43 9.5 5.5v11L172 65l-9.5-5.5v-11Z" fill="white" fill-opacity=".16" opacity=".86" />
			</g>
			<g fill="white"><circle cx="90" cy="36" r="2.5" opacity=".55" /><circle cx="30" cy="22" r="1.5" opacity=".42" /><circle cx="44" cy="54" r="1.75" opacity=".5" /><circle cx="214" cy="30" r="2" opacity=".55" /></g>
		{/if}
	</svg>
	<div class="absolute inset-0 bg-linear-to-b from-white/8 via-transparent to-black/18"></div>
	<div class="absolute inset-x-0 top-0 h-px bg-white/20"></div>
	<div class="absolute inset-x-0 bottom-0 h-px bg-black/50"></div>
</div>
