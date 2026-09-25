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

interface Packing {
	/** Farthest nucleon edge from the center, in nucleon units. */
	extent: number;
	points: Vector[];
}

interface Palette {
	core: string;
	halo: string;
	orbitBack: string;
	orbitFront: string;
}

interface Vector {
	x: number;
	y: number;
	z: number;
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
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_FRAME_S = 0.1;
const MAX_PIXEL_RATIO = 2;
const MAX_SPARKS = 12;
const NEUTRON_COLOR = '#9aa3ad';
const NUCLEON_RADIUS = 0.85;
const NUCLEON_SHADES = 4;
const PACKING_STEPS = 200;
const NUCLEUS_SHADOW = '#0e1522';
const ORBIT_SEGMENTS = 48;
const SPARK_COLOR = '#8cc2ff';
const SPARK_DURATION = 0.35;
const SPRITE_SIZE = 128;
const TAU = Math.PI * 2;

function parseHex(hex: string): [number, number, number] {
	const value = Number.parseInt(hex.slice(1, 7), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Returns hex so mixes chain, an `rgb()` string fed back into `parseHex` reads as black. */
function mix(hex: string, other: string, amount: number): string {
	const a = parseHex(hex);
	const b = parseHex(other);
	return `#${a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function rgba(hex: string, alpha: number): string {
	return `rgb(${parseHex(hex).join(' ')} / ${alpha})`;
}

/** Evenly spread directions: a golden-angle spiral over a hemisphere (orbit normals) or over the full sphere (nucleons). */
function spiralDirection(index: number, height: number): Vector {
	const radius = Math.sqrt(1 - height * height);
	return { x: radius * Math.cos(index * GOLDEN_ANGLE), y: height, z: radius * Math.sin(index * GOLDEN_ANGLE) };
}

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
export class AtomRenderer {
	scene: AtomScene;

	private readonly appear = new Float32Array(NUCLEON_RANGE.max);
	private readonly bases: { u: Vector; v: Vector }[];
	private readonly ctx: CanvasRenderingContext2D;
	private readonly packings = new Map<number, Packing>();
	private readonly palettes = new Map<string, Palette>();
	/** Electron batches in front of the nucleus, filled after it. */
	private readonly front: ElectronBatch[] = [];
	private readonly nucleonBases: Vector[];
	private readonly nucleonOrder: number[] = [];
	private readonly nucleonPoints = new Float32Array(NUCLEON_RANGE.max * 3);
	private readonly observers: (IntersectionObserver | ResizeObserver)[];
	private readonly orbitPoints: Float32Array[];
	private readonly sparks: { age: number; x: number; y: number }[] = [];
	private readonly sprites = new Map<string, HTMLCanvasElement>();
	private active = true;
	private frame = 0;
	private impulse = 0;
	private lastTime = 0;
	private nucleusScale = 0;
	private ratio = 1;
	private size = 0;
	private time = 0;
	private visible = false;

	constructor(
		private readonly canvas: HTMLCanvasElement,
		scene: AtomScene,
		shellSlots: number,
	) {
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
		const packing = this.packing(scene.nucleons);
		this.nucleonBases = Array.from({ length: NUCLEON_RANGE.max }, (_, i) => ({ ...(packing.points[i] ?? { x: 0, y: 0, z: 0 }) }));

		const resize = new ResizeObserver(() => this.resize());
		resize.observe(canvas);
		const intersection = new IntersectionObserver(([entry]) => {
			this.visible = entry.isIntersecting;
			this.update();
		});
		intersection.observe(canvas);
		this.observers = [resize, intersection];
		this.resize();
	}

	destroy() {
		cancelAnimationFrame(this.frame);
		for (const observer of this.observers) observer.disconnect();
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

	/** The atom realm stays mounted behind the other realms, the loop only runs while it is selected and on screen. */
	setActive(active: boolean) {
		this.active = active;
		this.update();
	}

	private update() {
		const running = this.active && this.visible;
		if (running && !this.frame) {
			this.lastTime = performance.now();
			this.frame = requestAnimationFrame(this.loop);
		} else if (!running && this.frame) {
			cancelAnimationFrame(this.frame);
			this.frame = 0;
		}
	}

	private resize() {
		this.size = this.canvas.clientWidth;
		this.ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
		this.canvas.width = Math.max(1, Math.round(this.size * this.ratio));
		this.canvas.height = this.canvas.width;
	}

	private sprite(key: string, paint: (ctx: CanvasRenderingContext2D, half: number) => void): HTMLCanvasElement {
		let sprite = this.sprites.get(key);
		if (!sprite) {
			sprite = document.createElement('canvas');
			sprite.width = sprite.height = SPRITE_SIZE;
			const ctx = sprite.getContext('2d');
			if (ctx) paint(ctx, SPRITE_SIZE / 2);
			this.sprites.set(key, sprite);
		}
		return sprite;
	}

	/** Settles `count` nucleons into a tight ball: every step pulls them toward the center, then pushes overlapping pairs apart. */
	private packing(count: number): Packing {
		let packing = this.packings.get(count);
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
		this.packings.set(count, packing);
		return packing;
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

	/** Faint light on the upper left, faint shadow on the lower right, `shade` (0 front to 1 back) slightly dims the far nucleons. */
	private ballSprite(color: string, shade: number): HTMLCanvasElement {
		return this.sprite(`ball${color}${shade}`, (ctx, half) => {
			const base = mix(mix(color, NEUTRON_COLOR, 0.18), NUCLEUS_SHADOW, (shade / (NUCLEON_SHADES - 1)) * 0.3);
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
		});
	}

	private readonly loop = (now: number) => {
		const dt = Math.min((now - this.lastTime) / 1000, MAX_FRAME_S);
		this.lastTime = now;
		this.draw(dt);
		this.frame = requestAnimationFrame(this.loop);
	};

	private draw(dt: number) {
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

		this.drawNucleus(dt, nucleons, nucleusRadius / this.packing(nucleons).extent, center, time, scene);

		ctx.globalAlpha = 1;
		for (const shell of scene.shells) {
			if (!this.bases[shell.line] || shell.count <= 0) continue;
			ctx.strokeStyle = this.palette(shell.color).orbitFront;
			this.strokeOrbit(this.orbitPoints[shell.line], false);
		}
		for (let i = this.front.length - 1; i >= 0; i--) this.fillBatch(this.front[i]);

		this.drawSparks(dt, center, unit);
		ctx.globalAlpha = 1;
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

		const packing = this.packing(nucleons);
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
