import { CURRENCIES, type CurrencyName } from '$data/currencies';
import type { RealmType } from '$data/realms';
import { CanvasLoop, pixelRatio } from '$helpers/CanvasLoop';
import { realmManager } from '$helpers/RealmManager.svelte';

const MAX_ICONS = 110;
/** Reserved apart from icons: an auto-clicker firing hundreds of times a second floods icon slots and would otherwise starve the "+N" text. */
const MAX_TEXTS = 40;
/** Share of the velocity kept after one second. */
const DRAG = 0.995 ** 60;
const ICON_ALPHA = 0.8;
/** Alpha lost per second, by icons and text alike. */
const FADE = 0.9;
/** Icons start at this scale and only ever shrink, so it is the largest size ever drawn. */
const ICON_SCALE = 0.1;
const ICON_SHRINK = 0.06;
/** Launch speed in px/s. */
const ICON_SPEED: readonly [number, number] = [90, 120];
const TEXT_SPEED = 90;
/** Side of the square a burst spreads its particles over, centered on the click. */
const JITTER = 10;
const TEXT_FONT = 'bold 13px Arial, sans-serif';
/** Line box of `TEXT_FONT` with room for descenders. */
const TEXT_HEIGHT = 18;
const MAX_TEXT_SPRITES = 32;
/** Fallback for SVGs that report no intrinsic size. */
const FALLBACK_ICON_SIZE = 150;

interface Sprite {
	/** Natural icon height, the particle scale math keeps working in these units. */
	height: number;
	/** Pre-rasterized bitmap: drawing the SVG directly re-vectorizes it on every frame. */
	source: CanvasImageSource;
	width: number;
}

interface Particle {
	alpha: number;
	cos: number;
	scale: number;
	sin: number;
	sprite: Sprite;
	vx: number;
	vy: number;
	x: number;
	y: number;
}

/** Fixed-size slots reused as particles die, so a 50 Hz auto-clicker allocates nothing per click. */
class Pool {
	readonly items: Particle[] = [];
	size = 0;

	constructor(private readonly max: number) {}

	clear() {
		this.size = 0;
	}

	/** Moves the last live particle into slot `i`, callers iterate backwards so it was already stepped. */
	kill(i: number) {
		const last = this.items[--this.size];
		this.items[this.size] = this.items[i];
		this.items[i] = last;
	}

	/** Returns null once full, the newest particles are the ones dropped. */
	take(sprite: Sprite, x: number, y: number): Particle | null {
		if (this.size >= this.max) return null;
		const particle = (this.items[this.size++] ??= { alpha: 0, cos: 1, scale: 0, sin: 0, sprite, vx: 0, vy: 0, x: 0, y: 0 });
		particle.sprite = sprite;
		particle.x = x + (Math.random() - 0.5) * JITTER;
		particle.y = y + (Math.random() - 0.5) * JITTER;
		return particle;
	}
}

/**
 * Currency icons and "+N" labels bursting from clicks, on one fixed canvas above every realm. Icons are drawn first so the
 * labels stay readable on top, and the loop stops once the last particle fades.
 */
export class ClickParticles extends CanvasLoop {
	private static current: ClickParticles | null = null;

	/** Box around everything drawn on the last frame, in CSS px: a burst covers a small area, clearing the whole screen filled it all for nothing. */
	private bottom = -Infinity;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly icons = new Pool(MAX_ICONS);
	/** Keyed by currency id, filled as the SVGs load: a click before that only gets its label. */
	private readonly iconSprites = new Map<string, Sprite>();
	private left = Infinity;
	private ratio = 1;
	private right = -Infinity;
	private readonly texts = new Pool(MAX_TEXTS);
	private readonly textSprites = new Map<string, Sprite>();
	private top = Infinity;

	constructor(canvas: HTMLCanvasElement) {
		super(canvas);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas2D is not available');
		this.ctx = ctx;
		ClickParticles.current = this;
		this.observe();
		for (const { id } of Object.values(CURRENCIES)) {
			const image = new Image();
			image.onload = () => this.iconSprites.set(id, this.rasterizeIcon(image));
			image.src = `/currencies/${id}.svg`;
		}
	}

	/** Drops bursts for a realm, tab or canvas that is not on screen, so callers never have to check. */
	static emit(realm: RealmType, x: number, y: number, currency: CurrencyName, count: number, text?: string) {
		const field = ClickParticles.current;
		if (!field?.shown || realmManager.selectedRealmId !== realm) return;

		const sprite = field.iconSprites.get(CURRENCIES[currency].id);
		for (let i = 0; sprite && i < count; i++) {
			const particle = field.icons.take(sprite, x, y);
			if (!particle) break;
			const angle = Math.random() * Math.PI * 2;
			const speed = ICON_SPEED[0] + Math.random() * (ICON_SPEED[1] - ICON_SPEED[0]);
			particle.alpha = ICON_ALPHA;
			particle.cos = Math.cos(angle);
			particle.scale = ICON_SCALE;
			particle.sin = Math.sin(angle);
			particle.vx = speed * particle.cos;
			particle.vy = speed * particle.sin;
		}

		const label = text && field.texts.take(field.rasterizeText(text), x, y);
		if (label) {
			label.alpha = 1;
			label.vy = -TEXT_SPEED;
		}
		field.update();
	}

	destroy() {
		super.destroy();
		if (ClickParticles.current === this) ClickParticles.current = null;
	}

	protected draw(dt: number): boolean {
		const { ctx, icons, ratio, texts } = this;
		const damp = DRAG ** dt;
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		if (this.right > this.left) ctx.clearRect(this.left, this.top, this.right - this.left, this.bottom - this.top);
		this.left = this.top = Infinity;
		this.right = this.bottom = -Infinity;

		for (let i = icons.size - 1; i >= 0; i--) {
			const particle = icons.items[i];
			particle.vx *= damp;
			particle.vy *= damp;
			particle.x += particle.vx * dt;
			particle.y += particle.vy * dt;
			particle.scale -= ICON_SHRINK * dt;
			particle.alpha -= FADE * dt;
			if (particle.alpha <= 0 || particle.scale <= 0) {
				icons.kill(i);
				continue;
			}
			const { cos, sin, sprite } = particle;
			const width = sprite.width * particle.scale;
			const height = sprite.height * particle.scale;
			ctx.globalAlpha = particle.alpha;
			ctx.setTransform(ratio * cos, ratio * sin, -ratio * sin, ratio * cos, ratio * particle.x, ratio * particle.y);
			ctx.drawImage(sprite.source, -width / 2, -height / 2, width, height);
			// At least half the diagonal, so it bounds the sprite at any rotation without a square root.
			this.cover(particle.x, particle.y, (width + height) / 2);
		}

		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		for (let i = texts.size - 1; i >= 0; i--) {
			const particle = texts.items[i];
			particle.vy *= damp;
			particle.y += particle.vy * dt;
			particle.alpha -= FADE * dt;
			if (particle.alpha <= 0) {
				texts.kill(i);
				continue;
			}
			const { sprite } = particle;
			ctx.globalAlpha = particle.alpha;
			ctx.drawImage(sprite.source, particle.x - sprite.width / 2, particle.y - sprite.height / 2, sprite.width, sprite.height);
			this.cover(particle.x, particle.y, Math.max(sprite.width, sprite.height) / 2);
		}

		ctx.globalAlpha = 1;
		return icons.size + texts.size > 0;
	}

	/** Particles caught by a hidden tab or a covering modal are dropped rather than frozen on the canvas. */
	protected paused() {
		this.icons.clear();
		this.texts.clear();
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.right = -Infinity;
	}

	/** Resizing clears the canvas, so nothing is left to erase. */
	protected resize() {
		this.ratio = pixelRatio();
		this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * this.ratio));
		this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * this.ratio));
		this.right = -Infinity;
	}

	/** Grows the box the next frame clears, with a pixel of room for antialiasing. */
	private cover(x: number, y: number, reach: number) {
		reach += 1;
		this.left = Math.min(this.left, Math.floor(x - reach));
		this.top = Math.min(this.top, Math.floor(y - reach));
		this.right = Math.max(this.right, Math.ceil(x + reach));
		this.bottom = Math.max(this.bottom, Math.ceil(y + reach));
	}

	private rasterizeIcon(image: HTMLImageElement): Sprite {
		const width = image.naturalWidth || image.width || FALLBACK_ICON_SIZE;
		const height = image.naturalHeight || image.height || FALLBACK_ICON_SIZE;
		const raster = document.createElement('canvas');
		raster.width = Math.max(1, Math.round(width * ICON_SCALE * this.ratio));
		raster.height = Math.max(1, Math.round(height * ICON_SCALE * this.ratio));
		raster.getContext('2d')?.drawImage(image, 0, 0, raster.width, raster.height);
		return { height, source: raster, width };
	}

	/**
	 * Text on the on-page canvas forces a style recalc of the whole dirty document on every frame, a detached canvas has no
	 * document style to resolve. Click power only changes on purchases, so each label is rasterized once.
	 */
	private rasterizeText(text: string): Sprite {
		let sprite = this.textSprites.get(text);
		if (sprite) return sprite;

		const raster = document.createElement('canvas');
		const ctx = raster.getContext('2d');
		if (!ctx) return { height: 0, source: raster, width: 0 };

		ctx.font = TEXT_FONT;
		const width = Math.ceil(ctx.measureText(text).width) + 2;
		raster.width = Math.round(width * this.ratio);
		raster.height = Math.round(TEXT_HEIGHT * this.ratio);
		ctx.scale(this.ratio, this.ratio);
		ctx.fillStyle = 'white';
		ctx.font = TEXT_FONT;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, width / 2, TEXT_HEIGHT / 2);

		if (this.textSprites.size >= MAX_TEXT_SPRITES) this.textSprites.clear();
		sprite = { height: TEXT_HEIGHT, source: raster, width };
		this.textSprites.set(text, sprite);
		return sprite;
	}
}
