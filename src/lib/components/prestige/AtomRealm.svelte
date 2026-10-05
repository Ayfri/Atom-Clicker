<script lang="ts">
	import Achievements from '#components/game/Achievements.svelte';
	import ActivePowerUps from '#components/hud/ActivePowerUps.svelte';
	import Ambient from '#components/game/Ambient.svelte';
	import Atom from '#components/game/Atom.svelte';
	import Bonus from '#components/game/Bonus.svelte';
	import Counter from '#components/game/Counter.svelte';
	import Generators from '#components/game/Generators.svelte';
	import Upgrades from '#components/game/Upgrades.svelte';
	import Tabs from '#components/ui/Tabs.svelte';
	import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
	import { GENERATOR_TYPES, getGeneratorColor } from '#data/generators.js';
	import { getQuarkShopItem } from '#data/quarkShop.js';
	import { RealmTypes } from '#data/realms.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { reveal, reveals } from '#helpers/reveals.svelte.js';
	import { mobile } from '#stores/window.svelte.js';
	import { ArrowBigUpDash, Factory, Trophy } from '@lucide/svelte';

	type Tab = keyof typeof TAB_LABELS;

	const TAB_ICONS = { achievements: Trophy, generators: Factory, upgrades: ArrowBigUpDash } as const;
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

	/** Each owned generator adds a mote in its level color, each prestige and realm reached thickens the dust. */
	const ambience = $derived.by(() => {
		const owned = GENERATOR_TYPES.flatMap(type => gameManager.generators[type]?.count ? [gameManager.generators[type]] : []);
		const colors = new Set([CURRENCIES[CurrenciesTypes.ATOMS].color, ...owned.map(generator => getGeneratorColor(generator.level))]);
		const protonised = gameManager.totalProtonisesAllTime > 0;
		const electronized = gameManager.totalElectronizesAllTime > 0;
		if (protonised) colors.add(CURRENCIES[CurrenciesTypes.PROTONS].color);
		if (electronized) colors.add(CURRENCIES[CurrenciesTypes.ELECTRONS].color);
		const realms = [RealmTypes.PHOTONS, RealmTypes.RADIATION].filter(realm => gameManager.realms[realm]?.unlocked).length;
		const density = 2 + owned.length + (protonised ? 3 : 0) + (electronized ? 3 : 0) + realms * 2;
		// A Higgs power-up turns the dust gold and makes it rise twice as fast, like the atom spinning faster.
		if (gameManager.hasBonus) {
			const higgs = CURRENCIES[CurrenciesTypes.HIGGS_BOSON].color;
			return { colors: [higgs, higgs, ...colors], density: density + 6, pace: 2 };
		}
		return { colors: [...colors], density };
	});
</script>

<div class={['relative transition-all duration-1000 ease-in-out lg:pt-8', mobile.current && 'pb-8']}>
	{#if realmManager.selectedRealmId === RealmTypes.ATOMS}
		<div class="fixed inset-0 -z-50 pointer-events-none overflow-hidden">
			{#if gameManager.totalProtonisesAllTime > 0}
				<div class="absolute bg-yellow-400/15 blur-[160px] h-64 right-[20%] rounded-full top-[10%] w-64"></div>
			{/if}
			{#if gameManager.totalElectronizesAllTime > 0}
				<div class="absolute bg-green-500/15 blur-[180px] bottom-[10%] h-80 left-[10%] rounded-full w-80"></div>
			{/if}
		</div>
		<Ambient accent={themeAccent ?? CURRENCIES[CurrenciesTypes.ATOMS].color} {ambience} realm={RealmTypes.ATOMS} />
	{/if}
	<Bonus />
	<ActivePowerUps />

	<!-- On desktop the side panels are 100dvh - 204px tall: this padding, the tabs row (or the generators' pt-12) and the footer. -->
	<div class="game-container gap-8 grid lg:max-w-4xl mx-auto p-4 max-lg:pt-1 lg:p-8 text-sm xl:max-w-360">
		{#if tabs.length > 0}
			<div class="grid-area-[upgrades] flex flex-col gap-1.5 z-10">
				{#if tabs.length > 1}
					<div in:reveal>
						<Tabs accent={themeAccent} onselect={tab => (activeTab = tab)} selected={shownTab} tabs={tabs.map(id => ({ hint: `${id}-tab`, icon: TAB_ICONS[id], id, label: TAB_LABELS[id] }))} />
					</div>
				{/if}
				<!-- Panels stay mounted: remounting a hundred icons on every tab switch froze low-end phones. -->
				<div>
					{#if reveals.upgrades}
						<div class={['rounded-lg', shownTab !== 'upgrades' && 'hidden']} in:reveal><Upgrades /></div>
					{/if}
					{#if reveals.achievements}
						<div class={['rounded-lg', shownTab !== 'achievements' && 'hidden']} in:reveal><Achievements /></div>
					{/if}
					{#if mobile.current && reveals.generators}
						<div class={['rounded-lg', shownTab !== 'generators' && 'hidden']} in:reveal><Generators /></div>
					{/if}
				</div>
			</div>
		{/if}
		<div class="grid-area-[atom] relative z-0 flex flex-col items-center justify-start max-lg:landscape:sticky max-lg:landscape:top-0">
			<Counter />
			<Atom />
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

	/* A phone on its side has no height for the stacked layout, so the atom stays in view beside the tabs. */
	@media (width < 64rem) and (orientation: landscape) {
		.game-container {
			align-items: start;
			gap: 1rem;
			grid-template-areas: 'atom upgrades';
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}
</style>
