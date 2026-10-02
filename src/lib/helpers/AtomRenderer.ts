import { CanvasLoop, pixelRatio } from '#helpers/CanvasLoop.js';
import { mix, NEUTRON_COLOR, NUCLEON_RADIUS, packNucleus, paintNucleon, rgba, spiralDirection, TAU, type Vector } from '#helpers/nucleus.js';

export interface AtomShell {
	color: string;
	count: number;
	line: number;
}

export interface AtomScene {
	/** Halo colors around the nucleus, one per prestige layer reached. */
	auras: readonly string[];
	bonus: boolean;
	/** 0 to 1, spins and shakes the atom faster as production grows. */
	energy: number;
	/** One color per prestige layer and realm reached, the protons cycle through them. */
	nucleonColors: readonly string[];
	nucleons: number;
	shells: readonly AtomShell[];
}

interface Palette {
	core: string;
	halo: string;
	orbitBack: string;
	orbitFront: string;
}

export const NUCLEON_RANGE = { max: 16, min: 1 } as const;

/** The canvas overflows its host so outer shells and halos are not cut at the button edges. */
export const CANVAS_OVERFLOW = 1.3;

const CAMERA_PITCH = 0.42;
const COS_PITCH = Math.cos(CAMERA_PITCH);
const SIN_PITCH = Math.sin(CAMERA_PITCH);
/** Electrons are filled as one path per shell and depth band, half the bands sit behind the nucleus. */
const DEPTH_BANDS = 4;
const BAND_ALPHAS = Array.from({ length: DEPTH_BANDS }, (_, band) => 1 - (0.6 * (band + 0.5)) / DEPTH_BANDS);
/** Radii and sizes below are authored for a 450px wide atom and scale with the host. */
const DESIGN_SIZE = 450;
/** Per second, how fast each electron closes the gap to its slot and size. */
const ELECTRON_EASE = 8;
/** A shell shows `count % GENERATOR_LEVEL_UP_COST` electrons, this only bounds the per-shell buffer. */
const MAX_ELECTRONS = 32;
const FOCAL_LENGTH = 650;
/** Aura sprites are baked at the brightest click impulse and dimmed with `globalAlpha`, which cannot go above 1. */
const AURA_PEAK = 0.3;
const AURA_REST = 0.22;
const MAX_SPARKS = 12;
const NUCLEON_SHADES = 4;
const ORBIT_SEGMENTS = 48;
const SPARK_COLOR = '#8cc2ff';
const SPARK_DURATION = 0.35;

function cross(a: Vector, b: Vector): Vector {
	return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(v: Vector): Vector {
	const length = Math.hypot(v.x, v.y, v.z);
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** Rolls `v` in its orbit plane, spins it by `yaw` around the atom, then tilts it under the camera, writing into `out`. */
function orient(out: Vector, v: Vector, roll: number, yaw: number) {
	const rx = v.x * Math.cos(roll) - v.y * Math.sin(roll);
	const ry = v.x * Math.sin(roll) + v.y * Math.cos(roll);
	const z = -rx * Math.sin(yaw) + v.z * Math.cos(yaw);
	out.x = rx * Math.cos(yaw) + v.z * Math.sin(yaw);
	out.y = ry * COS_PITCH - z * SIN_PITCH;
	out.z = ry * SIN_PITCH + z * COS_PITCH;
}

/** Angle of electron 0 on shell `line`, the others follow it at even spacing. */
function spin(line: number, time: number) {
	return (time * TAU) / (6 + line * 3) + line * 0.7;
}

/**
 * Draws the clickable atom on a Canvas2D: a spinning ball of nucleons wrapped in one tilted orbit per generator,
 * spread over every inclination so the shells outline a sphere. Electrons are filled as one path per shell and depth band:
 * a drawImage per electron cost ~5µs, 4.5ms a frame with every shell full. Nucleons are pre-rendered sprites.
 */
export class AtomRenderer extends CanvasLoop {
	/** The single mounted atom, purchases aim their background comets at it. */
	static current: AtomRenderer | null = null;

	scene: AtomScene;

	private readonly appear = new Float32Array(NUCLEON_RANGE.max);
	private readonly balls = new Map<string, HTMLCanvasElement[]>();
	private readonly bases: { u: Vector; v: Vector }[];
	private readonly byDepth = (a: number, b: number) => this.nucleonPoints[b * 3 + 2] - this.nucleonPoints[a * 3 + 2];
	private readonly ctx: CanvasRenderingContext2D;
	/** Electron count drawn per shell. */
	private readonly electronCounts: Uint8Array;
	/** x, y, radius and depth band of each electron per shell, rewritten every frame into the same buffers. */
	private readonly electrons: Float32Array[];
	/** Electrons a held shell may show, raised as each purchase's comets land. */
	private readonly released: Uint8Array;
	/** Purchases whose comets still fly to each shell, in landing order: when `at` passes, the shell may grow to `goal`. */
	private readonly releases: { at: number; goal: number }[][];
	private readonly palettes = new Map<string, Palette>();
	private readonly nucleonBases: Vector[];
	private readonly nucleonOrder: number[] = [];
	private readonly nucleonPoints = new Float32Array(NUCLEON_RANGE.max * 3);
	private readonly orbitPoints: Float32Array[];
	/** Electrons each shell is heading to, the scene count unless comets hold it back. */
	private readonly goals: Uint8Array;
	/** Angle of each electron past electron 0, per shell, eased toward its even slot. */
	private readonly offsets: Float32Array[];
	/** Size of each electron from 0 to 1, per shell. */
	private readonly scales: Float32Array[];
	private readonly sparks: { age: number; x: number; y: number }[] = [];
	/** Orbit plane of the shell being drawn, reused so no vector is allocated per frame. */
	private readonly u: Vector = { x: 0, y: 0, z: 0 };
	private readonly v: Vector = { x: 0, y: 0, z: 0 };
	private impulse = 0;
	private nucleusScale = 0;
	private ratio = 1;
	private size = 0;
	/** Last spin rate, so `target` can predict where a shell will be once a comet lands. */
	private speed = 1;
	private time = 0;

	constructor(canvas: HTMLCanvasElement, scene: AtomScene, shellSlots: number) {
		super(canvas);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		this.scene = scene;

		this.bases = Array.from({ length: shellSlots }, (_, line) => {
			const normal = spiralDirection(line, 1 - (line + 0.5) / shellSlots);
			const u = normalize(cross(Math.abs(normal.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, normal));
			return { u, v: cross(normal, u) };
		});
		this.orbitPoints = Array.from({ length: shellSlots }, () => new Float32Array((ORBIT_SEGMENTS + 1) * 3));
		this.electrons = Array.from({ length: shellSlots }, () => new Float32Array(MAX_ELECTRONS * 4));
		this.electronCounts = new Uint8Array(shellSlots);
		this.released = new Uint8Array(shellSlots);
		this.releases = Array.from({ length: shellSlots }, () => []);
		this.goals = new Uint8Array(shellSlots);
		this.offsets = Array.from({ length: shellSlots }, () => new Float32Array(MAX_ELECTRONS));
		this.scales = Array.from({ length: shellSlots }, () => new Float32Array(MAX_ELECTRONS));
		const packing = packNucleus(scene.nucleons);
		this.nucleonBases = Array.from({ length: NUCLEON_RANGE.max }, (_, i) => ({ ...(packing.points[i] ?? { x: 0, y: 0, z: 0 }) }));
		AtomRenderer.current = this;
		this.observe();
	}

	destroy() {
		super.destroy();
		if (AtomRenderer.current === this) AtomRenderer.current = null;
	}

	/**
	 * Keeps shell `line` at its current electrons until its purchase comets land in `seconds`, then lets it grow to `goal`, so the
	 * electrons show up with their comets instead of before them. Purchases made meanwhile queue up and land in order.
	 */
	hold(line: number, seconds: number, goal: number) {
		const releases = this.releases[line];
		if (!releases) return;
		if (releases.length === 0) this.released[line] = this.goals[line];
		releases.push({ at: performance.now() + seconds * 1000, goal });
	}

	/** Client position, as it will be in `seconds`, of slot `index` among `total` evenly spread electrons on shell `line`. Without a line, the nucleus. */
	target(line = -1, seconds = 0, index = 0, total = 1): { x: number; y: number } {
		const rect = this.canvas.getBoundingClientRect();
		const scale = this.size > 0 ? rect.width / this.size : 1;
		const basis = this.bases[line];
		if (!basis) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

		const time = this.time + seconds * this.speed;
		const center = this.size / 2;
		const unit = this.size / (DESIGN_SIZE * CANVAS_OVERFLOW);
		const focal = FOCAL_LENGTH * unit;
		const radius = unit * (78 + line * 18);
		const angle = spin(line, time) + (index * TAU) / Math.max(1, total);
		this.orbitPlane(line, time);
		const cos = Math.cos(angle) * radius;
		const sin = Math.sin(angle) * radius;
		const depth = focal / (focal + this.u.z * cos + this.v.z * sin);
		return {
			x: rect.left + (center + (this.u.x * cos + this.v.x * sin) * depth) * scale,
			y: rect.top + (center + (this.u.y * cos + this.v.y * sin) * depth) * scale,
		};
	}

	/**
	 * Leaves a small glowing dot at the click, `x` and `y` are CSS pixels from the atom center.
	 * Kept quiet on purpose: autoclickers fire dozens of clicks a second at the same spot.
	 */
	pulse(x: number, y: number) {
		this.impulse = Math.min(1, this.impulse + 0.35);
		this.sparks.push({ age: 0, x, y });
		if (this.sparks.length > MAX_SPARKS) this.sparks.shift();
	}

	protected resize() {
		this.size = this.canvas.clientWidth;
		this.ratio = pixelRatio();
		this.canvas.width = Math.max(1, Math.round(this.size * this.ratio));
		this.canvas.height = this.canvas.width;
	}

	private palette(color: string): Palette {
		let palette = this.palettes.get(color);
		if (!palette) {
			palette = { core: mix(color, '#ffffff', 0.35), halo: rgba(color, 0.18), orbitBack: rgba(color, 0.1), orbitFront: rgba(color, 0.28) };
			this.palettes.set(color, palette);
		}
		return palette;
	}

	/** Fills the electrons of shell `line` lying in depth `band`, halos first then cores. */
	private fillBand(line: number, band: number, palette: Palette, presence: number) {
		const { ctx } = this;
		ctx.globalAlpha = BAND_ALPHAS[band] * presence;
		ctx.fillStyle = palette.halo;
		this.traceBand(line, band, 2);
		ctx.fill();
		ctx.fillStyle = palette.core;
		this.traceBand(line, band, 1);
		ctx.fill();
	}

	private traceBand(line: number, band: number, size: number) {
		const { ctx } = this;
		const data = this.electrons[line];
		ctx.beginPath();
		for (let i = 0; i < this.electronCounts[line] * 4; i += 4) {
			if (data[i + 3] !== band) continue;
			const r = data[i + 2] * size;
			ctx.moveTo(data[i] + r, data[i + 1]);
			ctx.arc(data[i], data[i + 1], r, 0, TAU);
		}
	}

	/** Each orbit rolls at its own rate so its plane keeps changing, then yaw spins the whole atom under a camera slightly above it. */
	private orbitPlane(line: number, time: number) {
		const basis = this.bases[line];
		const roll = ((time * 0.09) / (1 + line * 0.35)) * (line % 2 ? 1 : -1);
		orient(this.u, basis.u, roll, time * 0.12);
		orient(this.v, basis.v, roll, time * 0.12);
	}

	private ballSprite(color: string, shade: number): HTMLCanvasElement {
		let shades = this.balls.get(color);
		if (!shades) {
			shades = Array.from({ length: NUCLEON_SHADES }, (_, s) =>
				this.sprite(`ball${color}${s}`, (ctx, half) => paintNucleon(ctx, half, color, s / (NUCLEON_SHADES - 1))),
			);
			this.balls.set(color, shades);
		}
		return shades[shade];
	}

	/** Keyed by the bare color, the ball sprites carry a prefix. */
	private auraSprite(color: string): HTMLCanvasElement {
		return this.sprite(color, (ctx, half) => {
			const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
			gradient.addColorStop(0, rgba(color, AURA_PEAK));
			gradient.addColorStop(0.45, rgba(color, (0.06 * AURA_PEAK) / AURA_REST));
			gradient.addColorStop(1, rgba(color, 0));
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, half * 2, half * 2);
		});
	}

	/** The atom never settles, it spins as long as it is on screen. */
	protected draw(dt: number): boolean {
		const { ctx, scene } = this;
		this.speed = (1 + 0.8 * scene.energy) * (scene.bonus ? 2 : 1);
		this.time += dt * this.speed;
		this.impulse *= Math.exp(-dt * 7);

		const time = this.time;
		const center = this.size / 2;
		const unit = this.size / (DESIGN_SIZE * CANVAS_OVERFLOW);
		const focal = FOCAL_LENGTH * unit;

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);

		const nucleons = Math.min(scene.nucleons, NUCLEON_RANGE.max);
		const growth = (nucleons - NUCLEON_RANGE.min) / (NUCLEON_RANGE.max - NUCLEON_RANGE.min);
		const heartbeat = 1 + 0.035 * Math.sin((time * TAU) / 2.5) - 0.06 * this.impulse;
		const nucleusRadius = unit * (24 + 26 * growth) * heartbeat;

		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = (AURA_REST + 0.08 * this.impulse) / AURA_PEAK;
		for (let i = 0; i < scene.auras.length; i++) {
			const radius = nucleusRadius * (2.3 + i * 0.9) * (1 + 0.07 * Math.sin(time * 1.6 + i * 2));
			ctx.drawImage(this.auraSprite(scene.auras[i]), center - radius, center - radius, radius * 2, radius * 2);
		}
		ctx.globalCompositeOperation = 'source-over';

		const now = performance.now();
		const ease = Math.min(1, dt * ELECTRON_EASE);
		ctx.lineWidth = unit * 1.2;
		for (const shell of scene.shells) {
			const { line } = shell;
			if (!this.bases[line]) continue;
			const releases = this.releases[line];
			for (; releases.length > 0 && now >= releases[0].at; releases.shift()) this.released[line] = releases[0].goal;
			// A held shell only grows as its comets land, then goes to the real count with the last purchase.
			const goal = Math.min(shell.count, MAX_ELECTRONS, releases.length > 0 ? this.released[line] : MAX_ELECTRONS);
			this.goals[line] = goal;
			const scales = this.scales[line];
			this.electronCounts[line] = 0;
			if (goal === 0 && scales[0] === 0) continue;

			this.orbitPlane(line, time);
			const { u, v } = this;
			const radius = unit * (78 + line * 18);
			const points = this.orbitPoints[line];
			for (let j = 0; j <= ORBIT_SEGMENTS; j++) {
				const angle = (j / ORBIT_SEGMENTS) * TAU;
				const cos = Math.cos(angle) * radius;
				const sin = Math.sin(angle) * radius;
				const z = u.z * cos + v.z * sin;
				const scale = focal / (focal + z);
				points[j * 3] = center + (u.x * cos + v.x * sin) * scale;
				points[j * 3 + 1] = center + (u.y * cos + v.y * sin) * scale;
				points[j * 3 + 2] = z;
			}
			const palette = this.palette(shell.color);
			ctx.strokeStyle = palette.orbitBack;
			this.strokeOrbit(points, true, scales[0]);

			// Each electron eases to its even slot on its own: a group joining is born in its final slots and grows at once,
			// while the others slide over to make room. Leaving electrons shrink where they are.
			const offsets = this.offsets[line];
			const start = spin(line, time);
			const electronRadius = unit * (2.3 + line * 0.12);
			const data = this.electrons[line];
			let count = 0;
			for (let k = 0; k < MAX_ELECTRONS; k++) {
				const grow = k < goal ? 1 : 0;
				if (grow === 0 && scales[k] === 0) continue;
				const slot = (k * TAU) / Math.max(1, goal);
				if (scales[k] === 0) offsets[k] = slot;
				else if (grow) offsets[k] += (slot - offsets[k]) * ease;
				scales[k] = Math.abs(grow - scales[k]) < 0.002 ? grow : scales[k] + (grow - scales[k]) * ease;
				if (scales[k] === 0) continue;

				const angle = start + offsets[k];
				const cos = Math.cos(angle) * radius;
				const sin = Math.sin(angle) * radius;
				const z = u.z * cos + v.z * sin;
				const scale = focal / (focal + z);
				data[count * 4] = center + (u.x * cos + v.x * sin) * scale;
				data[count * 4 + 1] = center + (u.y * cos + v.y * sin) * scale;
				data[count * 4 + 2] = electronRadius * scale * scales[k];
				data[count * 4 + 3] = Math.min(DEPTH_BANDS - 1, Math.floor(((z / radius + 1) / 2) * DEPTH_BANDS));
				count++;
			}
			this.electronCounts[line] = count;
			for (let band = DEPTH_BANDS - 1; band >= DEPTH_BANDS / 2; band--) this.fillBand(line, band, palette, scales[0]);
		}

		this.drawNucleus(dt, nucleons, nucleusRadius / packNucleus(nucleons).extent, center, time, scene);

		// Electron 0 is the first to grow and shrinks with the last, so its size fades the whole shell in and out.
		for (const { color, line } of scene.shells) {
			if (this.bases[line] && this.electronCounts[line] > 0) {
				ctx.strokeStyle = this.palette(color).orbitFront;
				this.strokeOrbit(this.orbitPoints[line], false, this.scales[line][0]);
			}
		}
		// Later shells' front bands go first, so the first shells stay on top.
		for (let i = scene.shells.length - 1; i >= 0; i--) {
			const { color, line } = scene.shells[i];
			if (!this.bases[line] || this.electronCounts[line] === 0) continue;
			const palette = this.palette(color);
			for (let band = DEPTH_BANDS / 2 - 1; band >= 0; band--) this.fillBand(line, band, palette, this.scales[line][0]);
		}

		this.drawSparks(dt, center, unit);
		ctx.globalAlpha = 1;
		return true;
	}

	/** Strokes the orbit segments lying behind (`back`) or in front of the nucleus plane. */
	private strokeOrbit(points: Float32Array, back: boolean, alpha: number) {
		const { ctx } = this;
		ctx.globalAlpha = alpha;
		ctx.beginPath();
		for (let j = 0; j < ORBIT_SEGMENTS; j++) {
			if (points[j * 3 + 2] + points[j * 3 + 5] > 0 !== back) continue;
			ctx.moveTo(points[j * 3], points[j * 3 + 1]);
			ctx.lineTo(points[j * 3 + 3], points[j * 3 + 4]);
		}
		ctx.stroke();
	}

	private drawNucleus(dt: number, nucleons: number, targetScale: number, center: number, time: number, scene: AtomScene) {
		const { ctx, nucleonPoints, nucleonOrder } = this;
		this.nucleusScale = this.nucleusScale === 0 ? targetScale : this.nucleusScale + (targetScale - this.nucleusScale) * Math.min(1, dt * 5);

		const cosA = Math.cos(time * 0.6);
		const sinA = Math.sin(time * 0.6);
		const cosB = Math.cos(time * 0.37);
		const sinB = Math.sin(time * 0.37);
		const shake = 0.05 + 0.12 * scene.energy + 0.15 * this.impulse;

		const packing = packNucleus(nucleons);
		const glide = Math.min(1, dt * 3);
		nucleonOrder.length = 0;
		for (let i = 0; i < NUCLEON_RANGE.max; i++) {
			const base = this.nucleonBases[i];
			const target = packing.points[i];
			/** A new nucleon pops in at its slot, the others glide to theirs as the ball re-settles. */
			if (target) {
				const blend = this.appear[i] < 0.01 ? 1 : glide;
				base.x += (target.x - base.x) * blend;
				base.y += (target.y - base.y) * blend;
				base.z += (target.z - base.z) * blend;
			}
			this.appear[i] += ((i < nucleons ? 1 : 0) - this.appear[i]) * Math.min(1, dt * 4);
			if (this.appear[i] < 0.01) continue;

			const x0 = base.x + shake * Math.sin(time * 7.3 + i * 1.7);
			const y0 = base.y + shake * Math.sin(time * 6.1 + i * 2.9);
			const z0 = base.z + shake * Math.sin(time * 8.7 + i * 0.7);
			const x1 = x0 * cosA + z0 * sinA;
			const z1 = -x0 * sinA + z0 * cosA;
			nucleonPoints[i * 3] = x1;
			nucleonPoints[i * 3 + 1] = y0 * cosB - z1 * sinB;
			nucleonPoints[i * 3 + 2] = y0 * sinB + z1 * cosB;
			nucleonOrder.push(i);
		}
		nucleonOrder.sort(this.byDepth);

		const scale = this.nucleusScale;
		const extent = Math.max(1, packing.extent - NUCLEON_RADIUS);
		ctx.globalAlpha = 1;
		for (const i of nucleonOrder) {
			const z = nucleonPoints[i * 3 + 2];
			const shade = Math.round(Math.min(1, Math.max(0, (z / extent + 1) / 2)) * (NUCLEON_SHADES - 1));
			const size = 2 * NUCLEON_RADIUS * scale * this.appear[i] * (1 - z * 0.05);
			const x = center + nucleonPoints[i * 3] * scale;
			const y = center + nucleonPoints[i * 3 + 1] * scale;
			/** Every third nucleon is a neutron, the others are protons numbered in order to cycle the colors evenly. */
			const color = i % 3 === 2 ? NEUTRON_COLOR : (scene.nucleonColors[(i - Math.floor(i / 3)) % scene.nucleonColors.length] ?? NEUTRON_COLOR);
			ctx.drawImage(this.ballSprite(color, shade), x - size / 2, y - size / 2, size, size);
		}
	}

	private drawSparks(dt: number, center: number, unit: number) {
		const { ctx, sparks } = this;
		for (let i = sparks.length - 1; i >= 0; i--) {
			const spark = sparks[i];
			spark.age += dt;
			const progress = spark.age / SPARK_DURATION;
			if (progress >= 1) {
				sparks.splice(i, 1);
				continue;
			}
			const x = center + spark.x;
			const y = center + spark.y;
			const glow = unit * (8 + 6 * progress);
			const gradient = ctx.createRadialGradient(x, y, 0, x, y, glow);
			gradient.addColorStop(0, rgba(SPARK_COLOR, 0.45));
			gradient.addColorStop(1, rgba(SPARK_COLOR, 0));
			ctx.globalAlpha = 1 - progress;
			ctx.fillStyle = gradient;
			ctx.fillRect(x - glow, y - glow, glow * 2, glow * 2);
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.arc(x, y, unit * 1.8 * (1 - progress * 0.5), 0, TAU);
			ctx.fill();
		}
	}
}
