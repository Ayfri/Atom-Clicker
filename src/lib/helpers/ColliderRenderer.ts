import { CanvasLoop, pixelRatio } from '$helpers/CanvasLoop';
import { rgba, TAU } from '$helpers/nucleus';

const BEAM_ACCELERATION = 22;
const BEAM_COLORS = ['#81addf', '#ffd58a'] as const;
const BEAM_MAX_SPEED = 38;
const BEAM_START_SPEED = 3;
/** Beams are injected at the bottom and cross at the top every lap, they only collide from their second top crossing on. */
const BOTTOM = Math.PI / 2;
const COLLISION_MIN_TRAVEL = 3 * Math.PI;
const DEBRIS = 44;
const FIZZLE_DURATION = 0.4;
const FLASH_DURATION = 0.35;
const IMPACT_DURATION = 1.1;
const MAX_SPARKS = 96;
const RING_RADIUS = 44;
const SPARK_DRAG = 2.4;
const TRAIL_SEGMENTS = 14;
/** The canvas overflows the 100 unit ring button so the debris flies past it, taller than wide for the vertical collision jets. */
const VIEW_WIDTH = 120;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Draws the Collider injection: two beams accelerate around the ring in opposite directions while the request runs, then collide at the top
 * with a flash, a shockwave, debris jets and energy running back down the ring. The loop only runs during the animation.
 */
export class ColliderRenderer extends CanvasLoop {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
	/** x, y, vx, vy, remaining life, lifespan per slot, a spent life marks a free slot. */
	private readonly sparks = new Float32Array(MAX_SPARKS * 6);
	private beams = false;
	private fade = 1;
	private fizzling = false;
	private impact = -1;
	private onImpact: (() => void) | undefined;
	private pixelHeight = 0;
	private pixelWidth = 0;
	private speed = 0;
	private travel = 0;

	constructor(canvas: HTMLCanvasElement) {
		super(canvas);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		this.observe();
	}

	/** Sends the beams around the ring, they keep circling until `collide` or `fizzle`. */
	accelerate() {
		if (this.reducedMotion) return;
		this.beams = true;
		this.fade = 1;
		this.fizzling = false;
		this.onImpact = undefined;
		this.speed = BEAM_START_SPEED;
		this.travel = 0;
		this.update();
	}

	/** The beams collide at their next top crossing, `onImpact` runs at that moment. */
	collide(onImpact: () => void) {
		this.onImpact = onImpact;
		if (!this.beams) this.explode();
	}

	fizzle() {
		this.fizzling = true;
		this.onImpact = undefined;
	}

	protected draw(dt: number): boolean {
		const { ctx, pixelHeight, pixelWidth } = this;
		const scale = pixelWidth / VIEW_WIDTH;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, pixelWidth, pixelHeight);
		ctx.setTransform(scale, 0, 0, scale, pixelWidth / 2, pixelHeight / 2);
		ctx.globalCompositeOperation = 'lighter';

		if (this.beams) this.moveBeams(dt);
		if (this.beams) this.drawBeams();
		const impacting = this.impact >= 0 && this.drawImpact(dt);
		const sparking = this.drawSparks(dt);
		ctx.globalAlpha = 1;
		return this.beams || impacting || sparking;
	}

	protected resize() {
		const ratio = pixelRatio();
		this.pixelWidth = this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
		this.pixelHeight = this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
		this.redraw();
	}

	private burst(x: number, y: number, count: number, speed: number, life: number) {
		for (let slot = 0; slot < MAX_SPARKS && count > 0; slot++) {
			const i = slot * 6;
			if (this.sparks[i + 4] > 0) continue;
			const angle = Math.random() * TAU;
			/** Head-on beams throw their debris sideways to their paths, stretching the burst into vertical jets. */
			const velocity = speed * (0.3 + Math.random() * 0.7) * (1 + 0.4 * Math.abs(Math.sin(angle)));
			this.sparks[i] = x;
			this.sparks[i + 1] = y;
			this.sparks[i + 2] = Math.cos(angle) * velocity;
			this.sparks[i + 3] = Math.sin(angle) * velocity;
			this.sparks[i + 4] = this.sparks[i + 5] = life * (0.5 + Math.random() * 0.5);
			count--;
		}
	}

	private drawBeams() {
		const { ctx } = this;
		const length = Math.min(2.6, 0.25 + this.speed * 0.07);
		const size = 6 + this.speed * 0.2;
		for (let beam = 0; beam < 2; beam++) {
			const direction = beam === 0 ? 1 : -1;
			const head = BOTTOM + direction * this.travel;
			ctx.strokeStyle = BEAM_COLORS[beam];
			for (let k = 0; k < TRAIL_SEGMENTS; k++) {
				const strength = 1 - k / TRAIL_SEGMENTS;
				const from = head - (direction * length * k) / TRAIL_SEGMENTS;
				const to = head - (direction * length * (k + 1)) / TRAIL_SEGMENTS;
				ctx.globalAlpha = this.fade * strength ** 2;
				ctx.lineWidth = 0.4 + 2.2 * strength;
				ctx.beginPath();
				ctx.arc(0, 0, RING_RADIUS, Math.min(from, to), Math.max(from, to));
				ctx.stroke();
			}
			ctx.globalAlpha = this.fade;
			ctx.drawImage(this.glow(BEAM_COLORS[beam]), Math.cos(head) * RING_RADIUS - size, Math.sin(head) * RING_RADIUS - size, size * 2, size * 2);
		}
	}

	/** Returns whether the impact is still playing. */
	private drawImpact(dt: number): boolean {
		const { ctx } = this;
		this.impact += dt;
		const t = this.impact / IMPACT_DURATION;
		if (t >= 1) {
			this.impact = -1;
			return false;
		}
		const fade = (1 - t) ** 2;
		const flash = Math.min(1, this.impact / FLASH_DURATION);
		const flashSize = 10 + 28 * Math.sqrt(flash);
		ctx.globalAlpha = 1 - flash;
		ctx.drawImage(this.glow('#ffffff'), -flashSize, -RING_RADIUS - flashSize, flashSize * 2, flashSize * 2);

		ctx.strokeStyle = BEAM_COLORS[0];
		ctx.globalAlpha = fade;
		ctx.lineWidth = 2 + 4 * (1 - t);
		ctx.beginPath();
		ctx.arc(0, 0, RING_RADIUS, 0, TAU);
		ctx.stroke();
		if (this.reducedMotion) return true;

		ctx.globalAlpha = fade * 0.5;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(0, 0, RING_RADIUS + 14 * easeOut(t), 0, TAU);
		ctx.stroke();

		ctx.strokeStyle = '#ffffff';
		ctx.globalAlpha = fade * 0.9;
		ctx.lineWidth = 1.4 * (1 - t);
		ctx.beginPath();
		ctx.arc(0, -RING_RADIUS, 3 + 18 * easeOut(Math.min(1, t * 1.6)), 0, TAU);
		ctx.stroke();

		/** The collision energy runs back down both sides of the ring, where the cooldown starts charging. */
		const offset = 2.6 * easeOut(t);
		ctx.globalAlpha = 1 - t;
		for (let beam = 0; beam < 2; beam++) {
			const angle = -BOTTOM + (beam === 0 ? offset : -offset);
			ctx.drawImage(this.glow(BEAM_COLORS[beam]), Math.cos(angle) * RING_RADIUS - 6, Math.sin(angle) * RING_RADIUS - 6, 12, 12);
		}
		return true;
	}

	/** Returns whether any spark is still alive. */
	private drawSparks(dt: number): boolean {
		const { ctx, sparks } = this;
		const drag = Math.exp(-SPARK_DRAG * dt);
		let alive = false;
		ctx.lineCap = 'round';
		ctx.lineWidth = 0.9;
		for (let slot = 0; slot < MAX_SPARKS; slot++) {
			const i = slot * 6;
			if (sparks[i + 4] <= 0) continue;
			sparks[i + 4] -= dt;
			sparks[i + 2] *= drag;
			sparks[i + 3] *= drag;
			sparks[i] += sparks[i + 2] * dt;
			sparks[i + 1] += sparks[i + 3] * dt;
			if (sparks[i + 4] <= 0) continue;
			alive = true;
			ctx.globalAlpha = sparks[i + 4] / sparks[i + 5];
			ctx.strokeStyle = slot % 3 === 2 ? '#ffffff' : BEAM_COLORS[slot % 3];
			ctx.beginPath();
			ctx.moveTo(sparks[i], sparks[i + 1]);
			ctx.lineTo(sparks[i] - sparks[i + 2] * 0.05, sparks[i + 1] - sparks[i + 3] * 0.05);
			ctx.stroke();
		}
		return alive;
	}

	private explode() {
		this.beams = false;
		this.impact = 0;
		this.onImpact?.();
		this.onImpact = undefined;
		if (!this.reducedMotion) this.burst(0, -RING_RADIUS, DEBRIS, 62, 1.1);
		this.update();
	}

	private glow(color: string): HTMLCanvasElement {
		return this.sprite(
			color,
			(ctx, half) => {
				const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
				gradient.addColorStop(0, '#ffffff');
				gradient.addColorStop(0.2, rgba(color, 0.9));
				gradient.addColorStop(1, rgba(color, 0));
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, half * 2, half * 2);
			},
			64,
		);
	}

	private moveBeams(dt: number) {
		const passed = Math.floor(this.travel / Math.PI);
		this.speed = Math.min(BEAM_MAX_SPEED, this.speed + BEAM_ACCELERATION * dt);
		this.travel += this.speed * dt;
		const crossing = Math.floor(this.travel / Math.PI);
		if (crossing > passed) {
			const top = crossing % 2 === 1 ? crossing : crossing - 1;
			if (top > passed && this.onImpact && top * Math.PI >= COLLISION_MIN_TRAVEL) return this.explode();
			const angle = BOTTOM + crossing * Math.PI;
			this.burst(Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, 5, 30, 0.4);
		}
		if (!this.fizzling) return;
		this.fade -= dt / FIZZLE_DURATION;
		if (this.fade <= 0) this.beams = false;
	}
}
