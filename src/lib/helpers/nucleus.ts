export interface Packing {
	/** Farthest nucleon edge from the center, in nucleon units. */
	extent: number;
	points: Vector[];
}

export interface Vector {
	x: number;
	y: number;
	z: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const NUCLEUS_SHADOW = '#0e1522';
const PACKING_STEPS = 200;
export const NEUTRON_COLOR = '#9aa3ad';
export const NUCLEON_RADIUS = 0.85;
export const TAU = Math.PI * 2;

const packings = new Map<number, Packing>();

function parseHex(hex: string): [number, number, number] {
	const value = Number.parseInt(hex.slice(1, 7), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Returns hex so mixes chain, an `rgb()` string fed back into `parseHex` reads as black. */
export function mix(hex: string, other: string, amount: number): string {
	const a = parseHex(hex);
	const b = parseHex(other);
	return `#${a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

export function rgba(hex: string, alpha: number): string {
	return `rgb(${parseHex(hex).join(' ')} / ${alpha})`;
}

/** Evenly spread directions: a golden-angle spiral over a hemisphere (orbit normals) or over the full sphere (nucleons). */
export function spiralDirection(index: number, height: number): Vector {
	const radius = Math.sqrt(1 - height * height);
	return { x: radius * Math.cos(index * GOLDEN_ANGLE), y: height, z: radius * Math.sin(index * GOLDEN_ANGLE) };
}

/** Settles `count` nucleons into a tight ball: every step pulls them toward the center, then pushes overlapping pairs apart. */
export function packNucleus(count: number): Packing {
	let packing = packings.get(count);
	if (packing) return packing;

	const points = Array.from({ length: count }, (_, i) => {
		const direction = spiralDirection(i, 1 - 2 * ((i * 0.618034 + 0.5) % 1));
		const distance = i === 0 ? 0 : Math.cbrt(i);
		return { x: direction.x * distance, y: direction.y * distance, z: direction.z * distance };
	});
	const spacing = 2 * NUCLEON_RADIUS * 0.9;
	for (let step = 0; step < PACKING_STEPS; step++) {
		if (step < PACKING_STEPS - 20) {
			for (const point of points) {
				point.x *= 0.97;
				point.y *= 0.97;
				point.z *= 0.97;
			}
		}
		for (let a = 0; a < count; a++) {
			for (let b = a + 1; b < count; b++) {
				const dx = points[b].x - points[a].x;
				const dy = points[b].y - points[a].y;
				const dz = points[b].z - points[a].z;
				const distance = Math.hypot(dx, dy, dz);
				if (distance >= spacing || distance < 1e-6) continue;
				const push = (spacing - distance) / (2 * distance);
				points[a].x -= dx * push;
				points[a].y -= dy * push;
				points[a].z -= dz * push;
				points[b].x += dx * push;
				points[b].y += dy * push;
				points[b].z += dz * push;
			}
		}
	}

	const centroid = points.reduce((sum, point) => ({ x: sum.x + point.x / count, y: sum.y + point.y / count, z: sum.z + point.z / count }), { x: 0, y: 0, z: 0 });
	for (const point of points) {
		point.x -= centroid.x;
		point.y -= centroid.y;
		point.z -= centroid.z;
	}
	packing = { extent: Math.max(...points.map(point => Math.hypot(point.x, point.y, point.z))) + NUCLEON_RADIUS, points };
	packings.set(count, packing);
	return packing;
}

/** Paints a nucleon ball filling a `2 * half` square: faint light on the upper left, faint shadow on the lower right, `depth` (0 front to 1 back) dims it. */
export function paintNucleon(ctx: CanvasRenderingContext2D, half: number, color: string, depth: number) {
	const base = mix(mix(color, NEUTRON_COLOR, 0.18), NUCLEUS_SHADOW, depth * 0.3);
	// Centered up-left and wider than the disc, so only the bottom-right limb reaches the shadow stop.
	const gradient = ctx.createRadialGradient(half * 0.72, half * 0.66, 0, half * 0.72, half * 0.66, half * 1.7);
	gradient.addColorStop(0, mix(base, '#ffffff', 0.35));
	gradient.addColorStop(0.3, base);
	gradient.addColorStop(0.62, base);
	gradient.addColorStop(1, mix(base, NUCLEUS_SHADOW, 0.35));
	ctx.beginPath();
	ctx.arc(half, half, half, 0, TAU);
	ctx.fillStyle = gradient;
	ctx.fill();
}
