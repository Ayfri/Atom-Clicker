<script lang="ts">
	import Chart from '$lib/components/benchmark/Chart.svelte';
	import type { ChartSeries } from '$lib/components/benchmark/BaseChart.svelte';
	import { BUILDINGS, BUILDING_COLORS, BUILDING_LEVEL_UP_COST, BUILDING_TYPES } from '$data/buildings';
	import { totalActionCount, type SimulationSnapshot } from '$lib/simulation/types';

	interface SeriesDef {
		color: string;
		fillOpacity?: number;
		getValue: (s: SimulationSnapshot, intervalMin: number) => number;
		label: string;
	}

	interface ChartDef {
		buildCustomSeries?: (snapshots: SimulationSnapshot[], intervalMin: number) => ChartSeries[];
		description?: string;
		half?: boolean;
		height?: number;
		series: SeriesDef[];
		title: string;
		useLog?: boolean;
		yAxisSuffix?: string;
	}

	interface ChartGroup {
		charts: ChartDef[];
		description: string;
		title: string;
	}

	function buildingSeries(
		pick: (s: SimulationSnapshot) => Partial<Record<string, number>>,
		fillOpacity: number,
		keepAbove: number,
	) {
		return (snapshots: SimulationSnapshot[]): ChartSeries[] =>
			BUILDING_TYPES.map((type, i) => ({
				color: BUILDING_COLORS[i],
				data: snapshots.map(s => pick(s)[type] ?? 0),
				fillOpacity,
				label: BUILDINGS[type].name,
			})).filter(s => s.data.some(v => v > keepAbove));
	}

	function groupSeries(colors: readonly string[], label: (i: number) => string, pick: (s: SimulationSnapshot) => number[]) {
		return (snapshots: SimulationSnapshot[]): ChartSeries[] =>
			colors.map((color, i) => ({
				color,
				data: snapshots.map(s => pick(s)[i] ?? 1),
				fillOpacity: 0,
				label: label(i),
			}));
	}

	const TIER_COLORS = ['#fde68a', '#fbbf24', '#f59e0b', '#d97706', '#b45309'];
	const LEVEL_COLORS = ['#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#a3e635', '#65a30d'];
	const ACHIEVEMENT_COLORS = ['#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#8b5cf6', '#f0abfc'];
	const PROTON_COLORS = ['#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#fda4af', '#fb7185'];
	const PROTONISE_COLORS = ['#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c'];

	const CHART_GROUPS: ChartGroup[] = [
		{
			description: 'Raw output of the run: what the player holds, how fast it grows, how often they act.',
			title: 'Economy',
			charts: [
				{
					height: 360,
					series: [
						{ color: '#4ade80', fillOpacity: 0.1, getValue: s => s.atoms, label: 'Atoms' },
						{ color: '#fbbf24', fillOpacity: 0.1, getValue: s => s.protons, label: 'Protons' },
						{ color: '#60a5fa', fillOpacity: 0.1, getValue: s => s.electrons, label: 'Electrons' },
						{ color: '#c084fc', fillOpacity: 0.1, getValue: s => s.photons, label: 'Photons' },
						{ color: '#22d3ee', fillOpacity: 0.1, getValue: s => s.quarks ?? 0, label: 'Quarks' },
					],
					title: 'Currencies (Log Scale)',
					useLog: true,
				},
				{
					height: 360,
					series: [
						{ color: '#f472b6', fillOpacity: 0.3, getValue: s => s.atomsPerSecond, label: 'APS' },
						{ color: '#38bdf8', fillOpacity: 0.1, getValue: s => s.atomsPerClick, label: 'APC' },
					],
					title: 'Atoms Per Second & Per Click (Log Scale)',
					useLog: true,
				},
				{
					description: 'Purchases, prestiges and achievements per minute. Flat zones = the player has nothing affordable to do.',
					series: [{ color: '#f87171', fillOpacity: 0.4, getValue: (s, iMin) => (totalActionCount(s.actionCounts) || s.actions.length) / iMin, label: 'Actions / min' }],
					title: 'Game Pace (Actions per Minute)',
					yAxisSuffix: '/m',
				},
			],
		},
		{
			description: 'Where the global multiplier comes from, then each upgrade family isolated. A line stuck at 1× means that upgrade is never bought.',
			title: 'Multipliers',
			charts: [
				{
					description: 'Total × is the product of every category. Click a legend entry to isolate it.',
					height: 380,
					series: [
						{ color: '#facc15', fillOpacity: 0.1, getValue: s => s.globalMultiplier, label: 'Total ×' },
						{ color: '#f9a8d4', fillOpacity: 0.05, getValue: s => s.globalSkillsMultiplier, label: 'Skills ×' },
						{ color: '#fcd34d', fillOpacity: 0.05, getValue: s => s.globalFlatMultiplier, label: 'Flat Upgrades ×' },
						{ color: '#f87171', fillOpacity: 0.05, getValue: s => s.globalProtonBoostMultiplier, label: 'Proton Boosts ×' },
						{ color: '#fb923c', fillOpacity: 0.05, getValue: s => s.globalProtoniseMultiplier, label: 'Protonise Upgrades ×' },
						{ color: '#a78bfa', fillOpacity: 0.05, getValue: s => s.globalAchievementMultiplier, label: 'Achievement Upgrades ×' },
						{ color: '#86efac', fillOpacity: 0.05, getValue: s => s.globalLevelMultiplier, label: 'Level Upgrades ×' },
						{ color: '#fb7185', fillOpacity: 0.08, getValue: s => s.radiationMultiplier, label: 'Radiation ×' },
						{ color: '#34d399', fillOpacity: 0.08, getValue: s => s.stabilityMultiplier, label: 'Stability ×' },
						{ color: '#c084fc', fillOpacity: 0.08, getValue: s => s.bonusMultiplier, label: 'Power-Up ×' },
						{ color: '#38bdf8', fillOpacity: 0.08, getValue: s => s.atomsCurrencyBoost, label: 'Atoms Boost ×' },
					],
					title: 'Multiplier Stack (Log Scale)',
					useLog: true,
				},
				{
					buildCustomSeries: groupSeries(TIER_COLORS, i => `Tier ${i * 10 + 1}–${i * 10 + 10} ×`, s => s.groupContributions.globalBoostTiers),
					description: 'global_boost_1..50 folded into tiers of 10. Each line = product of the owned upgrades in that range.',
					series: [],
					title: 'Global Boost Upgrades — Tier Products (Log Scale)',
					useLog: true,
				},
				{
					buildCustomSeries: groupSeries(LEVEL_COLORS, i => `level_boost_${i + 1} ×`, s => s.groupContributions.levelBoost),
					description: 'Value stays at 1× until purchased, then grows with player level.',
					half: true,
					height: 300,
					series: [],
					title: 'Level Boost Upgrades (Log Scale)',
					useLog: true,
				},
				{
					buildCustomSeries: groupSeries(ACHIEVEMENT_COLORS, i => `achievement_mul_${i + 1} ×`, s => s.groupContributions.achievementMul),
					description: 'Scales with achievement count, so both buying and earning push the line up.',
					half: true,
					height: 300,
					series: [],
					title: 'Achievement Multiplier Upgrades (Log Scale)',
					useLog: true,
				},
				{
					buildCustomSeries: snapshots => [
						...groupSeries(PROTON_COLORS, i => `proton_boost_${i + 1} ×`, s => s.groupContributions.protonBoost)(snapshots),
						...groupSeries(PROTONISE_COLORS, i => `protonise_boost_${i + 1} ×`, s => s.groupContributions.protoniseBoost)(snapshots),
					],
					description: 'proton_boost_N is a fixed multiplier bought with protons. protonise_boost_N scales with the number of protonises run.',
					series: [],
					title: 'Proton & Protonise Boost Upgrades (Log Scale)',
					useLog: true,
				},
			],
		},
		{
			description: 'Per-building counts and output, then the two multipliers that lift a building above its base rate.',
			title: 'Buildings',
			charts: [
				{
					buildCustomSeries: buildingSeries(s => s.buildings, 0.05, 0),
					height: 360,
					series: [],
					title: 'Building Counts (Log Scale)',
					useLog: true,
				},
				{
					buildCustomSeries: buildingSeries(s => s.buildingProductions, 0.05, 0),
					description: 'Final APS contributed by each building, all multipliers applied. A building that never overtakes the previous tier is mispriced.',
					height: 360,
					series: [],
					title: 'APS by Building (Log Scale)',
					useLog: true,
				},
				{
					buildCustomSeries: buildingSeries(s => s.buildingUpgradeFactors, 0, 0),
					description: 'Every building the run ever owned. A line flat at 1× means no building upgrade for that tier was ever bought.',
					half: true,
					height: 300,
					series: [],
					title: 'Upgrade Multiplier per Building ×',
					useLog: true,
				},
				{
					buildCustomSeries: buildingSeries(s => s.buildingLevelFactors, 0, 0),
					description: `Levels come from owning ${BUILDING_LEVEL_UP_COST} of a building. A line flat at 1× means that tier never reached level 1.`,
					half: true,
					height: 300,
					series: [],
					title: 'Level Multiplier per Building ×',
					useLog: true,
				},
			],
		},
		{
			description: 'Everything the player unlocks over time, and the raw activity feeding it.',
			title: 'Progression',
			charts: [
				{
					height: 360,
					series: [
						{ color: '#fbbf24', fillOpacity: 0, getValue: s => s.achievements, label: 'Achievements' },
						{ color: '#a78bfa', fillOpacity: 0, getValue: s => s.upgrades, label: 'Upgrades Owned' },
						{ color: '#6366f1', fillOpacity: 0, getValue: s => s.totalUpgrades, label: 'Upgrades All-Time' },
						{ color: '#818cf8', fillOpacity: 0, getValue: s => s.skills, label: 'Skills' },
						{ color: '#34d399', fillOpacity: 0, getValue: s => s.skillPointsUsed, label: 'Boost Points Spent' },
						{ color: '#10b981', fillOpacity: 0, getValue: s => s.buildingLevels, label: 'Building Levels' },
						{ color: '#f59e0b', fillOpacity: 0.1, getValue: s => s.playerLevel, label: 'Player Level' },
						{ color: '#f472b6', fillOpacity: 0, getValue: s => s.photonUpgradeLevels, label: 'Photon Upgrade Levels' },
					],
					title: 'Unlocks & Levels (Log Scale)',
					useLog: true,
				},
				{
					series: [
						{ color: '#f59e0b', fillOpacity: 0.15, getValue: s => s.totalXP, label: 'Total XP' },
						{ color: '#60a5fa', fillOpacity: 0.1, getValue: s => s.clicks, label: 'Total Clicks' },
						{ color: '#c084fc', fillOpacity: 0.1, getValue: s => s.buildingsPurchased, label: 'Buildings All-Time' },
					],
					title: 'Activity (Log Scale)',
					useLog: true,
				},
			],
		},
		{
			description: 'Reset loops and the daily-quest economy layered on top of them.',
			title: 'Prestige & Meta',
			charts: [
				{
					half: true,
					height: 300,
					series: [
						{ color: '#f59e0b', fillOpacity: 0.2, getValue: s => s.protonises, label: 'Protonises' },
						{ color: '#06b6d4', fillOpacity: 0.2, getValue: s => s.electronizes, label: 'Electronizes' },
					],
					title: 'Protonises & Electronizes',
				},
				{
					description: 'Quark income split by source: daily quests versus the flat drip from achievements.',
					half: true,
					height: 300,
					series: [
						{ color: '#3ddc84', fillOpacity: 0.1, getValue: s => s.quarksFromQuests ?? 0, label: 'From Quests' },
						{ color: '#ff4d4d', fillOpacity: 0.1, getValue: s => s.quarksFromAchievements ?? 0, label: 'From Achievements' },
					],
					title: 'Quark Sources',
				},
				{
					description: 'Completion rate ignores quest engagement (it measures whether the targets were reachable at all); claiming follows the questBehavior setting.',
					series: [
						{ color: '#a78bfa', fillOpacity: 0.15, getValue: s => s.questsCompletedToday ?? 0, label: 'Completed (last day)' },
						{
							color: '#facc15',
							fillOpacity: 0,
							getValue: s => ((s.questsOfferedTotal ?? 0) > 0 ? ((s.questsCompletedTotal ?? 0) / (s.questsOfferedTotal ?? 1)) * 100 : 0),
							label: 'Completion rate %',
						},
					],
					title: 'Daily Quest Completion',
					yAxisSuffix: '%',
				},
			],
		},
	];

	interface Props {
		comparisonName?: string;
		comparisonSnapshots: SimulationSnapshot[];
		currentSnapshots: SimulationSnapshot[];
		hasComparison: boolean;
		simulationDurationHours: number;
		snapshotInterval: number;
	}

	let { comparisonName, comparisonSnapshots, currentSnapshots, hasComparison, simulationDurationHours, snapshotInterval }: Props =
		$props();

	const comparisonDurationHours = $derived(
		comparisonSnapshots.length > 0 ? comparisonSnapshots[comparisonSnapshots.length - 1].timestamp / 3_600_000 : 0,
	);

	const primaryIntervalMin = $derived(snapshotInterval / 60);
	const cmpIntervalMin = $derived(
		comparisonSnapshots.length > 1 ? (comparisonSnapshots[1].timestamp - comparisonSnapshots[0].timestamp) / 60_000 : primaryIntervalMin,
	);

	function buildChartSeries(def: ChartDef, snapshots: SimulationSnapshot[], intervalMin: number): ChartSeries[] {
		if (snapshots.length === 0) return [];
		if (def.buildCustomSeries) return def.buildCustomSeries(snapshots, intervalMin);
		return def.series.map(d => ({
			color: d.color,
			data: snapshots.map(s => d.getValue(s, intervalMin)),
			fillOpacity: d.fillOpacity,
			label: d.label,
		}));
	}

	interface ChartEntry {
		comparison: ChartSeries[];
		def: ChartDef;
		primary: ChartSeries[];
	}

	// Consecutive `half` charts share a row; everything else spans the full width.
	function toRows(charts: ChartEntry[]): ChartEntry[][] {
		const rows: ChartEntry[][] = [];
		for (const entry of charts) {
			const lastRow = rows[rows.length - 1];
			if (entry.def.half && lastRow?.length === 1 && lastRow[0].def.half) lastRow.push(entry);
			else rows.push([entry]);
		}
		return rows;
	}

	const allGroups = $derived.by(() =>
		CHART_GROUPS.map(group => ({
			description: group.description,
			rows: toRows(
				group.charts.map(def => ({
					comparison: hasComparison ? buildChartSeries(def, comparisonSnapshots, cmpIntervalMin) : [],
					def,
					primary: buildChartSeries(def, currentSnapshots, primaryIntervalMin),
				})),
			),
			title: group.title,
		})),
	);
</script>

{#snippet chartCard(def: ChartDef, primary: ChartSeries[], comparison: ChartSeries[])}
	<div
		class="backdrop-blur-xl bg-white/5 border border-white/10 flex items-center justify-center p-6 rounded-2xl"
		style="min-height: {def.height ?? 340}px"
	>
		<Chart
			{comparisonDurationHours}
			comparisonSeries={comparison}
			comparisonTitle={comparisonName?.slice(0, 20) ?? 'Comparison'}
			description={def.description}
			height={def.height ?? 340}
			primarySeries={primary}
			title={def.title}
			totalHours={simulationDurationHours}
			useLog={def.useLog}
			yAxisSuffix={def.yAxisSuffix}
		/>
	</div>
{/snippet}

<section class="flex flex-col gap-10">
	{#each allGroups as group (group.title)}
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-1 px-1">
				<h2 class="font-semibold text-gray-200 text-lg">{group.title}</h2>
				<p class="text-gray-500 text-sm">{group.description}</p>
			</div>

			{#each group.rows as row (row[0].def.title)}
				{#if row.length > 1}
					<div class="gap-4 grid grid-cols-1 lg:grid-cols-2">
						{#each row as { def, primary, comparison } (def.title)}
							{@render chartCard(def, primary, comparison)}
						{/each}
					</div>
				{:else}
					{@render chartCard(row[0].def, row[0].primary, row[0].comparison)}
				{/if}
			{/each}
		</div>
	{/each}
</section>
