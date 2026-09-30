import { CanvasLoop, pixelRatio } from '$helpers/CanvasLoop';
import { mix, NEUTRON_COLOR, NUCLEON_RADIUS, packNucleus, paintNucleon, rgba, TAU, type Vector } from '$helpers/nucleus';

export interface ReactorScene {
	accent: string;
	/** 0 to 1, how shaky the core looks: power scaled by how loaded it is. */
	instability: number;
	mass: number;
	/** Output over its cap, 0 to 1, fills the gauge ring. */
	output: number;
	power: number;
}

/** Everything is laid out in a 100 unit wide square centered on 0, the canvas transforms map it to pixels. */
const VIEW_UNITS = 100;
const CAPPED_COLOR = '#fb923c';
const CHAMBER_RADIUS = 34;
const COLD_COLOR = '#7fa7d9';
const DEPTH_SHADES = 4;
const ELECTRON_COLOR = '#45d945';
const GAUGE_RADIUS = 44.5;
/** The gauge opens at the bottom, where the output readout sits, and fills clockwise over the top. */
const GAUGE_START = Math.PI * 0.75;
const GAUGE_SWEEP = Math.PI * 1.5;
/** Heat runs 0 (frozen) to 1 (running) to 2 (white-hot), nucleon sprites snap to quarter steps instead of cross-fading two draws. */
const HEAT_STEPS_PER_UNIT = 4;
const HOT_COLOR = '#fff1b8';
const MAX_FUEL = 32;
const MAX_NUCLEONS = 40;
const MAX_RAYS = 64;
/** Nucleon units to view units, a constant so the ball grows with its nucleon count like a real nucleus. */
const NUCLEUS_SCALE = 4.8;
const RING_RADIUS = 38.5;
const ROD_COUNT = 6;
const ROD_WIDTH = 4.2;
const SETTLED = 0.002;
const SHOCK_DURATION = 0.7;

/** Nucleons for a fuel mass: a handful for the first units, then logarithmic so late game masses still fit the chamber. */
function nucleonCount(mass: number): number {
	return mass <= 0 ? 0 : Math.min(MAX_NUCLEONS, Math.round(3 + 6 * Math.log2(1 + mass / 4)));
}

/** Rods point sideways and diagonally, keeping the top and the bottom gauge gap clear. */
function rodAngle(index: number): number {
	return (index * TAU) / ROD_COUNT;
}

/**
 * Draws the Radiation Realm reactor: a packed 3D nucleus sized by the fuel, control rods that pull back as the power rises,
 * radiation streaks flying to the chamber wall and an output gauge around the vessel. The static vessel lives on its own canvas behind,
 * nucleon sprites are rasterized at their on-screen size, and the loop parks itself once a frozen core has settled.
 */
export class ReactorRenderer extends CanvasLoop {
	/** The single mounted reactor. */
	static current: ReactorRenderer | null = null;

	private readonly appear = new Float32Array(MAX_NUCLEONS);
	private readonly ctx: CanvasRenderingContext2D;
	/** Fuel electrons flying to the core: x, y, vx, vy per slot, a zero speed marks a free slot. */
	private readonly fuel = new Float32Array(MAX_FUEL * 4);
	private readonly nucleonBases: Vector[] = Array.from({ length: MAX_NUCLEONS }, () => ({ x: 0, y: 0, z: 0 }));
	private readonly nucleonOrder: number[] = [];
	private readonly nucleonPoints = new Float32Array(MAX_NUCLEONS * 3);
	/** Indexed by heat step, neutron flag and depth shade, rebuilt when the size or the accent changes. */
	private readonly nucleonSprites: (HTMLCanvasElement | undefined)[] = [];
	/** Radiation streaks: x, y, vx, vy per slot, a zero speed marks a free slot. */
	private readonly rays = new Float32Array(MAX_RAYS * 4);
	private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
	/** Frame view transform, rumble included, kept so each rod rotates from it without a save/restore. */
	private readonly view: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
	private accent = '';
	private coreRadius = 0;
	private state: ReactorScene;
	private flash = 0;
	private heat = 0;
	private output = 0;
	private pixelSize = 0;
	private power = 0;
	private rayBudget = 0;
	private rayColor = '';
	private shock = 1;
	private spin = 0;
	private time = 0;

	constructor(
		private readonly vessel: HTMLCanvasElement,
		canvas: HTMLCanvasElement,
		scene: ReactorScene,
	) {
		super(canvas);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		this.state = scene;
		this.power = scene.power;
		this.output = scene.output;
		ReactorRenderer.current = this;
		this.observe();
	}

	/** Client position of the core, fuel and upgrades aim their background comets at it. */
	get center(): { x: number; y: number } {
		const rect = this.canvas.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}

	destroy() {
		super.destroy();
		if (ReactorRenderer.current === this) ReactorRenderer.current = null;
	}

	get scene(): ReactorScene {
		return this.state;
	}

	/** A new scene wakes a settled loop. */
	set scene(scene: ReactorScene) {
		this.state = scene;
		this.update();
	}

	/** Fuel electrons stream in from the gauge ring, the core flashes and sends a shockwave once they land. */
	inject(mass: number) {
		let count = 8 + Math.min(24, Math.round(mass));
		for (let slot = 0; slot < MAX_FUEL && count > 0; slot++) {
			const i = slot * 4;
			if (this.fuel[i + 2] !== 0 || this.fuel[i + 3] !== 0) continue;
			const angle = Math.random() * TAU;
			const radius = GAUGE_RADIUS - Math.random() * 3;
			const speed = 55 + Math.random() * 45;
			this.fuel[i] = Math.cos(angle) * radius;
			this.fuel[i + 1] = Math.sin(angle) * radius;
			/** A slight sideways component curls the electrons into a spiral on their way in. */
			this.fuel[i + 2] = (-Math.cos(angle) - Math.sin(angle) * 0.35) * speed;
			this.fuel[i + 3] = (-Math.sin(angle) + Math.cos(angle) * 0.35) * speed;
			count--;
		}
		this.shock = 0;
		this.update();
	}

	/** Streaks and fuel in flight are dropped while off screen, they would all land at once on return. */
	protected paused() {
		this.rays.fill(0);
		this.fuel.fill(0);
	}

	protected resize() {
		const cssSize = this.canvas.clientWidth;
		this.pixelSize = Math.max(1, Math.round(cssSize * pixelRatio()));
		this.canvas.width = this.canvas.height = this.vessel.width = this.vessel.height = this.pixelSize;
		this.nucleonSprites.length = 0;
		this.paintVessel();
		this.redraw();
	}

	private glowSprite(color: string): HTMLCanvasElement {
		return this.sprite(`glow${color}`, (ctx, half) => {
			const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
			gradient.addColorStop(0, rgba(color, 1));
			gradient.addColorStop(0.25, rgba(color, 0.45));
			gradient.addColorStop(0.6, rgba(color, 0.1));
			gradient.addColorStop(1, rgba(color, 0));
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, half * 2, half * 2);
		});
	}

	/** Rasterized at the nucleon's on-screen size: downscaling a 128px sprite cost more than the rest of the frame. */
	private nucleonSprite(step: number, neutron: boolean, shade: number): HTMLCanvasElement {
		const index = (step * 2 + (neutron ? 1 : 0)) * DEPTH_SHADES + shade;
		let sprite = this.nucleonSprites[index];
		if (!sprite) {
			sprite = document.createElement('canvas');
			sprite.width = sprite.height = Math.max(8, Math.ceil(((2 * NUCLEON_RADIUS * NUCLEUS_SCALE * this.pixelSize) / VIEW_UNITS) * 1.1));
			const ctx = sprite.getContext('2d');
			const base = neutron ? NEUTRON_COLOR : mix(this.accent, NEUTRON_COLOR, 0.3);
			const heat = step / HEAT_STEPS_PER_UNIT;
			const color = heat <= 1 ? mix(COLD_COLOR, base, 0.45 + 0.55 * heat) : mix(base, HOT_COLOR, (heat - 1) * 0.6);
			if (ctx) paintNucleon(ctx, sprite.width / 2, color, shade / (DEPTH_SHADES - 1));
			this.nucleonSprites[index] = sprite;
		}
		return sprite;
	}

	/** The vessel never moves: housing, bolts, rod sleeves, chamber and gauge track sit on the canvas behind, painted once per size and accent. */
	private paintVessel() {
		const { pixelSize } = this;
		const accent = this.state.accent;
		const ctx = this.vessel.getContext('2d');
		if (!ctx) return;
		const scale = pixelSize / VIEW_UNITS;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, pixelSize, pixelSize);
		ctx.setTransform(scale, 0, 0, scale, pixelSize / 2, pixelSize / 2);

		const steel = mix(accent, '#12161a', 0.86);
		const housing = ctx.createRadialGradient(0, -12, 0, 0, 0, RING_RADIUS + 4);
		housing.addColorStop(0, mix(steel, '#000000', 0.35));
		housing.addColorStop(0.85, steel);
		housing.addColorStop(1, mix(steel, '#ffffff', 0.08));
		ctx.fillStyle = housing;
		ctx.beginPath();
		ctx.arc(0, 0, RING_RADIUS + 3.5, 0, TAU);
		ctx.fill();
		ctx.lineWidth = 0.6;
		ctx.strokeStyle = rgba('#ffffff', 0.12);
		ctx.stroke();

		ctx.fillStyle = '#07090b';
		for (let i = 0; i < ROD_COUNT; i++) {
			ctx.save();
			ctx.rotate(rodAngle(i));
			ctx.fillRect(CHAMBER_RADIUS - 1, -ROD_WIDTH / 2 - 1.2, RING_RADIUS + 3.5 - CHAMBER_RADIUS + 1, ROD_WIDTH + 2.4);
			ctx.restore();
		}
		ctx.fillStyle = rgba('#ffffff', 0.18);
		for (let i = 0; i < ROD_COUNT * 2; i++) {
			const angle = rodAngle(i / 2) + Math.PI / ROD_COUNT / 2;
			ctx.beginPath();
			ctx.arc(Math.cos(angle) * (RING_RADIUS + 1), Math.sin(angle) * (RING_RADIUS + 1), 0.7, 0, TAU);
			ctx.fill();
		}

		const chamber = ctx.createRadialGradient(0, 0, 0, 0, 0, CHAMBER_RADIUS);
		chamber.addColorStop(0, mix(accent, '#05080a', 0.82));
		chamber.addColorStop(0.7, '#05080a');
		chamber.addColorStop(1, '#020304');
		ctx.fillStyle = chamber;
		ctx.beginPath();
		ctx.arc(0, 0, CHAMBER_RADIUS, 0, TAU);
		ctx.fill();
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = rgba(accent, 0.25);
		ctx.stroke();

		ctx.lineCap = 'round';
		ctx.lineWidth = 2.2;
		ctx.strokeStyle = rgba('#ffffff', 0.07);
		ctx.beginPath();
		ctx.arc(0, 0, GAUGE_RADIUS, GAUGE_START, GAUGE_START + GAUGE_SWEEP);
		ctx.stroke();
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = rgba('#ffffff', 0.25);
		for (let i = 0; i <= 4; i++) {
			const angle = GAUGE_START + (GAUGE_SWEEP * i) / 4;
			ctx.beginPath();
			ctx.moveTo(Math.cos(angle) * (GAUGE_RADIUS + 2), Math.sin(angle) * (GAUGE_RADIUS + 2));
			ctx.lineTo(Math.cos(angle) * (GAUGE_RADIUS + 3.2), Math.sin(angle) * (GAUGE_RADIUS + 3.2));
			ctx.stroke();
		}
	}

	/** Settles once a frozen or empty core has nothing left to animate, so an idle reactor costs no frames. */
	protected draw(dt: number): boolean {
		const { ctx, state: scene } = this;
		if (scene.accent !== this.accent) {
			this.accent = scene.accent;
			this.rayColor = mix(scene.accent, '#ffffff', 0.35);
			this.clearSprites();
			this.nucleonSprites.length = 0;
			this.paintVessel();
		}

		const ease = (value: number, target: number, rate: number) => (Math.abs(target - value) < SETTLED ? target : value + (target - value) * Math.min(1, dt * rate));
		this.power = ease(this.power, scene.power, 6);
		this.output = ease(this.output, scene.output, 3);
		const targetHeat = scene.mass <= 0 || scene.power <= 0 ? 0 : Math.min(1, scene.power / 0.08) + Math.max(0, (scene.power - 0.5) * 2);
		this.heat = ease(this.heat, targetHeat, 2);
		const count = nucleonCount(scene.mass);
		const packing = count > 0 ? packNucleus(count) : undefined;
		const targetRadius = packing ? packing.extent * NUCLEUS_SCALE : 6;
		this.coreRadius = this.coreRadius === 0 ? targetRadius : ease(this.coreRadius, targetRadius, 3);

		/** 0% power freezes the core, the cube keeps it calm below ~70% and makes it race at full power. */
		const speed = scene.mass <= 0 || scene.power <= 0 ? 0 : (0.25 + this.power * 0.9 + this.power ** 3 * 2.2) * (this.reducedMotion ? 0.35 : 1);
		this.time += dt * speed;
		this.spin += dt * speed * 0.6;
		this.flash = this.flash < 0.02 ? 0 : this.flash * Math.exp(-dt * 4);
		this.shock = Math.min(1, this.shock + dt / SHOCK_DURATION);

		const scale = this.pixelSize / VIEW_UNITS;
		const center = this.pixelSize / 2;
		const rumble = !this.reducedMotion && this.power > 0.85 && scene.mass > 0 ? ((this.power - 0.85) / 0.15) * 0.45 : 0;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, this.pixelSize, this.pixelSize);
		const view = this.view;
		view[0] = view[3] = scale;
		view[4] = center + (Math.random() - 0.5) * rumble * scale;
		view[5] = center + (Math.random() - 0.5) * rumble * scale;
		ctx.setTransform(...view);

		const coreRadius = this.coreRadius;
		if (scene.mass > 0) {
			const radius = coreRadius * (1.7 + this.heat * 0.5) * (1 + 0.06 * Math.sin(this.time * 5));
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = Math.min(1, 0.12 + this.power * 0.55 + this.flash * 0.5);
			ctx.drawImage(this.glowSprite(this.accent), -radius, -radius, radius * 2, radius * 2);
			ctx.globalCompositeOperation = 'source-over';
		} else {
			ctx.globalAlpha = 0.3;
			ctx.lineWidth = 0.4;
			ctx.setLineDash([1.2, 1.6]);
			ctx.strokeStyle = this.accent;
			ctx.beginPath();
			ctx.arc(0, 0, 8, 0, TAU);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		this.drawRods(coreRadius);
		const nucleusMoving = packing ? this.drawNucleus(dt, count, packing.points, scene) : this.fadeNucleons(dt);
		const raysAlive = this.drawRays(dt, coreRadius, scene);
		const fuelAlive = this.drawFuel(dt, coreRadius);

		if (this.shock < 1) {
			const radius = coreRadius + (CHAMBER_RADIUS - coreRadius) * this.shock;
			ctx.globalAlpha = (1 - this.shock) * 0.7;
			ctx.lineWidth = 1.4 * (1 - this.shock) + 0.2;
			ctx.strokeStyle = this.accent;
			ctx.beginPath();
			ctx.arc(0, 0, radius, 0, TAU);
			ctx.stroke();
		}
		if (this.flash > 0) {
			const radius = coreRadius * (1 + this.flash);
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = this.flash * 0.8;
			ctx.drawImage(this.glowSprite('#ffffff'), -radius, -radius, radius * 2, radius * 2);
			ctx.globalCompositeOperation = 'source-over';
		}

		this.drawGauge();
		ctx.globalAlpha = 1;

		return (
			speed > 0 ||
			nucleusMoving ||
			raysAlive ||
			fuelAlive ||
			this.shock < 1 ||
			this.flash > 0 ||
			this.heat !== targetHeat ||
			this.power !== scene.power ||
			this.output !== scene.output ||
			this.coreRadius !== targetRadius ||
			(scene.output >= 1 && this.output > 0)
		);
	}

	/** Rods plunge down to the core surface at 0% power and slide back into their sleeves at 100%. */
	private drawRods(coreRadius: number) {
		const { ctx } = this;
		const tip = coreRadius + 2 + (CHAMBER_RADIUS + 1 - coreRadius - 2) * this.power;
		const length = RING_RADIUS + 2 - tip;
		const rod = this.sprite('rod', (sctx, half) => {
			const gradient = sctx.createLinearGradient(0, 0, 0, half * 2);
			gradient.addColorStop(0, '#1b2126');
			gradient.addColorStop(0.35, '#59636b');
			gradient.addColorStop(0.55, '#3a4249');
			gradient.addColorStop(1, '#14191d');
			sctx.fillStyle = gradient;
			sctx.fillRect(0, 0, half * 2, half * 2);
		});
		const tipAlpha = 0.35 + 0.5 * (1 - this.power);
		ctx.fillStyle = this.accent;
		for (let i = 0; i < ROD_COUNT; i++) {
			const angle = rodAngle(i);
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			ctx.setTransform(...this.view);
			ctx.transform(cos, sin, -sin, cos, 0, 0);
			ctx.globalAlpha = 1;
			ctx.drawImage(rod, tip, -ROD_WIDTH / 2, length, ROD_WIDTH);
			ctx.globalAlpha = tipAlpha;
			ctx.fillRect(tip, -ROD_WIDTH / 2, 0.9, ROD_WIDTH);
		}
		ctx.setTransform(...this.view);
	}

	/** Shrinks the leftover nucleons away once the fuel runs out, returns whether any is still visible. */
	private fadeNucleons(dt: number): boolean {
		let visible = false;
		for (let i = 0; i < MAX_NUCLEONS; i++) {
			this.appear[i] = this.appear[i] < 0.01 ? 0 : this.appear[i] * (1 - Math.min(1, dt * 4));
			visible ||= this.appear[i] > 0;
		}
		return visible;
	}

	/** Returns whether a nucleon is still popping in, fading out or gliding to a new slot. */
	private drawNucleus(dt: number, count: number, targets: Vector[], scene: ReactorScene): boolean {
		const { ctx, nucleonBases, nucleonOrder, nucleonPoints } = this;
		const cosA = Math.cos(this.spin);
		const sinA = Math.sin(this.spin);
		const cosB = Math.cos(this.spin * 0.62);
		const sinB = Math.sin(this.spin * 0.62);
		const shake = this.reducedMotion || scene.power <= 0 ? 0 : 0.04 + 0.28 * this.power ** 3 + 0.12 * scene.instability;
		const time = this.time;

		const glide = Math.min(1, dt * 3);
		let moving = false;
		nucleonOrder.length = 0;
		for (let i = 0; i < MAX_NUCLEONS; i++) {
			const base = nucleonBases[i];
			const target = targets[i];
			if (target) {
				const blend = this.appear[i] < 0.01 ? 1 : glide;
				const dx = target.x - base.x;
				const dy = target.y - base.y;
				const dz = target.z - base.z;
				moving ||= Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 0.01;
				base.x += dx * blend;
				base.y += dy * blend;
				base.z += dz * blend;
			}
			const appearTarget = i < count ? 1 : 0;
			const gap = appearTarget - this.appear[i];
			this.appear[i] = Math.abs(gap) < 0.01 ? appearTarget : this.appear[i] + gap * Math.min(1, dt * 4);
			moving ||= this.appear[i] !== appearTarget;
			if (this.appear[i] < 0.01) continue;

			const x0 = base.x + shake * Math.sin(time * 23 + i * 1.7);
			const y0 = base.y + shake * Math.sin(time * 19 + i * 2.9);
			const z0 = base.z + shake * Math.sin(time * 27 + i * 0.7);
			const x1 = x0 * cosA + z0 * sinA;
			const z1 = -x0 * sinA + z0 * cosA;
			nucleonPoints[i * 3] = x1;
			nucleonPoints[i * 3 + 1] = y0 * cosB - z1 * sinB;
			nucleonPoints[i * 3 + 2] = y0 * sinB + z1 * cosB;
			nucleonOrder.push(i);
		}
		nucleonOrder.sort((a, b) => nucleonPoints[b * 3 + 2] - nucleonPoints[a * 3 + 2]);

		const step = Math.round(this.heat * HEAT_STEPS_PER_UNIT);
		const extent = Math.max(1, packNucleus(count).extent - NUCLEON_RADIUS);
		ctx.globalAlpha = 1;
		for (const i of nucleonOrder) {
			const z = nucleonPoints[i * 3 + 2];
			const shade = Math.round(Math.min(1, Math.max(0, (z / extent + 1) / 2)) * (DEPTH_SHADES - 1));
			const size = 2 * NUCLEON_RADIUS * NUCLEUS_SCALE * this.appear[i] * (1 - z * 0.04);
			/** Every third nucleon is a neutron, like the main atom. */
			ctx.drawImage(this.nucleonSprite(step, i % 3 === 2, shade), nucleonPoints[i * 3] * NUCLEUS_SCALE - size / 2, nucleonPoints[i * 3 + 1] * NUCLEUS_SCALE - size / 2, size, size);
		}

		if (this.heat > 1) {
			const radius = this.coreRadius * 1.3;
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = (this.heat - 1) * 0.35;
			ctx.drawImage(this.glowSprite(HOT_COLOR), -radius, -radius, radius * 2, radius * 2);
			ctx.globalCompositeOperation = 'source-over';
		}
		return moving;
	}

	/** Streaks leave the core surface, spawn rate follows the output and they fade out before reaching the chamber wall. Returns whether any flies. */
	private drawRays(dt: number, coreRadius: number, scene: ReactorScene): boolean {
		const { ctx, rays } = this;
		if (scene.mass > 0 && scene.power > 0) {
			this.rayBudget += dt * (3 + 70 * this.output + 25 * scene.instability) * (this.reducedMotion ? 0.3 : 1);
		}
		for (let slot = 0; slot < MAX_RAYS && this.rayBudget >= 1; slot++) {
			const i = slot * 4;
			if (rays[i + 2] !== 0 || rays[i + 3] !== 0) continue;
			const angle = Math.random() * TAU;
			const speed = 30 + Math.random() * 45 + this.power * 25;
			rays[i] = Math.cos(angle) * coreRadius * 0.85;
			rays[i + 1] = Math.sin(angle) * coreRadius * 0.85;
			rays[i + 2] = Math.cos(angle) * speed;
			rays[i + 3] = Math.sin(angle) * speed;
			this.rayBudget--;
		}
		this.rayBudget = Math.min(this.rayBudget, 1);

		const bright = new Path2D();
		const dim = new Path2D();
		let alive = false;
		for (let slot = 0; slot < MAX_RAYS; slot++) {
			const i = slot * 4;
			const vx = rays[i + 2];
			const vy = rays[i + 3];
			if (vx === 0 && vy === 0) continue;
			const x = (rays[i] += vx * dt);
			const y = (rays[i + 1] += vy * dt);
			const distance = Math.hypot(x, y);
			if (distance >= CHAMBER_RADIUS - 1) {
				rays[i + 2] = rays[i + 3] = 0;
				continue;
			}
			const path = distance > CHAMBER_RADIUS - 9 ? dim : bright;
			path.moveTo(x, y);
			path.lineTo(x - vx * 0.07, y - vy * 0.07);
			alive = true;
		}
		if (!alive) return false;
		ctx.globalCompositeOperation = 'lighter';
		ctx.lineCap = 'round';
		ctx.lineWidth = 0.55;
		ctx.strokeStyle = this.rayColor;
		ctx.globalAlpha = 0.85;
		ctx.stroke(bright);
		ctx.globalAlpha = 0.3;
		ctx.stroke(dim);
		ctx.globalCompositeOperation = 'source-over';
		return true;
	}

	/** Returns whether any fuel electron is still on its way. */
	private drawFuel(dt: number, coreRadius: number): boolean {
		const { ctx, fuel } = this;
		const cores = new Path2D();
		const halos = new Path2D();
		let alive = false;
		for (let slot = 0; slot < MAX_FUEL; slot++) {
			const i = slot * 4;
			const vx = fuel[i + 2];
			const vy = fuel[i + 3];
			if (vx === 0 && vy === 0) continue;
			const x = (fuel[i] += vx * dt);
			const y = (fuel[i + 1] += vy * dt);
			if (Math.hypot(x, y) < coreRadius * 0.8) {
				fuel[i + 2] = fuel[i + 3] = 0;
				this.flash = Math.min(1, this.flash + 0.12);
				continue;
			}
			cores.moveTo(x + 0.9, y);
			cores.arc(x, y, 0.9, 0, TAU);
			halos.moveTo(x + 2.4, y);
			halos.arc(x, y, 2.4, 0, TAU);
			alive = true;
		}
		if (!alive) return false;
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = 0.3;
		ctx.fillStyle = ELECTRON_COLOR;
		ctx.fill(halos);
		ctx.globalAlpha = 1;
		ctx.fillStyle = mix(ELECTRON_COLOR, '#ffffff', 0.5);
		ctx.fill(cores);
		ctx.globalCompositeOperation = 'source-over';
		return true;
	}

	private drawGauge() {
		const { ctx } = this;
		if (this.output <= 0) return;
		const capped = this.state.output >= 1;
		const color = capped ? CAPPED_COLOR : this.accent;
		const end = GAUGE_START + GAUGE_SWEEP * Math.min(1, this.output);
		ctx.lineCap = 'round';
		ctx.strokeStyle = color;
		ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = capped ? 0.3 + 0.15 * Math.sin(performance.now() / 120) : 0.22;
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.arc(0, 0, GAUGE_RADIUS, GAUGE_START, end);
		ctx.stroke();
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.lineWidth = 2.2;
		ctx.stroke();
		ctx.fillStyle = mix(color, '#ffffff', 0.6);
		ctx.beginPath();
		ctx.arc(Math.cos(end) * GAUGE_RADIUS, Math.sin(end) * GAUGE_RADIUS, 1.5, 0, TAU);
		ctx.fill();
	}
}
