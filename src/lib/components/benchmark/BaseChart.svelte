<script lang="ts">
	import { formatNumber, formatSimTimePrecise } from '#lib/utils.js';
	import type { Attachment } from 'svelte/attachments';

	export interface ChartSeries {
		color: string;
		data: number[];
		fillOpacity?: number;
		label: string;
		visible?: boolean;
	}

	interface Props {
		description?: string;
		height?: number;
		series: ChartSeries[];
		title: string;
		totalHours: number;
		useLog?: boolean;
		yAxisSuffix?: string;
	}

	let { description, height = 320, series, title, totalHours, useLog = false, yAxisSuffix = '' }: Props = $props();

	let containerWidth = $state(800);
	const padding = { bottom: 30, left: 60, right: 20, top: 20 };
	let hoveredIndex = $state<number | null>(null);
	let hiddenLabels = $state<Set<string>>(new Set());

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
	const maxVal = $derived.by(() => {
		let max = 0;
		let hasData = false;

		series.forEach(s => {
			if (hiddenLabels.has(s.label)) return;
			if (!s.data || s.data.length === 0) return;
			hasData = true;

			for (const val of s.data) {
				const v = transformValue(val);
				if (v > max) max = v;
			}
		});

		if (!hasData) return 0;
		max = max * 1.1;
		return max < 0.0001 ? 1 : max;
	});

	const hasVisibleSeries = $derived(series.some(s => !hiddenLabels.has(s.label) && s.data?.length > 0));

	const dataLen = $derived(series[0]?.data.length ?? 0);
	const denominator = $derived(dataLen > 1 ? dataLen - 1 : 1);

	function transformValue(val: number): number {
		if (!useLog) return val;
		return Math.log10(Math.max(val, 1));
	}

	function getLinePath(data: number[]): string {
		if (data.length === 0) return '';

		return data
			.map((val, i) => {
				const x = dataLen > 1 ? (chartWidth * i) / denominator : 0;
				const v = Math.max(0, transformValue(val));
				const ratio = v / maxVal;
				const y = chartHeight - chartHeight * ratio;
				return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
			})
			.join(' ');
	}

	function getAreaPath(data: number[]): string {
		const linePath = getLinePath(data);
		if (!linePath) return '';

		const firstX = 0;
		const lastX = dataLen > 1 ? chartWidth : 0;

		return `${linePath} L ${lastX},${chartHeight} L ${firstX},${chartHeight} Z`;
	}

	function handlePointerMove(e: PointerEvent) {
		if (!hasVisibleSeries) return;
		const rect = (e.currentTarget as Element).getBoundingClientRect();
		const x = e.clientX - rect.left - padding.left;
		if (x < 0 || x > chartWidth) {
			hoveredIndex = null;
			return;
		}
		let index = 0;
		if (dataLen > 1) {
			index = Math.min(Math.max(0, Math.round((x / chartWidth) * denominator)), denominator);
		}

		hoveredIndex = index;
	}

	function handlePointerLeave() {
		hoveredIndex = null;
	}

	function toggleSeries(label: string) {
		const newSet = new Set(hiddenLabels);
		if (newSet.has(label)) {
			newSet.delete(label);
		} else {
			newSet.add(label);
		}
		hiddenLabels = newSet;
	}

	const tooltipData = $derived.by(() => {
		if (hoveredIndex === null) return [];
		return series
			.map(s => ({
				s,
				val: s.data[hoveredIndex!] ?? 0,
				visible: !hiddenLabels.has(s.label),
			}))
			.filter(item => item.visible && item.val !== undefined)
			.sort((a, b) => b.val - a.val);
	});

	const tooltipX = $derived(hoveredIndex !== null ? (chartWidth * hoveredIndex) / denominator : 0);
	const tooltipStyle = $derived.by(() => {
		if (hoveredIndex === null) return '';
		const ttWidth = 180;
		const ttLeft = padding.left + tooltipX + 15;
		let finalLeft = ttLeft;
		if (ttLeft + ttWidth > containerWidth) {
			finalLeft = padding.left + tooltipX - ttWidth - 15;
		}

		return `left: ${finalLeft}px; top: ${padding.top + 10}px; width: ${ttWidth}px;`;
	});

	const simulatedTimeMs = $derived(hoveredIndex !== null ? (totalHours * hoveredIndex * 3600000) / denominator : 0);
</script>

<div class="flex flex-col gap-4 w-full">
	<div class="flex flex-wrap gap-4 items-center justify-between px-2 w-full">
		<div class="flex flex-col gap-0.5">
			<h3 class="font-semibold text-gray-300 text-sm">{title}</h3>
			{#if description}
				<p class="text-[11px] text-slate-500 leading-tight">{description}</p>
			{/if}
		</div>

		<div class="flex flex-wrap gap-x-4 gap-y-2 justify-end">
			{#each series as s (s.label)}
				<button
					onclick={() => toggleSeries(s.label)}
					class={['flex gap-2 group items-center text-xs transition-all', hiddenLabels.has(s.label) && 'opacity-40 grayscale']}
					aria-label="Toggle {s.label}"
				>
					<span
						class="block h-2.5 rounded-full shadow-sm w-2.5"
						style="box-shadow: 0 0 8px {s.color}66; background-color: {s.color}"
					></span>
					<span class="font-medium group-hover:text-white text-gray-400 transition-colors">{s.label}</span>
				</button>
			{/each}

			<div class="flex gap-2 items-center ml-2 pl-2">
				<button
					onclick={() => (hiddenLabels = new Set())}
					class="hover:text-white text-[10px] text-gray-600 transition-colors uppercase"
				>
					All
				</button>
				<span class="text-gray-700">/</span>
				<button
					onclick={() => (hiddenLabels = new Set(series.map(s => s.label)))}
					class="hover:text-white text-[10px] text-gray-600 transition-colors uppercase"
				>
					None
				</button>
			</div>
		</div>
	</div>

	<div
		{@attach resize}
		class="bg-black/20 border border-white/5 overflow-hidden relative rounded-xl select-none w-full"
		style="height: {height}px;"
		onpointermove={handlePointerMove}
		onpointerleave={handlePointerLeave}
		role="application"
		aria-label="Interactive chart"
	>
		<svg
			width={containerWidth}
			{height}
			viewBox="0 0 {containerWidth} {height}"
			class="block h-full pointer-events-none w-full"
		>
			<defs>
				<linearGradient
					id="chartBgGradient"
					x1="0%"
					y1="0%"
					x2="0%"
					y2="100%"
				>
					<stop
						offset="0%"
						stop-color="#0f172a"
					></stop>
					<stop
						offset="100%"
						stop-color="#1e293b"
					></stop>
				</linearGradient>
			</defs>
			<rect
				width="100%"
				height="100%"
				fill="url(#chartBgGradient)"
			></rect>

			<g
				class="text-[10px] font-sans text-slate-400"
				font-family="'Inter', system-ui, sans-serif"
				font-size="10"
			>
				{#each { length: 6 }, i}
					{const y = $derived(padding.top + (chartHeight * i) / 5)}
					{const valRatio = $derived(1 - i / 5)}
					{const valRaw = $derived(useLog ? Math.pow(10, maxVal * valRatio) : maxVal * valRatio)}
					{const val = $derived(valRaw < 0.0001 ? 0 : valRaw)}
					{const text = $derived(formatNumber(val).length > 8 ? val.toExponential(1) : formatNumber(val))}

					<line
						x1={padding.left}
						y1={y}
						x2={containerWidth - padding.right}
						y2={y}
						stroke={i === 5 ? '#475569' : '#1e293b'}
						stroke-width="1"
					></line>

					<text
						x={padding.left - 8}
						{y}
						text-anchor="end"
						dominant-baseline="middle"
						fill="#64748b">{text}{yAxisSuffix}</text
					>
				{/each}
			</g>

			<g
				class="text-[10px] font-sans text-slate-400"
				font-family="'Inter', system-ui, sans-serif"
				font-size="10"
			>
				{#each { length: 7 }, i}
					{const x = $derived(padding.left + (chartWidth * i) / 6)}
					{const hour = $derived((totalHours * i) / 6)}
					<text
						{x}
						y={height - 10}
						text-anchor="middle"
						dominant-baseline="auto"
						fill="#94a3b8">{hour.toFixed(1)}h</text
					>
				{/each}
			</g>

			<g transform="translate({padding.left}, {padding.top})">
				{#if !hasVisibleSeries}
					<text
						x={chartWidth / 2}
						y={chartHeight / 2}
						text-anchor="middle"
						dominant-baseline="middle"
						fill="rgba(148, 163, 184, 0.5)"
						font-size="16"
						font-style="italic">No data visible</text
					>
				{:else}
					{#each series as s (s.label)}
						{#if !hiddenLabels.has(s.label) && s.data?.length > 0}
							{#if s.fillOpacity && s.fillOpacity > 0 && s.data.length > 1}
								<path
									d={getAreaPath(s.data)}
									fill={s.color}
									fill-opacity={s.fillOpacity}
								></path>
							{/if}

							{#if s.data.length > 1}
								<path
									d={getLinePath(s.data)}
									fill="none"
									stroke={s.color}
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								></path>
							{:else}
								{const val = $derived(Math.max(0, transformValue(s.data[0])))}
								{const y = $derived(chartHeight - chartHeight * (val / maxVal))}
								<circle
									cx="0"
									cy={y}
									r="4"
									fill={s.color}
								></circle>
							{/if}
						{/if}
					{/each}

					{#if hoveredIndex !== null && tooltipData.length > 0}
						<line
							x1={tooltipX}
							y1="0"
							x2={tooltipX}
							y2={chartHeight}
							stroke="rgba(255, 255, 255, 0.5)"
							stroke-width="1"
							stroke-dasharray="4 4"
						></line>

						{#each tooltipData as { s, val } (s.label)}
							{const v = $derived(Math.max(0, transformValue(val)))}
							{const y = $derived(chartHeight - chartHeight * (v / maxVal))}
							<circle
								cx={tooltipX}
								cy={y}
								r="4"
								fill={s.color}
								stroke="#1e293b"
								stroke-width="2"
							></circle>
						{/each}
					{/if}
				{/if}
			</g>
		</svg>

		{#if hoveredIndex !== null && tooltipData.length > 0}
			<div
				class="absolute backdrop-blur-md bg-slate-900/95 border border-slate-600/50 p-3 pointer-events-none rounded-2xl shadow-2xl text-xs z-10"
				style={tooltipStyle}
			>
				<div class="font-bold mb-2 text-slate-50">Time: {formatSimTimePrecise(simulatedTimeMs)}</div>
				<div class="flex flex-col gap-1.5">
					{#each tooltipData as { s, val } (s.label)}
						<div class="flex items-center justify-between gap-4">
							<div class="flex gap-2 items-center overflow-hidden">
								<span
									class="h-2 rounded-full shrink-0 w-2"
									style="background-color: {s.color}"
								></span>
								<span class="text-slate-300 truncate">{s.label}</span>
							</div>
							<span class="font-mono text-white">{formatNumber(val)}{yAxisSuffix}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
