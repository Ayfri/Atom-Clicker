<script lang="ts">
	/** Two runs overlaid, each scaled to its actual duration. */
	import type { ChartSeries } from '#lib/components/benchmark/BaseChart.svelte';
	import { formatNumber, formatSimTimePrecise } from '#lib/utils.js';
	import type { Attachment } from 'svelte/attachments';

	interface Props {
		comparisonDurationHours?: number;
		comparisonSeries?: ChartSeries[];
		comparisonTitle?: string;
		description?: string;
		height?: number;
		primarySeries: ChartSeries[];
		primaryTitle?: string;
		title: string;
		totalHours: number;
		useLog?: boolean;
		yAxisSuffix?: string;
	}

	let {
		comparisonDurationHours = 0,
		comparisonSeries = [],
		comparisonTitle = 'Comparison',
		description,
		height = 360,
		primarySeries,
		primaryTitle = 'Current',
		title,
		totalHours,
		useLog = false,
		yAxisSuffix = '',
	}: Props = $props();

	let containerWidth = $state(800);
	let hoveredX = $state<number | null>(null);

	const padding = { bottom: 35, left: 70, right: 20, top: 25 };

	/** Skips the 0 width of a hidden chart, where `bind:clientWidth` would collapse it. */
	const resize: Attachment<HTMLElement> = node => {
		const observer = new ResizeObserver(([entry]) => {
			if (entry.contentRect.width > 0) containerWidth = entry.contentRect.width;
		});
		observer.observe(node);
		return () => observer.disconnect();
	};

	const chartWidth = $derived(Math.max(0, containerWidth - padding.left - padding.right));
	const chartHeight = $derived(Math.max(0, height - padding.top - padding.bottom));

	const hasComparison = $derived(comparisonSeries.length > 0 && comparisonDurationHours > 0);

	const primaryDataLen = $derived(primarySeries[0]?.data.length ?? 0);
	const comparisonDataLen = $derived(comparisonSeries[0]?.data.length ?? 0);

	// X axis spans the longest run; each series is scaled to its actual duration fraction.
	const effectiveTotalHours = $derived(Math.max(totalHours, comparisonDurationHours));
	const primaryScale = $derived(effectiveTotalHours > 0 ? totalHours / effectiveTotalHours : 1);
	const comparisonScale = $derived(effectiveTotalHours > 0 ? comparisonDurationHours / effectiveTotalHours : 1);

	function transformValue(val: number): number {
		if (!useLog) return val;
		return Math.log10(Math.max(val, 1));
	}

	const maxVal = $derived.by(() => {
		let max = 0;
		for (const s of [...primarySeries, ...comparisonSeries]) {
			if (!s.data || s.data.length === 0) continue;
			for (const val of s.data) {
				const v = transformValue(val);
				if (v > max) max = v;
			}
		}
		return max * 1.1 || 1;
	});

	function getLinePath(data: number[], dataLen: number, scale: number): string {
		if (data.length === 0) return '';
		const denom = dataLen > 1 ? dataLen - 1 : 1;
		return data
			.map((val, i) => {
				const x = dataLen > 1 ? (chartWidth * i * scale) / denom : 0;
				const v = Math.max(0, transformValue(val));
				const y = chartHeight - chartHeight * (v / maxVal);
				return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
			})
			.join(' ');
	}

	function getAreaPath(data: number[], dataLen: number, scale: number): string {
		const linePath = getLinePath(data, dataLen, scale);
		if (!linePath) return '';
		const lastX = dataLen > 1 ? chartWidth * scale : 0;
		return `${linePath} L ${lastX},${chartHeight} L 0,${chartHeight} Z`;
	}

	// Separate hover indices per run so each maps to the correct game time.
	const primaryHoveredIndex = $derived.by(() => {
		if (hoveredX === null || primaryDataLen === 0) return null;
		const endX = chartWidth * primaryScale;
		if (endX <= 0 || hoveredX > endX) return null;
		return Math.min(Math.max(0, Math.round((hoveredX / endX) * (primaryDataLen - 1))), primaryDataLen - 1);
	});

	const comparisonHoveredIndex = $derived.by(() => {
		if (hoveredX === null || !hasComparison || comparisonDataLen === 0) return null;
		const endX = chartWidth * comparisonScale;
		if (endX <= 0 || hoveredX > endX) return null;
		return Math.min(Math.max(0, Math.round((hoveredX / endX) * (comparisonDataLen - 1))), comparisonDataLen - 1);
	});

	const primaryTooltipData = $derived.by(() => {
		if (primaryHoveredIndex === null) return [];
		return primarySeries.map(s => ({
			color: s.color,
			label: s.label,
			val: s.data[primaryHoveredIndex!] ?? 0,
		}));
	});

	const comparisonTooltipData = $derived.by(() => {
		if (comparisonHoveredIndex === null) return [];
		return comparisonSeries.map(s => ({
			color: s.color,
			label: s.label,
			val: s.data[comparisonHoveredIndex!] ?? 0,
		}));
	});

	const primaryTimeMs = $derived(
		primaryHoveredIndex !== null && primaryDataLen > 1
			? (totalHours * primaryHoveredIndex * 3600000) / (primaryDataLen - 1)
			: 0,
	);
	const comparisonTimeMs = $derived(
		comparisonHoveredIndex !== null && comparisonDataLen > 1
			? (comparisonDurationHours * comparisonHoveredIndex * 3600000) / (comparisonDataLen - 1)
			: 0,
	);

	// Dot X positions snap to the nearest data point, not the raw mouse X.
	const primaryDotX = $derived(
		primaryHoveredIndex !== null && primaryDataLen > 1
			? (chartWidth * primaryHoveredIndex * primaryScale) / (primaryDataLen - 1)
			: null,
	);
	const comparisonDotX = $derived(
		comparisonHoveredIndex !== null && comparisonDataLen > 1
			? (chartWidth * comparisonHoveredIndex * comparisonScale) / (comparisonDataLen - 1)
			: null,
	);

	const tooltipStyle = $derived.by(() => {
		if (hoveredX === null) return '';
		const ttWidth = hasComparison && comparisonHoveredIndex !== null ? 280 : 190;
		let ttLeft = padding.left + hoveredX + 15;
		if (ttLeft + ttWidth > containerWidth) ttLeft = padding.left + hoveredX - ttWidth - 15;
		return `left: ${ttLeft}px; top: ${padding.top + 10}px; width: ${ttWidth}px;`;
	});

	function handlePointerMove(e: PointerEvent) {
		const rect = (e.currentTarget as Element).getBoundingClientRect();
		const x = e.clientX - rect.left - padding.left;
		hoveredX = x >= 0 && x <= chartWidth ? x : null;
	}

	function handlePointerLeave() {
		hoveredX = null;
	}
</script>

<div class="flex flex-col gap-4 w-full">
	<div class="flex flex-wrap gap-4 items-center justify-between px-2 w-full">
		<div class="flex flex-col gap-0.5">
			<h3 class="font-semibold text-gray-300 text-sm">{title}</h3>
			{#if description}
				<p class="text-[11px] text-slate-500 leading-tight">{description}</p>
			{/if}
		</div>

		{#if hasComparison}
			<div class="flex gap-5 text-xs">
				<div class="flex gap-2 items-center">
					<span class="bg-white h-px w-6 opacity-60"></span>
					<span class="text-gray-400">{primaryTitle} ({totalHours.toFixed(1)}h)</span>
				</div>
				<div class="flex gap-2 items-center">
					<svg width="24" height="2" class="overflow-visible"><line x1="0" y1="1" x2="24" y2="1" stroke="white" stroke-width="2" stroke-dasharray="6 3" stroke-opacity="0.6"/></svg>
					<span class="text-gray-400">{comparisonTitle} ({comparisonDurationHours.toFixed(1)}h)</span>
				</div>
			</div>
		{/if}

		<div class="flex flex-wrap gap-x-4 gap-y-2 justify-end">
			{#each primarySeries as s (s.label)}
				<div class="flex gap-2 items-center text-xs">
					<span
						class="block h-2.5 rounded-full shadow-sm w-2.5"
						style="box-shadow: 0 0 8px {s.color}66; background-color: {s.color}"
					></span>
					<span class="font-medium text-gray-400">{s.label}</span>
				</div>
			{/each}
		</div>
	</div>

	<div
		{@attach resize}
		class="bg-black/20 border border-white/5 overflow-hidden relative rounded-xl select-none w-full"
		style="height: {height}px;"
		onpointermove={handlePointerMove}
		onpointerleave={handlePointerLeave}
		role="application"
		aria-label="Interactive comparison chart"
	>
		<svg
			width={containerWidth}
			{height}
			viewBox="0 0 {containerWidth} {height}"
			class="block h-full pointer-events-none w-full"
		>
			<defs>
				<linearGradient id="cmpBg" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stop-color="#0f172a"></stop>
					<stop offset="100%" stop-color="#1e293b"></stop>
				</linearGradient>
			</defs>
			<rect width="100%" height="100%" fill="url(#cmpBg)"></rect>

			<g font-family="'Inter', system-ui, sans-serif" font-size="10">
				{#each { length: 6 }, i}
					{const y = $derived(padding.top + (chartHeight * i) / 5)}
					{const valRatio = $derived(1 - i / 5)}
					{const valRaw = $derived(useLog ? Math.pow(10, maxVal * valRatio) : maxVal * valRatio)}
					{const text = $derived(formatNumber(valRaw < 0.0001 ? 0 : valRaw))}
					<line x1={padding.left} y1={y} x2={containerWidth - padding.right} y2={y} stroke={i === 5 ? '#475569' : '#334155'} stroke-width="1"></line>
					<text x={padding.left - 10} {y} text-anchor="end" dominant-baseline="middle" fill="#64748b">{text}{yAxisSuffix}</text>
				{/each}
			</g>

			<g font-family="'Inter', system-ui, sans-serif" font-size="10">
				{#each { length: 7 }, i}
					{const x = $derived(padding.left + (chartWidth * i) / 6)}
					{const hour = $derived((effectiveTotalHours * i) / 6)}
					<text {x} y={height - 12} text-anchor="middle" dominant-baseline="auto" fill="#64748b">{hour.toFixed(1)}h</text>
				{/each}
			</g>

			<g transform="translate({padding.left}, {padding.top})">
				{#each primarySeries as s (s.label)}
					{#if s.data?.length > 0}
						{#if s.fillOpacity && s.fillOpacity > 0 && s.data.length > 1}
							<path d={getAreaPath(s.data, primaryDataLen, primaryScale)} fill={s.color} fill-opacity={s.fillOpacity * 0.5}></path>
						{/if}
						{#if s.data.length > 1}
							<path d={getLinePath(s.data, primaryDataLen, primaryScale)} fill="none" stroke={s.color} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
						{/if}
					{/if}
				{/each}

				{#if hasComparison}
					{#each comparisonSeries as s (s.label)}
						{#if s.data?.length > 1}
							<path
								d={getLinePath(s.data, comparisonDataLen, comparisonScale)}
								fill="none"
								stroke={s.color}
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-dasharray="8 4"
								stroke-opacity="0.75"
							></path>
						{/if}
					{/each}

					{#if comparisonDurationHours < totalHours}
						{const markerX = $derived(chartWidth * comparisonScale)}
						<line x1={markerX} y1="0" x2={markerX} y2={chartHeight} stroke="#475569" stroke-width="1" stroke-dasharray="3 3"></line>
						<text x={markerX + 4} y="10" font-size="9" fill="#64748b" font-family="'Inter', system-ui, sans-serif">end</text>
					{/if}
				{/if}

				{#if hoveredX !== null}
					<line x1={hoveredX} y1="0" x2={hoveredX} y2={chartHeight} stroke="rgba(255,255,255,0.5)" stroke-width="1" stroke-dasharray="4 4"></line>
				{/if}

				{#if primaryDotX !== null}
					{#each primaryTooltipData as { color, label, val } (label)}
						{const v = $derived(Math.max(0, transformValue(val)))}
						{const y = $derived(chartHeight - chartHeight * (v / maxVal))}
						<circle cx={primaryDotX} cy={y} r="5" fill={color} stroke="#0f172a" stroke-width="2"></circle>
					{/each}
				{/if}

				{#if comparisonDotX !== null}
					{#each comparisonTooltipData as { color, label, val } (label)}
						{const v = $derived(Math.max(0, transformValue(val)))}
						{const y = $derived(chartHeight - chartHeight * (v / maxVal))}
						<circle cx={comparisonDotX} cy={y} r="5" fill="#0f172a" stroke={color} stroke-width="2" stroke-dasharray="3 2"></circle>
					{/each}
				{/if}
			</g>
		</svg>

		{#if hoveredX !== null && (primaryTooltipData.length > 0 || comparisonTooltipData.length > 0)}
			<div
				class="absolute backdrop-blur-md bg-slate-900/95 border border-slate-600/50 p-3 pointer-events-none rounded-2xl shadow-2xl text-[11px] z-10"
				style={tooltipStyle}
			>
				{#if hasComparison && comparisonHoveredIndex !== null}
					<div class="grid mb-2 pb-2 border-b border-slate-700" style="grid-template-columns: 1fr auto auto; gap: 0.5rem;">
						<span class="text-slate-500"></span>
						<span class="font-semibold text-emerald-400 text-[10px] text-right truncate">{primaryTitle}</span>
						<span class="font-semibold text-cyan-400 text-[10px] text-right truncate">{comparisonTitle}</span>
					</div>
					<div class="grid mb-2 pb-2 border-b border-slate-700/50 text-[10px]" style="grid-template-columns: 1fr auto auto; gap: 0.5rem;">
						<span class="text-slate-600">Time</span>
						<span class="text-slate-400 text-right">{primaryHoveredIndex !== null ? formatSimTimePrecise(primaryTimeMs) : '—'}</span>
						<span class="text-slate-400 text-right">{formatSimTimePrecise(comparisonTimeMs)}</span>
					</div>
					<div class="flex flex-col gap-1">
						{#each primaryTooltipData as { color, label, val }, i (label)}
							{const cmpVal = $derived(comparisonTooltipData[i]?.val)}
							<div class="grid items-center" style="grid-template-columns: 1fr auto auto; gap: 0.5rem;">
								<div class="flex gap-1.5 items-center min-w-0">
									<span class="h-2 rounded-full shrink-0 w-2" style="background-color: {color}"></span>
									<span class="text-slate-400 truncate">{label}</span>
								</div>
								<span class="font-mono text-emerald-200 text-right">{primaryHoveredIndex !== null ? formatNumber(val) + yAxisSuffix : '—'}</span>
								<span class="font-mono text-cyan-200 text-right">{cmpVal != null ? formatNumber(cmpVal) + yAxisSuffix : '—'}</span>
							</div>
						{/each}
					</div>
				{:else}
					<div class="font-bold mb-2 text-slate-50">
						{primaryHoveredIndex !== null ? formatSimTimePrecise(primaryTimeMs) : ''}
					</div>
					<div class="flex flex-col gap-1.5">
						{#each primaryTooltipData as { color, label, val } (label)}
							<div class="flex items-center gap-2">
								<span class="h-2 rounded-full shrink-0 w-2" style="background-color: {color}"></span>
								<span class="min-w-0 truncate text-slate-300">{label}</span>
								<span class="font-mono ml-auto shrink-0 text-white">{formatNumber(val)}{yAxisSuffix}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
