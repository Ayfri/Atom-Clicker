import { pixelRatio } from '#helpers/CanvasLoop.js';
import { perfTracker } from '#helpers/perfTracker.js';
import { realmManager } from '#helpers/RealmManager.svelte.js';
import { autoLevel, type GlobeLut, globeLut, MAP_HEIGHT, MAP_WIDTH, rockLut, shadeGlobe } from '#components/cosmos/skyGlobe.js';
import { ROCK_SHAPES } from '#lib/cosmos/rockShapes.js';
import { ui } from '#stores/ui.svelte.js';
import { prefersReducedMotion } from 'svelte/motion';

export type ThumbKind = 'flat' | 'globe';

type Pixels = Uint8ClampedArray<ArrayBuffer>;

interface Entry {
	ctx: CanvasRenderingContext2D;
	image: ImageData;
	lut: GlobeLut | null;
	onReady: () => void;
	source: Pixels | null;
	visible: boolean;
}

/** Copied from `DEEP_SKY` in `cosmos/nebulae.ts`: importing it would pull Three.js into the HUD chunk. A body's map is `/cosmos/<id>.webp`. */
export const DEEP_MAPS: Record<string, string> = {
	andromeda: 'm31',
	cmb: 'cmb',
	cosmic_rays: 'cosmic_rays',
	crab_nebula: 'm1',
	kilonova: 'ngc4993',
	mira: 'mira',
	orion_nebula: 'm42',
	tycho: 'sn1572',
};

/** Crop center in UV when it is not the middle: Mira's star sits at the right end of its tail. */
const FLAT_CENTERS: Record<string, readonly [number, number]> = { mira: [0.86, 0.5] };

const CLOUD_COLOR = [244, 247, 251] as const;
const FRAME_MS = 1000 / 15;
/** A long frame (a busy tab) never throws the globes forward. */
const MAX_STEP_S = 0.25;
const TURN_S = 24;

const sources = new Map<string, Promise<Pixels | null>>();
let queue: Promise<unknown> = Promise.resolve();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

async function fetchBitmap(id: string, options?: ImageBitmapOptions) {
	const response = await fetch(`/cosmos/${id}.webp`, { cache: 'force-cache' });
	if (!response.ok) throw new Error(`${id}: ${response.status}`);
	return createImageBitmap(await response.blob(), options);
}

function readPixels(width: number, height: number, draw: (ctx: OffscreenCanvasRenderingContext2D) => void) {
	const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('No 2d context');
	draw(ctx);
	return ctx.getImageData(0, 0, width, height).data;
}

async function decodeMap(id: string) {
	const bitmap = await fetchBitmap(id, { resizeHeight: MAP_HEIGHT, resizeQuality: 'medium', resizeWidth: MAP_WIDTH });
	const pixels = readPixels(MAP_WIDTH, MAP_HEIGHT, ctx => ctx.drawImage(bitmap, 0, 0));
	bitmap.close();
	return pixels;
}

async function decodeEarth() {
	const day = await decodeMap('earth');
	const clouds = await decodeMap('clouds');
	for (let i = 0; i < day.length; i += 4) {
		const cover = (clouds[i] / 255) * 0.85;
		for (let channel = 0; channel < 3; channel++) day[i + channel] += (CLOUD_COLOR[channel] - day[i + channel]) * cover;
	}
	return day;
}

/** Brightened with `autoLevel`, most of these maps are dim. */
async function decodeFlat(id: string, size: number) {
	const bitmap = await fetchBitmap(DEEP_MAPS[id]);
	const side = Math.min(bitmap.width, bitmap.height);
	const [u, v] = FLAT_CENTERS[id] ?? [0.5, 0.5];
	const pixels = readPixels(size, size, ctx => {
		ctx.imageSmoothingQuality = 'high';
		const left = clamp(u * bitmap.width - side / 2, 0, bitmap.width - side);
		const top = clamp(v * bitmap.height - side / 2, 0, bitmap.height - side);
		ctx.drawImage(bitmap, left, top, side, side, 0, 0, size, size);
	});
	bitmap.close();
	autoLevel(pixels);
	return pixels;
}

/** One decode at a time in attach order, opening the list would start dozens at once. A failure resolves null and is retried later. */
function loadSource(id: string, kind: ThumbKind, size: number) {
	const key = kind === 'flat' ? `${id}:${size}` : id;
	const cached = sources.get(key);
	if (cached) return cached;

	const decode = () => (kind === 'flat' ? decodeFlat(id, size) : id === 'earth' ? decodeEarth() : decodeMap(id));
	const loaded = queue.then(decode).then(
		pixels => pixels,
		() => {
			sources.delete(key);
			return null;
		},
	);
	queue = loaded;
	sources.set(key, loaded);
	return loaded;
}

/** One shared 15 fps timer for every on-screen globe, stopped while the tab is hidden, a modal or the Table covers the Cosmos, or no globe shows. */
class SkyThumbnails {
	#active = true;
	#entries = new Map<Element, Entry>();
	#last = 0;
	#observer: IntersectionObserver | null = null;
	#stopTracking: (() => void) | null = null;
	#timer = 0;
	/** Map columns, negative: the surface moves from left to right. */
	#turn = 0;

	/** `size` and `radius` are CSS pixels. Returns the release. */
	attach(canvas: HTMLCanvasElement, id: string, kind: ThumbKind, size: number, radius: number, onReady = () => {}) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return () => {};

		const pixels = Math.round(size * pixelRatio());
		const rock = kind === 'globe' ? ROCK_SHAPES[id] : undefined;
		canvas.width = canvas.height = pixels;
		const entry: Entry = {
			ctx,
			image: new ImageData(pixels, pixels),
			lut: kind === 'globe' && !rock ? globeLut(pixels, (radius * pixels) / size) : null,
			onReady,
			source: null,
			visible: false,
		};
		if (!this.#entries.size) this.#start();
		this.#entries.set(canvas, entry);
		this.#observer?.observe(canvas);
		loadSource(id, kind, pixels).then(source => {
			if (!source || this.#entries.get(canvas) !== entry) return;

			/** Ray marching costs a few ms per rock, it runs here so a list of rocks builds one after the other as their maps decode. */
			if (rock) entry.lut = rockLut(pixels, (radius * pixels) / size, rock);
			entry.source = source;
			this.#draw(entry);
			entry.onReady();
			this.#update();
		});
		return () => {
			this.#observer?.unobserve(canvas);
			this.#entries.delete(canvas);
			if (this.#entries.size) this.#update();
			else this.#stop();
		};
	}

	#draw({ ctx, image, lut, source }: Entry) {
		if (!source) return;

		if (lut) shadeGlobe(image.data, source, lut, this.#turn);
		else image.data.set(source);
		ctx.putImageData(image, 0, 0);
	}

	#onIntersect = (records: IntersectionObserverEntry[]) => {
		for (const record of records) {
			const entry = this.#entries.get(record.target);
			if (entry) entry.visible = record.isIntersecting;
		}
		this.#update();
	};

	#onVisibility = () => this.#update();

	#start() {
		this.#observer = new IntersectionObserver(this.#onIntersect);
		document.addEventListener('visibilitychange', this.#onVisibility);
		this.#stopTracking = $effect.root(() => {
			$effect(() => {
				this.#active = ui.activeModal === null && !realmManager.tableOpen && !realmManager.introPlaying;
				this.#update();
			});
		});
	}

	#stop() {
		this.#observer?.disconnect();
		this.#observer = null;
		document.removeEventListener('visibilitychange', this.#onVisibility);
		this.#stopTracking?.();
		this.#stopTracking = null;
		clearInterval(this.#timer);
		this.#timer = 0;
	}

	#tick = () => {
		const start = performance.now();
		this.#turn = (this.#turn - Math.min((start - this.#last) / 1000, MAX_STEP_S) * (MAP_WIDTH / TURN_S)) % MAP_WIDTH;
		this.#last = start;
		for (const entry of this.#entries.values()) if (entry.lut && entry.visible) this.#draw(entry);
		perfTracker.track('canvas:sky-thumbs', start);
	};

	#update() {
		let moving = this.#active && !document.hidden && !prefersReducedMotion.current;
		if (moving) {
			moving = false;
			for (const { lut, source, visible } of this.#entries.values()) {
				if (lut && source && visible) {
					moving = true;
					break;
				}
			}
		}
		if (moving && !this.#timer) {
			this.#last = performance.now();
			this.#timer = window.setInterval(this.#tick, FRAME_MS);
		} else if (!moving && this.#timer) {
			clearInterval(this.#timer);
			this.#timer = 0;
		}
	}
}

export const skyThumbnails = new SkyThumbnails();
