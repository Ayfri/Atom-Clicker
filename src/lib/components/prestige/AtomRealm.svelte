<script lang="ts">
	import Achievements from '@components/game/Achievements.svelte';
	import ActivePowerUps from '@components/hud/ActivePowerUps.svelte';
	import Atom from '@components/game/Atom.svelte';
	import Bonus from '@components/game/Bonus.svelte';
	import Buildings from '@components/game/Buildings.svelte';
	import Canvas from '@components/game/Canvas.svelte';
	import Counter from '@components/game/Counter.svelte';
	import Upgrades from '@components/game/Upgrades.svelte';
	import { RealmTypes } from '$data/realms';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { mobile } from '$stores/window.svelte';

	let activeTab: 'achievements' | 'buildings' | 'upgrades' = $state('upgrades');
</script>

<div class="relative pt-12 transition-all duration-1000 ease-in-out lg:pt-8 {mobile.current ? 'min-h-screen pb-8' : ''}">
	<Canvas />

	{#if realmManager.selectedRealmId === RealmTypes.ATOMS}
		<div class="fixed inset-0 -z-50 pointer-events-none overflow-hidden">
			{#if gameManager.totalProtonisesAllTime > 0}
				<div class="absolute bg-yellow-400/15 blur-[160px] h-64 right-[20%] rounded-full top-[10%] w-64"></div>
			{/if}
			{#if gameManager.totalElectronizesAllTime > 0}
				<div class="absolute bg-green-500/15 blur-[180px] bottom-[10%] h-80 left-[10%] rounded-full w-80"></div>
			{/if}
		</div>
	{/if}
	<Bonus />

	<div class="game-container gap-8 grid lg:max-w-4xl mx-auto p-4 lg:p-8 text-sm xl:max-w-360">
		<div class="grid-area-[upgrades] flex flex-col gap-1.5 z-10">
			<div class="grid grid-flow-col gap-2 auto-cols-fr">
				<button
					class="backdrop-blur-xs rounded-lg p-1.5 sm:p-2 w-full whitespace-nowrap border-none text-inherit cursor-pointer transition-all duration-200 text-xs sm:text-sm {(
						activeTab === 'upgrades'
					) ?
						'bg-accent-400 text-white'
					:	'bg-white/5 hover:bg-white/10'}"
					onclick={() => (activeTab = 'upgrades')}>Upgrades</button
				>
				{#if mobile.current}
					<button
						class="backdrop-blur-xs rounded-lg p-1.5 sm:p-2 w-full whitespace-nowrap border-none text-inherit cursor-pointer transition-all duration-200 text-xs sm:text-sm {(
							activeTab === 'buildings'
						) ?
							'bg-accent-400 text-white'
						:	'bg-white/5 hover:bg-white/10'}"
						onclick={() => (activeTab = 'buildings')}>Buildings</button
					>
				{/if}
				<button
					class="backdrop-blur-xs rounded-lg p-1.5 sm:p-2 w-full whitespace-nowrap border-none text-inherit cursor-pointer transition-all duration-200 text-xs sm:text-sm {(
						activeTab === 'achievements'
					) ?
						'bg-accent-400 text-white'
					:	'bg-white/5 hover:bg-white/10'}"
					onclick={() => (activeTab = 'achievements')}
				>
					Achievements
				</button>
			</div>
			<div class="mt-1">
				{#if activeTab === 'upgrades'}
					<Upgrades />
				{:else if activeTab === 'achievements'}
					<Achievements />
				{:else if activeTab === 'buildings'}
					<Buildings />
				{/if}
			</div>
		</div>
		<div class="grid-area-[atom] relative z-0 flex flex-col items-center justify-start">
			<Counter />
			<Atom />
			<ActivePowerUps />
		</div>
		{#if !mobile.current}
			<div class="grid-area-[buildings] pt-12">
				<Buildings />
			</div>
		{/if}
	</div>
</div>

<style>
	.game-container {
		grid-template-areas: 'upgrades atom buildings';
		grid-template-columns: 300px 1fr 300px;
	}

	/* Tablet breakpoint - Custom styles for mid-range screens */
	@media (min-width: 900px) and (max-width: 1536px) {
		.game-container {
			grid-template-columns: 250px 300px 250px;
			max-width: 64rem; /* 1000px */
			padding-left: 4rem;
		}
	}

	/* Mobile breakpoint - Stack layout vertically */
	@media (max-width: 900px) {
		.game-container {
			grid-template-areas: 'atom' 'upgrades' 'buildings';
			grid-template-columns: minmax(0, 1fr);
			max-width: 100%;
			overflow-x: hidden;
		}
	}

	/* Small mobile breakpoint - Maintain vertical layout */
	@media (max-width: 700px) {
		.game-container {
			grid-template-areas: 'atom' 'upgrades' 'buildings';
			grid-template-columns: 1fr;
			overflow-x: hidden;
		}
	}
</style>
