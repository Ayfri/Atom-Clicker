<script lang="ts">
	import { dev } from '$app/environment';
	import Modal from '@components/ui/Modal.svelte';
	import AchievementsTab from './tabs/AchievementsTab.svelte';
	import ActionsTab from './tabs/ActionsTab.svelte';
	import AutomationTab from './tabs/AutomationTab.svelte';
	import BoostsTab from './tabs/BoostsTab.svelte';
	import IconsTab from './tabs/IconsTab.svelte';
	import JsonTab from './tabs/JsonTab.svelte';
	import StatsTab from './tabs/StatsTab.svelte';
	import UpgradesTab from './tabs/UpgradesTab.svelte';
	import { BarChart3, Cpu, FileJson, Image, Settings, TrendingUp, Trophy, Zap } from 'lucide-svelte';

	let isOpen = $state(false);
	let activeTab = $state<'actions' | 'achievements' | 'automation' | 'boosts' | 'icons' | 'json' | 'stats' | 'upgrades'>('stats');

	const tabs = [
		{ icon: BarChart3, id: 'stats' as const, label: 'Stats' },
		{ icon: TrendingUp, id: 'upgrades' as const, label: 'Upgrades' },
		{ icon: Trophy, id: 'achievements' as const, label: 'Achievements' },
		{ icon: Cpu, id: 'automation' as const, label: 'Automation' },
		{ icon: Zap, id: 'boosts' as const, label: 'Boosts' },
		{ icon: Image, id: 'icons' as const, label: 'Icons' },
		{ icon: FileJson, id: 'json' as const, label: 'JSON' },
		{ icon: Zap, id: 'actions' as const, label: 'Actions' },
	];

	function toggleDevTools() {
		isOpen = !isOpen;
	}
</script>

{#if dev}
	<!-- Floating Button -->
	<button
		class="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-accent-950/80 hover:bg-accent-900 text-accent-200 px-4 py-2.5 rounded-xl shadow-2xl transition-all font-bold cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-xl border border-accent-500/30 hover:border-accent-400/60 group hover:shadow-accent-500/20"
		onclick={toggleDevTools}
		aria-label="Open Developer Tools"
	>
		<Settings
			size={18}
			class="group-hover:rotate-90 transition-transform duration-700 ease-in-out"
		/>
		<span class="hidden sm:inline text-[11px] font-black uppercase tracking-[0.2em] opacity-80 group-hover:opacity-100">DevTools</span>
	</button>

	{#if isOpen}
		<Modal
			title="Developer Tools"
			onClose={toggleDevTools}
			width="xl"
		>
			<!-- Tabs -->
			<div class="flex gap-4 mb-6 overflow-x-auto pb-4 px-2 border-b border-white/10">
				{#each tabs as tab}
					{@const Icon = tab.icon}
					<button
						class="flex items-center gap-2.5 px-5 py-2 rounded-lg font-bold transition-all cursor-pointer border-2 {(
							activeTab === tab.id
						) ?
							'bg-accent-500 text-white border-accent-400 scale-105'
						:	'bg-white/5 text-white/40 hover:text-white/90 hover:bg-white/10 border-transparent hover:border-white/10'}"
						onclick={() => (activeTab = tab.id)}
					>
						<Icon
							size={18}
							class={activeTab === tab.id ? 'animate-pulse' : ''}
						/>
						<span>{tab.label}</span>
					</button>
				{/each}
			</div>

			<!-- Content -->
			<div class="min-h-[50vh] **:select-text!">
				{#if activeTab === 'stats'}
					<StatsTab />
				{:else if activeTab === 'upgrades'}
					<UpgradesTab />
				{:else if activeTab === 'achievements'}
					<AchievementsTab />
				{:else if activeTab === 'boosts'}
					<BoostsTab />
				{:else if activeTab === 'icons'}
					<IconsTab />
				{:else if activeTab === 'json'}
					<JsonTab />
				{:else if activeTab === 'actions'}
					<ActionsTab />
				{:else if activeTab === 'automation'}
					<AutomationTab />
				{/if}
			</div>
		</Modal>
	{/if}
{/if}
