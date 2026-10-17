import { CanvasLoop } from '#helpers/CanvasLoop.js';

const MAX_SPARKS = 320;
const MAX_COMETS = 24;
/** Share of the velocity kept after one second. */
const DRAG = 0.04;
const COMET_SECONDS = 0.9;
const SPRITE = 64;

export interface Point {
	x: number;
	y: number;
}

interface Spark {
	alpha: number;
	color: string;
	fade: number;
	gravity: number;
	size: number;
	vx: number;
	vy: number;
	x: number;
	y: number;
}

interface Comet {
	color: string;
	control: Point;
	from: Point;
	t: number;
	to: Point;
}

/** Glowing sparks and forge-to-cell comets on one fixed canvas, the loop sleeps once the last one fades. */
export class TableParticles extends CanvasLoop {
	private readonly comets: Comet[] = [];
	private readonly ctx: CanvasRenderingContext2D;
	private readonly sparks: Spark[] = [];

	constructor(canvas: HTMLCanvasElement) {
		super(canvas, 'canvas:tableParticles');
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		this.observe();
	}

	/** Sparks flying out of a point, `rise` pulls them upward like embers instead of letting them fall. */
	burst({ x, y }: Point, colors: string[], count: number, { rise = false, size = 10, speed = 160 } = {}) {
		if (!this.shown) return;
		for (let i = 0; i < count && this.sparks.length < MAX_SPARKS; i++) {
			const angle = rise ? -Math.PI / 2 + (Math.random() - 0.5) * 1.2 : Math.random() * Math.PI * 2;
			const velocity = speed * (0.35 + Math.random() * 0.65);
			this.sparks.push({
				alpha: 1,
				color: colors[i % colors.length],
				fade: 0.9 + Math.random() * 0.8,
				gravity: rise ? -30 : 90,
				size: size * (0.5 + Math.random() * 0.6),
				vx: Math.cos(angle) * velocity,
				vy: Math.sin(angle) * velocity,
				x,
				y,
			});
		}
		this.update();
	}

	/** A glowing nucleus arcing `lift` pixels above its path from `from` to `to` in `COMET_SECONDS`, the caller lands its own effect after that delay. */
	comet(from: Point, to: Point, color: string, lift = Math.min(160, Math.hypot(to.x - from.x, to.y - from.y) * 0.35)) {
		if (!this.shown || this.comets.length >= MAX_COMETS) return;
		this.comets.push({ color, control: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift }, from, t: 0, to });
		this.update();
	}

	destroy() {
		super.destroy();
		this.sparks.length = 0;
		this.comets.length = 0;
	}

	protected draw(dt: number): boolean {
		const { ctx, ratio } = this;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx.globalCompositeOperation = 'lighter';
		const damp = DRAG ** dt;

		for (let i = this.comets.length - 1; i >= 0; i--) {
			const comet = this.comets[i];
			comet.t += dt / COMET_SECONDS;
			if (comet.t >= 1) {
				this.comets.splice(i, 1);
				continue;
			}
			const eased = comet.t < 0.5 ? 2 * comet.t * comet.t : 1 - (-2 * comet.t + 2) ** 2 / 2;
			const at = this.bezier(comet, eased);
			if (this.sparks.length < MAX_SPARKS) {
				this.sparks.push({ alpha: 0.7, color: comet.color, fade: 2.2, gravity: 0, size: 7, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, ...at });
			}
			this.blit('white', at.x, at.y, 10, 1);
			this.blit(comet.color, at.x, at.y, 26, 1);
		}

		for (let i = this.sparks.length - 1; i >= 0; i--) {
			const spark = this.sparks[i];
			spark.vx *= damp;
			spark.vy = spark.vy * damp + spark.gravity * dt;
			spark.x += spark.vx * dt;
			spark.y += spark.vy * dt;
			spark.alpha -= spark.fade * dt;
			if (spark.alpha <= 0) {
				this.sparks[i] = this.sparks[this.sparks.length - 1];
				this.sparks.pop();
				continue;
			}
			this.blit(spark.color, spark.x, spark.y, spark.size, spark.alpha);
		}

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		return this.sparks.length + this.comets.length > 0;
	}

	protected paused() {
		this.sparks.length = 0;
		this.comets.length = 0;
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	protected resize(width: number, height: number) {
		this.fit(width, height);
	}

	private bezier({ control, from, to }: Comet, t: number): Point {
		const u = 1 - t;
		return { x: u * u * from.x + 2 * u * t * control.x + t * t * to.x, y: u * u * from.y + 2 * u * t * control.y + t * t * to.y };
	}

	/** Each color's soft glow is painted once into a sprite, every particle is then a single drawImage. */
	private blit(color: string, x: number, y: number, size: number, alpha: number) {
		const sprite = this.sprite(
			`glow:${color}`,
			(ctx, half) => {
				const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
				gradient.addColorStop(0, color);
				gradient.addColorStop(0.25, color);
				gradient.addColorStop(1, 'transparent');
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, half * 2, half * 2);
			},
			SPRITE,
		);
		this.ctx.globalAlpha = Math.max(0, alpha);
		this.ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
	}
}
