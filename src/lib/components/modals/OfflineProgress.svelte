<script lang="ts">
	import { BUILDINGS, BuildingTypes, type BuildingType } from '$data/buildings';
	import type { CurrencyName } from '$data/currencies';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatDuration, formatNumber } from '$lib/utils';
	import BlackHoleIcon from '@components/icons/buildings/BlackHole.svelte';
	import CrystalIcon from '@components/icons/buildings/Crystal.svelte';
	import MicroorganismIcon from '@components/icons/buildings/Microorganism.svelte';
	import MoleculeIcon from '@components/icons/buildings/Molecule.svelte';
	import NanostructureIcon from '@components/icons/buildings/Nanostructure.svelte';
	import NeutronStarIcon from '@components/icons/buildings/NeutronStar.svelte';
	import PlanetIcon from '@components/icons/buildings/Planet.svelte';
	import RockIcon from '@components/icons/buildings/Rock.svelte';
	import StarIcon from '@components/icons/buildings/Star.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import Tooltip from '@components/ui/Tooltip.svelte';
	import Value from '@components/ui/Value.svelte';
	import type { Component } from 'svelte';
	import { Clock, Settings2, Star, TrendingUp, Zap, Activity, Battery } from '@lucide/svelte';

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

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const summary = $derived(gameManager.offlineProgressSummary);
	const autoBuyEntries = $derived.by(() => {
		if (!summary) return [] as [BuildingType, number][];
		return Object.entries(summary.autoBuyCounts)
			.filter(([, count]) => (count ?? 0) > 0)
			.map(([type, count]) => [type as BuildingType, count ?? 0] as [BuildingType, number])
			.sort(([a], [b]) => BUILDINGS[a].name.localeCompare(BUILDINGS[b].name));
	});
	const autoBuyTotal = $derived.by(() => autoBuyEntries.reduce((total, [, count]) => total + count, 0));
	const autoPurchaseEnabled = $derived.by(() => !!summary && (summary.autoBuyEnabled || summary.autoUpgradeEnabled));
	const autoPurchaseTotal = $derived.by(() => (summary ? autoBuyTotal + summary.autoUpgradePurchases : 0));
	const currencyEntries = $derived.by(() => {
		if (!summary) return [] as [CurrencyName, number][];
		return Object.entries(summary.currencyGains)
			.filter(([, amount]) => (amount ?? 0) > 0)
			.map(([currency, amount]) => [currency as CurrencyName, amount ?? 0] as [CurrencyName, number])
			.sort(([a], [b]) => a.localeCompare(b));
	});
	const hasCurrencyGains = $derived(currencyEntries.length > 0);

	function handleClose() {
		gameManager.clearOfflineProgressSummary();
		onClose();
	}
</script>

{#if summary}
	<Modal
		onClose={handleClose}
		title="Offline Progress"
		width="lg"
	>
		<div class="flex flex-col gap-4">
			<div class="rounded-xl border border-white/10 bg-black/20 p-4 text-base text-white/80 sm:text-lg">
				<Clock
					size={20}
					class="mr-1 mb-0.5 inline-block shrink-0 align-middle text-white/40"
				/>
				You were away for <span class="font-semibold text-white">{formatDuration(summary.awayMs)}</span>. The game simulated
				<span class="font-semibold text-white">{formatDuration(summary.appliedMs)}</span>
				of offline time (cap <span class="font-semibold text-white">{formatDuration(summary.capMs)}</span>).
			</div>

			<div class="rounded-xl border border-white/10 bg-black/20 p-4">
				<div class="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
					<TrendingUp size={12} />
					Production
				</div>
				{#if hasCurrencyGains}
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{#each currencyEntries as [currencyType, amount]}
							<div class="flex flex-col gap-1">
								<span class="text-[10px] font-bold uppercase tracking-widest text-white/30">{currencyType} Gained</span>
								<Value
									class="text-lg font-semibold text-white"
									currency={currencyType}
									value={amount}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-sm text-white/50">No offline gains during this period.</div>
				{/if}
				<div class="mt-3 text-xs text-white/50">
					Offline income applied at {(summary.incomeMultiplier * 100).toFixed(0)}% of live production.
				</div>
			</div>

			{#if summary.levelsGained > 0 || summary.xpGained > 0}
				<div class="rounded-xl border border-white/10 bg-black/20 p-4">
					<div class="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
						<Star size={12} />
						Leveling
					</div>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div class="flex flex-col gap-1">
							<span class="text-[10px] font-bold uppercase tracking-widest text-white/30">XP Gained</span>
							<span class="text-lg font-semibold text-white">+{formatNumber(summary.xpGained)} XP</span>
						</div>
						{#if summary.levelsGained > 0}
							<div class="flex flex-col gap-1">
								<span class="text-[10px] font-bold uppercase tracking-widest text-white/30">Levels Gained</span>
								<span class="text-lg font-semibold text-green-400">+{summary.levelsGained} Levels</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<div class="rounded-xl border border-white/10 bg-black/20 p-4">
					<div class="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
						<Settings2 size={12} />
						Automation
					</div>
					<div class="flex flex-col gap-2 text-sm text-white/80">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span>Buildings</span>
								<span class={autoPurchaseEnabled ? 'text-green-400' : 'text-white/40'}>
									{autoPurchaseEnabled ? `(1/${summary.autoBuyFactor})` : 'Disabled'}
								</span>
							</div>
							<div class="flex items-center gap-2">
								<span>{formatNumber(autoPurchaseTotal)}</span>
								<Tooltip
									position="left"
									size="sm"
								>
									{#snippet children()}
										<span
											class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/70"
										>
											?
										</span>
									{/snippet}
									{#snippet content()}
										<div class="flex flex-col gap-1">
											<div class="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
												Buildings purchased
											</div>
											{#if autoBuyEntries.length > 0}
												{#each autoBuyEntries as [type, count]}
													{@const IconComponent = BUILDING_ICONS[type]}
													<div class="flex items-center justify-between gap-4">
														<span class="text-white/60 flex items-center gap-1.5">
															<IconComponent
																size={14}
																color="currentColor"
															/>
															{BUILDINGS[type].name}
														</span>
														<span class="font-semibold text-white">{formatNumber(count)}</span>
													</div>
												{/each}
											{:else}
												<div class="text-white/50">No offline auto-buys.</div>
											{/if}
										</div>
									{/snippet}
								</Tooltip>
							</div>
						</div>
						<div class="flex items-center justify-between">
							<span>Upgrades</span>
							<span>{formatNumber(summary.autoUpgradePurchases)}</span>
						</div>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span>Auto-clicks</span>
								<span class={summary.atomAutoClickEnabled ? 'text-green-400' : 'text-white/40'}>
									{summary.atomAutoClickEnabled ? `(1/${summary.autoBuyFactor})` : 'Disabled'}
								</span>
							</div>
							<span>{formatNumber(summary.atomAutoClicks)}</span>
						</div>
					</div>
				</div>

				<div class="rounded-xl border border-white/10 bg-black/20 p-4">
					<div class="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
						<Zap size={12} />
						Photon Realm
					</div>
					<div class="flex flex-col gap-2 text-sm text-white/80">
						<div class="flex items-center justify-between">
							<span>Auto-click</span>
							<span class={summary.photonAutoClickEnabled ? 'text-green-400' : 'text-white/40'}>
								{summary.photonAutoClickEnabled ? `Enabled (1/${summary.photonAutoClickFactor})` : 'Disabled'}
							</span>
						</div>
						<div class="flex items-center justify-between">
							<span>Clicks</span>
							<span>{formatNumber(summary.photonAutoClicks)}</span>
						</div>
						<div class="flex items-center justify-between">
							<span>Clicks/s</span>
							<span>{formatNumber(summary.photonAutoClicksPerSecond, 2)}</span>
						</div>
						<div class="flex items-center justify-between">
							<span>Yield/click</span>
							<span>{formatNumber(summary.photonClickExpectedTotal, 1)}</span>
						</div>
					</div>
				</div>

				{#if summary.radiationActive}
					<div class="rounded-xl border border-white/10 bg-black/20 p-4">
						<div class="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
							<Activity size={12} />
							Radiation Realm
						</div>
						<div class="flex flex-col gap-2 text-sm text-white/80">
							<div class="flex items-center justify-between">
								<span class="opacity-60">Mass Lost</span>
								<span class="text-red-400">-{formatNumber(summary.radiationMassLost, 2)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="opacity-60">Mass Gained</span>
								<span class="text-green-400">+{formatNumber(summary.radiationMassGained, 2)}</span>
							</div>
							{#if summary.radiationTimeToEmpty !== Infinity && summary.radiationTimeToEmpty > 0}
								<div class="flex items-center justify-between">
									<span class="opacity-60">Fuel Time</span>
									<span class="text-white/80">{formatDuration(summary.radiationTimeToEmpty * 1000)}</span>
								</div>
							{:else if summary.radiationTimeToEmpty === Infinity}
								<div class="flex items-center justify-between">
									<span class="opacity-60 text-accent-400">Fuel Time</span>
									<span class="text-accent-400 font-medium">Sustainable</span>
								</div>
							{/if}
							<div class="flex items-center justify-between pt-1 border-t border-white/5">
								<span class="opacity-60">Avg. Multiplier</span>
								<span class="font-bold text-accent-400">x{formatNumber(summary.radiationAvgMultiplier, 2)}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="mt-4 flex justify-center">
				<button
					class="cursor-pointer rounded-xl bg-accent-600 px-14 py-2 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-accent-500 active:scale-95 shadow-accent-500/20"
					onclick={handleClose}
				>
					Yay!
				</button>
			</div>
		</div>
	</Modal>
{/if}
