import { BLUE_HALF, CHROMATIC, CHROMATIC_COLORS, CHROMATIC_MAX_ON_SCREEN, type ChromaticColor, ChromaticColors } from '$data/chromatic';
import { CURRENCIES } from '$data/currencies';
import { chromaticManager } from '$helpers/ChromaticManager.svelte';
import { drawLightIcon } from '$helpers/photonCanvas';

export interface ChromaticPhoton {
	color: ChromaticColor;
	drop: number;
	/** Remaining time of the white hit flash, in ms. */
	flash: number;
	/** A Blue half, which pays on break instead of splitting again. */
	half: boolean;
	hp: number;
	id: number;
	lifetime: number;
	maxHp: number;
	maxLifetime: number;
	size: number;
	vx: number;
	vy: number;
	x: number;
	y: number;
}

export interface ChromaticBreak {
	color: ChromaticColor;
	drop: number;
	/** Blue halves pay but don't count as a break, a Blue photon counts once toward its spectrum level. */
	half: boolean;
	x: number;
	y: number;
}

const FLASH_MS = 80;
const POP_MS = 350;
const HP_RING_GAP = 4;
const HIT_PADDING = 6;
const MIN_HIT_RADIUS = 24;
/** Blue halves fly apart then slow down, px per second lost each second. */
const HALF_DRAG = 3;

/**
 * Colored photons of the Photon Realm, drawn on the same canvas as the normal circles and above them.
 * They carry HP that taps knock down, and pay their color's Light when broken.
 */
export class ChromaticField {
	photons: ChromaticPhoton[] = [];
	#nextId = 0;

	get empty() {
		return this.photons.length === 0;
	}

	spawn(width: number, height: number) {
		if (width === 0 || this.photons.filter(photon => !photon.half).length >= CHROMATIC_MAX_ON_SCREEN) return;

		const color = CHROMATIC_COLORS[Math.floor(Math.random() * CHROMATIC_COLORS.length)];
		const { drop, lifetime, size, speed } = CHROMATIC[color];
		const margin = size;
		const angle = Math.random() * Math.PI * 2;
		const maxHp = chromaticManager.maxHp(color);
		this.photons.push({
			color,
			drop,
			flash: 0,
			half: false,
			hp: maxHp,
			id: this.#nextId++,
			lifetime: 0,
			maxHp,
			maxLifetime: lifetime + chromaticManager.lifetimeBonus,
			size,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			x: margin + Math.random() * Math.max(0, width - margin * 2),
			y: margin + Math.random() * Math.max(0, height - margin * 2),
		});
	}

	/** Ages every photon and drops the expired ones, which pay nothing. Movement is skipped while the realm is hidden. */
	update(deltaMs: number, width: number, height: number, moving: boolean) {
		const seconds = deltaMs / 1000;
		let alive = 0;
		for (const photon of this.photons) {
			photon.lifetime += deltaMs;
			photon.flash = Math.max(0, photon.flash - deltaMs);
			if (photon.lifetime >= photon.maxLifetime) continue;
			if (moving) this.#move(photon, seconds, width, height);
			this.photons[alive++] = photon;
		}
		this.photons.length = alive;
	}

	#move(photon: ChromaticPhoton, seconds: number, width: number, height: number) {
		if (photon.vx === 0 && photon.vy === 0) return;
		const radius = photon.size / 2;
		photon.x += photon.vx * seconds;
		photon.y += photon.vy * seconds;
		if (photon.x < radius || photon.x > width - radius) photon.vx = -photon.vx;
		if (photon.y < radius || photon.y > height - radius) photon.vy = -photon.vy;
		photon.x = Math.min(Math.max(photon.x, radius), Math.max(radius, width - radius));
		photon.y = Math.min(Math.max(photon.y, radius), Math.max(radius, height - radius));
		if (photon.half) {
			const drag = Math.max(0, 1 - HALF_DRAG * seconds);
			photon.vx *= drag;
			photon.vy *= drag;
		}
	}

	at(x: number, y: number): ChromaticPhoton | null {
		for (let i = this.photons.length - 1; i >= 0; i--) {
			const photon = this.photons[i];
			const radius = Math.max(MIN_HIT_RADIUS, (photon.size * this.#scale(photon)) / 2 + HIT_PADDING);
			const dx = x - photon.x;
			const dy = y - photon.y;
			if (dx * dx + dy * dy <= radius * radius) return photon;
		}
		return null;
	}

	/** Deals one tap and returns the break when it takes the last HP. A broken Blue photon leaves two halves behind. */
	hit(photon: ChromaticPhoton, auto: boolean): ChromaticBreak | null {
		photon.hp -= chromaticManager.tapDamage(photon.color, auto);
		photon.flash = FLASH_MS;
		if (photon.hp > 0) return null;

		const index = this.photons.indexOf(photon);
		if (index !== -1) this.photons.splice(index, 1);
		if (photon.color === ChromaticColors.BLUE && !photon.half) this.#split(photon);
		return { color: photon.color, drop: photon.drop, half: photon.half, x: photon.x, y: photon.y };
	}

	#split(photon: ChromaticPhoton) {
		for (const direction of [-1, 1]) {
			this.photons.push({
				...photon,
				drop: BLUE_HALF.drop,
				flash: 0,
				half: true,
				hp: photon.maxHp * BLUE_HALF.hp,
				id: this.#nextId++,
				lifetime: 0,
				maxHp: photon.maxHp * BLUE_HALF.hp,
				maxLifetime: BLUE_HALF.lifetime + chromaticManager.lifetimeBonus,
				size: photon.size * BLUE_HALF.size,
				vx: direction * 160,
				vy: (Math.random() - 0.5) * 60,
				x: photon.x + direction * 8,
			});
		}
	}

	#scale(photon: ChromaticPhoton) {
		if (photon.lifetime >= POP_MS) return 1;
		const t = photon.lifetime / POP_MS - 1;
		return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
	}

	draw(ctx: CanvasRenderingContext2D, still: boolean) {
		for (const photon of this.photons) {
			const { currency, facets } = CHROMATIC[photon.color];
			const color = CURRENCIES[currency].color;
			const remaining = 1 - photon.lifetime / photon.maxLifetime;
			/** Fades only over the last quarter of its life, the HP ring has to stay readable until then. */
			const alpha = Math.min(1, remaining * 4);
			const squash = still ? 1 : 1 - 0.12 * (photon.flash / FLASH_MS);
			const size = photon.size * this.#scale(photon) * squash;
			const radius = size / 2 + HP_RING_GAP;

			ctx.save();
			ctx.translate(photon.x, photon.y);
			drawLightIcon(ctx, color, facets, size, alpha);

			if (photon.flash > 0) {
				ctx.globalAlpha = alpha * 0.7 * (photon.flash / FLASH_MS);
				ctx.fillStyle = '#ffffff';
				ctx.beginPath();
				ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
				ctx.fill();
			}

			ctx.lineCap = 'round';
			ctx.strokeStyle = color;
			ctx.globalAlpha = alpha * 0.3;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(0, 0, radius + 4, -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2);
			ctx.stroke();

			ctx.globalAlpha = alpha;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.max(0, photon.hp / photon.maxHp) * Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}
	}
}
