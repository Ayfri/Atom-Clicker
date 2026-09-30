<script lang="ts">
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { RADIATION_UPGRADES, getRadiationUpgradeCost } from '$data/radiationUpgrades';
	import { RealmTypes } from '$data/realms';
	import { AmbientField } from '$helpers/AmbientField';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { ReactorRenderer } from '$helpers/ReactorRenderer';
	import { reveal } from '$helpers/reveals.svelte';
	import { Flame, FlaskConical, Grid3x3, Layers, Magnet, Recycle, ShieldHalf, Snowflake, Sparkles } from '@lucide/svelte';
	import type { Component } from 'svelte';

	const ICONS: Record<string, Component> = {
		breeder_reactor: Recycle,
		cherenkov_glow: Sparkles,
		coolant_pumps: Snowflake,
		fusion_ignition: Flame,
		graphite_moderators: Layers,
		ion_lattice: Grid3x3,
		isotopic_enrichment: FlaskConical,
		magnetic_confinement: Magnet,
		neutron_reflector: ShieldHalf,
	};

	const balance = $derived(currenciesManager.getAmount(CurrenciesTypes.ELECTRONS));
	const levels = $derived(radiationManager.upgradeLevels);

	/** Cheapest first, the order players can afford them in. The Ionize ones appear with the Ionize that unlocks them. */
	const upgrades = $derived(
		Object.values(RADIATION_UPGRADES)
			.filter(upgrade => gameManager.totalIonizesAllTime >= (upgrade.ionizes ?? 0))
			.sort((a, b) => a.baseCost - b.baseCost),
	);
</script>

<section class="flex flex-col gap-3" data-hint="radiation-upgrades">
	<div class="flex items-center gap-1.5">
		<h2 class="text-lg">Reactor Upgrades</h2>
		<HelpIcon position="bottom">
			{#snippet content()}
				<p class="text-xs text-white/80">
					Bought with Electrons, they make the reactor stronger, cooler and longer lasting. They survive Protonize and Electronize, Ionize resets them and
					unlocks new ones.
				</p>
			{/snippet}
		</HelpIcon>
		<Value class="ml-auto text-sm text-white/60" currency={CurrenciesTypes.ELECTRONS} value={balance} />
	</div>

	<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
		{#each upgrades as upgrade (upgrade.id)}
			{@const level = levels[upgrade.id] ?? 0}
			{@const cost = getRadiationUpgradeCost(upgrade, level)}
			{@const maxed = level >= upgrade.maxLevel}
			{@const affordable = !maxed && balance >= cost}
			{@const Icon = ICONS[upgrade.id]}
			<button
				class="flex items-center gap-3 rounded-xl p-2.5 text-left transition-colors duration-200
					{affordable ? 'cursor-pointer bg-radiation/8 hover:bg-radiation/15' : 'cursor-default bg-white/3'}"
				disabled={!affordable}
				in:reveal={{ y: 0 }}
				onclick={event => {
					if (radiationManager.purchaseUpgrade(upgrade.id)) AmbientField.emit(RealmTypes.RADIATION, 'bloom', event, { surge: 6, target: ReactorRenderer.mounted?.center });
				}}
			>
				<span
					class="grid size-10 shrink-0 place-items-center rounded-lg {affordable || maxed ? 'bg-radiation/15 text-radiation' : 'bg-white/5 text-white/30'}"
				>
					<Icon class="size-5" />
				</span>
				<span class="flex min-w-0 flex-1 flex-col gap-1">
					<span class="flex items-baseline justify-between gap-2">
						<span class="truncate text-sm font-semibold {affordable || maxed ? 'text-white' : 'text-white/60'}">{upgrade.name}</span>
						{#if maxed}
							<span class="text-xs font-bold uppercase tracking-wider text-radiation">Max</span>
						{:else}
							<Value class="shrink-0 text-xs font-mono {affordable ? 'text-radiation' : 'text-white/40'}" currency={CurrenciesTypes.ELECTRONS} value={cost} />
						{/if}
					</span>
					<span class="truncate text-xs text-white/50" title={upgrade.description(maxed ? level : level + 1)}>{upgrade.description(maxed ? level : level + 1)}</span>
					<span class="flex items-center gap-2">
						<span class="h-1 flex-1 overflow-hidden rounded-full bg-black/40">
							<span class="block h-full rounded-full bg-radiation" style:width="{(level / upgrade.maxLevel) * 100}%"></span>
						</span>
						<span class="font-mono text-[10px] tabular-nums text-white/40">{level}/{upgrade.maxLevel}</span>
					</span>
				</span>
			</button>
		{/each}
	</div>
</section>
