import {
	color,
	dot,
	exp,
	float,
	instancedBufferAttribute,
	length,
	max,
	mix,
	mx_fractal_noise_float,
	mx_noise_float,
	oneMinus,
	pow,
	saturate,
	sin,
	smoothstep,
	time,
	uniform,
	uv,
	vec2,
	vec3,
} from 'three/tsl';
import { AdditiveBlending, BackSide, Group, InstancedBufferAttribute, MathUtils, Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry, PointsNodeMaterial, SphereGeometry, Sprite, type Vector3 } from 'three/webgpu';
import { COSMOS_OBJECTS_BY_ID, type CosmosObject, skySight } from '#data/cosmos.js';
import { darkSky, realism } from './shading.js';
import { DEEP_SKY_DISTANCE, EARTH_POLE, galactic, ORIGIN, SKY_DISTANCE, STAR_DISTANCE } from './space.js';

const STAR_COUNT = 3500;
/** Faint stars past the naked eye's reach, one dot each, they fill in one magnitude at a time past the bright field. */
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

/** The bright field, `sight` runs from 0, only the brightest stars, to 1, the whole field. One instanced draw call for every star. */
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
	/** Twinkling is the Earth's air bending starlight, out in space the realistic lighting holds them steady. */
	const twinkle = mix(sin(time.mul(star.w.mul(1.3).add(0.5)).add(star.x.mul(0.37))).mul(0.2).add(0.85), 0.85, realism);
	/**
	 * The ~2% brightest stars get a bigger sprite with a faint four-point sparkle, the rest stay round dots. In the realistic lighting
	 * every star is a pinpoint without spikes, they only differ by brightness.
	 */
	const sparkle = smoothstep(3.2, 3.4, star.w).mul(oneMinus(realism));
	const offset = uv().sub(0.5);
	const disc = oneMinus(smoothstep(0.08, 0.18, length(offset).mul(mix(1, 3, sparkle))));
	const ray = (along: Node<'float'>, across: Node<'float'>) =>
		oneMinus(smoothstep(0, 0.025, across.abs())).mul(oneMinus(smoothstep(0.03, 0.45, along.abs()))).mul(0.6);
	const material = new PointsNodeMaterial({ blending: AdditiveBlending, depthWrite: false, sizeAttenuation: false, transparent: true });
	material.positionNode = star.xyz;
	material.sizeNode = star.w.mul(mix(mix(1.8, 6, sparkle), 1.3, realism));
	/** A star shows once the sight reaches its brightness: the brightest ~8% from the start, the faint majority last. */
	const seen = smoothstep(mix(2.5, 0.7, sight), mix(2.8, 1, sight), star.w);
	/** Real brightness spreads far wider than the cartoon's: a handful stand out, most are barely there. */
	const brightness = mix(star.w.mul(0.3).add(0.35), pow(star.w.div(3.6), 3).mul(1.6), realism);
	material.colorNode = tint.mul(twinkle).mul(brightness).mul(seen).mul(darkSky);
	material.opacityNode = max(disc, ray(offset.x, offset.y).add(ray(offset.y, offset.x)).mul(sparkle));
	return instancedSprite(material, STAR_COUNT);
}

/**
 * Faint stars, plain dots without the bright field's sparkle, each one showing once the limit passes its magnitude. Their count
 * triples with every magnitude like real star counts, and the faintest crowd the Milky Way's band.
 */
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
	material.colorNode = color('#dfe6ff').mul(glow).mul(smoothstep(star.w.sub(0.3), star.w.add(0.7), limit)).mul(darkSky);
	material.opacityNode = oneMinus(smoothstep(0.15, 0.5, length(uv().sub(0.5))));
	return instancedSprite(material, FAINT_STAR_COUNT);
}

interface DeepSkyObject {
	/** Position angle of the drawing's +x axis, its long axis, in degrees from the sky's north through east. */
	angle: number;
	/** Galactic longitude and latitude in degrees. */
	at: readonly [number, number];
	/** Cosmos object id of one the player discovers, and the tint of the smudge it shows until then. */
	discovery?: readonly [id: string, smudge: string];
	/** Glow from the plane's coordinates, -1 to 1 on both axes. */
	draw: (p: Node<'vec2'>) => Node<'vec3'>;
	/** Integrated apparent magnitude, the object fades in as the sight passes it. */
	magnitude: number;
	/** Width and height in degrees. */
	size: readonly [number, number];
}

/** Soft glow with a noisy edge, the base of every nebula. */
const cloud = (p: Node<'vec2'>, falloff: number, seed: number) =>
	exp(length(p).mul(-falloff)).mul(mx_fractal_noise_float(vec3(p.mul(2.5), seed), 3, 2, 0.5).mul(0.8).add(0.7));

/** Gaussian blob, `stretch` undoes the plane's aspect so it stays round on the sky. */
const blob = (p: Node<'vec2'>, [x, y]: readonly [number, number], stretch: readonly [number, number], sharpness: number) => {
	const offset = p.sub(vec2(x, y)).mul(vec2(...stretch));
	return exp(dot(offset, offset).mul(-sharpness));
};

/**
 * The brightest galaxy and nebulae, at their real places in the galactic frame of the Milky Way dome. The small ones are drawn a few
 * times larger than life, at true size the Crab and the Ring would be a few pixels even at the narrowest zoom.
 */
const DEEP_SKY: DeepSkyObject[] = [
	{
		/** Andromeda, 2.5 million light years away: a bright bulge, a tilted disc crossed by dust lanes, and its companions M32 and M110. */
		angle: 215,
		at: [121.17, -21.57],
		discovery: ['andromeda', '#d6d4ea'],
		draw: p => {
			const disc = exp(length(p).mul(-3.2));
			const lanes = max(
				oneMinus(smoothstep(0, 0.05, p.y.sub(0.24).add(p.x.mul(p.x).mul(0.15)).abs())),
				oneMinus(smoothstep(0, 0.04, p.y.sub(0.42).add(p.x.mul(p.x).mul(0.2)).abs())).mul(0.6),
			).mul(oneMinus(smoothstep(0.5, 0.9, p.x.abs())));
			const companions = blob(p, [0.03, -0.55], [3, 1], 30).add(blob(p, [-0.2, 0.8], [3, 1.6], 18).mul(0.7));
			return color('#c9cdf0')
				.mul(disc.mul(0.22).mul(oneMinus(lanes.mul(0.6))))
				.add(color('#ffe0b0').mul(blob(p, [0, 0], [3, 1], 40).mul(0.5).add(companions.mul(0.25))));
		},
		magnitude: 3.4,
		size: [4.2, 1.4],
	},
	{
		/** The Orion Nebula: red hydrogen wings around a green-white core lit by the Trapezium, and the dark bay of the "fish's mouth". */
		angle: 0,
		at: [209.01, -19.38],
		discovery: ['orion_nebula', '#d7b8d8'],
		draw: p => {
			const core = blob(p, [0.05, 0.1], [1, 1], 18);
			const bay = oneMinus(smoothstep(0.05, 0.25, length(p.sub(vec2(0.35, 0.3)).mul(vec2(1, 2.2)))));
			return mix(color('#ff6f86'), color('#9ff0dc'), core).mul(cloud(p.mul(vec2(1, 1.2)), 3, 3).add(core).mul(0.32)).mul(oneMinus(bay.mul(0.85)));
		},
		magnitude: 4,
		size: [1.4, 1.4],
	},
	{
		/** The Lagoon Nebula, named after the dark lane of dust that crosses its glow, with the bright Hourglass near its heart. */
		angle: 90,
		at: [6.05, -1.2],
		draw: p => {
			const lane = oneMinus(smoothstep(0.02, 0.12, p.y.add(p.x.mul(0.35)).sub(0.05).abs())).mul(smoothstep(-0.6, -0.1, p.x)).mul(oneMinus(smoothstep(0.3, 0.7, p.x)));
			return color('#ff7a8c').mul(cloud(p, 2.6, 7).mul(0.3).add(blob(p, [-0.3, 0.05], [2, 1], 14).mul(0.35))).mul(oneMinus(lane.mul(0.8)));
		},
		magnitude: 6,
		size: [1.6, 0.8],
	},
	{
		/**
		 * The Eagle Nebula, with the Pillars of Creation: three columns of dust rising into the glow, the left one the tallest, their
		 * heads toward the stars of NGC 6611 to the northwest that carve them.
		 */
		angle: 225,
		at: [16.95, 0.79],
		draw: p => {
			const pillars = (
				[
					[-0.18, 0.06, 0.45],
					[0.05, 0.05, 0.2],
					[0.22, 0.04, 0.1],
				] as const
			).reduce<Node<'float'>>(
				(cover, [x, half, top]) =>
					max(cover, oneMinus(smoothstep(half * 0.6, half, p.x.sub(x).add(p.y.mul(0.15)).abs())).mul(oneMinus(smoothstep(top - 0.08, top, p.y))).mul(smoothstep(-0.7, -0.4, p.y))),
				float(0),
			);
			return mix(color('#ffb36b'), color('#ff7a5c'), saturate(length(p))).mul(cloud(p, 2.4, 11).mul(0.32)).mul(oneMinus(pillars.mul(0.85)));
		},
		magnitude: 6,
		size: [1, 1],
	},
	{
		/** The Crab Nebula, what is left of the supernova of 1054: orange filaments over the blue-white glow of its pulsar's wind. */
		angle: 125,
		at: [184.56, -5.78],
		discovery: ['crab_nebula', '#c9c4d8'],
		draw: p => {
			const shell = oneMinus(smoothstep(0.55, 0.95, length(p).add(mx_noise_float(vec3(p.mul(3), 9)).mul(0.15))));
			const filaments = oneMinus(smoothstep(0.02, 0.1, mx_noise_float(vec3(p.mul(7), 5)).abs()));
			return color('#a9c4ff').mul(exp(length(p).mul(-4)).mul(0.3)).add(color('#ff8d5a').mul(filaments.mul(0.4))).mul(shell);
		},
		magnitude: 8.4,
		size: [0.42, 0.3],
	},
	{
		/** The Ring Nebula, a dying star's shell of gas: blue-green inside, red at the rim, the white dwarf a faint dot at its center. */
		angle: 60,
		at: [63.17, 13.98],
		draw: p => {
			const radius = length(p);
			const ring = exp(radius.sub(0.55).mul(radius.sub(0.55)).mul(-60));
			const inner = oneMinus(smoothstep(0.2, 0.55, radius)).mul(0.08).add(blob(p, [0, 0], [1, 1], 900).mul(0.3));
			return mix(color('#7fe0d0'), color('#ff7062'), smoothstep(0.45, 0.75, radius)).mul(ring.mul(0.5)).add(color('#cfe6ff').mul(inner));
		},
		magnitude: 8.8,
		size: [0.25, 0.2],
	},
];

const span = (degrees: number) => 2 * DEEP_SKY_DISTANCE * Math.tan(MathUtils.degToRad(degrees) / 2);

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

/**
 * One flat glow per deep-sky object, facing the center of the sky, faded in by the eased limiting magnitude. A discoverable one is a
 * smudge until its discovery resolves it, flaring cyan halfway like Saturn's rings.
 */
function deepSky(limit: Node<'float'>, discovered: readonly string[]) {
	return DEEP_SKY.map(({ angle, at, discovery, draw, magnitude, size }) => {
		const p = uv().sub(0.5).mul(2);
		const glow = (sharpness: number) => exp(dot(p, p).mul(-sharpness));
		const nebula = discovery && new Nebula(COSMOS_OBJECTS_BY_ID[discovery[0]], galactic(...at), Math.max(...size), discovered.includes(discovery[0]));
		const drawn = nebula
			? mix(color(discovery[1]).mul(glow(5)).mul(0.18), draw(p), nebula.reveal).add(color('#8ff5ff').mul(glow(4)).mul(nebula.reveal.mul(oneMinus(nebula.reveal)).mul(8)))
			: draw(p);
		const material = new MeshBasicNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
		material.colorNode = drawn
			.mul(oneMinus(smoothstep(0.75, 1, max(p.x.abs(), p.y.abs()))))
			.mul(smoothstep(magnitude - 0.3, magnitude + 1.5, limit))
			.mul(darkSky);
		const mesh = new Mesh(new PlaneGeometry(span(size[0]), span(size[1])), material);
		mesh.position.copy(galactic(...at)).multiplyScalar(DEEP_SKY_DISTANCE);
		mesh.up.copy(EARTH_POLE);
		mesh.lookAt(ORIGIN);
		/** Seen from inside the sky with north up, +x points west, a position angle of 270°, and angles turn counterclockwise. */
		mesh.rotateZ(MathUtils.degToRad(angle + 90));
		return { magnitude, mesh, nebula };
	});
}

/**
 * Everything past the Solar System, centered on the camera: the Milky Way dome, the deep-sky objects and the two star fields. A
 * wider sight eases in so a new Aperture level visibly fills the sky.
 */
export class Sky {
	readonly group = new Group();
	/** The deep-sky objects to discover, by Cosmos object id. */
	readonly nebulae: ReadonlyMap<string, Nebula>;
	readonly #deepSky: ReturnType<typeof deepSky>;
	readonly #dome: Mesh;
	readonly #faint: Sprite;
	/** Limiting magnitude, eased toward `#goal`. */
	readonly #limit = uniform(0);
	#goal: number;
	/** Share of the bright field and Milky Way shown at the eased limit, see `skySight`. */
	readonly #sight = uniform(0);
	readonly #stars: Sprite;

	constructor(albedo: Node<'vec3'>, limit: number, discovered: readonly string[]) {
		this.#limit.value = this.#goal = limit;
		this.#sight.value = skySight(limit);
		/** The Milky Way rises out of the dark in the second half of the sight. */
		const material = new MeshBasicNodeMaterial({ depthWrite: false, side: BackSide });
		material.colorNode = albedo.mul(smoothstep(0.3, 1, this.#sight)).mul(darkSky);
		this.#dome = new Mesh(new SphereGeometry(SKY_DISTANCE, 64, 32), material);
		this.#dome.renderOrder = -1;
		this.#deepSky = deepSky(this.#limit, discovered);
		this.nebulae = new Map(this.#deepSky.flatMap(({ nebula }) => (nebula ? [[nebula.object.id, nebula]] : [])));
		this.#stars = starField(this.#sight);
		this.#faint = faintStars(this.#limit);
		this.group.add(this.#dome, ...this.#deepSky.map(({ mesh }) => mesh), this.#stars, this.#faint);
		this.showDepth();
	}

	set limit(limit: number) {
		this.#goal = limit;
	}

	follow(camera: Vector3) {
		this.group.position.copy(camera);
	}

	/** Low quality drops the Milky Way and keeps a quarter of the stars. */
	setQuality(high: boolean) {
		this.#dome.visible = high;
		this.#stars.count = high ? STAR_COUNT : STAR_COUNT / 4;
		this.#faint.count = high ? FAINT_STAR_COUNT : FAINT_STAR_COUNT / 4;
	}

	/** Skips drawing what the eased limit doesn't reach yet, `all` draws it anyway so its shaders compile. */
	showDepth(all = false) {
		const limit = this.#limit.value;
		for (const { magnitude, mesh } of this.#deepSky) mesh.visible = all || limit > magnitude - 0.3;
		this.#faint.visible = all || limit > FAINT_STAR_MAGNITUDES[0] - 0.3;
	}

	update(dt: number) {
		if (this.#limit.value === this.#goal) return;
		const gap = this.#goal - this.#limit.value;
		this.#limit.value = Math.abs(gap) < 1e-3 ? this.#goal : this.#limit.value + gap * Math.min(1, dt * 1.2);
		this.#sight.value = skySight(this.#limit.value);
		this.showDepth();
	}
}
