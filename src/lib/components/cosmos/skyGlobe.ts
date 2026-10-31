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
