import { color, length, max, oneMinus, pow, saturate, smoothstep, uniform, uv } from 'three/tsl';
import { AdditiveBlending, type Node, Sprite, SpriteNodeMaterial, Vector3 } from 'three/webgpu';
import { flareIntensity, GUEST_STAR_LIFE } from '#data/guestStars.js';

/** Shortest spike, the ray fade needs its end past its start. */
const MIN_SPIKE = 0.1;

/**
 * A new star flaring in the sky: a bright core with a halo and two crossed diffraction spikes, drawn additively so the bloom turns it
 * into a glow. It is a direction from the camera, and every frame only writes two uniforms.
 */
export class GuestStarFlare {
	readonly direction = new Vector3();
	readonly sprite: Sprite;

	readonly #intensity = uniform(0);
	readonly #spike = uniform(1);

	#age = 0;
	#still = false;

	constructor() {
		const offset = uv().sub(0.5);
		const radius = length(offset).mul(2);
		const ray = (along: Node<'float'>, across: Node<'float'>) =>
			oneMinus(smoothstep(0, 0.012, across.abs())).mul(oneMinus(smoothstep(0.02, this.#spike.mul(0.5), along.abs())));
		const core = pow(saturate(oneMinus(radius)), 6).mul(3);
		const halo = pow(saturate(oneMinus(radius)), 2).mul(0.35);
		const spikes = max(ray(offset.x, offset.y), ray(offset.y, offset.x)).mul(1.6);
		const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
		material.colorNode = color('#fff1d6').mul(core.add(halo).add(spikes)).mul(this.#intensity);
		this.sprite = new Sprite(material);
		this.sprite.frustumCulled = false;
		this.sprite.visible = false;
	}

	get visible(): boolean {
		return this.sprite.visible;
	}

	/** `still` holds the flare steady, for players who asked for less motion. */
	show(direction: Vector3, still: boolean) {
		this.direction.copy(direction);
		this.#age = 0;
		this.#still = still;
		this.sprite.visible = true;
		this.update(0);
	}

	/** Advances the flare, false once its life is over and it hid itself. */
	update(dt: number): boolean {
		this.#age += dt;
		if (this.#age >= GUEST_STAR_LIFE) {
			this.hide();
			return false;
		}
		const intensity = flareIntensity(this.#age, this.#still);
		this.#intensity.value = intensity;
		this.#spike.value = this.#still ? 1 : Math.max(MIN_SPIKE, intensity);
		return true;
	}

	hide() {
		this.sprite.visible = false;
		this.#intensity.value = 0;
	}
}
