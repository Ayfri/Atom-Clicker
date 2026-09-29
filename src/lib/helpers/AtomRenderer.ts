import { CanvasLoop } from '$helpers/CanvasLoop';
import { mix, NEUTRON_COLOR, NUCLEON_RADIUS, packNucleus, paintNucleon, rgba, spiralDirection, TAU, type Vector } from '$helpers/nucleus';

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

interface ElectronBatch {
	alpha: number;
	core: Path2D;
	halo: Path2D;
	palette: Palette;
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
/** Electrons are batched into one path per shell and depth band, half the bands sit behind the nucleus. */
const DEPTH_BANDS = 4;
/** Radii and sizes below are authored for a 450px wide atom and scale with the host. */
const DESIGN_SIZE = 450;
const FOCAL_LENGTH = 650;
const MAX_PIXEL_RATIO = 2;
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

/**
 * Draws the clickable atom on a Canvas2D: a spinning ball of nucleons wrapped in one tilted orbit per generator,
 * spread over every inclination so the shells outline a sphere. Electrons are filled as one path per shell and depth band:
 * a drawImage per electron cost ~5µs, 4.5ms a frame with every shell full. Nucleons are pre-rendered sprites.
 */
export class AtomRenderer extends CanvasLoop {
	scene: AtomScene;

	private readonly appear = new Float32Array(NUCLEON_RANGE.max);
	private readonly bases: { u: Vector; v: Vector }[];
	private readonly ctx: CanvasRenderingContext2D;
	private readonly palettes = new Map<string, Palette>();
	/** Electron batches in front of the nucleus, filled after it. */
	private readonly front: ElectronBatch[] = [];
	private readonly nucleonBases: Vector[];
	private readonly nucleonOrder: number[] = [];
	private readonly nucleonPoints = new Float32Array(NUCLEON_RANGE.max * 3);
	private readonly orbitPoints: Float32Array[];
	private readonly sparks: { age: number; x: number; y: number }[] = [];
	private impulse = 0;
	private nucleusScale = 0;
	private ratio = 1;
	private size = 0;
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
		const packing = packNucleus(scene.nucleons);
		this.nucleonBases = Array.from({ length: NUCLEON_RANGE.max }, (_, i) => ({ ...(packing.points[i] ?? { x: 0, y: 0, z: 0 }) }));
		this.observe();
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
		this.ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
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

	private fillBatch({ alpha, core, halo, palette }: ElectronBatch) {
		this.ctx.globalAlpha = alpha;
		this.ctx.fillStyle = palette.halo;
		this.ctx.fill(halo);
		this.ctx.fillStyle = palette.core;
		this.ctx.fill(core);
	}

	private ballSprite(color: string, shade: number): HTMLCanvasElement {
		return this.sprite(`ball${color}${shade}`, (ctx, half) => paintNucleon(ctx, half, color, shade / (NUCLEON_SHADES - 1)));
	}

	/** The atom never settles, it spins as long as it is on screen. */
	protected draw(dt: number): boolean {
		const { ctx, scene } = this;
		const speed = (1 + 0.8 * scene.energy) * (scene.bonus ? 2 : 1);
		this.time += dt * speed;
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
		scene.auras.forEach((color, i) => {
			const radius = nucleusRadius * (2.3 + i * 0.9) * (1 + 0.07 * Math.sin(time * 1.6 + i * 2));
			const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
			gradient.addColorStop(0, rgba(color, 0.22 + 0.08 * this.impulse));
			gradient.addColorStop(0.45, rgba(color, 0.06));
			gradient.addColorStop(1, rgba(color, 0));
			ctx.fillStyle = gradient;
			ctx.fillRect(center - radius, center - radius, radius * 2, radius * 2);
		});
		ctx.globalCompositeOperation = 'source-over';

		/** Each orbit rolls at its own rate so its plane keeps changing, then yaw spins the whole atom under a camera slightly above it. */
		const yaw = time * 0.12;
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);
		const cosPitch = Math.cos(CAMERA_PITCH);
		const sinPitch = Math.sin(CAMERA_PITCH);
		const rotate = (v: Vector, cosRoll: number, sinRoll: number): Vector => {
			const rx = v.x * cosRoll - v.y * sinRoll;
			const ry = v.x * sinRoll + v.y * cosRoll;
			const x = rx * cosYaw + v.z * sinYaw;
			const z = -rx * sinYaw + v.z * cosYaw;
			return { x, y: ry * cosPitch - z * sinPitch, z: ry * sinPitch + z * cosPitch };
		};

		this.front.length = 0;
		ctx.lineWidth = unit * 1.2;
		for (const shell of scene.shells) {
			const basis = this.bases[shell.line];
			if (!basis || shell.count <= 0) continue;
			const roll = ((time * 0.09) / (1 + shell.line * 0.35)) * (shell.line % 2 ? 1 : -1);
			const cosRoll = Math.cos(roll);
			const sinRoll = Math.sin(roll);
			const u = rotate(basis.u, cosRoll, sinRoll);
			const v = rotate(basis.v, cosRoll, sinRoll);
			const radius = unit * (78 + shell.line * 18);

			const points = this.orbitPoints[shell.line];
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
			this.strokeOrbit(points, true);

			const batches = Array.from({ length: DEPTH_BANDS }, (_, band) => ({
				alpha: 1 - (0.6 * (band + 0.5)) / DEPTH_BANDS,
				core: new Path2D(),
				halo: new Path2D(),
				palette,
			}));
			const spin = (time * TAU) / (6 + shell.line * 3) + shell.line * 0.7;
			const electronRadius = unit * (2.3 + shell.line * 0.12);
			for (let k = 0; k < shell.count; k++) {
				const angle = spin + (k / shell.count) * TAU;
				const cos = Math.cos(angle) * radius;
				const sin = Math.sin(angle) * radius;
				const z = u.z * cos + v.z * sin;
				const scale = focal / (focal + z);
				const x = center + (u.x * cos + v.x * sin) * scale;
				const y = center + (u.y * cos + v.y * sin) * scale;
				const r = electronRadius * scale;
				const batch = batches[Math.min(DEPTH_BANDS - 1, Math.floor(((z / radius + 1) / 2) * DEPTH_BANDS))];
				batch.core.moveTo(x + r, y);
				batch.core.arc(x, y, r, 0, TAU);
				batch.halo.moveTo(x + r * 2, y);
				batch.halo.arc(x, y, r * 2, 0, TAU);
			}
			for (let band = DEPTH_BANDS - 1; band >= DEPTH_BANDS / 2; band--) this.fillBatch(batches[band]);
			this.front.push(...batches.slice(0, DEPTH_BANDS / 2));
		}

		this.drawNucleus(dt, nucleons, nucleusRadius / packNucleus(nucleons).extent, center, time, scene);

		ctx.globalAlpha = 1;
		for (const shell of scene.shells) {
			if (!this.bases[shell.line] || shell.count <= 0) continue;
			ctx.strokeStyle = this.palette(shell.color).orbitFront;
			this.strokeOrbit(this.orbitPoints[shell.line], false);
		}
		for (let i = this.front.length - 1; i >= 0; i--) this.fillBatch(this.front[i]);

		this.drawSparks(dt, center, unit);
		ctx.globalAlpha = 1;
		return true;
	}

	/** Strokes the orbit segments lying behind (`back`) or in front of the nucleus plane. */
	private strokeOrbit(points: Float32Array, back: boolean) {
		const { ctx } = this;
		ctx.globalAlpha = 1;
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
		nucleonOrder.sort((a, b) => nucleonPoints[b * 3 + 2] - nucleonPoints[a * 3 + 2]);

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
