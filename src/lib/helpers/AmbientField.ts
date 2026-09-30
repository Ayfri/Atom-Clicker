import type { RealmType } from '$data/realms';
import { CanvasLoop } from '$helpers/CanvasLoop';
import { REALM_SWITCH_MS } from '$helpers/RealmManager.svelte';
import { prefersReducedMotion } from 'svelte/motion';

const TAU = Math.PI * 2;
/** Soft glows need no retina detail and the canvas spans the whole realm: 1x keeps its fill and memory at a quarter of 2x. */
const MAX_PIXEL_RATIO = 1;
const MAX_BURST_MOTES = 60;
const MAX_DUST = 20;
/** Extra dust purchases may add on top of the realm density. */
const MAX_SURGE = 12;
const GLOW_SIZE = 32;
const FADE_IN_S = 0.08;
/** A ring ends its life this many times wider than its preset size. */
const RING_GROWTH = 9;
const RING_ALPHA = 0.45;
/** Speed in px/s that stretches a streak to twice its size. */
const STRETCH_SPEED = 90;
const MAX_STRETCH = 4;
/** Room around each mote for antialiasing and the ring stroke, so the partial clear never leaves a trail. */
const CLEAR_MARGIN = 3;
/** Dust alone moves a few px per second, so it is drawn at 30 fps: every skipped frame leaves the canvas layer untouched. */
const DUST_FRAME_S = 1 / 30;

interface Preset {
	/** Peak opacity. */
	alpha: number;
	/** Minimum ms between two bursts: auto-clickers fire far faster than the background should react. */
	cooldown: number;
	count: number;
	/** Share of the velocity kept after one second. */
	drag: number;
	life: readonly [number, number];
	/** Upward acceleration in px/s². */
	lift: number;
	/** Adds an expanding ring under the burst. */
	ring: boolean;
	/** Glow radius in px. */
	size: readonly [number, number];
	speed: readonly [number, number];
	/** Cone width in radians around the burst angle, a full turn scatters evenly. */
	spread: number;
	/** Stretches the glow along its velocity into a streak. */
	stretch: boolean;
}

/**
 * - `bloom`: ring and radial burst, a purchase that matters (upgrade, level up, power-up)
 * - `drift`: one slow mote, ambient activity
 * - `embers`: rising streaks, a purchase
 * - `hum`: one soft mote, an automated action
 * - `spark`: two fast streaks, a manual click
 */
const PRESETS = {
	bloom: { alpha: 1, cooldown: 60, count: 10, drag: 0.08, life: [0.8, 1.3], lift: 0, ring: true, size: [6, 10], speed: [90, 200], spread: TAU, stretch: false },
	drift: { alpha: 0.8, cooldown: 0, count: 1, drag: 0.6, life: [2.5, 3.5], lift: 10, ring: false, size: [6, 11], speed: [20, 45], spread: 0.6, stretch: false },
	embers: { alpha: 1, cooldown: 60, count: 6, drag: 0.35, life: [1, 1.8], lift: 60, ring: false, size: [6, 10], speed: [60, 150], spread: 1.6, stretch: true },
	hum: { alpha: 0.8, cooldown: 300, count: 1, drag: 0.4, life: [1.4, 2.2], lift: 8, ring: false, size: [5, 9], speed: [40, 90], spread: 0.8, stretch: false },
	spark: { alpha: 1, cooldown: 50, count: 2, drag: 0.05, life: [0.5, 0.9], lift: 0, ring: false, size: [4, 7], speed: [300, 480], spread: TAU, stretch: true },
} as const satisfies Record<string, Preset>;

/** Small ring and splash where a comet lands. */
const IMPACT: Preset = { alpha: 1, cooldown: 0, count: 5, drag: 0.05, life: [0.3, 0.6], lift: 0, ring: true, size: [3, 5], speed: [80, 160], spread: TAU, stretch: true };
const COMET_LIFE: readonly [number, number] = [0.7, 1];
/** Flight of a comet carrying a new electron, the shell waits for it before growing one. */
export const ELECTRON_FLIGHT = 0.8;
const COMET_SIZE: readonly [number, number] = [5, 7];
/** Sideways bend of a comet path, as a share of its length. */
const COMET_BEND: readonly [number, number] = [0.15, 0.35];

/** Background dust, like the skill tree's: rises from the bottom edge across most of the screen with a slow sway. */
const DUST_ALPHA = 0.5;
const DUST_LIFE: readonly [number, number] = [14, 26];
const DUST_MEAN_LIFE = (DUST_LIFE[0] + DUST_LIFE[1]) / 2;
/** Share of the field height a mote climbs over its life. */
const DUST_RISE = 0.85;
const DUST_SIZE: readonly [number, number] = [3, 6];
/** Share of the life spent fading in, and again fading out. */
const DUST_FADE = 0.15;
const DUST_SWAY: readonly [number, number] = [4, 12];
/** Radians per second of the sway. */
const DUST_SWAY_SPEED: readonly [number, number] = [0.6, 1.2];
/** Surge dust lives shorter and starts partway up, so a purchase shows at once. */
const SURGE_LIFE: readonly [number, number] = [5, 8];
const SURGE_PROGRESS: readonly [number, number] = [0.1, 0.6];

export type AmbientPreset = keyof typeof PRESETS;

type Point = { x: number; y: number };

export interface AmbientBurst {
	/** Direction in radians, straight up by default. Only matters for presets with a narrow spread. */
	angle?: number;
	color?: string;
	count?: number;
	/** Comet flight in seconds, for a caller that times something to its landing. Random in `COMET_LIFE` otherwise. */
	flight?: number;
	/** Extra short-lived dust in the burst color, capped by `MAX_SURGE`. */
	surge?: number;
	/** Client point a comet flies to from the burst, splashing on arrival. */
	target?: Point;
}

/** Constant dust of a realm: how many motes float at once (up to `MAX_DUST`), the colors they pick from and how fast they rise. */
export interface Ambience {
	colors: readonly string[];
	density: number;
	pace?: number;
}

/** A click places the burst under the pointer, or on its button for keyboard activation; a point is in client pixels. */
type Origin = MouseEvent | Point;

/** Quadratic curve of a comet, in field pixels. */
interface CometPath {
	cx: number;
	cy: number;
	sx: number;
	sy: number;
	tx: number;
	ty: number;
}

interface Mote {
	age: number;
	alpha: number;
	/** Square drawn on the last frame, cleared on the next one. Plain numbers, an object per mote per frame would churn the GC. */
	boxSize: number;
	boxX: number;
	boxY: number;
	color: string;
	drag: number;
	dust: boolean;
	life: number;
	lift: number;
	path: CometPath | null;
	/** Start of the sway cycle, so neighbours never sway in sync. */
	phase: number;
	ring: boolean;
	size: number;
	stretch: boolean;
	/** Sideways sway amplitude in px, 0 for bursts. */
	sway: number;
	swaySpeed: number;
	vx: number;
	vy: number;
	x: number;
	y: number;
}

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min);

/**
 * Background particles of the realm on screen: constant dust that thickens with progression, and bursts reacting to what the
 * player does. Only the selected realm mounts one, and each frame clears just the areas its motes covered on the previous one.
 */
export class AmbientField extends CanvasLoop {
	private static current: AmbientField | null = null;

	/** Default burst color, the realm accent. */
	accent: string;
	private ambience: Ambience;
	/** Comets that landed this frame, reused so arrivals allocate nothing. */
	private readonly arrivals: Mote[] = [];
	private bursts = 0;
	private readonly ctx: CanvasRenderingContext2D;
	private dust = 0;
	/** Dust owed by the spawn rate, spawned once it reaches a whole mote. */
	private dustDebt = 0;
	private readonly lastBurst: Partial<Record<AmbientPreset, number>> = {};
	private motes: Mote[] = [];
	/** Time not yet simulated by a skipped dust frame. */
	private pending = 0;
	private ratio = 1;
	private rect: DOMRect | null = null;
	private readonly settleTimeout: ReturnType<typeof setTimeout>;

	constructor(
		canvas: HTMLCanvasElement,
		private readonly realm: RealmType,
		accent: string,
		ambience: Ambience,
	) {
		super(canvas);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		this.accent = accent;
		this.ambience = ambience;
		AmbientField.current = this;
		// The field mounts while its realm swings in, a rect measured mid-transform is dropped once it settles.
		this.settleTimeout = setTimeout(() => (this.rect = null), REALM_SWITCH_MS + 50);
		this.observe();
	}

	/** Drops bursts for a realm or tab that is not on screen, so callers never have to check. */
	static emit(realm: RealmType, preset: AmbientPreset, origin: Origin, burst: AmbientBurst = {}): number {
		const field = AmbientField.current;
		return field?.realm === realm && !document.hidden && !prefersReducedMotion.current ? field.burst(preset, origin, burst) : 0;
	}

	destroy() {
		super.destroy();
		clearTimeout(this.settleTimeout);
		if (AmbientField.current === this) AmbientField.current = null;
	}

	setAmbience(ambience: Ambience) {
		this.ambience = ambience;
		this.update();
	}

	protected draw(dt: number): boolean {
		const density = prefersReducedMotion.current ? 0 : Math.min(this.ambience.density, MAX_DUST);
		const pace = this.ambience.pace ?? 1;
		this.pending += dt;
		if (this.bursts === 0 && this.dust > 0 && this.pending < DUST_FRAME_S) return true;
		dt = this.pending;
		this.pending = 0;

		const { ctx, ratio } = this;
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		for (const { boxSize, boxX, boxY } of this.motes) if (boxSize > 0) ctx.clearRect(boxX, boxY, boxSize, boxSize);

		// An empty field starts with dust already mid-life, a realm never opens on a blank background.
		if (this.dust === 0) for (let i = 0; i < density; i++) this.spawnDust(Math.random(), DUST_LIFE);
		this.dustDebt += (dt * density * pace) / DUST_MEAN_LIFE;
		for (; this.dustDebt >= 1; this.dustDebt--) if (this.dust < density) this.spawnDust(0, DUST_LIFE);

		this.arrivals.length = 0;
		let alive = 0;
		let bursts = 0;
		let dust = 0;
		for (const mote of this.motes) {
			const step = mote.dust ? dt * pace : dt;
			mote.age += step;
			if (mote.age >= mote.life) {
				if (mote.path) this.arrivals.push(mote);
				continue;
			}
			this.motes[alive++] = mote;
			if (mote.dust) dust++;
			else bursts++;

			const t = mote.age / mote.life;
			if (mote.path) {
				const { cx, cy, sx, sy, tx, ty } = mote.path;
				const e = t * t * (3 - 2 * t);
				const u = 1 - e;
				const x = u * u * sx + 2 * u * e * cx + e * e * tx;
				const y = u * u * sy + 2 * u * e * cy + e * e * ty;
				if (step > 0) {
					mote.vx = (x - mote.x) / step;
					mote.vy = (y - mote.y) / step;
				}
				mote.x = x;
				mote.y = y;
			} else {
				const damp = mote.drag ** step;
				mote.vx *= damp;
				mote.vy = mote.vy * damp - mote.lift * step;
				mote.x += mote.vx * step;
				mote.y += mote.vy * step;
			}

			const envelope =
				mote.dust ? Math.min(1, t / DUST_FADE, (1 - t) / DUST_FADE)
				: mote.path ? Math.min(1, mote.age / FADE_IN_S)
				: Math.min(1, mote.age / FADE_IN_S) * (1 - t) * (1 - t);
			const x = mote.sway > 0 ? mote.x + Math.sin(mote.age * mote.swaySpeed + mote.phase) * mote.sway : mote.x;
			ctx.globalAlpha = envelope * mote.alpha;
			let reach: number;
			if (mote.ring) {
				reach = mote.size * RING_GROWTH * (1 - (1 - t) ** 3);
				ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
				ctx.globalAlpha *= RING_ALPHA;
				ctx.lineWidth = 0.5 + 2 * (1 - t);
				ctx.strokeStyle = mote.color;
				ctx.beginPath();
				ctx.arc(mote.x, mote.y, reach, 0, TAU);
				ctx.stroke();
			} else {
				const speed = Math.hypot(mote.vx, mote.vy);
				const length = mote.stretch ? Math.min(1 + speed / STRETCH_SPEED, MAX_STRETCH) : 1;
				const cos = speed > 0 ? mote.vx / speed : 1;
				const sin = speed > 0 ? mote.vy / speed : 0;
				ctx.setTransform(ratio * cos, ratio * sin, -ratio * sin, ratio * cos, ratio * x, ratio * mote.y);
				ctx.drawImage(this.glow(mote.color), -mote.size * length, -mote.size, 2 * mote.size * length, 2 * mote.size);
				reach = mote.size * length;
			}

			reach += CLEAR_MARGIN;
			mote.boxX = Math.floor(x - reach);
			mote.boxY = Math.floor(mote.y - reach);
			mote.boxSize = Math.ceil(reach * 2) + 1;
		}

		this.motes.length = alive;
		this.bursts = bursts;
		this.dust = dust;
		ctx.globalAlpha = 1;
		for (const { color, path } of this.arrivals) if (path) this.scatter(IMPACT, color, path.tx, path.ty, 0, IMPACT.count);
		return this.motes.length > 0 || density > 0;
	}

	/** Motes caught by a hidden tab or realm are dropped rather than frozen on the canvas. */
	protected paused() {
		this.motes.length = 0;
		this.bursts = this.dust = 0;
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	protected resize() {
		this.ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
		this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * this.ratio));
		this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * this.ratio));
		// Resizing resets the context state and clears the canvas.
		this.ctx.globalCompositeOperation = 'lighter';
		for (const mote of this.motes) mote.boxSize = 0;
		this.rect = null;
	}

	/** Returns the comet flight in seconds, 0 when none left. */
	private burst(name: AmbientPreset, origin: Origin, { angle = -Math.PI / 2, color = this.accent, count, flight, surge = 0, target }: AmbientBurst) {
		const preset: Preset = PRESETS[name];
		const now = performance.now();
		if (now - (this.lastBurst[name] ?? -Infinity) < preset.cooldown || this.bursts >= MAX_BURST_MOTES) return 0;
		this.lastBurst[name] = now;

		const { x, y } = this.locate(origin);
		// The comet goes first, something may be waiting for it to land.
		const launched = target ? this.launch(color, x, y, this.locate(target), flight ?? between(COMET_LIFE)) : 0;
		this.scatter(preset, color, x, y, angle, count ?? preset.count);
		for (let i = 0; i < surge && this.dust < MAX_DUST + MAX_SURGE; i++) this.spawnDust(between(SURGE_PROGRESS), SURGE_LIFE, color);
		this.update();
		return launched;
	}

	private glow(color: string) {
		return this.sprite(
			color,
			(ctx, half) => {
				// A white alpha mask tinted with `source-in`: a gradient straight to a transparent color would darken its fringe.
				const halo = ctx.createRadialGradient(half, half, 0, half, half, half);
				halo.addColorStop(0, 'rgba(255, 255, 255, 1)');
				halo.addColorStop(0.25, 'rgba(255, 255, 255, 0.5)');
				halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
				ctx.fillStyle = halo;
				ctx.fillRect(0, 0, half * 2, half * 2);
				ctx.globalCompositeOperation = 'source-in';
				ctx.fillStyle = color;
				ctx.fillRect(0, 0, half * 2, half * 2);

				ctx.globalCompositeOperation = 'source-over';
				const core = ctx.createRadialGradient(half, half, 0, half, half, half * 0.22);
				core.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
				core.addColorStop(1, 'rgba(255, 255, 255, 0)');
				ctx.fillStyle = core;
				ctx.fillRect(0, 0, half * 2, half * 2);
			},
			GLOW_SIZE,
		);
	}

	/** Sends a comet along a curve bent to a random side, so repeated purchases never draw the same line. */
	private launch(color: string, sx: number, sy: number, { x: tx, y: ty }: Point, life: number) {
		if (this.bursts >= MAX_BURST_MOTES) return 0;
		const bend = between(COMET_BEND) * (Math.random() < 0.5 ? -1 : 1);
		const path = { cx: (sx + tx) / 2 - (ty - sy) * bend, cy: (sy + ty) / 2 + (tx - sx) * bend, sx, sy, tx, ty };
		this.motes.push(this.mote({ color, life, path, size: between(COMET_SIZE), stretch: true, x: sx, y: sy }));
		this.bursts++;
		return life;
	}

	private locate(origin: Origin): Point {
		this.rect ??= this.canvas.getBoundingClientRect();
		if (!(origin instanceof MouseEvent)) return { x: origin.x - this.rect.left, y: origin.y - this.rect.top };
		if (origin.detail === 0 && origin.currentTarget instanceof Element) {
			const target = origin.currentTarget.getBoundingClientRect();
			return { x: target.left + target.width / 2 - this.rect.left, y: target.top + target.height / 2 - this.rect.top };
		}
		return { x: origin.clientX - this.rect.left, y: origin.clientY - this.rect.top };
	}

	private mote(fields: Partial<Mote> & Pick<Mote, 'color' | 'life' | 'size' | 'x' | 'y'>): Mote {
		return {
			age: 0,
			alpha: 1,
			boxSize: 0,
			boxX: 0,
			boxY: 0,
			drag: 1,
			dust: false,
			lift: 0,
			path: null,
			phase: 0,
			ring: false,
			stretch: false,
			sway: 0,
			swaySpeed: 0,
			vx: 0,
			vy: 0,
			...fields,
		};
	}

	private scatter(preset: Preset, color: string, x: number, y: number, angle: number, count: number) {
		const base = { alpha: preset.alpha, color, drag: preset.drag, lift: preset.lift, stretch: preset.stretch, x, y };
		if (preset.ring) this.motes.push(this.mote({ ...base, life: between(preset.life), ring: true, size: between(preset.size) }));
		const total = Math.min(count, MAX_BURST_MOTES - this.bursts);
		for (let i = 0; i < total; i++) {
			const direction = angle + (Math.random() - 0.5) * preset.spread;
			const speed = between(preset.speed);
			this.motes.push(this.mote({ ...base, life: between(preset.life), size: between(preset.size), vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed }));
		}
		// Counted now, so the next frame draws at full rate and a burst in the same frame respects the cap.
		this.bursts += total + (preset.ring ? 1 : 0);
	}

	/** `progress` is the share of its life already spent, a mote spawned mid-life starts that far up. */
	private spawnDust(progress: number, lifeRange: readonly [number, number], color?: string) {
		const { colors } = this.ambience;
		if (!color && colors.length === 0) return;
		const height = this.canvas.height / this.ratio;
		const life = between(lifeRange);
		const size = between(DUST_SIZE);
		const speed = (DUST_RISE * height) / life;
		this.motes.push(
			this.mote({
				age: progress * life,
				alpha: DUST_ALPHA,
				color: color ?? colors[Math.floor(Math.random() * colors.length)],
				dust: true,
				life,
				phase: Math.random() * TAU,
				size,
				sway: between(DUST_SWAY),
				swaySpeed: between(DUST_SWAY_SPEED),
				vy: -speed,
				x: Math.random() * (this.canvas.width / this.ratio),
				y: height + size - speed * progress * life,
			}),
		);
		this.dust++;
	}
}
