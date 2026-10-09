import { NEUTRON_COLOR, NUCLEON_RADIUS, packNucleus, paintNucleon, rgba, TAU } from '#helpers/nucleus.js';

/** Subshells in Madelung filling order, as [shell, capacity]. */
const SUBSHELLS = [
	[1, 2], [2, 2], [2, 6], [3, 2], [3, 6], [4, 2], [3, 10], [4, 6], [5, 2], [4, 10], [5, 6], [6, 2], [4, 14], [5, 10], [6, 6], [7, 2], [5, 14], [6, 10],
	[7, 6], [8, 2],
] as const;

export type StageKind = 'forging' | 'identified' | 'ready' | 'reading' | 'waiting';

/** A mini atom past this many nucleons keeps the same ball, its nucleons would shrink to specks. */
export const MINI_NUCLEONS = 20;

/** Electrons per shell by the Madelung rule, which misses the few exceptions like chromium and copper: K → [2, 8, 8, 1]. */
export function shellsOf(z: number): number[] {
	const shells: number[] = [];
	let left = z;
	for (const [n, capacity] of SUBSHELLS) {
		if (left <= 0) break;
		const take = Math.min(capacity, left);
		shells[n - 1] = (shells[n - 1] ?? 0) + take;
		left -= take;
	}
	return Array.from(shells, count => count ?? 0);
}

/** Mass number of the most common isotope within a few units: Fe → 56, Au → 197, U → 237. */
export const nucleonsOf = (z: number) => (z === 1 ? 1 : Math.round(z * (2 + 0.0063 * z)));

/** The first `count` electrons in filling order, spread back over their shells: the 11 first of argon → [2, 8, 1]. */
export function partialShells(shells: number[], count: number): number[] {
	let left = count;
	return shells.map(capacity => {
		const take = Math.min(capacity, Math.max(0, left));
		left -= take;
		return take;
	});
}

/** Paints a ball of `count` nucleons centered on (x, y), protons and neutrons alternating like a light nucleus. */
export function paintNucleus(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, count: number, protonColor: string, neutronColor = NEUTRON_COLOR) {
	if (count <= 0) return;
	const packing = packNucleus(count);
	const scale = radius / packing.extent;
	const half = NUCLEON_RADIUS * scale;
	const extent = Math.max(1, packing.extent - NUCLEON_RADIUS);
	const order = packing.points.map((point, i) => ({ i, point })).toSorted((a, b) => b.point.z - a.point.z);
	for (const { i, point } of order) {
		ctx.save();
		ctx.translate(x + point.x * scale - half, y + point.y * scale - half);
		paintNucleon(ctx, half, i % 2 ? neutronColor : protonColor, Math.min(1, Math.max(0, (point.z / extent + 1) / 2)));
		ctx.restore();
	}
}

/** Nucleus radius for a cell of `size`, growing with the nucleon count so hydrogen stays a dot and heavy elements a ball. */
const miniNucleusRadius =(size: number, count: number) => size * (0.07 + 0.09 * Math.min(1, Math.cbrt(count / MINI_NUCLEONS)));

/**
 * Paints element `z` as a flat Bohr atom filling a `size` square: its real shells as rings, every electron as a dot,
 * the nucleus in the middle. Rings get tighter with more shells so the seventh still fits.
 */
export function paintAtom(ctx: CanvasRenderingContext2D, size: number, z: number, color: string) {
	const center = size / 2;
	const shells = shellsOf(z);
	const nucleons = Math.min(MINI_NUCLEONS, nucleonsOf(z));
	const core = miniNucleusRadius(size, nucleons);
	const inner = core + size * 0.06;
	const outer = size * 0.47;
	const step = shells.length > 1 ? (outer - inner) / (shells.length - 1) : 0;
	const dot = Math.max(0.8, size * (shells.length > 4 ? 0.016 : 0.022));

	const glow = ctx.createRadialGradient(center, center, 0, center, center, outer);
	glow.addColorStop(0, rgba(color, 0.35));
	glow.addColorStop(0.5, rgba(color, 0.08));
	glow.addColorStop(1, rgba(color, 0));
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, size, size);

	ctx.lineWidth = Math.max(0.6, size * 0.01);
	shells.forEach((count, shell) => {
		const radius = shells.length > 1 ? inner + step * shell : (inner + outer) / 2;
		ctx.strokeStyle = rgba(color, 0.32);
		ctx.beginPath();
		ctx.arc(center, center, radius, 0, TAU);
		ctx.stroke();
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		for (let i = 0; i < count; i++) {
			const angle = shell * 0.9 + (i * TAU) / count;
			const ex = center + Math.cos(angle) * radius;
			const ey = center + Math.sin(angle) * radius;
			ctx.moveTo(ex + dot, ey);
			ctx.arc(ex, ey, dot, 0, TAU);
		}
		ctx.fill();
	});

	paintNucleus(ctx, center, center, core, nucleons, color);
}
