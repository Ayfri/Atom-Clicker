import { color, float, fract, instancedBufferAttribute, length, oneMinus, pow, saturate, sin, smoothstep, time, uv } from 'three/tsl';
import { AdditiveBlending, Color, InstancedBufferAttribute, MathUtils, type PerspectiveCamera, PointsNodeMaterial, Sprite, SpriteNodeMaterial } from 'three/webgpu';
import type { Body } from './bodies.js';
import { realism } from './shading.js';

const radial = () => length(uv().sub(0.5)).mul(2);

export function glowSprite(tint: string, falloff: number, strength: number) {
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color(tint).mul(pow(saturate(oneMinus(radial())), falloff)).mul(strength);
	return new Sprite(material);
}

/** Pulsing light on the Earth where an instrument is being built, it rotates with the planet and hides behind it. */
export function beaconSprite() {
	const distance = radial();
	const phase = fract(time.mul(0.8));
	const ring = oneMinus(smoothstep(0, 0.1, distance.sub(phase).abs())).mul(oneMinus(phase));
	const core = pow(saturate(oneMinus(distance)), 8).mul(sin(time.mul(4)).mul(0.4).add(1));
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color('#ffd27a').mul(core.mul(2.5).add(ring));
	return new Sprite(material);
}

/** Drawn over everything, the player has to find it even behind a planet. */
export function signalSprite() {
	const distance = radial();
	const phase = fract(time.mul(0.5));
	const ring = oneMinus(smoothstep(0, 0.07, distance.sub(phase).abs())).mul(oneMinus(phase));
	const core = pow(saturate(oneMinus(distance)), 6).mul(sin(time.mul(3)).mul(0.3).add(0.9));
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthTest: false, depthWrite: false, transparent: true });
	material.colorNode = color('#8ff5ff').mul(core.mul(2.2).add(ring.mul(1.3)));
	const sprite = new Sprite(material);
	sprite.renderOrder = 10;
	sprite.visible = false;
	return sprite;
}

/** A dot on its orbit where each planet is, so a planet shrunk to a pixel stays findable. */
export class PlanetMarkers {
	readonly sprite: Sprite;
	readonly #bodies: readonly Body[];
	/** Position and opacity of each body's dot. */
	readonly #markers: InstancedBufferAttribute;

	constructor(bodies: readonly Body[]) {
		this.#bodies = bodies;
		this.#markers = new InstancedBufferAttribute(new Float32Array(bodies.length * 4), 4);
		const marker = instancedBufferAttribute<'vec4'>(this.#markers, 'vec4');
		const tints = new Float32Array(bodies.flatMap(({ object }) => new Color(object.color).toArray()));
		const material = new PointsNodeMaterial({ depthWrite: false, sizeAttenuation: false, transparent: true });
		material.positionNode = marker.xyz;
		material.sizeNode = float(6);
		material.colorNode = instancedBufferAttribute<'vec3'>(new InstancedBufferAttribute(tints, 3), 'vec3');
		material.opacityNode = oneMinus(smoothstep(0.3, 0.5, length(uv().sub(0.5)))).mul(marker.w);
		this.sprite = new Sprite(material);
		this.sprite.count = bodies.length;
		this.sprite.frustumCulled = false;
	}

	/**
	 * Fades each dot in as its planet shrinks from 4 to 1.5 px. Hidden at the eyepiece, it would point at what the player hunts, and in
	 * the realistic lighting, where a far planet is a faint speck or nothing.
	 */
	update(camera: PerspectiveCamera, height: number, observing: boolean) {
		const shown = 1 - realism.value;
		this.sprite.visible = !observing && shown > 0;
		if (!this.sprite.visible) return;
		const pixelsPerUnit = height / 2 / Math.tan(MathUtils.degToRad(camera.fov) / 2);
		for (let i = 0; i < this.#bodies.length; i++) {
			const { discovered, group, look } = this.#bodies[i];
			const pixels = (look.radius / group.position.distanceTo(camera.position)) * pixelsPerUnit;
			const opacity = discovered && group.visible ? 1 - MathUtils.smoothstep(pixels, 1.5, 4) : 0;
			this.#markers.setXYZW(i, group.position.x, group.position.y, group.position.z, opacity * shown * 0.9);
		}
		this.#markers.needsUpdate = true;
	}
}
