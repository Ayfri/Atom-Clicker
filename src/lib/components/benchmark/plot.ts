import type { Attachment } from 'svelte/attachments';

export interface ChartSeries {
	color: string;
	data: number[];
	fillOpacity?: number;
	label: string;
}

/** The plot area in pixels, with `maxVal` expressed in the scale the values are drawn in (log10 when `useLog`). */
export interface Plot {
	height: number;
	maxVal: number;
	useLog: boolean;
	width: number;
}

/** Skips the 0 width of a hidden chart, where `bind:clientWidth` would collapse it. */
export function observeWidth(onWidth: (width: number) => void): Attachment<HTMLElement> {
	return node => {
		const observer = new ResizeObserver(([entry]) => {
			if (entry.contentRect.width > 0) onWidth(entry.contentRect.width);
		});
		observer.observe(node);
		return () => observer.disconnect();
	};
}

export function transformValue(val: number, useLog: boolean): number {
	return useLog ? Math.log10(Math.max(val, 1)) : val;
}

export function yOf(val: number, plot: Plot): number {
	return plot.height - plot.height * (Math.max(0, transformValue(val, plot.useLog)) / plot.maxVal);
}

/** `scale` is the share of the width a run takes when another, longer run shares the axis. */
export function linePath(data: number[], dataLen: number, scale: number, plot: Plot): string {
	const denom = dataLen > 1 ? dataLen - 1 : 1;
	return data.map((val, i) => `${i === 0 ? 'M' : 'L'} ${dataLen > 1 ? (plot.width * i * scale) / denom : 0},${yOf(val, plot)}`).join(' ');
}

export function areaPath(data: number[], dataLen: number, scale: number, plot: Plot): string {
	const path = linePath(data, dataLen, scale, plot);
	if (!path) return '';
	return `${path} L ${dataLen > 1 ? plot.width * scale : 0},${plot.height} L 0,${plot.height} Z`;
}
