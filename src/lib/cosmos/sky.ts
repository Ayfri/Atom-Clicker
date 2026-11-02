import { prefersReducedMotion } from 'svelte/motion';
import {
	cameraPosition,
	color,
	dot,
	exp,
	float,
	instancedBufferAttribute,
	length,
	luminance,
	max,
	mix,
	mx_cell_noise_float,
	oneMinus,
	positionLocal,
	positionWorld,
	pow,
	sin,
	smoothstep,
	step,
	time,
	uniform,
	uv,
	vec3,
} from 'three/tsl';
import {
	AdditiveBlending,
	BackSide,
	Group,
	InstancedBufferAttribute,
	MathUtils,
	Mesh,
	MeshBasicNodeMaterial,
	type Node,
	type PerspectiveCamera,
	PlaneGeometry,
	PointsNodeMaterial,
	SphereGeometry,
	Sprite,
	type Vector3,
} from 'three/webgpu';
import { COSMOS_OBJECTS_BY_ID, type CosmosObject, skySight } from '#data/cosmos.js';
import { DEEP_SKY } from './nebulae.js';
import { darkSky, realism, skyLight } from './shading.js';
import { SiteRings } from './siteRings.js';
import { DEEP_SKY_DISTANCE, EARTH_POLE, galactic, ORIGIN, SKY_DISTANCE, STAR_DISTANCE } from './space.js';

const STAR_COUNT = 3500;
const FAINT_STAR_COUNT = 14_000;
const FAINT_STAR_MAGNITUDES = [8, 17] as const;

/** Random galactic latitude in degrees, a `band` share of them crowding the Milky Way's plane within about `spread` degrees. */
const starLatitude = (band: number, spread: number) =>
	Math.random() < band ? (Math.random() + Math.random() + Math.random() - 1.5) * spread : Math.asin(Math.random() * 2 - 1) * MathUtils.RAD2DEG;

const instancedSprite = (material: PointsNodeMaterial, count: number) => {
	const sprite = new Sprite(material);
	sprite.count = count;
	sprite.frustumCulled = false;
	return sprite;
};

/** The bright field in one instanced draw call, `sight` runs from 0 (brightest stars only) to 1 (whole field). */
function starField(sight: Node<'float'>) {
	const data = new Float32Array(STAR_COUNT * 4);
	const tints = new Float32Array(STAR_COUNT * 3);
	const palette = [
		[0.72, 0.8, 1],
		[1, 1, 1],
		[1, 0.94, 0.8],
		[1, 0.8, 0.6],
	];
	for (let i = 0; i < STAR_COUNT; i++) {
		const point = galactic(Math.random() * 360, starLatitude(0.5, 11.5)).multiplyScalar(STAR_DISTANCE);
		data.set([point.x, point.y, point.z, 1 + Math.random() ** 6 * 2.6], i * 4);
		tints.set(palette[Math.floor(Math.random() * palette.length)], i * 3);
	}
	const star = instancedBufferAttribute<'vec4'>(new InstancedBufferAttribute(data, 4), 'vec4');
	const tint = instancedBufferAttribute<'vec3'>(new InstancedBufferAttribute(tints, 3), 'vec3');
	/** Twinkling comes from the Earth's air, the realistic lighting holds stars steady. */
	const twinkle = mix(sin(time.mul(star.w.mul(1.3).add(0.5)).add(star.x.mul(0.37))).mul(0.2).add(0.85), 0.85, realism);
	/** The ~2% brightest stars get a bigger sprite with a faint four-point sparkle, in the realistic lighting every star is a plain pinpoint. */
	const sparkle = smoothstep(3.2, 3.4, star.w).mul(oneMinus(realism));
	const offset = uv().sub(0.5);
	const disc = oneMinus(smoothstep(0.08, 0.18, length(offset).mul(mix(1, 3, sparkle))));
	const ray = (along: Node<'float'>, across: Node<'float'>) =>
		oneMinus(smoothstep(0, 0.025, across.abs())).mul(oneMinus(smoothstep(0.03, 0.45, along.abs()))).mul(0.6);
	const material = new PointsNodeMaterial({ blending: AdditiveBlending, depthWrite: false, sizeAttenuation: false, transparent: true });
	material.positionNode = star.xyz;
	material.sizeNode = star.w.mul(mix(mix(1.8, 6, sparkle), 1.3, realism));
	/** A star shows once the sight reaches its brightness, the faint majority last. */
	const seen = smoothstep(mix(2.5, 0.7, sight), mix(2.8, 1, sight), star.w);
	/** Real brightness spreads far wider than the cartoon's: a handful stand out, most are barely there. */
	const brightness = mix(star.w.mul(0.3).add(0.35), pow(star.w.div(3.6), 3).mul(1.6), realism);
	material.colorNode = tint.mul(twinkle).mul(brightness).mul(seen).mul(skyLight(star.xyz));
	material.opacityNode = max(disc, ray(offset.x, offset.y).add(ray(offset.y, offset.x)).mul(sparkle));
	return instancedSprite(material, STAR_COUNT);
}

/** Faint stars, plain dots each showing once the limit passes its magnitude. Counts triple per magnitude, the faintest crowd the Milky Way. */
function faintStars(limit: Node<'float'>) {
	const [brightest, faintest] = FAINT_STAR_MAGNITUDES;
	const data = new Float32Array(FAINT_STAR_COUNT * 4);
	for (let i = 0; i < FAINT_STAR_COUNT; i++) {
		const magnitude = brightest + Math.log(1 + Math.random() * (3 ** (faintest - brightest) - 1)) / Math.log(3);
		const point = galactic(Math.random() * 360, starLatitude(0.3 + (0.4 * (magnitude - brightest)) / (faintest - brightest), 9)).multiplyScalar(STAR_DISTANCE);
		data.set([point.x, point.y, point.z, magnitude], i * 4);
	}
	const star = instancedBufferAttribute<'vec4'>(new InstancedBufferAttribute(data, 4), 'vec4');
	const material = new PointsNodeMaterial({ blending: AdditiveBlending, depthWrite: false, sizeAttenuation: false, transparent: true });
	material.positionNode = star.xyz;
	material.sizeNode = float(2);
	/** Dimmer the fainter, the brightest of them stay under the faintest of the bright field. */
	const glow = mix(0.45, 0.18, star.w.sub(brightest).div(faintest - brightest));
	material.colorNode = color('#dfe6ff').mul(glow).mul(smoothstep(star.w.sub(0.3), star.w.add(0.7), limit)).mul(skyLight(star.xyz));
	material.opacityNode = oneMinus(smoothstep(0.15, 0.5, length(uv().sub(0.5))));
	return instancedSprite(material, FAINT_STAR_COUNT);
}

const span = (degrees: number) => 2 * DEEP_SKY_DISTANCE * Math.tan(MathUtils.degToRad(degrees) / 2);

/** Own clock for the deep-sky animations, TSL's `time` keeps running while the scene pauses. Wrapped every hour so floats stay precise. */
export const skyClock = uniform(0);
/** 1 for the deep-sky animations, eased to 0 under reduced motion. */
export const skyMotion = uniform(1);

/** A deep-sky object the player discovers: a faint smudge until then, resolved into its drawing as `reveal` rises. */
export class Nebula {
	/** Field of view that frames it with some sky around it. */
	readonly fov: number;
	/** Half its drawn width, for the pointer picking. */
	readonly radius: number;
	readonly reveal = uniform(0);
	/** Seconds since the discovery started, -1 when not resolving. */
	revealTime = -1;

	constructor(
		readonly object: CosmosObject,
		/** The same from anywhere in the scene, it is that far. */
		readonly direction: Vector3,
		width: number,
		public discovered: boolean,
	) {
		this.fov = MathUtils.clamp(width * 2.5, 2, 50);
		this.radius = span(width) / 2;
		this.reveal.value = discovered ? 1 : 0;
	}

	startReveal() {
		this.discovered = true;
		this.revealTime = 0;
	}

	/** Same pace as a body condensing. */
	updateReveal(dt: number) {
		this.revealTime += dt;
		this.reveal.value = MathUtils.clamp((this.revealTime - 0.6) / 1.4, 0, 1);
		if (this.revealTime > 2.2) this.revealTime = -1;
	}
}

/** One flat glow per deep-sky object, faded by the eased limit. A discoverable one is a smudge until resolved, flaring cyan halfway like Saturn's rings. */
function deepSky(limit: Node<'float'>, discovered: readonly string[], albedo: (id: string) => Node<'vec3'>) {
	return DEEP_SKY.map(({ angle, animate, at, discovery, id, magnitude, size }) => {
		const p = uv().sub(0.5).mul(2);
		const glow = (sharpness: number) => exp(dot(p, p).mul(-sharpness));
		const nebula = discovery && new Nebula(COSMOS_OBJECTS_BY_ID[discovery[0]], galactic(...at), Math.max(...size), discovered.includes(discovery[0]));
		const map = animate ? animate(albedo(id), p, skyClock, skyMotion) : albedo(id);
		const drawn = nebula
			? mix(color(discovery[1]).mul(glow(5)).mul(0.18), map, nebula.reveal).add(color('#8ff5ff').mul(glow(4)).mul(nebula.reveal.mul(oneMinus(nebula.reveal)).mul(8)))
			: map;
		const material = new MeshBasicNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
		material.colorNode = drawn
			.mul(oneMinus(smoothstep(0.7, 1, length(p))))
			.mul(smoothstep(magnitude - 0.3, magnitude + 1.5, limit))
			.mul(skyLight(positionWorld.sub(cameraPosition)));
		const mesh = new Mesh(new PlaneGeometry(span(size[0]), span(size[1])), material);
		mesh.position.copy(galactic(...at)).multiplyScalar(DEEP_SKY_DISTANCE);
		mesh.up.copy(EARTH_POLE);
		mesh.lookAt(ORIGIN);
		/** Seen from inside the sky with north up, +x points west, a position angle of 270°, and angles turn counterclockwise. */
		mesh.rotateZ(MathUtils.degToRad(angle + 90));
		return { magnitude, mesh, nebula };
	});
}

/** Cells per radian of each zoom star layer, every one three times finer than the last. */
const ZOOM_STAR_LAYERS = [400, 1200, 3600, 10_800] as const;
/** A layer shows once its cells span this many CSS pixels, fully at the second. */
const ZOOM_STAR_CELL = [5, 14] as const;

/**
 * Stars too many to store, drawn from the view direction alone: one candidate per cell of a 3D grid, a few lit, in layers whose cells
 * shrink threefold and fade in once they span a few pixels. Crowded along the Milky Way's `band`, `pixel` is the angle a CSS pixel covers.
 */
function zoomStars(pixel: Node<'float'>, band: Node<'float'>) {
	const direction = positionLocal.normalize();
	return ZOOM_STAR_LAYERS.reduce<Node<'vec3'>>((sum, scale) => {
		const cell = direction.mul(scale).floor();
		const random = (offset: number) => mx_cell_noise_float(cell.add(offset));
		const star = cell.add(vec3(random(0), random(31), random(73)).mul(0.6).add(0.2)).normalize();
		/** Only stars that land in their own cell, the fragments of a neighbor would cut the dot off. */
		const own = oneMinus(step(0.5, length(star.mul(scale).floor().sub(cell))));
		const lit = step(random(97), mix(0.06, 0.18, band));
		const dot = oneMinus(smoothstep(0.35, 1.1, length(direction.sub(star)).div(pixel)));
		const shown = smoothstep(ZOOM_STAR_CELL[0], ZOOM_STAR_CELL[1], float(1 / scale).div(pixel));
		const brightness = pow(random(11), 2).mul(0.7).add(0.2);
		return sum.add(mix(color('#bcd0ff'), color('#ffe0bc'), random(53)).mul(dot.mul(own).mul(lit).mul(shown).mul(brightness)));
	}, vec3(0));
}

/** The Milky Way rises out of the dark from 30% of the sight, slowly at first. */
const milkyGlow = (limit: number) => Math.max(0, (skySight(limit) - 0.3) / 0.7) ** 2;

/** Everything past the Solar System, centered on the camera. A wider sight eases in so a new Aperture level visibly fills the sky. */
export class Sky {
	readonly group = new Group();
	readonly nebulae: ReadonlyMap<string, Nebula>;
	readonly rings: SiteRings;
	readonly #deepSky: ReturnType<typeof deepSky>;
	readonly #dome: Mesh;
	readonly #faint: Sprite;
	#high = true;
	/** Limiting magnitude, eased toward `#goal`. */
	readonly #limit = uniform(0);
	#goal: number;
	/** Milky Way brightness, eased far slower than the limit: a new instrument raises the limit by several magnitudes at once. */
	readonly #milky = uniform(0);
	readonly #pixel = uniform(1);
	/** Share of the bright field and Milky Way shown at the eased limit, see `skySight`. */
	readonly #sight = uniform(0);
	readonly #stars: Sprite;
	/** Off while even the widest layer's cells are too small to show, so the overview never pays for them. */
	readonly #zoomStars: Mesh;

	/** `albedo` reads a baked map, or the live surface when it isn't baked. */
	constructor(albedo: (id: string) => Node<'vec3'>, limit: number, discovered: readonly string[]) {
		this.#limit.value = this.#goal = limit;
		this.#sight.value = skySight(limit);
		this.#milky.value = milkyGlow(limit);
		const milkyWay = albedo('sky');
		const material = new MeshBasicNodeMaterial({ depthWrite: false, side: BackSide });
		material.colorNode = milkyWay.mul(this.#milky).mul(darkSky);
		this.#dome = new Mesh(new SphereGeometry(SKY_DISTANCE, 64, 32), material);
		this.#dome.renderOrder = -1;
		/** Past the naked eye only, they are the faint stars a telescope adds. */
		const zoom = new MeshBasicNodeMaterial({ blending: AdditiveBlending, depthWrite: false, side: BackSide, transparent: true });
		zoom.colorNode = zoomStars(this.#pixel, smoothstep(0.005, 0.06, luminance(milkyWay))).mul(smoothstep(3, 7, this.#limit)).mul(skyLight(positionLocal));
		this.#zoomStars = new Mesh(new SphereGeometry(SKY_DISTANCE * 0.98, 64, 32), zoom);
		this.#deepSky = deepSky(this.#limit, discovered, albedo);
		this.nebulae = new Map(this.#deepSky.flatMap(({ nebula }) => (nebula ? [[nebula.object.id, nebula]] : [])));
		this.rings = new SiteRings(this.nebulae, this.#pixel);
		this.#stars = starField(this.#sight);
		this.#faint = faintStars(this.#limit);
		this.group.add(this.#dome, this.#zoomStars, ...this.#deepSky.map(({ mesh }) => mesh), this.#stars, this.#faint, this.rings.sprite);
		this.showDepth();
	}

	set limit(limit: number) {
		this.#goal = limit;
	}

	follow(camera: PerspectiveCamera, height: number, observing: boolean) {
		this.group.position.copy(camera.position);
		this.rings.setObserving(observing);
		this.#pixel.value = MathUtils.degToRad(camera.fov) / height;
		this.#zoomStars.visible = this.#high && this.#pixel.value * ZOOM_STAR_LAYERS[0] * ZOOM_STAR_CELL[0] < 1;
	}

	/** Low quality drops the Milky Way and the zoom stars, and keeps a quarter of the stars. */
	setQuality(high: boolean) {
		this.#high = high;
		this.#dome.visible = high;
		this.#stars.count = high ? STAR_COUNT : STAR_COUNT / 4;
		this.#faint.count = high ? FAINT_STAR_COUNT : FAINT_STAR_COUNT / 4;
	}

	/** Skips drawing what the eased limit doesn't reach yet, `all` draws it anyway so its shaders compile. */
	showDepth(all = false) {
		const limit = this.#limit.value;
		for (const { magnitude, mesh } of this.#deepSky) mesh.visible = all || limit > magnitude - 0.3;
		this.#faint.visible = all || limit > FAINT_STAR_MAGNITUDES[0] - 0.3;
		this.rings.show(all);
		if (all) this.#zoomStars.visible = true;
	}

	update(dt: number) {
		const still = prefersReducedMotion.current;
		if (!still) skyClock.value = (skyClock.value + dt) % 3600;
		skyMotion.value = still ? Math.max(0, skyMotion.value - dt * 2) : Math.min(1, skyMotion.value + dt * 2);
		this.rings.update(dt);
		const glow = milkyGlow(this.#goal);
		const left = glow - this.#milky.value;
		if (left !== 0) this.#milky.value = Math.abs(left) < 1e-3 ? glow : this.#milky.value + left * Math.min(1, dt * 0.25);
		if (this.#limit.value === this.#goal) return;
		const gap = this.#goal - this.#limit.value;
		this.#limit.value = Math.abs(gap) < 1e-3 ? this.#goal : this.#limit.value + gap * Math.min(1, dt * 1.2);
		this.#sight.value = skySight(this.#limit.value);
		this.showDepth();
	}
}
