import { CanvasLoop, pixelRatio } from '#helpers/CanvasLoop.js';
import { rgba, TAU } from '#helpers/nucleus.js';
import { MINI_NUCLEONS, nucleonsOf, paintAtom, paintNucleus } from './atoms.js';

export type CellLook =
	/** `glow` is the lamp color, a soft halo behind the atom. */
	| { color: string; glow?: string; kind: 'identified' | 'ready' | 'reading' }
	| { color: string; kind: 'forging'; progress: number }
	| { kind: 'waiting' };

interface Slot {
	size: number;
	x: number;
	y: number;
}

const BARE_COLOR = '#c3cad6';
/** The atom leaves the bottom of its cell to the symbol. */
const ATOM_SHARE = 0.86;
const POP_SECONDS = 0.5;
const LAMP_GLOW_ALPHA = 0.4;
/** Widest a ready nucleus's pulsing glow gets relative to its atom, it reaches past the top of the cell. */
const READY_GLOW = 1.23;

/** What a cell's pixels depend on, as `drawCell` reads it: a forging cell only shows its nucleon count. */
function pixelsOf(z: number, look: CellLook): string {
	if (look.kind === 'waiting') return look.kind;
	const extra = look.kind === 'forging' ? Math.floor(look.progress * Math.min(MINI_NUCLEONS, nucleonsOf(z))) : (look.glow ?? '');
	return `${look.kind}:${look.color}:${extra}`;
}

/** Every element as a mini atom on one canvas under the cells. The loop only runs while a ready nucleus wobbles or a cell pops. */
export class TableAtoms extends CanvasLoop {
	private readonly changed = new Map<number, number>();
	private readonly ctx: CanvasRenderingContext2D;
	private full = true;
	private looks = new Map<number, CellLook>();
	private slots = new Map<number, Slot>();
	private time = 0;

	/** The canvas overflows the grid so the first row's glows and pops aren't cut, `zoom` sharpens a pinch-zoomed table. */
	constructor(
		canvas: HTMLCanvasElement,
		private readonly zoom = 1,
	) {
		super(canvas, 'canvas:tableAtoms');
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		this.observe();
	}

	/** Forging progress lands every second but only repaints when it adds a nucleon, a cell changing otherwise repaints the whole table. */
	set(looks: Map<number, CellLook>) {
		let repaint = looks.size !== this.looks.size;
		for (const [z, look] of looks) {
			const previous = this.looks.get(z);
			if (previous?.kind !== look.kind) this.changed.set(z, this.time);
			repaint ||= !previous || pixelsOf(z, previous) !== pixelsOf(z, look);
		}
		this.looks = looks;
		if (!repaint) return;
		this.full = true;
		this.update();
		this.redraw();
	}

	/** A state change, a resize or a pop repaints the whole table, otherwise only the wobbling ready cells. */
	protected draw(dt: number): boolean {
		const { ctx, ratio } = this;
		this.time += dt;
		const popping = this.changed.size > 0;
		const full = this.full || popping;
		if (full) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

		/** Wiping every ready glow before painting any keeps a glow reaching past its cell from erasing its neighbor's. */
		if (!full)
			for (const [z, look] of this.looks) {
				const slot = this.slots.get(z);
				if (look.kind !== 'ready' || !slot) continue;
				const size = slot.size * ATOM_SHARE;
				const reach = (size * READY_GLOW) / 2 + 1;
				ctx.clearRect(slot.x + slot.size / 2 - reach, slot.y + size / 2 - reach, reach * 2, reach * 2);
			}

		let moving = popping;
		for (const [z, look] of this.looks) {
			const slot = this.slots.get(z);
			if (!slot || (!full && look.kind !== 'ready')) continue;
			this.drawCell(z, look, slot);
			moving ||= look.kind === 'ready';
		}
		/** The frame after the last pop repaints in full to wipe what it drew past its cell. */
		this.full = popping;
		return moving;
	}

	private drawCell(z: number, look: CellLook, slot: Slot) {
		const { ctx, ratio } = this;
		const size = slot.size * ATOM_SHARE;
		const x = slot.x + (slot.size - size) / 2;
		const y = slot.y;
		const cx = x + size / 2;
		const cy = y + size / 2;
		const pixels = Math.max(8, Math.round(size * ratio));
		const nucleons = Math.min(MINI_NUCLEONS, nucleonsOf(z));

		const age = (this.time - (this.changed.get(z) ?? -POP_SECONDS)) / POP_SECONDS;
		if (age >= 1) this.changed.delete(z);
		const pop = age < 1 ? 1 + 0.35 * Math.sin(age * Math.PI) * (1 - age) : 1;
		ctx.save();
		ctx.translate(cx, cy);
		ctx.scale(pop, pop);
		ctx.translate(-cx, -cy);

		if (look.kind === 'identified') {
			if (look.glow) {
				ctx.globalAlpha = LAMP_GLOW_ALPHA;
				ctx.drawImage(this.glow(look.glow), cx - size / 2, cy - size / 2, size, size);
				ctx.globalAlpha = 1;
			}
			ctx.drawImage(this.sprite(`atom:${z}`, ctx => paintAtom(ctx, pixels, z, look.color), pixels), x, y, size, size);
		} else if (look.kind === 'waiting') {
			ctx.strokeStyle = 'rgb(252 211 77 / 0.35)';
			ctx.lineWidth = 1;
			ctx.setLineDash([2, 3]);
			ctx.beginPath();
			ctx.arc(cx, cy, size * 0.28, 0, TAU);
			ctx.stroke();
		} else {
			const forging = look.kind === 'forging';
			const shown = forging ? Math.floor(look.progress * nucleons) : nucleons;
			const color = forging ? look.color : BARE_COLOR;
			const pulse = look.kind === 'ready' ? Math.sin(this.time * 4 + z) : 0;
			const glowSize = size * (look.kind === 'ready' ? 1.15 + 0.08 * pulse : 0.95);
			ctx.globalAlpha = look.kind === 'ready' ? 0.55 + 0.25 * pulse : look.kind === 'reading' ? 0.45 : 0.25;
			ctx.drawImage(this.glow(look.color), cx - glowSize / 2, cy - glowSize / 2, glowSize, glowSize);
			if (shown > 0) {
				const radius = pixels * (0.14 + 0.1 * Math.cbrt(nucleons / MINI_NUCLEONS));
				const sprite = this.sprite(`bare:${z}:${shown}:${color}`, ctx => paintNucleus(ctx, pixels / 2, pixels / 2, radius, shown, color), pixels);
				const scale = 1 + 0.06 * pulse;
				ctx.translate(cx, cy);
				ctx.rotate(look.kind === 'ready' ? Math.sin(this.time * 9 + z * 2) * 0.06 : 0);
				ctx.scale(scale, scale);
				ctx.globalAlpha = forging ? 0.85 : 1;
				ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
			}
		}
		ctx.restore();
	}

	protected resize() {
		this.full = true;
		this.ratio = pixelRatio() * this.zoom;
		this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * this.ratio));
		this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * this.ratio));
		const { offsetLeft, offsetTop } = this.canvas;
		const cells = this.canvas.parentElement?.querySelectorAll<HTMLElement>('[data-cell]') ?? [];
		this.slots = new Map([...cells].map(cell => [Number(cell.dataset.cell), { size: cell.offsetWidth, x: cell.offsetLeft - offsetLeft, y: cell.offsetTop - offsetTop }]));
		this.clearSprites();
		this.redraw();
	}

	private glow(color: string): HTMLCanvasElement {
		return this.sprite(
			`glow:${color}`,
			(ctx, half) => {
				const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
				gradient.addColorStop(0, rgba(color, 1));
				gradient.addColorStop(0.4, rgba(color, 0.35));
				gradient.addColorStop(1, rgba(color, 0));
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, half * 2, half * 2);
			},
			64,
		);
	}
}
