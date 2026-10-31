import { ELEMENTS } from '#data/elements.js';
import { CanvasLoop } from '#helpers/CanvasLoop.js';
import { rgba } from '#helpers/nucleus.js';

export const GRID_COLUMNS = 18;
/** Seven periods, a gap, then the lanthanides and actinides. */
export const GRID_ROWS = 9.4;
/** When the diagonal wave starts drawing the outlines, in ms since the introduction began. */
export const GRID_AT = 3200;

const BASE_ALPHA = 0.14;
const CELL_SHARE = 0.86;
const FLASH_ALPHA = 0.5;
const GAP_ROWS = 0.4;
const RING_MS = 450;
const SYMBOL_SHARE = 0.42;
const WAVE_MS = 400;
const WAVE_STEP_MS = 18;
const LAST_WAVE_MS = GRID_AT + Math.max(...ELEMENTS.map(({ column, row }) => row + column)) * WAVE_STEP_MS + WAVE_MS;

interface Ring {
	color: string;
	from: number;
	progress: number;
}

/** Row of an element in grid units: the lanthanide and actinide rows sit under the gap that the real Table also leaves. */
const rowOf = (row: number) => (row <= 7 ? row - 1 : row - 3 + GAP_ROWS);

/** Center of an element's cell in a grid `width` CSS pixels wide, relative to its top left corner. */
export function cellCenter(z: number, width: number): { x: number; y: number } {
	const { column, row } = ELEMENTS[z - 1];
	const pitch = width / GRID_COLUMNS;
	return { x: (column - 0.5) * pitch, y: (rowOf(row) + 0.5) * pitch };
}

/** Font size in px of an element symbol in a grid `width` CSS pixels wide. */
export const symbolSize = (width: number) => (width / GRID_COLUMNS) * CELL_SHARE * SYMBOL_SHARE;

/** The ghost 18-column Table of the introduction: outlines drawn by a diagonal wave, landed symbols and forge rings, all on one canvas. */
export class IntroGrid extends CanvasLoop {
	private readonly ctx: CanvasRenderingContext2D;
	private end = LAST_WAVE_MS;
	private finished = false;
	private readonly landed = new Set<number>();
	private readonly rings = new Map<number, Ring>();
	private startedAt = 0;
	private width = 0;

	constructor(canvas: HTMLCanvasElement) {
		super(canvas, 'canvas:tableIntro');
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		this.observe();
	}

	/** Jumps to the last frame: every outline, symbol and ring is in place. */
	finish() {
		this.finished = true;
		this.redraw();
	}

	/** The symbol of `z` settles in its cell, grey. */
	land(z: number) {
		this.landed.add(z);
		this.update();
	}

	/** `from` is in ms since `start`, the ring then fills to `progress` of its cell. */
	ring(z: number, color: string, progress: number, from: number) {
		this.rings.set(z, { color, from, progress });
		this.end = Math.max(this.end, from + RING_MS);
	}

	start() {
		this.startedAt = performance.now();
		this.update();
	}

	protected draw(): boolean {
		const { ctx, ratio, width } = this;
		const elapsed = this.finished ? Infinity : performance.now() - this.startedAt;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		const pitch = width / GRID_COLUMNS;
		const size = pitch * CELL_SHARE;
		const inset = (pitch - size) / 2;
		ctx.font = `800 ${size * SYMBOL_SHARE}px system-ui, sans-serif`;
		ctx.lineWidth = 1;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		for (const { column, row, symbol, z } of ELEMENTS) {
			const age = elapsed - GRID_AT - (row + column) * WAVE_STEP_MS;
			if (age < 0) continue;
			const x = (column - 1) * pitch + inset;
			const y = rowOf(row) * pitch + inset;
			ctx.beginPath();
			ctx.roundRect(x, y, size, size, size * 0.14);
			ctx.strokeStyle = rgba('#cfe8ff', BASE_ALPHA + (age < WAVE_MS ? FLASH_ALPHA * Math.sin((Math.PI * age) / WAVE_MS) : 0));
			ctx.stroke();
			if (this.landed.has(z)) {
				ctx.fillStyle = rgba('#ffffff', 0.45);
				ctx.fillText(symbol, x + size / 2, y + size / 2 + size * 0.04);
			}
		}

		for (const [z, ring] of this.rings) {
			const grown = Math.min((elapsed - ring.from) / RING_MS, 1);
			if (grown <= 0) continue;
			const { x, y } = cellCenter(z, width);
			const radius = size * 0.4;
			ctx.lineWidth = 2;
			ctx.strokeStyle = rgba('#ffffff', 0.18);
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			ctx.stroke();
			ctx.strokeStyle = ring.color;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(ring.progress, 0.08) * grown);
			ctx.stroke();
		}
		return elapsed < this.end;
	}

	protected resize(width: number, height: number) {
		this.width = width;
		this.fit(width, height);
		this.redraw();
	}
}
