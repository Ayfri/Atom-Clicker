const MAX_FRAME_S = 0.1;
const SPRITE_SIZE = 128;

/**
 * Lifecycle shared by the hand-drawn realm canvases: the frame loop only runs while the realm is selected and the canvas on screen,
 * and stops by itself once `draw` reports a settled scene. Also caches the pre-rendered sprites.
 */
export abstract class CanvasLoop {
	private readonly sprites = new Map<string, HTMLCanvasElement>();
	private active = true;
	private frame = 0;
	private lastTime = 0;
	private observers: (IntersectionObserver | ResizeObserver)[] = [];
	private visible = false;

	protected constructor(protected readonly canvas: HTMLCanvasElement) {}

	destroy() {
		cancelAnimationFrame(this.frame);
		for (const observer of this.observers) observer.disconnect();
	}

	/** Realms stay mounted behind the selected one, a deselected realm keeps its loop stopped. */
	setActive(active: boolean) {
		this.active = active;
		this.update();
	}

	/** Returns whether the scene still moves: a settled scene stops the loop until `update` wakes it. */
	protected abstract draw(dt: number): boolean;

	protected abstract resize(): void;

	/** Called by the subclass constructor once its own fields exist, the first resize reads them. */
	protected observe() {
		const resize = new ResizeObserver(() => this.resize());
		resize.observe(this.canvas);
		const intersection = new IntersectionObserver(([entry]) => {
			this.visible = entry.isIntersecting;
			this.update();
		});
		intersection.observe(this.canvas);
		this.observers = [resize, intersection];
		this.resize();
	}

	/** Runs when the loop stops for a hidden or deselected canvas. */
	protected paused() {}

	/** Draws one frame even when stopped, resizing a canvas clears it. */
	protected redraw() {
		if (!this.frame) this.frame = requestAnimationFrame(this.loop);
	}

	/** Starts or stops the loop to match the realm selection and visibility, and wakes a settled one. */
	protected update() {
		const running = this.active && this.visible;
		if (running && !this.frame) {
			this.lastTime = performance.now();
			this.frame = requestAnimationFrame(this.loop);
		} else if (!running && this.frame) {
			cancelAnimationFrame(this.frame);
			this.frame = 0;
			this.paused();
		}
	}

	protected clearSprites() {
		this.sprites.clear();
	}

	protected sprite(key: string, paint: (ctx: CanvasRenderingContext2D, half: number) => void): HTMLCanvasElement {
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

	private readonly loop = (now: number) => {
		const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, MAX_FRAME_S) : 0;
		this.lastTime = now;
		this.frame = this.draw(dt) && this.active && this.visible ? requestAnimationFrame(this.loop) : 0;
	};
}
