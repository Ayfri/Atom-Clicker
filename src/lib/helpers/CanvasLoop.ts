import { perfTracker } from '#helpers/perfTracker.js';
import { prefersReducedMotion } from 'svelte/motion';

const MAX_FRAME_S = 0.1;
const SPRITE_SIZE = 128;

/** Resolved once: the check is environment-level and runs on the click path. */
export const particlesEnabled = typeof window !== 'undefined' && !/headless|phantom|selenium/.test(navigator.userAgent.toLowerCase());

/** Cheap phones report a 3x ratio, which triples the fill cost of a canvas for no visible gain. */
export const pixelRatio = (max = 2) => Math.min(window.devicePixelRatio || 1, max);

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
	/** Timestamp of the previous frame of this loop, 0 after a stop so the idle gap is not counted as a hitch. */
	private previousFrame = 0;
	private sized = false;
	private visible = false;

	/** `source` names the loop in the performance reports, e.g. `canvas:atom`. */
	protected constructor(
		protected readonly canvas: HTMLCanvasElement,
		private readonly source: string,
	) {}

	destroy() {
		cancelAnimationFrame(this.frame);
		this.previousFrame = 0;
		for (const observer of this.observers) observer.disconnect();
	}

	/** Realms stay mounted behind the selected one, a deselected realm keeps its loop stopped. */
	setActive(active: boolean) {
		this.active = active;
		this.update();
	}

	/** Returns whether the scene still moves: a settled scene stops the loop until `update` wakes it. */
	protected abstract draw(dt: number): boolean;

	/** `width` and `height` are the canvas CSS size, in pixels. */
	protected abstract resize(width: number, height: number): void;

	/** Whether effects emitted now would be seen: a paused, hidden or reduced-motion canvas drops them instead of piling them up. */
	protected get shown() {
		return this.active && this.visible && !document.hidden && !prefersReducedMotion.current;
	}

	/**
	 * Called by the subclass constructor once its own fields exist. The size comes from the ResizeObserver, after layout: reading
	 * `clientWidth` here would force a full style and layout of the realm being mounted, about 400 ms of a realm switch on a slow laptop.
	 * The loop waits for that first size.
	 */
	protected observe() {
		const resize = new ResizeObserver(([entry]) => {
			this.resize(entry.contentRect.width, entry.contentRect.height);
			this.sized = true;
			this.update();
		});
		resize.observe(this.canvas);
		const intersection = new IntersectionObserver(([entry]) => {
			this.visible = entry.isIntersecting;
			this.update();
		});
		intersection.observe(this.canvas);
		this.observers = [resize, intersection];
	}

	/** Runs when the loop stops for a hidden or deselected canvas. */
	protected paused() {}

	/** Draws one frame even when stopped, resizing a canvas clears it. */
	protected redraw() {
		if (!this.frame) this.frame = requestAnimationFrame(this.loop);
	}

	/** Starts or stops the loop to match the realm selection and visibility, and wakes a settled one. */
	protected update() {
		const running = this.active && this.sized && this.visible;
		if (running && !this.frame) {
			this.lastTime = performance.now();
			this.frame = requestAnimationFrame(this.loop);
		} else if (!running && this.frame) {
			cancelAnimationFrame(this.frame);
			this.frame = 0;
			this.previousFrame = 0;
			this.paused();
		}
	}

	protected clearSprites() {
		this.sprites.clear();
	}

	protected sprite(key: string, paint: (ctx: CanvasRenderingContext2D, half: number) => void, size = SPRITE_SIZE): HTMLCanvasElement {
		let sprite = this.sprites.get(key);
		if (!sprite) {
			sprite = document.createElement('canvas');
			sprite.width = sprite.height = size;
			const ctx = sprite.getContext('2d');
			if (ctx) paint(ctx, size / 2);
			this.sprites.set(key, sprite);
		}
		return sprite;
	}

	/** The rAF timestamp is the frame start, it can precede the `performance.now()` taken in `update`, so dt is clamped at 0. */
	private readonly loop = (now: number) => {
		const dt = this.lastTime ? Math.min(Math.max(0, (now - this.lastTime) / 1000), MAX_FRAME_S) : 0;
		this.lastTime = now;
		perfTracker.frame(now, this.previousFrame);
		const start = performance.now();
		const more = this.draw(dt) && this.active && this.visible;
		perfTracker.track(this.source, start);
		this.frame = more ? requestAnimationFrame(this.loop) : 0;
		this.previousFrame = more ? now : 0;
	};
}
