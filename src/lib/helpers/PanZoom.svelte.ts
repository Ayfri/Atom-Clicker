interface Point {
	x: number;
	y: number;
}

interface PanZoomOptions {
	/** Content area that must stay reachable, its edges can't be dragged past the middle of the view. */
	bounds: { maxX: number; maxY: number; minX: number; minY: number };
	/** Content point centered, and zoom used, when attaching and on `recenter()`. */
	home: Point & { zoom: number };
	maxZoom: number;
	minZoom: number;
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Drag, wheel and pinch navigation over a content layer, attached with `{@attach panZoom.attach}`.
 * @example <div style:transform="translate({panZoom.x}px, {panZoom.y}px) scale({panZoom.zoom})">
 */
export class PanZoom {
	x = $state(0);
	y = $state(0);
	zoom = $state(1);

	/** Distance moved by the current gesture, a click ending a real drag is swallowed so it doesn't press what it lands on. */
	#dragDistance = 0;
	#element: HTMLElement | undefined;
	readonly #options: PanZoomOptions;
	readonly #pointers = new Map<number, Point>();

	constructor(options: PanZoomOptions) {
		this.#options = options;
		this.zoom = options.home.zoom;
	}

	attach = (element: HTMLElement) => {
		this.#element = element;
		this.recenter();
		element.addEventListener('click', this.#onClickCapture, true);
		element.addEventListener('pointerdown', this.#onPointerDown);
		element.addEventListener('wheel', this.#onWheel, { passive: false });
		window.addEventListener('pointermove', this.#onPointerMove);
		window.addEventListener('pointerup', this.#onPointerUp);
		window.addEventListener('pointercancel', this.#onPointerUp);
		return () => {
			element.removeEventListener('click', this.#onClickCapture, true);
			element.removeEventListener('pointerdown', this.#onPointerDown);
			element.removeEventListener('wheel', this.#onWheel);
			window.removeEventListener('pointermove', this.#onPointerMove);
			window.removeEventListener('pointerup', this.#onPointerUp);
			window.removeEventListener('pointercancel', this.#onPointerUp);
			this.#element = undefined;
		};
	};

	panBy(dx: number, dy: number) {
		this.x += dx;
		this.y += dy;
		this.#clamp();
	}

	recenter() {
		if (!this.#element) return;
		const { home } = this.#options;
		this.zoom = home.zoom;
		this.x = this.#element.clientWidth / 2 - home.x * home.zoom;
		this.y = this.#element.clientHeight / 2 - home.y * home.zoom;
	}

	/** Zooms by `factor` keeping the view point (`vx`, `vy`) still, pass no point to zoom on the view center. */
	zoomBy(factor: number, vx = (this.#element?.clientWidth ?? 0) / 2, vy = (this.#element?.clientHeight ?? 0) / 2) {
		const zoom = Math.min(this.#options.maxZoom, Math.max(this.#options.minZoom, this.zoom * factor));
		const scale = zoom / this.zoom;
		this.x = vx - (vx - this.x) * scale;
		this.y = vy - (vy - this.y) * scale;
		this.zoom = zoom;
		this.#clamp();
	}

	#clamp() {
		if (!this.#element) return;
		const { bounds } = this.#options;
		const halfWidth = this.#element.clientWidth / 2;
		const halfHeight = this.#element.clientHeight / 2;
		this.x = Math.min(halfWidth - bounds.minX * this.zoom, Math.max(halfWidth - bounds.maxX * this.zoom, this.x));
		this.y = Math.min(halfHeight - bounds.minY * this.zoom, Math.max(halfHeight - bounds.maxY * this.zoom, this.y));
	}

	#onClickCapture = (event: MouseEvent) => {
		if (this.#dragDistance > 6) event.stopPropagation();
		this.#dragDistance = 0;
	};

	#onPointerDown = (event: PointerEvent) => {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		if (this.#pointers.size === 0) this.#dragDistance = 0;
		this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
	};

	#onPointerMove = (event: PointerEvent) => {
		const last = this.#pointers.get(event.pointerId);
		if (!last || !this.#element) return;
		const next = { x: event.clientX, y: event.clientY };
		const other = [...this.#pointers].find(([id]) => id !== event.pointerId)?.[1];
		this.#pointers.set(event.pointerId, next);

		if (!other) {
			this.#dragDistance += Math.abs(next.x - last.x) + Math.abs(next.y - last.y);
			this.panBy(next.x - last.x, next.y - last.y);
			return;
		}

		const rect = this.#element.getBoundingClientRect();
		const before = midpoint(last, other);
		const after = midpoint(next, other);
		this.#dragDistance = Infinity;
		this.zoomBy(Math.hypot(next.x - other.x, next.y - other.y) / Math.hypot(last.x - other.x, last.y - other.y), after.x - rect.left, after.y - rect.top);
		this.panBy(after.x - before.x, after.y - before.y);
	};

	#onPointerUp = (event: PointerEvent) => {
		this.#pointers.delete(event.pointerId);
	};

	#onWheel = (event: WheelEvent) => {
		if (!this.#element) return;
		event.preventDefault();
		const rect = this.#element.getBoundingClientRect();
		const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
		/** Trackpad pinches arrive as ctrl+wheel with much smaller deltas than a mouse wheel. */
		this.zoomBy(Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015)), event.clientX - rect.left, event.clientY - rect.top);
	};
}
