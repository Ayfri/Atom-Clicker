import {
	color,
	dot,
	exp,
	fwidth,
	length,
	max,
	mix,
	mx_fractal_noise_float,
	mx_worley_noise_float,
	oneMinus,
	pow,
	saturate,
	sin,
	smoothstep,
	texture,
	time,
	uniform,
	uv,
	vec2,
	vec3,
} from 'three/tsl';
import {
	AdditiveBlending,
	Group,
	MathUtils,
	Mesh,
	MeshBasicNodeMaterial,
	type Node,
	type PerspectiveCamera,
	SphereGeometry,
	Sprite,
	SpriteNodeMaterial,
	type Texture,
	Vector3,
} from 'three/webgpu';
import { edge, fresnel, realism, sunView, surfacePoint } from './shading.js';
import { SUN_RADIUS } from './space.js';

const CORONA_REACH = 2.8;

/** `masks` reads the baked flow and cells, two reads drifting apart in longitude stand in for the live noise moving through the surface. */
function sunMaterial(masks: Texture | null, gain: Node<'float'>) {
	const [flow, blobs] = masks
		? [texture(masks, uv().add(vec2(time.mul(0.0015), 0))).r, texture(masks, uv().add(vec2(time.mul(-0.002), 0))).g]
		: [
				edge(0.1, mx_fractal_noise_float(surfacePoint.mul(2).add(vec3(0, time.mul(0.04), 0)), 3, 2, 0.5), 0.15),
				oneMinus(edge(0.22, mx_worley_noise_float(surfacePoint.mul(5).add(vec3(time.mul(0.05)))), 0.08)),
			];
	const surface = mix(mix(color('#fff4dc'), color('#fffdf6'), flow), color('#ffe4ad'), blobs.mul(0.35));
	const material = new MeshBasicNodeMaterial();
	/** Near white with a warm limb, past ~2x the neutral tone mapping washes the disc out, the glow comes from the corona and bloom. */
	material.colorNode = mix(surface, color('#ffc88a'), smoothstep(0.6, 0.98, fresnel)).mul(gain);
	return material;
}

/** Cartoon corona on one camera-facing sprite: an inner corona hugging the limb, drifting solar wind streamers and a thin halo ring. */
function coronaSprite(right: Node<'vec3'>, up: Node<'vec3'>, rays: Node<'float'>) {
	const offset = uv().sub(0.5).mul(2);
	const radius = length(offset).mul(CORONA_REACH);
	const above = max(radius.sub(1), 0);
	/** Each pixel's direction from the Sun in the world, so the rays reshape as the camera moves, read on the screen they stuck to it. */
	const direction = right.mul(offset.x).add(up.mul(offset.y)).div(max(length(offset), 1e-4));
	/** Rays from plane waves bent by slower drifting waves, with pulses running outward. Far cheaper than noise, the sprite can cover the screen. */
	const along = (x: number, y: number, z: number) => dot(direction, vec3(new Vector3(x, y, z).normalize()));
	const wave = (rays: Node<'float'>, bend: Node<'float'>, drift: number) => sin(rays.add(sin(bend.add(time.mul(drift))).mul(1.6))).mul(0.5).add(0.5);
	const wide = smoothstep(0.3, 1, wave(along(1, 0.3, -0.5).mul(10), along(-0.2, 1, 0.4).mul(3), 0.11));
	const thin = smoothstep(0.6, 1, wave(along(0.4, -0.8, 0.5).mul(23), along(0.9, 0.2, 0.3).mul(5), -0.13));
	const pulses = sin(radius.mul(2.5).sub(time.mul(1.2)).add(along(0.1, 0.5, 1).mul(4))).mul(0.25).add(0.75);
	const streamers = wide.add(thin.mul(0.5)).mul(pulses).mul(exp(above.mul(-1.6))).mul(rays);
	const inner = exp(above.mul(-3.5));
	/** At least a pixel and a half wide, a far Sun otherwise shimmered as the ring went thinner than a pixel. */
	const ring = oneMinus(smoothstep(0, max(fwidth(radius).mul(1.5), 0.05), radius.sub(1.35).abs())).mul(0.12);
	const fade = oneMinus(smoothstep(CORONA_REACH * 0.7, CORONA_REACH, radius));
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	/** A real corona only shows in a total eclipse, the realistic lighting fades it out. */
	material.colorNode = mix(color('#ffe6bd'), color('#fff8ec'), inner)
		.mul(inner.mul(0.55).add(streamers.mul(0.22)).add(ring))
		.mul(fade)
		.mul(oneMinus(realism));
	const sprite = new Sprite(material);
	sprite.scale.setScalar(SUN_RADIUS * CORONA_REACH * 2);
	return sprite;
}

/** Stands in for bloom around the Sun: a bright halo hugging the disc and a faint warm wash spreading far past it. */
function sunGlowSprite(strength: Node<'float'>) {
	const fade = saturate(oneMinus(length(uv().sub(0.5)).mul(2)));
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color('#ffe4b8').mul(pow(fade, 7).mul(0.9)).add(color('#ffc890').mul(pow(fade, 2).mul(0.07))).mul(strength);
	const sprite = new Sprite(material);
	sprite.scale.setScalar(SUN_RADIUS * 12);
	return sprite;
}

export class Sun {
	readonly group = new Group();
	/** The camera's right and up axes in the world, the corona's rays are laid out with them. */
	readonly #cameraRight = uniform(new Vector3(1, 0, 0));
	readonly #cameraUp = uniform(new Vector3(0, 1, 0));
	/** The corona's rays, faded out on a far Sun where they are thinner than a pixel and flickered as the camera moved. */
	readonly #rays = uniform(1);
	readonly #corona = coronaSprite(this.#cameraRight, this.#cameraUp, this.#rays);
	readonly #gain = uniform(1.7);
	readonly #glowStrength = uniform(1);
	readonly #glow = sunGlowSprite(this.#glowStrength);
	/** The Sun's radius on screen at the last frame, in CSS pixels. */
	#pixels = 0;

	constructor(masks: Texture | null) {
		this.group.add(new Mesh(new SphereGeometry(SUN_RADIUS, 96, 64), sunMaterial(masks, this.#gain)), this.#corona, this.#glow);
	}

	set corona(shown: boolean) {
		this.#corona.visible = shown;
	}

	/**
	 * A Sun a few pixels wide flickered through the half resolution bloom as it slid across pixels: under ~16 px it dims below the bloom
	 * threshold and the smooth glow sprite takes over. Returns whether the Sun's size changed since the last frame, the bloom has to be
	 * redrawn meanwhile or a stale halo pulses.
	 */
	fit(camera: PerspectiveCamera, height: number, bloom: boolean) {
		this.#cameraRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
		this.#cameraUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
		const distance = camera.position.length();
		const angle = Math.asin(Math.min(1, SUN_RADIUS / distance));
		sunView.direction.value.copy(camera.position).negate().divideScalar(distance);
		sunView.inner.value = Math.cos(angle);
		sunView.outer.value = Math.cos(angle * 1.04);
		/** ~25° to the whole sky from the Earth, 3.5° to 26° from seven times farther. The inner angle stays under 180° so the two never meet up close. */
		sunView.haloInner.value = Math.cos(Math.min(Math.PI * 0.95, angle * 6));
		sunView.haloOuter.value = Math.cos(Math.min(Math.PI, angle * 45));
		const halfHeight = distance * Math.tan(MathUtils.degToRad(camera.fov) / 2);
		const pixels = (SUN_RADIUS / halfHeight) * (height / 2);
		const resized = Math.abs(pixels - this.#pixels) > this.#pixels * 0.002;
		this.#pixels = pixels;
		this.#rays.value = MathUtils.smoothstep(pixels, 8, 24);
		const small = bloom ? 1 - MathUtils.smoothstep(pixels, 6, 16) : 1;
		this.#gain.value = bloom ? MathUtils.lerp(1.7, 0.98, small) : 1.7;
		this.#glowStrength.value = small;
		this.#glow.visible = this.#corona.visible && small > 0;
		return resized;
	}
}
