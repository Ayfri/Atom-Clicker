<script lang="ts">
	import { EXCITED_PHOTON_UPGRADES, PHOTON_UPGRADES } from '$data/photonUpgrades';
	import { RADIATION_UPGRADES } from '$data/radiationUpgrades';
	import { SKILL_UPGRADES } from '$data/skillTree';
	import { UPGRADES } from '$data/upgrades';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import LevelList from '../LevelList.svelte';
	import ToggleGrid from '../ToggleGrid.svelte';

	const VIEWS = ['Upgrades', 'Skills', 'Photon', 'Excited', 'Radiation'] as const;
	let view = $state<(typeof VIEWS)[number]>('Upgrades');

	const upgrades = Object.values(UPGRADES);
	const skills = Object.values(SKILL_UPGRADES);
	const photonUpgrades = Object.values(PHOTON_UPGRADES);
	const excitedUpgrades = Object.values(EXCITED_PHOTON_UPGRADES);
	const radiationUpgrades = Object.values(RADIATION_UPGRADES);

	/** Features and realm unlocks are derived from what is owned, the purchase paths refresh them the same way. */
	function refresh() {
		gameManager.syncFeatures();
		gameManager.checkRealmUnlocks();
	}
</script>

<div class="sticky top-0 z-10 -mx-4 -mt-3 mb-3 flex gap-1 bg-accent-950/95 px-4 py-2.5 backdrop-blur">
	{#each VIEWS as option (option)}
		<button
			class="flex-1 cursor-pointer rounded-md px-1 py-1.5 text-xs font-semibold transition-colors {view === option ?
				'bg-accent-500/30 text-white'
			:	'text-white/50 hover:bg-white/5'}"
			onclick={() => (view = option)}
		>
			{option}
		</button>
	{/each}
</div>

{#if view === 'Upgrades'}
	<ToggleGrid
		items={upgrades}
		onChange={owned => {
			gameManager.upgrades = owned;
			refresh();
		}}
		owned={gameManager.upgrades}
	/>
{:else if view === 'Skills'}
	<ToggleGrid
		items={skills}
		onChange={owned => {
			gameManager.skillUpgrades = owned;
			refresh();
		}}
		owned={gameManager.skillUpgrades}
	/>
{:else if view === 'Radiation'}
	<LevelList
		items={radiationUpgrades}
		levels={radiationManager.upgradeLevels}
		onChange={levels => {
			radiationManager.upgradeLevels = levels;
			gameManager.radiationUpgrades = { ...levels };
		}}
	/>
{:else}
	<LevelList
		items={view === 'Photon' ? photonUpgrades : excitedUpgrades}
		levels={gameManager.photonUpgrades}
		onChange={levels => {
			gameManager.photonUpgrades = { ...gameManager.photonUpgrades, ...levels };
			refresh();
		}}
	/>
{/if}
