<script lang="ts">
	import QuarkIcon from '@components/icons/Quark.svelte';
	import { getJSON, setItem } from '$lib/utils/safeLocalStorage';
	import { ChartLine, Factory, Gamepad2, Globe, HardDrive, Maximize2, Minimize2, Palette, TrendingUp, Trophy, Wrench, X } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import AchievementsTab from './tabs/AchievementsTab.svelte';
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

	const iconButton = 'flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors';
</script>

<svelte:window onkeydown={onKeydown} />

{#if prefs.open}
	<aside
		class="fixed top-0 right-0 z-60 flex h-dvh w-full flex-col border-l border-white/10 bg-accent-950/95 shadow-2xl backdrop-blur-md **:select-text! {prefs.wide ?
			'sm:w-192'
		:	'sm:w-124'}"
	>
		<header class="flex items-center gap-1 border-b border-white/10 px-3 py-2">
			{#each TABS as tab (tab.id)}
				<button
					aria-label={tab.label}
					class="{iconButton} {tab.id === active.id ? 'bg-accent-500/30 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/80'}"
					onclick={() => (prefs.tab = tab.id)}
					title={tab.label}
				>
					<tab.icon size={16} />
				</button>
			{/each}
			<span class="ml-2 truncate text-sm font-bold text-white/80">{active.label}</span>
			<a aria-label="Benchmark" class="{iconButton} ml-auto text-white/40 hover:bg-white/5 hover:text-white" href="/benchmark" title="Benchmark">
				<ChartLine size={15} />
			</a>
			<button
				aria-label="Toggle width"
				class="{iconButton} hidden text-white/40 hover:bg-white/5 hover:text-white sm:flex"
				onclick={() => (prefs.wide = !prefs.wide)}
				title="Toggle width"
			>
				{#if prefs.wide}<Minimize2 size={15} />{:else}<Maximize2 size={15} />{/if}
			</button>
			<button aria-label="Close" class="{iconButton} text-white/40 hover:bg-white/5 hover:text-white" onclick={() => (prefs.open = false)} title="Close (² or `)">
				<X size={16} />
			</button>
		</header>
		<div class="flex-1 overflow-y-auto px-4 pt-3">
			<active.component />
		</div>
	</aside>
{:else}
	<button
		aria-label="Open DevTools"
		class="fixed right-3 bottom-3 z-60 flex size-9 cursor-pointer items-center justify-center rounded-full border border-accent-500/30 bg-accent-950/80 text-accent-200/70 shadow-lg backdrop-blur transition-colors hover:text-white"
		onclick={() => (prefs.open = true)}
		title="DevTools (² or `)"
	>
		<Wrench size={16} />
	</button>
{/if}
