<script lang="ts">
	import { BUILDING_COLORS, BUILDINGS, BuildingTypes, type BuildingType } from '$data/buildings';
	import AtomIcon from '@components/icons/Atom.svelte';
	import BlackHoleIcon from '@components/icons/buildings/BlackHole.svelte';
	import CrystalIcon from '@components/icons/buildings/Crystal.svelte';
	import MicroorganismIcon from '@components/icons/buildings/Microorganism.svelte';
	import MoleculeIcon from '@components/icons/buildings/Molecule.svelte';
	import NanostructureIcon from '@components/icons/buildings/Nanostructure.svelte';
	import NeutronStarIcon from '@components/icons/buildings/NeutronStar.svelte';
	import PlanetIcon from '@components/icons/buildings/Planet.svelte';
	import RockIcon from '@components/icons/buildings/Rock.svelte';
	import StarIcon from '@components/icons/buildings/Star.svelte';
	import DiscordIcon from '@components/icons/Discord.svelte';
	import ElectronIcon from '@components/icons/Electron.svelte';
	import ExcitedPhotonIcon from '@components/icons/ExcitedPhoton.svelte';
	import GitHubIcon from '@components/icons/GitHub.svelte';
	import HiggsBosonIcon from '@components/icons/HiggsBoson.svelte';
	import PhotonIcon from '@components/icons/Photon.svelte';
	import ProtonIcon from '@components/icons/Proton.svelte';
	import type { Component } from 'svelte';

	const BUILDING_ICONS: Record<BuildingType, Component<{ color?: string; size?: number }>> = {
		[BuildingTypes.BLACK_HOLE]: BlackHoleIcon,
		[BuildingTypes.CRYSTAL]: CrystalIcon,
		[BuildingTypes.MICROORGANISM]: MicroorganismIcon,
		[BuildingTypes.MOLECULE]: MoleculeIcon,
		[BuildingTypes.NANOSTRUCTURE]: NanostructureIcon,
		[BuildingTypes.NEUTRON_STAR]: NeutronStarIcon,
		[BuildingTypes.PLANET]: PlanetIcon,
		[BuildingTypes.ROCK]: RockIcon,
		[BuildingTypes.STAR]: StarIcon,
	};

	const currencyIcons = [
		{ component: AtomIcon, name: 'Atom' },
		{ component: ElectronIcon, name: 'Electron' },
		{ component: ExcitedPhotonIcon, name: 'Excited Photon' },
		{ component: HiggsBosonIcon, name: 'Higgs Boson' },
		{ component: PhotonIcon, name: 'Photon' },
		{ component: ProtonIcon, name: 'Proton' },
	];

	const socialIcons = [
		{ component: DiscordIcon, name: 'Discord' },
		{ component: GitHubIcon, name: 'GitHub' },
	];

	const buildingIconEntries = Object.entries(BUILDINGS).map(([type, building]) => ({
		component: BUILDING_ICONS[type as BuildingType],
		color: BUILDING_COLORS[0],
		name: building.name,
		type: type as BuildingType,
	}));

	let iconSize = $state(48);
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center gap-4">
		<label class="text-sm text-white/60">Icon Size:</label>
		<input
			type="range"
			min="24"
			max="128"
			bind:value={iconSize}
			class="w-48 accent-accent-500"
		/>
		<span class="text-sm font-mono text-white/80">{iconSize}px</span>
	</div>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">Building Icons</h3>
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
			{#each buildingIconEntries as { component: Icon, color, name }}
				<div class="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 hover:bg-white/10 transition-colors">
					<div
						class="flex items-center justify-center"
						style="width: {iconSize}px; height: {iconSize}px;"
					>
						<Icon
							{color}
							size={iconSize}
						/>
					</div>
					<span class="text-xs text-center text-white/60 font-medium">{name}</span>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">Currency Icons</h3>
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
			{#each currencyIcons as { component: Icon, name }}
				<div class="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 hover:bg-white/10 transition-colors">
					<div
						class="flex items-center justify-center"
						style="width: {iconSize}px; height: {iconSize}px;"
					>
						<Icon size={iconSize} />
					</div>
					<span class="text-xs text-center text-white/60 font-medium">{name}</span>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h3 class="text-lg font-bold text-white/80 mb-4 border-b border-white/10 pb-2">Social Icons</h3>
		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
			{#each socialIcons as { component: Icon, name }}
				<div class="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 hover:bg-white/10 transition-colors">
					<div
						class="flex items-center justify-center"
						style="width: {iconSize}px; height: {iconSize}px;"
					>
						<Icon size={iconSize} />
					</div>
					<span class="text-xs text-center text-white/60 font-medium">{name}</span>
				</div>
			{/each}
		</div>
	</section>
</div>
