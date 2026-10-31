import { type RockShape, rockLumps } from '#lib/cosmos/rockShapes.js';

export const MAP_HEIGHT = 64;
export const MAP_WIDTH = 128;

const TILT = (20 * Math.PI) / 180;
const LIGHT = [-0.55, 0.45, 0.7] as const;
const LIGHT_LENGTH = Math.hypot(...LIGHT);

/** Parallel arrays with one entry per covered pixel, so a frame is a single pass without trigonometry. */
export interface GlobeLut {
	alpha: Uint8Array;
	column: Float32Array;
	pixel: Uint32Array;
	row: Uint16Array;
	shade: Float32Array;
	size: number;
}

const LUTS = new Map<string, GlobeLut>();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function globeLut(size: number, radius: number): GlobeLut {
	const key = `${size}:${radius}`;
	const cached = LUTS.get(key);
	if (cached) return cached;

	const capacity = size * size;
	const alpha = new Uint8Array(capacity);
	const column = new Float32Array(capacity);
	const pixel = new Uint32Array(capacity);
	const row = new Uint16Array(capacity);
	const shade = new Float32Array(capacity);
	const [lightX, lightY, lightZ] = LIGHT;
	const sin = Math.sin(TILT);
	const cos = Math.cos(TILT);
	let count = 0;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const dx = x + 0.5 - size / 2;
			const dy = y + 0.5 - size / 2;
			const coverage = clamp(radius - Math.hypot(dx, dy), 0, 1);
			if (coverage === 0) continue;

			const nx = dx / radius;
			const ny = -dy / radius;
			const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
			const latitude = Math.asin(clamp(ny * cos + nz * sin, -1, 1));
			alpha[count] = coverage * 255;
			column[count] = (Math.atan2(nx, nz * cos - ny * sin) / (2 * Math.PI)) * MAP_WIDTH;
			pixel[count] = y * size + x;
			row[count] = Math.round((0.5 - latitude / Math.PI) * (MAP_HEIGHT - 1));
			shade[count] = 0.07 + 0.93 * Math.max(0, (nx * lightX + ny * lightY + nz * lightZ) / LIGHT_LENGTH) * (0.85 + 0.15 * nz);
			count++;
		}
	}
	const lut = {
		alpha: alpha.slice(0, count),
		column: column.slice(0, count),
		pixel: pixel.slice(0, count),
		row: row.slice(0, count),
		shade: shade.slice(0, count),
		size,
	};
	LUTS.set(key, lut);
	return lut;
}

/** The lumps never add more than 13% to a radius, the margin of the bounding ellipsoid a ray is marched through. */
const ROCK_REACH = 1.14;
const ROCK_MARCH_STEPS = 24;
const ROCK_REFINE_STEPS = 6;
/** Sub-pixel rays per axis, they give the silhouette its anti-aliased edge. */
const ROCK_SUBSAMPLES = [0.25, 0.75] as const;

/**
 * A rock seen from its side, longest axis across the box and tilted toward the viewer like a globe's pole. Rays are marched through
 * the same lumpy ellipsoid as the 3D mesh, so the silhouette is the mesh's. Each pixel reads the map and the light at the body direction it hits.
 * `radius` is the box's half width in pixels, the rock fills 96% of it.
 */
export function rockLut(size: number, radius: number, { axes, seed }: RockShape): GlobeLut {
	const key = `${size}:${radius}:${axes.join(',')}:${seed}`;
	const cached = LUTS.get(key);
	if (cached) return cached;

	const [ax, ay, az] = axes;
	const [lightX, lightY, lightZ] = LIGHT;
	const sin = Math.sin(TILT);
	const cos = Math.cos(TILT);
	/** Below 0 inside the rock: its body-frame point in units of the axes lies closer to the center than the lumpy unit sphere. `z` is the depth toward the viewer. */
	const field = (x: number, y: number, z: number) => {
		const bx = x / ax;
		const by = (y * cos + z * sin) / ay;
		const bz = (z * cos - y * sin) / az;
		const length = Math.hypot(bx, by, bz);
		return length - rockLumps(bx / length, by / length, bz / length, seed);
	};

	let reachX = 0;
	let reachY = 0;
	for (let i = 0; i < 32; i++) {
		for (let j = 0; j < 64; j++) {
			const polar = ((i + 0.5) / 32) * Math.PI;
			const azimuth = (j / 64) * 2 * Math.PI;
			const x = Math.sin(polar) * Math.sin(azimuth);
			const y = Math.cos(polar);
			const z = Math.sin(polar) * Math.cos(azimuth);
			const lumps = rockLumps(x, y, z, seed);
			reachX = Math.max(reachX, Math.abs(x * ax * lumps));
			reachY = Math.max(reachY, Math.abs(y * ay * lumps * cos - z * az * lumps * sin));
		}
	}
	const scale = (radius * 0.96) / Math.max(reachX, reachY);

	const inverse = 1 / (ROCK_REACH * ROCK_REACH);
	const quadratic = (sin / ay) ** 2 + (cos / az) ** 2;
	const cross = sin * cos * (1 / ay ** 2 - 1 / az ** 2);
	const capacity = size * size;
	const alpha = new Uint8Array(capacity);
	const column = new Float32Array(capacity);
	const pixel = new Uint32Array(capacity);
	const row = new Uint16Array(capacity);
	const shade = new Float32Array(capacity);
	const epsilon = 0.01;
	let count = 0;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let hits = 0;
			let hitX = 0;
			let hitY = 0;
			let hitZ = 0;
			for (const sy of ROCK_SUBSAMPLES) {
				for (const sx of ROCK_SUBSAMPLES) {
					const px = (x + sx - size / 2) / scale;
					const py = -(y + sy - size / 2) / scale;
					/** The ray against the bounding ellipsoid, a quadratic in the depth. */
					const a = quadratic * inverse;
					const b = py * cross * inverse;
					const c = ((px / ax) ** 2 + (py * cos / ay) ** 2 + (py * sin / az) ** 2) * inverse - 1;
					const discriminant = b * b - a * c;
					if (discriminant < 0) continue;

					const root = Math.sqrt(discriminant);
					const top = (-b + root) / a;
					const step = (2 * root) / a / ROCK_MARCH_STEPS;
					let outside = top;
					for (let i = 1; i <= ROCK_MARCH_STEPS; i++) {
						const inside = top - i * step;
						if (field(px, py, inside) >= 0) {
							outside = inside;
							continue;
						}
						let near = outside;
						let far = inside;
						for (let r = 0; r < ROCK_REFINE_STEPS; r++) {
							const middle = (near + far) / 2;
							if (field(px, py, middle) < 0) far = middle;
							else near = middle;
						}
						if (!hits++) {
							hitX = px;
							hitY = py;
							hitZ = far;
						}
						break;
					}
				}
			}
			if (hits === 0) continue;

			let nx = field(hitX + epsilon, hitY, hitZ) - field(hitX - epsilon, hitY, hitZ);
			let ny = field(hitX, hitY + epsilon, hitZ) - field(hitX, hitY - epsilon, hitZ);
			let nz = field(hitX, hitY, hitZ + epsilon) - field(hitX, hitY, hitZ - epsilon);
			const length = Math.hypot(nx, ny, nz) || 1;
			nx /= length;
			ny /= length;
			nz /= length;

			const bx = hitX / ax;
			const by = (hitY * cos + hitZ * sin) / ay;
			const bz = (hitZ * cos - hitY * sin) / az;
			const latitude = Math.asin(clamp(by / Math.hypot(bx, by, bz), -1, 1));
			alpha[count] = (hits / (ROCK_SUBSAMPLES.length ** 2)) * 255;
			column[count] = (Math.atan2(bx, bz) / (2 * Math.PI)) * MAP_WIDTH;
			pixel[count] = y * size + x;
			row[count] = Math.round((0.5 - latitude / Math.PI) * (MAP_HEIGHT - 1));
			shade[count] = 0.07 + 0.93 * Math.max(0, (nx * lightX + ny * lightY + nz * lightZ) / LIGHT_LENGTH) * (0.85 + 0.15 * Math.max(0, nz));
			count++;
		}
	}
	const lut = {
		alpha: alpha.slice(0, count),
		column: column.slice(0, count),
		pixel: pixel.slice(0, count),
		row: row.slice(0, count),
		shade: shade.slice(0, count),
		size,
	};
	LUTS.set(key, lut);
	return lut;
}

/** Pixels outside the disc are never written, `out` is zeroed once. A negative `turn` moves the surface left to right, like a planet spins. */
export function shadeGlobe(out: Uint8ClampedArray, source: Uint8ClampedArray, lut: GlobeLut, turn: number) {
	const { alpha, column, pixel, row, shade } = lut;
	for (let i = 0; i < pixel.length; i++) {
		let u = Math.floor(column[i] + turn) % MAP_WIDTH;
		if (u < 0) u += MAP_WIDTH;
		const from = (row[i] * MAP_WIDTH + u) * 4;
		const to = pixel[i] * 4;
		const light = shade[i];
		out[to] = source[from] * light;
		out[to + 1] = source[from + 1] * light;
		out[to + 2] = source[from + 2] * light;
		out[to + 3] = alpha[i];
	}
}

/** The brightest 2% of the pixels reach `target`, the deep-sky maps are mostly black. Falls back to the brightest pixel when 98% is black. */
export function autoLevel(data: Uint8ClampedArray, target = 230) {
	const histogram = new Uint32Array(256);
	for (let i = 0; i < data.length; i += 4) histogram[Math.max(data[i], data[i + 1], data[i + 2])]++;

	let peak = 255;
	while (peak > 0 && histogram[peak] === 0) peak--;
	if (peak === 0) return;

	const wanted = Math.ceil((data.length / 4) * 0.02);
	let level = peak;
	let seen = 0;
	for (; level > 0; level--) {
		seen += histogram[level];
		if (seen >= wanted) break;
	}
	const gain = target / (level || peak);
	for (let i = 0; i < data.length; i++) if ((i & 3) !== 3) data[i] *= gain;
}
