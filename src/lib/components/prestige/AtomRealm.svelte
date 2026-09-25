<script lang="ts">
	import Achievements from '@components/game/Achievements.svelte';
	import ActivePowerUps from '@components/hud/ActivePowerUps.svelte';
	import Atom from '@components/game/Atom.svelte';
	import Bonus from '@components/game/Bonus.svelte';
	import Canvas from '@components/game/Canvas.svelte';
	import Counter from '@components/game/Counter.svelte';
	import Generators from '@components/game/Generators.svelte';
	import Upgrades from '@components/game/Upgrades.svelte';
	import { getQuarkShopItem } from '$data/quarkShop';
	import { RealmTypes } from '$data/realms';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { reveal, reveals } from '$helpers/reveals.svelte';
	import { mobile } from '$stores/window.svelte';

	type Tab = keyof typeof TAB_LABELS;

	const TAB_LABELS = { achievements: 'Achievements', generators: 'Generators', upgrades: 'Upgrades' } as const;

	let activeTab: Tab = $state('upgrades');

	/** Generators only get a tab on phones, desktop gives them their own column. */
	const tabs = $derived(
		(['upgrades', 'generators', 'achievements'] as const).filter(tab =>
			tab === 'generators' ? mobile.current && reveals.generators : reveals[tab],
		),
	);
	const shownTab = $derived(tabs.includes(activeTab) ? activeTab : tabs[0]);

	const themeAccent = $derived.by(() => {
		const themeId = quarksManager.equippedThemes[RealmTypes.ATOMS];
		return themeId ? getQuarkShopItem(themeId)?.theme?.accent : undefined;
	});
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
		{#if tabs.length > 0}
			<div class="grid-area-[upgrades] flex flex-col gap-1.5 z-10">
				{#if tabs.length > 1}
					<div class="grid grid-flow-col gap-2 auto-cols-fr rounded-lg" in:reveal>
						{#each tabs as tab (tab)}
							<button
								class="backdrop-blur-xs rounded-lg p-1.5 sm:p-2 w-full whitespace-nowrap border-none text-inherit cursor-pointer transition-all duration-200 text-xs sm:text-sm {(
									shownTab === tab
								) ?
									'text-white'
								:	'bg-white/5 hover:bg-white/10'}"
								data-hint="{tab}-tab"
								id="tab-{tab}"
								style={shownTab === tab ? `background-color: ${themeAccent ?? 'var(--color-accent-400)'};` : ''}
								in:reveal
								onclick={() => (activeTab = tab)}>{TAB_LABELS[tab]}</button
							>
						{/each}
					</div>
				{/if}
				<!-- Panels stay mounted: remounting a hundred icons on every tab switch froze low-end phones. -->
				<div class="mt-1">
					{#if reveals.upgrades}
						<div class="rounded-lg" class:hidden={shownTab !== 'upgrades'} in:reveal><Upgrades /></div>
					{/if}
					{#if reveals.achievements}
						<div class="rounded-lg" class:hidden={shownTab !== 'achievements'} in:reveal><Achievements /></div>
					{/if}
					{#if mobile.current && reveals.generators}
						<div class="rounded-lg" class:hidden={shownTab !== 'generators'} in:reveal><Generators /></div>
					{/if}
				</div>
			</div>
		{/if}
		<div class="grid-area-[atom] relative z-0 flex flex-col items-center justify-start">
			<Counter />
			<Atom />
			<ActivePowerUps />
		</div>
		{#if !mobile.current && reveals.generators}
			<div class="grid-area-[generators] pt-12">
				<div class="rounded-lg" in:reveal><Generators /></div>
			</div>
		{/if}
	</div>
</div>

<style>
	.game-container {
		grid-template-areas: 'upgrades atom generators';
		grid-template-columns: 300px 1fr 300px;
	}

	/* Leaves room for the fixed side nav (72px) plus the grid gaps, the narrowest width this layout survives is ~1008px. */
	@media (64rem <= width < 96rem) {
		.game-container {
			grid-template-columns: 250px 300px 250px;
			max-width: 64rem;
			padding-left: 5rem;
		}
	}

	/* Must stay in sync with MOBILE_QUERY, the `mobile` rune decides which children are rendered into these areas. */
	@media (width < 64rem) {
		.game-container {
			grid-template-areas: 'atom' 'upgrades' 'generators';
			grid-template-columns: minmax(0, 1fr);
			max-width: 100%;
			overflow-x: hidden;
		}
	}
</style>
