import { prefersReducedMotion } from 'svelte/motion';
import { instancedBufferAttribute, length, max, oneMinus, smoothstep, uv } from 'three/tsl';
import { Color, InstancedBufferAttribute, type Node, PointsNodeMaterial, Sprite } from 'three/webgpu';
import { SITE_IDS, SITES } from '#data/sites.js';
import type { Nebula } from './sky.js';
import { DEEP_SKY_DISTANCE } from './space.js';

const FADE = 0.6;
/** Smallest ring in CSS px, the Crab is a few pixels wide in the overview. */
const MIN_SIZE = 28;
/** Ring radius against the sprite's half size: the sprite is 1.25 times the object, so the ring lands on its edge. */
const RING = 0.8;

/** A thin ring on each deep-sky object whose source is forging, drawn at a fixed screen width however far the view is zoomed. */
export class SiteRings {
	readonly sprite: Sprite;
	readonly #attribute: InstancedBufferAttribute;
	/** Position and opacity of each ring, four floats apiece. */
	readonly #data: Float32Array;
	readonly #goal: Float32Array;
	readonly #ids: readonly string[];
	#active = false;
	#fading = false;
	#observing = false;

	/** `pixel` is the angle a CSS pixel covers. */
	constructor(nebulae: ReadonlyMap<string, Nebula>, pixel: Node<'float'>) {
		const rings = SITE_IDS.flatMap(id => {
			const nebula = nebulae.get(SITES[id].object ?? '');
			return nebula ? [{ id, nebula }] : [];
		});
		this.#ids = rings.map(({ id }) => id);
		this.#goal = new Float32Array(rings.length);
		this.#data = new Float32Array(rings.length * 4);
		rings.forEach(({ nebula }, i) => this.#data.set(nebula.direction.clone().multiplyScalar(DEEP_SKY_DISTANCE * 0.99).toArray(), i * 4));
		this.#attribute = new InstancedBufferAttribute(this.#data, 4);
		const ring = instancedBufferAttribute<'vec4'>(this.#attribute, 'vec4');
		const angular = new Float32Array(rings.map(({ nebula }) => Math.atan(nebula.radius / DEEP_SKY_DISTANCE)));
		const tints = new Float32Array(rings.flatMap(({ id }) => new Color(SITES[id].color).toArray()));
		const size = max(instancedBufferAttribute<'float'>(new InstancedBufferAttribute(angular, 1), 'float').mul(2.5).div(pixel), MIN_SIZE);
		const material = new PointsNodeMaterial({ depthWrite: false, sizeAttenuation: false, transparent: true });
		material.positionNode = ring.xyz;
		material.sizeNode = size;
		material.colorNode = instancedBufferAttribute<'vec3'>(new InstancedBufferAttribute(tints, 3), 'vec3');
		/** Distance from the ring in CSS px: the line stays about 1.5 px wide at any sprite size. */
		const away = length(uv().sub(0.5)).mul(2).sub(RING).abs().mul(size).mul(0.5);
		material.opacityNode = oneMinus(smoothstep(0.5, 1.5, away)).mul(ring.w).mul(0.6);
		this.sprite = new Sprite(material);
		this.sprite.count = rings.length;
		this.sprite.frustumCulled = false;
		this.sprite.visible = false;
	}

	/** Rings the given sources: the ones newly shown fade in from nothing, the removed ones go at once. */
	set(sites: readonly string[]) {
		const still = prefersReducedMotion.current;
		this.#active = false;
		for (let i = 0; i < this.#ids.length; i++) {
			const goal = sites.includes(this.#ids[i]) ? 1 : 0;
			this.#goal[i] = goal;
			if (goal === 0 || still) this.#data[i * 4 + 3] = goal;
			this.#active ||= goal === 1;
		}
		this.#fading = this.#active && !still;
		this.#attribute.needsUpdate = true;
		this.show();
	}

	/** Drawn at all only with a ring to show, `all` draws it anyway so its shader compiles. */
	show(all = false) {
		this.sprite.visible = all || (this.#active && !this.#observing);
	}

	/** Hidden at the eyepiece, where a ring would point at the target. */
	setObserving(observing: boolean) {
		if (observing === this.#observing) return;
		this.#observing = observing;
		this.show();
	}

	update(dt: number) {
		if (!this.#fading) return;
		let left = false;
		for (let i = 0; i < this.#goal.length; i++) {
			const at = i * 4 + 3;
			if (this.#data[at] >= this.#goal[i]) continue;
			this.#data[at] = Math.min(this.#goal[i], this.#data[at] + dt / FADE);
			left ||= this.#data[at] < this.#goal[i];
		}
		this.#fading = left;
		this.#attribute.needsUpdate = true;
	}
}
