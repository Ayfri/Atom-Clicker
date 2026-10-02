import { CanvasLoop, pixelRatio } from '#helpers/CanvasLoop.js';

const MAX_SPARKS = 16;
/** Sparks spawned per second. */
const RATE = 9;
const LIFE: readonly [number, number] = [0.6, 1.1];
/** Rise speed in px/s. */
const RISE: readonly [number, number] = [18, 34];
/** Sideways drift in px/s. */
const SWAY = 8;
/** Glow radius in px. */
const SIZE: readonly [number, number] = [3, 5];
const GLOW_SIZE = 16;
/** Distance between the canvas bottom and the gauge center, where sparks are born. */
const GAUGE_OFFSET = 6;

interface Spark {
	age: number;
	life: number;
	size: number;
	vx: number;
	vy: number;
	x: number;
	y: number;
}

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min);

/** Glowing sparks rising off a maxed currency boost gauge, mounted only while the gauge is full. */
export class BoostSparks extends CanvasLoop {
	private readonly ctx: CanvasRenderingContext2D;
	/** Fraction of a spark owed by the spawn rate, carried between frames. */
	private debt = 0;
	private height = 0;
	private ratio = 1;
	private readonly sparks: Spark[] = [];
	private width = 0;

	constructor(
		canvas: HTMLCanvasElement,
		private readonly color: string,
	) {
		super(canvas);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		this.observe();
	}

	protected draw(dt: number): boolean {
		const { canvas, ctx, height, ratio, sparks, width } = this;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!this.shown) {
			sparks.length = 0;
			return false;
		}

		this.debt = Math.min(this.debt + dt * RATE, 1);
		if (this.debt >= 1 && sparks.length < MAX_SPARKS) {
			this.debt--;
			sparks.push({ age: 0, life: between(LIFE), size: between(SIZE), vx: (Math.random() - 0.5) * SWAY, vy: between(RISE), x: Math.random() * width, y: height - GAUGE_OFFSET });
		}

		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		const glow = this.glow();
		let alive = 0;
		for (const spark of sparks) {
			spark.age += dt;
			if (spark.age >= spark.life) continue;
			spark.x += spark.vx * dt;
			spark.y -= spark.vy * dt;
			ctx.globalAlpha = Math.sin((spark.age / spark.life) * Math.PI);
			ctx.drawImage(glow, spark.x - spark.size, spark.y - spark.size, spark.size * 2, spark.size * 2);
			sparks[alive++] = spark;
		}
		sparks.length = alive;
		ctx.globalAlpha = 1;
		return true;
	}

	protected resize() {
		this.ratio = pixelRatio();
		this.width = this.canvas.clientWidth;
		this.height = this.canvas.clientHeight;
		this.canvas.width = Math.max(1, Math.round(this.width * this.ratio));
		this.canvas.height = Math.max(1, Math.round(this.height * this.ratio));
		// Resizing resets the context state and clears the canvas.
		this.ctx.globalCompositeOperation = 'lighter';
	}

	private glow() {
		return this.sprite(
			this.color,
			(ctx, half) => {
				const halo = ctx.createRadialGradient(half, half, 0, half, half, half);
				halo.addColorStop(0, 'rgba(255, 255, 255, 1)');
				halo.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
				halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
				ctx.fillStyle = halo;
				ctx.fillRect(0, 0, half * 2, half * 2);
				ctx.globalCompositeOperation = 'source-in';
				ctx.fillStyle = this.color;
				ctx.fillRect(0, 0, half * 2, half * 2);
			},
			GLOW_SIZE,
		);
	}
}
