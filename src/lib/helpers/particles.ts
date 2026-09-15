import { CURRENCIES, type CurrencyName } from '$data/currencies';
import { type Writable } from 'svelte/store';

// --- Interfaces ---

export interface Particle {
	/** Higher layers are drawn last. Text sits above icons. */
	layer: number;
	draw: (ctx: CanvasRenderingContext2D) => void;
	update: (dt: number) => boolean;
}

// --- Constants ---

const MAX_PARTICLES = 150;
/** Reserved separately from icons: a click autoclicker firing hundreds of times a second floods icon slots and would otherwise starve the "+N" text. */
const MAX_TEXT_PARTICLES = 40;
const MAX_ICON_PARTICLES = MAX_PARTICLES - MAX_TEXT_PARTICLES;
const ICON_LAYER = 0;
const TEXT_LAYER = 1;
/** Matches the previous PixiJS text: 26px bold Arial drawn at a 0.5 scale. */
const TEXT_FONT = 'bold 13px Arial, sans-serif';
/** Icons start at this scale and only ever shrink, so it is the largest size ever drawn. */
const ICON_START_SCALE = 0.1;
/** Same cap as the canvas backing store, see Canvas.svelte. */
const MAX_PIXEL_RATIO = 2;
/** Fallback for SVGs that report no intrinsic size. */
const FALLBACK_ICON_SIZE = 150;

// --- Assets ---

interface ParticleSprite {
	/** Natural icon height, the particle scale math keeps working in these units. */
	height: number;
	/** Pre-rasterized bitmap: drawing the SVG directly re-vectorizes it on every frame. */
	source: CanvasImageSource;
	width: number;
}

const sprites = new Map<string, ParticleSprite>();

/** Cached instead of read live: `document.documentElement.scrollTop` forces a synchronous reflow when DOM state is dirty, which happens on every click. */
let cachedScrollTop = typeof document === 'undefined' ? 0 : document.documentElement.scrollTop;
if (typeof window !== 'undefined') {
	window.addEventListener('scroll', () => { cachedScrollTop = document.documentElement.scrollTop; }, { passive: true });
}

function rasterize(image: HTMLImageElement): ParticleSprite {
	const width = image.naturalWidth || image.width || FALLBACK_ICON_SIZE;
	const height = image.naturalHeight || image.height || FALLBACK_ICON_SIZE;
	const ratio = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

	const raster = document.createElement('canvas');
	raster.width = Math.max(1, Math.round(width * ICON_START_SCALE * ratio));
	raster.height = Math.max(1, Math.round(height * ICON_START_SCALE * ratio));
	raster.getContext('2d')?.drawImage(image, 0, 0, raster.width, raster.height);

	return { height, source: raster, width };
}

export const loadParticleAssets = async () => {
	try {
		await Promise.all(
			Object.values(CURRENCIES).map(
				currency =>
					new Promise<void>(resolve => {
						const image = new Image();
						image.onload = () => {
							sprites.set(currency.id, rasterize(image));
							resolve();
						};
						image.onerror = () => resolve();
						image.src = `/currencies/${currency.id}.svg`;
					})
			)
		);
	} catch (e) {
		console.warn('Particle assets failed:', e);
	}
};

// --- Creators ---

export const createClickParticleSync = (x: number, y: number, currency: CurrencyName): Particle | null => {
	const sprite = sprites.get(CURRENCIES[currency].id);
	if (!sprite) return null;

	const rotation = Math.random() * Math.PI * 2;
	let alpha = 0.8;
	let scale = ICON_START_SCALE;
	let px = x;
	let py = y + cachedScrollTop;
	let sx = (1.5 + Math.random() * 0.5) * Math.cos(rotation);
	let sy = (1.5 + Math.random() * 0.5) * Math.sin(rotation);

	return {
		layer: ICON_LAYER,
		draw: ctx => {
			const width = sprite.width * scale;
			const height = sprite.height * scale;

			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.translate(px, py);
			ctx.rotate(rotation);
			ctx.drawImage(sprite.source, -width / 2, -height / 2, width, height);
			ctx.restore();
		},
		update: dt => {
			const damp = Math.pow(0.995, dt);
			sx *= damp;
			sy *= damp;
			px += sx * dt;
			py += sy * dt;
			scale -= 0.001 * dt;
			alpha -= 0.015 * dt;
			return alpha > 0 && scale > 0;
		}
	};
};

export const createClickTextParticleSync = (x: number, y: number, text: string): Particle | null => {
	let alpha = 1;
	let py = y + cachedScrollTop;
	let sy = -1.5;

	return {
		layer: TEXT_LAYER,
		draw: ctx => {
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.fillStyle = 'white';
			ctx.font = TEXT_FONT;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(text, x, py);
			ctx.restore();
		},
		update: dt => {
			sy *= Math.pow(0.995, dt);
			py += sy * dt;
			alpha -= 0.015 * dt;
			return alpha > 0;
		}
	};
};

// --- Engine ---

export class ParticleEngine {
	private particles: Particle[] = [];
	private iconCount = 0;
	private textCount = 0;
	private unsubscribe: () => void;

	constructor(queue: Writable<Particle[]>) {
		this.unsubscribe = queue.subscribe(newParticles => {
			if (!newParticles.length) return;
			for (const particle of newParticles) {
				if (particle.layer === TEXT_LAYER) {
					if (this.textCount >= MAX_TEXT_PARTICLES) continue;
					this.textCount++;
				} else {
					if (this.iconCount >= MAX_ICON_PARTICLES) continue;
					this.iconCount++;
				}
				this.particles.push(particle);
			}
			queue.set([]);
		});
	}

	update(dt: number) {
		for (let i = this.particles.length - 1; i >= 0; i--) {
			if (!this.particles[i].update(dt)) {
				if (this.particles[i].layer === TEXT_LAYER) this.textCount--;
				else this.iconCount--;
				this.particles.splice(i, 1);
			}
		}
	}

	draw(ctx: CanvasRenderingContext2D) {
		for (const particle of this.particles) {
			if (particle.layer === ICON_LAYER) particle.draw(ctx);
		}
		for (const particle of this.particles) {
			if (particle.layer === TEXT_LAYER) particle.draw(ctx);
		}
	}

	get count() {
		return this.particles.length;
	}

	destroy() {
		this.unsubscribe();
		this.particles = [];
	}
}
