<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { autoBuyManager } from '$stores/autoBuy.svelte';
	import { autoUpgradeManager } from '$stores/autoUpgrade.svelte';
	import { BUILDING_TYPES, BUILDINGS, BuildingTypes, type BuildingType } from '$data/buildings';
	import { UPGRADES } from '$data/upgrades';
	import BlackHoleIcon from '@components/icons/buildings/BlackHole.svelte';
	import CrystalIcon from '@components/icons/buildings/Crystal.svelte';
	import MicroorganismIcon from '@components/icons/buildings/Microorganism.svelte';
	import MoleculeIcon from '@components/icons/buildings/Molecule.svelte';
	import NanostructureIcon from '@components/icons/buildings/Nanostructure.svelte';
	import NeutronStarIcon from '@components/icons/buildings/NeutronStar.svelte';
	import PlanetIcon from '@components/icons/buildings/Planet.svelte';
	import RockIcon from '@components/icons/buildings/Rock.svelte';
	import StarIcon from '@components/icons/buildings/Star.svelte';
	import { Zap, Factory, TrendingUp, Clock, CheckCircle2, XCircle, MousePointer2, Play, Lock } from 'lucide-svelte';
	import { formatNumber } from '$lib/utils';
	import { getUpgradesWithEffects } from '$helpers/effects';
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

	const intervals = $derived(autoBuyManager.autoBuyIntervals);
	const upgradeInterval = $derived(autoUpgradeManager.autoUpgradeInterval);
	const autoClicksPerSecond = $derived(gameManager.autoClicksPerSecond);

	// Check if automation is unlocked (has upgrades) regardless of settings
	const isUpgradeAutomationUnlocked = $derived.by(() => {
		return getUpgradesWithEffects(gameManager.currentUpgradesBought, { type: 'auto_upgrade' }).length > 0;
	});

	const unlockedBuildingAutomations = $derived.by(() => {
		const unlocked = new Set<BuildingType>();
		const autoBuyUpgrades = getUpgradesWithEffects(gameManager.currentUpgradesBought, { type: 'auto_buy' });

		autoBuyUpgrades.forEach(upgrade => {
			upgrade.effects?.forEach(effect => {
				if (effect.type === 'auto_buy' && effect.target) {
					unlocked.add(effect.target as BuildingType);
				}
			});
		});
		return unlocked;
	});

	function toggleBuildingAutomation(type: BuildingType) {
		if (gameManager.settings.automation.buildings.includes(type)) {
			gameManager.settings.automation.buildings = gameManager.settings.automation.buildings.filter(b => b !== type);
		} else {
			gameManager.settings.automation.buildings = [...gameManager.settings.automation.buildings, type];
		}
	}

	function toggleAllBuildings(enable: boolean) {
		if (enable) {
			gameManager.settings.automation.buildings = [...BUILDING_TYPES];
		} else {
			gameManager.settings.automation.buildings = [];
		}
	}

	function forceAutoUpgrade() {
		autoUpgradeManager.purchaseAvailableUpgrades();
	}

	function forceAutoBuy(type: BuildingType) {
		autoBuyManager.purchaseBuilding(type);
	}
</script>

<div class="space-y-6">
	<!-- Auto Clicker Section -->
	<div class="bg-white/5 rounded-xl p-4 border border-white/10">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-bold flex items-center gap-2 text-accent-300">
				<MousePointer2 size={20} />
				<span>Auto Clicker</span>
			</h3>
			{#if autoClicksPerSecond > 0}
				<div
					class="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded font-bold border border-green-500/30 flex items-center gap-1.5"
				>
					<CheckCircle2 size={12} />
					<span>Active</span>
				</div>
			{:else}
				<div class="px-3 py-1 bg-white/5 text-white/40 text-xs rounded font-bold border border-white/10 flex items-center gap-1.5">
					<Lock size={12} />
					<span>Locked</span>
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="bg-black/20 p-3 rounded-lg border border-white/5">
				<div class="text-xs text-white/40 uppercase font-black tracking-wider mb-1">Clicks Per Second</div>
				<div class="flex items-center gap-2 text-xl font-mono font-bold text-white">
					<Zap
						size={16}
						class="text-accent-400"
					/>
					{formatNumber(autoClicksPerSecond, 1)} CPS
				</div>
			</div>
			<div class="bg-black/20 p-3 rounded-lg border border-white/5">
				<div class="text-xs text-white/40 uppercase font-black tracking-wider mb-1">Click Interval</div>
				<div class="flex items-center gap-2 text-xl font-mono font-bold text-white">
					<Clock
						size={16}
						class="text-accent-400"
					/>
					{autoClicksPerSecond > 0 ? `${(1000 / autoClicksPerSecond).toFixed(1)}ms` : 'N/A'}
				</div>
			</div>
		</div>
	</div>

	<!-- Auto Upgrades Section -->
	<div class="bg-white/5 rounded-xl p-4 border border-white/10">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-bold flex items-center gap-2 text-accent-300">
				<TrendingUp size={20} />
				<span>Auto Upgrades</span>
			</h3>
			<div class="flex items-center gap-3">
				{#if !isUpgradeAutomationUnlocked}
					<div
						class="px-3 py-1 bg-white/5 text-white/40 text-xs font-bold rounded border border-white/10 flex items-center gap-1.5"
					>
						<Lock size={12} />
						<span>Locked</span>
					</div>
				{:else if !gameManager.settings.automation.upgrades}
					<div
						class="px-3 py-1 bg-yellow-500/10 text-yellow-500/60 text-xs font-bold rounded border border-yellow-500/20 flex items-center gap-1.5"
					>
						<XCircle size={12} />
						<span>Disabled</span>
					</div>
				{:else}
					<div
						class="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded border border-green-500/30 flex items-center gap-1.5"
					>
						<CheckCircle2 size={12} />
						<span>Enabled</span>
					</div>
				{/if}

				<label
					class="relative inline-flex items-center cursor-pointer {isUpgradeAutomationUnlocked ? '' : (
						'opacity-50 pointer-events-none'
					)}"
				>
					<input
						type="checkbox"
						disabled={!isUpgradeAutomationUnlocked}
						checked={gameManager.settings.automation.upgrades}
						onchange={e => (gameManager.settings.automation.upgrades = e.currentTarget.checked)}
						class="sr-only peer"
					/>
					<div
						class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-500"
					></div>
				</label>
				<button
					class="p-2 bg-accent-500/20 hover:bg-accent-500/40 text-accent-300 rounded transition-all cursor-pointer border border-accent-500/30 {(
						isUpgradeAutomationUnlocked
					) ?
						''
					:	'opacity-50 pointer-events-none'}"
					onclick={forceAutoUpgrade}
					title="Force Trigger Auto Upgrade"
				>
					<Play size={16} />
				</button>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="bg-black/20 p-3 rounded-lg border border-white/5">
				<div class="text-xs text-white/40 uppercase font-black tracking-wider mb-1">Current Interval</div>
				<div class="flex items-center gap-2 text-xl font-mono font-bold text-white">
					<Clock
						size={16}
						class="text-accent-400"
					/>
					{upgradeInterval > 0 ? `${(upgradeInterval / 1000).toFixed(1)}s` : 'Disabled'}
				</div>
			</div>
			<div class="bg-black/20 p-3 rounded-lg border border-white/5">
				<div class="text-xs text-white/40 uppercase font-black tracking-wider mb-1">Recently Purchased</div>
				<div class="flex flex-wrap gap-1">
					{#if autoUpgradeManager.recentlyAutoPurchased.size === 0}
						<span class="text-sm text-white/20 italic">None recently</span>
					{:else}
						{#each Array.from(autoUpgradeManager.recentlyAutoPurchased) as upgradeId}
							<span
								class="px-2 py-0.5 bg-accent-500/20 text-accent-300 text-[10px] font-bold rounded border border-accent-500/30"
							>
								{UPGRADES[upgradeId]?.name || upgradeId}
							</span>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Auto Buildings Section -->
	<div class="bg-white/5 rounded-xl p-4 border border-white/10">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-bold flex items-center gap-2 text-accent-300">
				<Factory size={20} />
				<span>Auto Buildings</span>
			</h3>
			<div class="flex gap-2">
				<button
					class="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 text-xs font-bold rounded transition-colors cursor-pointer border border-green-500/20"
					onclick={() => toggleAllBuildings(true)}
				>
					<CheckCircle2 size={12} />
					<span>Enable All</span>
				</button>
				<button
					class="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold rounded transition-colors cursor-pointer border border-red-500/20"
					onclick={() => toggleAllBuildings(false)}
				>
					<XCircle size={12} />
					<span>Disable All</span>
				</button>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
			{#each BUILDING_TYPES as type}
				{@const isUnlocked = unlockedBuildingAutomations.has(type)}
				{@const isEnabled = gameManager.settings.automation.buildings.includes(type)}
				{@const interval = intervals[type]}
				{@const recentlyPurchased = autoBuyManager.recentlyAutoPurchasedBuildings.get(type) || 0}
				{@const IconComponent = BUILDING_ICONS[type]}
				<div
					class="flex flex-col gap-2 p-3 rounded-xl border transition-all {isUnlocked ?
						isEnabled ? 'bg-accent-500/10 border-accent-500/30'
						:	'bg-yellow-500/5 border-yellow-500/20'
					:	'bg-black/20 border-white/5 opacity-40'}"
				>
					<div class="flex items-center justify-between">
						<button
							class="font-bold text-sm transition-colors flex items-center gap-2 {isUnlocked ?
								'cursor-pointer hover:text-accent-300'
							:	'text-white/20 cursor-default'}"
							onclick={() => isUnlocked && toggleBuildingAutomation(type)}
						>
							<IconComponent
								size={18}
								color="currentColor"
							/>
							{BUILDINGS[type].name}
						</button>
						<div class="flex items-center gap-2">
							{#if isUnlocked}
								<button
									class="p-1 bg-accent-500/20 hover:bg-accent-500/40 text-accent-300 rounded-md transition-all cursor-pointer border border-accent-500/30"
									onclick={() => forceAutoBuy(type)}
									title="Force Auto Buy"
								>
									<Play size={12} />
								</button>
								<button
									class="p-1 bg-accent-500/20 hover:bg-accent-500/40 text-accent-300 rounded-md transition-all cursor-pointer border {(
										isEnabled
									) ?
										'bg-accent-500/20 border-accent-500/30 text-accent-400'
									:	'bg-white/5 border-white/10 text-white/20 hover:text-white/40'}"
									onclick={() => toggleBuildingAutomation(type)}
									title={isEnabled ? 'Disable Auto Buy' : 'Enable Auto Buy'}
								>
									{#if isEnabled}
										<CheckCircle2 size={12} />
									{:else}
										<XCircle size={12} />
									{/if}
								</button>
							{:else}
								<div
									class="p-1.5 text-white/20"
									title="Locked"
								>
									<Lock size={14} />
								</div>
							{/if}
						</div>
					</div>

					<div class="flex items-center justify-between mt-auto">
						<div class="flex items-center gap-1.5 text-[10px] font-mono text-white/60">
							<Clock size={10} />
							{#if !isUnlocked}
								Locked
							{:else if !isEnabled}
								Disabled
							{:else}
								{interval ? `${(interval / 1000).toFixed(1)}s` : 'N/A'}
							{/if}
						</div>
						{#if recentlyPurchased > 0}
							<span class="text-[10px] font-black text-accent-400 animate-pulse">
								+{recentlyPurchased}
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
