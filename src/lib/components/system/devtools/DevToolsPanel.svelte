<script lang="ts">
	import QuarkIcon from '#components/icons/Quark.svelte';
	import { getJSON, setItem } from '#lib/utils/safeLocalStorage.js';
	import { ChartLine, Factory, Gamepad2, Globe, HardDrive, Maximize2, Minimize2, Palette, Telescope, TrendingUp, Trophy, Wrench, X } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import AchievementsTab from './tabs/AchievementsTab.svelte';
	import CosmosTab from './tabs/CosmosTab.svelte';
	import GeneratorsTab from './tabs/GeneratorsTab.svelte';
	import PlayTab from './tabs/PlayTab.svelte';
	import QuarksTab from './tabs/QuarksTab.svelte';
	import RealmsTab from './tabs/RealmsTab.svelte';
	import SaveTab from './tabs/SaveTab.svelte';
	import UpgradesTab from './tabs/UpgradesTab.svelte';
	import VisualsTab from './tabs/VisualsTab.svelte';

	const TABS: { component: Component; icon: Component<{ size?: number }>; id: string; label: string }[] = [
		{ component: PlayTab, icon: Gamepad2, id: 'play', label: 'Play' },
		{ component: GeneratorsTab, icon: Factory, id: 'generators', label: 'Generators' },
		{ component: UpgradesTab, icon: TrendingUp, id: 'upgrades', label: 'Upgrades' },
		{ component: AchievementsTab, icon: Trophy, id: 'achievements', label: 'Achievements' },
		{ component: RealmsTab, icon: Globe, id: 'realms', label: 'Realms' },
		{ component: CosmosTab, icon: Telescope, id: 'cosmos', label: 'Cosmos' },
		{ component: QuarksTab, icon: QuarkIcon, id: 'quarks', label: 'Quarks' },
		{ component: SaveTab, icon: HardDrive, id: 'save', label: 'Save' },
		{ component: VisualsTab, icon: Palette, id: 'visuals', label: 'Visuals' },
	];

	interface Prefs {
		open: boolean;
		tab: string;
		wide: boolean;
	}

	const PREFS_KEY = 'atomic-clicker-devtools';
	const prefs = $state<Prefs>({ open: false, tab: 'play', wide: false, ...getJSON<Partial<Prefs>>(PREFS_KEY, {}) });
	const active = $derived(TABS.find(tab => tab.id === prefs.tab) ?? TABS[0]);

	$effect(() => {
		setItem(PREFS_KEY, JSON.stringify(prefs));
	});

	/** Physical key left of 1: backquote on QWERTY, ² on AZERTY. */
	function onKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (e.code !== 'Backquote' || e.ctrlKey || e.altKey || e.metaKey || target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
		e.preventDefault();
		prefs.open = !prefs.open;
	}

	const iconButton = 'flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors';
</script>

<svelte:window onkeydown={onKeydown} />

{#if prefs.open}
	<!-- The theme sizes are scaled up for the whole panel, every `text-xs`/`text-sm` inside reads them. -->
	<aside
		class="fixed top-0 right-0 z-60 flex h-dvh w-full flex-col border-l border-white/10 bg-accent-950/95 shadow-2xl backdrop-blur-md [--text-sm:0.9375rem] [--text-xs:0.8125rem] **:select-text! {prefs.wide ?
			'sm:w-216'
		:	'sm:w-144'}"
	>
		<header class="flex flex-col gap-1.5 border-b border-white/10 px-3 pt-2.5 pb-2">
			<div class="flex items-center gap-1">
				<h2 class="ml-1 flex-1 truncate text-base font-bold text-white">{active.label}</h2>
				<a aria-label="Benchmark" class="{iconButton} text-white/50 hover:bg-white/5 hover:text-white" href="/benchmark" title="Benchmark">
					<ChartLine size={16} />
				</a>
				<button
					aria-label="Toggle width"
					class="{iconButton} hidden text-white/50 hover:bg-white/5 hover:text-white sm:flex"
					onclick={() => (prefs.wide = !prefs.wide)}
					title="Toggle width"
				>
					{#if prefs.wide}<Minimize2 size={16} />{:else}<Maximize2 size={16} />{/if}
				</button>
				<button aria-label="Close" class="{iconButton} text-white/50 hover:bg-white/5 hover:text-white" onclick={() => (prefs.open = false)} title="Close (² or `)">
					<X size={17} />
				</button>
			</div>
			<nav class="flex flex-wrap gap-1">
				{#each TABS as tab (tab.id)}
					<button
						aria-label={tab.label}
						class="{iconButton} {tab.id === active.id ? 'bg-accent-500/30 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}"
						onclick={() => (prefs.tab = tab.id)}
						title={tab.label}
					>
						<tab.icon size={17} />
					</button>
				{/each}
			</nav>
		</header>
		<div class="flex-1 overflow-y-auto px-4 pt-3">
			<active.component />
		</div>
	</aside>
{:else}
	<button
		aria-label="Open DevTools"
		class="fixed right-3 bottom-[calc(var(--mobile-nav-height,0px)+0.75rem)] z-60 flex size-9 cursor-pointer items-center justify-center rounded-full border border-accent-500/30 bg-accent-950/80 text-accent-200/70 shadow-lg backdrop-blur transition-colors hover:text-white"
		onclick={() => (prefs.open = true)}
		title="DevTools (² or `)"
	>
		<Wrench size={16} />
	</button>
{/if}
