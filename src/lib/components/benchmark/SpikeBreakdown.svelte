<script lang="ts">
	import { AlertTriangle, Award, Flame, RotateCcw, Sparkles, Star, TrendingUp, Wrench, Zap } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { GENERATOR_COLORS, GENERATORS, GeneratorTypes } from '$data/generators';
	import { ALL_PHOTON_UPGRADES } from '$data/photonUpgrades';
	import { SKILL_UPGRADES } from '$data/skillTree';
	import { UPGRADES } from '$data/upgrades';
	import { ACHIEVEMENTS } from '$data/achievements';
	import BlackHoleIcon from '@components/icons/generators/BlackHole.svelte';
	import CrystalIcon from '@components/icons/generators/Crystal.svelte';
	import MicroorganismIcon from '@components/icons/generators/Microorganism.svelte';
	import MoleculeIcon from '@components/icons/generators/Molecule.svelte';
	import NanostructureIcon from '@components/icons/generators/Nanostructure.svelte';
	import NeutronStarIcon from '@components/icons/generators/NeutronStar.svelte';
	import PlanetIcon from '@components/icons/generators/Planet.svelte';
	import RockIcon from '@components/icons/generators/Rock.svelte';
	import StarIcon from '@components/icons/generators/Star.svelte';
	import { formatNumber, formatSimTimePrecise } from '$lib/utils';
	import type { SimulationAction, SpikeEvent } from '$lib/simulation/types';

	let { index, spike }: { index: number; spike: SpikeEvent } = $props();

	const APS_BOOSTER_EFFECT_TYPES = new Set(['global', 'proton_gain', 'electron_gain', 'click']);

	const GENERATOR_ICONS: Record<string, Component<{ color?: string; size?: number }>> = {
		[GeneratorTypes.BLACK_HOLE]: BlackHoleIcon,
		[GeneratorTypes.CRYSTAL]: CrystalIcon,
		[GeneratorTypes.MICROORGANISM]: MicroorganismIcon,
		[GeneratorTypes.MOLECULE]: MoleculeIcon,
		[GeneratorTypes.NANOSTRUCTURE]: NanostructureIcon,
		[GeneratorTypes.NEUTRON_STAR]: NeutronStarIcon,
		[GeneratorTypes.PLANET]: PlanetIcon,
		[GeneratorTypes.ROCK]: RockIcon,
		[GeneratorTypes.STAR]: StarIcon,
	};

	const GENERATOR_TYPE_ORDER = Object.values(GeneratorTypes);

	interface ResolvedAction {
		apsDelta: number;
		count: number;
		description: string;
		isApsBooster: boolean;
		isNew: boolean;
		key: string;
		label: string;
		raw: SimulationAction;
		totalBought: number;
	}

	function resolveAction(action: SimulationAction): { description: string; isApsBooster: boolean; label: string } {
		const d = action.details ?? '';
		switch (action.type) {
			case 'upgrade': {
				const u = UPGRADES[d];
				if (!u) return { description: d, isApsBooster: false, label: d };
				const isApsBooster = u.effects.some(e => APS_BOOSTER_EFFECT_TYPES.has(e.type));
				return { description: u.description, isApsBooster, label: u.name };
			}
			case 'skill': {
				const s = SKILL_UPGRADES[d];
				if (!s) return { description: d, isApsBooster: false, label: d };
				const isApsBooster = s.effects.some(e => APS_BOOSTER_EFFECT_TYPES.has(e.type));
				return { description: s.description, isApsBooster, label: s.name };
			}
			case 'photon_upgrade': {
				const p = ALL_PHOTON_UPGRADES[d];
				if (!p) return { description: d, isApsBooster: false, label: d };
				return { description: p.description(1), isApsBooster: false, label: p.name };
			}
			case 'achievement': {
				const entry = Object.values(ACHIEVEMENTS).find(a => a.name === d);
				return { description: entry?.description ?? d, isApsBooster: false, label: d };
			}
			case 'generator': {
				const generatorType = d.split(' ')[0];
				const b = GENERATORS[generatorType as keyof typeof GENERATORS];
				return { description: '', isApsBooster: false, label: b?.name ?? generatorType };
			}
			case 'protonise':
				return { description: d, isApsBooster: true, label: 'Protonise' };
			case 'electronize':
				return { description: d, isApsBooster: true, label: 'Electronize' };
			case 'power_up':
				return { description: d, isApsBooster: false, label: 'Power-up' };
			default:
				return { description: d, isApsBooster: false, label: d || action.type };
		}
	}

	function parseGeneratorAmount(details: string): number {
		const match = details.match(/x(\d+)$/);
		return match ? parseInt(match[1]) : 1;
	}

	const groupedActions = $derived.by(() => {
		const byKey = new Map<string, ResolvedAction>();
		for (const action of spike.actions) {
			const generatorType = action.type === 'generator' ? action.details?.split(' ')[0] ?? '' : null;
			const key = generatorType ? `generator::${generatorType}` : `${action.type}::${action.details ?? ''}`;
			const existing = byKey.get(key);
			const bought = generatorType ? parseGeneratorAmount(action.details ?? '') : 1;
			if (existing) {
				existing.count++;
				existing.totalBought += bought;
				existing.apsDelta += action.apsDelta ?? 0;
				if (action.isFirstPurchase) existing.isNew = true;
			} else {
				const resolved = resolveAction(action);
				byKey.set(key, {
					apsDelta: action.apsDelta ?? 0,
					count: 1,
					isNew: action.isFirstPurchase ?? false,
					key,
					raw: action,
					totalBought: bought,
					...resolved,
				});
			}
		}

		const groups: Record<string, ResolvedAction[]> = {};
		for (const item of byKey.values()) {
			const t = item.raw.type;
			groups[t] ??= [];
			groups[t].push(item);
		}
		for (const list of Object.values(groups)) {
			if (list[0]?.raw.type === 'generator') {
				list.sort((a, b) => GENERATOR_TYPE_ORDER.indexOf(a.raw.details?.split(' ')[0] as any) - GENERATOR_TYPE_ORDER.indexOf(b.raw.details?.split(' ')[0] as any));
			} else {
				list.sort((a, b) => b.count - a.count);
			}
		}
		return groups;
	});

	const apsMultiplier = $derived(spike.apsStart > 0 ? spike.apsEnd / spike.apsStart : 0);
	const hasApsJump = $derived(apsMultiplier >= 10);

	const TYPE_LABELS: Record<string, string> = {
		achievement: 'Achievements',
		generator: 'Generators',
		electronize: 'Electronize',
		photon_upgrade: 'Photon Upgrades',
		power_up: 'Power-ups',
		protonise: 'Protonise',
		skill: 'Skills',
		upgrade: 'Upgrades',
	};

	const TYPE_COLORS: Record<string, string> = {
		achievement: 'text-purple-400 bg-purple-500/15 border-purple-500/25',
		generator: 'text-green-400 bg-green-500/15 border-green-500/25',
		electronize: 'text-blue-400 bg-blue-500/15 border-blue-500/25',
		photon_upgrade: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25',
		power_up: 'text-orange-400 bg-orange-500/15 border-orange-500/25',
		protonise: 'text-amber-400 bg-amber-500/15 border-amber-500/25',
		skill: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/25',
		upgrade: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
	};

	const TYPE_ICONS: Record<string, Component> = {
		achievement: Award,
		electronize: RotateCcw,
		photon_upgrade: Sparkles,
		power_up: Flame,
		protonise: RotateCcw,
		skill: Star,
		upgrade: Wrench,
	};
</script>

<div class="bg-amber-500/6 border border-amber-500/20 flex flex-col gap-4 p-4 rounded-xl text-sm">
	<!-- Header -->
	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap gap-x-4 gap-y-1 items-center">
			<div class="flex gap-2 items-center">
				<AlertTriangle class="shrink-0 text-amber-400" size={15} />
				<span class="font-semibold text-amber-300">Spike #{index + 1} at {formatSimTimePrecise(spike.timestamp)}</span>
			</div>
			<div class="flex gap-2 items-center font-mono text-xs">
				<span class="text-red-400 font-bold">{spike.peakRatePerMin.toFixed(0)}/min</span>
				<span class="text-gray-500">vs avg</span>
				<span class="text-gray-400">{spike.avgRatePerMin.toFixed(1)}/min</span>
				<span class="text-gray-600 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">{(spike.peakRatePerMin / spike.avgRatePerMin).toFixed(1)}x</span>
			</div>
			<div class="flex gap-2 items-center text-xs {hasApsJump ? 'text-red-300' : 'text-gray-400'}">
				<TrendingUp size={12} />
				<span class="font-mono">
					{formatNumber(spike.apsStart)}/s
					<span class="text-gray-600 mx-1">-></span>
					{formatNumber(spike.apsEnd)}/s
				</span>
				{#if apsMultiplier > 0}
					<span class="font-mono font-bold {hasApsJump ? 'text-red-400' : 'text-gray-500'}">
						({apsMultiplier >= 2 ? `${apsMultiplier.toFixed(0)}x` : `+${((apsMultiplier - 1) * 100).toFixed(0)}%`})
					</span>
				{/if}
			</div>
			<div class="flex gap-2 items-center text-xs text-gray-500 ml-auto">
				<Zap size={11} />
				<span>{spike.actions.length} actions</span>
			</div>
		</div>
	</div>

	<!-- Action groups -->
	<div class="flex flex-col gap-2">
		{#each Object.entries(groupedActions) as [type, items]}
			{@const Icon = TYPE_ICONS[type]}
			<div class="flex flex-col gap-1.5">
				<div class="flex gap-2 items-center">
					<span class="border flex gap-1 items-center font-medium px-2 py-0.5 rounded text-xs {TYPE_COLORS[type] ?? 'text-gray-400 bg-white/5 border-white/10'}">
						{#if Icon}
							<Icon size={11} />
						{/if}
						{TYPE_LABELS[type] ?? type}
					</span>
					<span class="text-gray-600 text-xs">{items.reduce((n, i) => n + i.totalBought, 0)} total</span>
				</div>
				<div class="gap-1.5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pl-2">
					{#each items as item (item.key)}
						{@const generatorType = item.raw.type === 'generator' ? item.raw.details?.split(' ')[0] : null}
						{@const GeneratorIcon = generatorType ? GENERATOR_ICONS[generatorType] : null}
						{@const generatorColorIdx = generatorType ? GENERATOR_TYPE_ORDER.indexOf(generatorType as any) : -1}
						{@const generatorColor = generatorColorIdx >= 0 ? GENERATOR_COLORS[generatorColorIdx] : null}
						<div class="bg-black/20 border-l-2 flex flex-col gap-0.5 min-w-0 px-2.5 py-1.5 rounded-r-lg {item.isApsBooster ? 'border-amber-500/60' : 'border-white/10'}">
							<div class="flex gap-1.5 items-center">
								{#if GeneratorIcon && generatorColor}
									<GeneratorIcon color={generatorColor} size={13} />
								{:else if Icon}
									<Icon class="shrink-0 text-gray-400" size={11} />
								{/if}
								<span class="font-medium text-gray-200 text-xs truncate" title={item.label}>{item.label}</span>
								{#if item.isNew}
									<span class="bg-sky-500/20 border border-sky-500/40 px-1 py-px rounded text-sky-400 text-xs shrink-0 font-mono">new</span>
								{/if}
								{#if item.totalBought > 1}
									<span class="bg-white/10 font-mono font-bold px-1 py-0.5 rounded text-white text-xs shrink-0">{item.totalBought}x</span>
								{/if}
								{#if item.isApsBooster}
									<TrendingUp class="shrink-0 text-amber-400" size={10} />
								{/if}
							</div>
							{#if item.raw.type === 'generator' && item.apsDelta > 0}
								<span class="text-green-400/70 text-xs font-mono">+{formatNumber(item.apsDelta)}/s</span>
							{:else if item.description}
								<span class="text-gray-500 text-xs leading-tight line-clamp-2">{item.description}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
