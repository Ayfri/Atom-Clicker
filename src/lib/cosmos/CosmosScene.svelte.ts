import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
	abs,
	cameraPosition,
	color,
	dot,
	exp,
	float,
	fract,
	instancedBufferAttribute,
	length,
	luminance,
	max,
	mix,
	mx_fractal_noise_float,
	mx_noise_float,
	mx_worley_noise_float,
	normalView,
	normalWorld,
	normalWorldGeometry,
	pass,
	positionLocal,
	positionViewDirection,
	positionWorld,
	pow,
	remapClamp,
	saturate,
	sin,
	smoothstep,
	time,
	uniform,
	uv,
	vec3,
} from 'three/tsl';
import {
	AdditiveBlending,
	BackSide,
	BufferGeometry,
	Float32BufferAttribute,
	Group,
	InstancedBufferAttribute,
	LineBasicNodeMaterial,
	Line,
	type Material,
	MathUtils,
	Mesh,
	MeshBasicNodeMaterial,
	NeutralToneMapping,
	type Node,
	PerspectiveCamera,
	PointsNodeMaterial,
	RenderPipeline,
	Scene,
	SphereGeometry,
	Sprite,
	SpriteNodeMaterial,
	Vector3,
	WebGPURenderer,
} from 'three/webgpu';

export type CosmosMode = 'discovery' | 'intro' | 'observe' | 'overview';
export type CosmosQuality = 'high' | 'low';

interface CosmosHud {
	/** Chevron at the screen edge pointing at the signal while it is outside the reticle. */
	arrow: HTMLElement;
	/** Scaled on X with the resolution, written directly because it changes every frame. */
	progress: HTMLElement;
}

interface Flight {
	duration: number;
	elapsed: number;
	fromFov: number;
	fromLook: Vector3;
	fromPosition: Vector3;
	onEnd: () => void;
	toFov: number;
	/** Targets are read every frame, the planets keep orbiting during the flight. */
	toLook: () => Vector3;
	toPosition: () => Vector3;
}

/** Real proportions for the planet sizes and the Mars/Earth orbit ratio, distances and the Sun are shrunk so all of it fits a screen. */
const EARTH_RADIUS = 1.6;
const EARTH_ORBIT = 260;
const MOON_RADIUS = EARTH_RADIUS * 0.273;
const MOON_DISTANCE = 10;
const MARS_RADIUS = EARTH_RADIUS * 0.532;
const MARS_ORBIT = EARTH_ORBIT * 1.524;
const SUN_RADIUS = 18;
const STAR_DISTANCE = 1500;
const SKY_DISTANCE = 1800;
/** Seconds per turn, compressed so the system visibly moves without turning days into a blur. */
const EARTH_YEAR = 720;
const EARTH_DAY = 40;
const MOON_MONTH = 60;
const MARS_YEAR = EARTH_YEAR * 1.88;
const AXIAL_TILT = 0.41;
/** Without a clock drive the sky slides out of the eyepiece as the Earth turns, real telescopes had the same problem. */
const SKY_DRIFT = 0.016;
const RETICLE_RADIUS = 56;
const SIGNAL_SIZE = 44;
/** Rate of the exponential ease toward a wheel zoom goal, ~90% of the way in 0.25 s. */
const ZOOM_EASE = 9;
const STAR_COUNT = 3500;
const UP = new Vector3(0, 1, 0);
/** The galactic plane is tilted against the solar system's, the star band and the Milky Way dome share it. */
const GALAXY_AXIS = new Vector3(1, 0, 0.3).normalize();
const GALAXY_TILT = 1.05;
const GALAXY_NORMAL = UP.clone().applyAxisAngle(GALAXY_AXIS, GALAXY_TILT);
const GALAXY_CORE = new Vector3(1, 0, 0).applyAxisAngle(GALAXY_AXIS, GALAXY_TILT);

const easeInOut = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const invert = (node: Node<'float'>) => float(1).sub(node);

/** Sun at the origin, so the light direction is the way back to it. */
const toSun = positionWorld.negate().normalize();
const sunFacing = dot(normalWorld, toSun);
const fresnel = invert(saturate(dot(normalView, positionViewDirection)));
const surfacePoint = positionLocal.normalize();

/** A soft edge between two flat color areas, wide enough that regions blend instead of switching abruptly. */
const edge = (at: number, value: Node<'float'>, width = 0.04) => smoothstep(at - width, at + width, value);

/** Softened cel shading: a smooth terminator plus a gentle second band, stylized without hard light steps. */
const toon = (light: Node<'float'>, night: number) =>
	float(night)
		.add(smoothstep(-0.12, 0.08, light).mul(0.55 - night))
		.add(smoothstep(0.1, 0.5, light).mul(0.45));

/** Flat atmosphere band on the lit limb, plus a faint outline on the night side so the silhouette stays readable against space. */
const outline = (lit: string, night: string) =>
	color(lit)
		.mul(edge(0.72, fresnel))
		.mul(smoothstep(-0.25, 0.1, sunFacing))
		.add(color(night).mul(edge(0.86, fresnel)).mul(invert(smoothstep(-0.25, 0.1, sunFacing))));

function earthMaterial() {
	const height = mx_fractal_noise_float(surfacePoint.mul(1.5), 3, 2, 0.5);
	const latitude = abs(surfacePoint.y);
	const land = edge(0.03, height);
	const ocean = mix(color('#17427f'), color('#2b78b8'), edge(-0.06, height, 0.08));
	const dryBelt = invert(smoothstep(0.02, 0.2, abs(latitude.sub(0.3))));
	const dry = edge(0.26, mx_fractal_noise_float(surfacePoint.mul(3).add(11), 2, 2, 0.5).add(dryBelt.mul(0.35)), 0.1);
	const ground = mix(mix(color('#4d9a45'), color('#3a7a3b'), edge(0.17, height, 0.08)), color('#c9a86a'), dry);
	/**
	 * Rare fold ranges shaped like spindles: east-west lines along wobbling latitudes, whose width follows small sparse blobs so
	 * each range tapers to a point at both ends and swells in the middle, with lumps along the spine. Snow on the thickest part.
	 */
	const rugged = mx_fractal_noise_float(surfacePoint.mul(22), 3, 2, 0.5).mul(0.5).add(0.5);
	const wobbledLatitude = surfacePoint.y.add(mx_noise_float(surfacePoint.mul(3).add(13)).mul(0.07));
	const foldDistance = abs(fract(wobbledLatitude.mul(4).add(0.3)).sub(0.5));
	const spindle = smoothstep(0.2, 0.5, mx_noise_float(surfacePoint.mul(vec3(2.6, 6, 2.6)).add(57))).mul(smoothstep(0.06, 0.14, height));
	const lumps = mx_noise_float(surfacePoint.mul(14).add(3)).mul(0.35).add(0.85);
	/** A power under 1 bulges the width profile, the ends stay pointed but the body is rounded instead of a diamond. */
	const halfWidth = pow(spindle, 0.55).mul(lumps).mul(0.16).add(1e-3);
	const ranges = invert(smoothstep(halfWidth.mul(0.4), halfWidth, foldDistance.add(rugged.mul(0.012))));
	const rock = smoothstep(0.2, 0.55, ranges.mul(rugged.mul(0.5).add(0.6)));
	const snow = smoothstep(0.75, 0.9, ranges.mul(spindle).mul(rugged.mul(0.5).add(0.6)));
	const terrain = mix(mix(ground, mix(color('#6e5f4f'), color('#9a8a76'), rugged), rock), color('#f2f4f7'), snow.mul(0.85));
	const ice = edge(0.87, latitude.add(height.mul(0.12)), 0.03);
	const surface = mix(mix(ocean, terrain, land), color('#eef3f8'), ice);
	/** Divided by a clamped length: with the Sun right behind the Earth the sum is near zero and `normalize` returned NaN pixels. */
	const halfwaySum = toSun.add(cameraPosition.sub(positionWorld).normalize());
	const halfway = halfwaySum.div(max(length(halfwaySum), 1e-4));
	const highlight = edge(0.985, dot(normalWorld, halfway), 0.01).mul(invert(land)).mul(0.35);
	const day = surface.mul(smoothstep(-0.1, 0.55, sunFacing).mul(0.7).add(0.3)).add(highlight);

	/** Fine points grouped in urban regions, a high frequency keeps them from reading as flat yellow blobs up close. */
	const urban = smoothstep(0.1, 0.4, mx_fractal_noise_float(surfacePoint.mul(5).add(23), 3, 2, 0.5)).mul(land).mul(invert(ice));
	const cities = smoothstep(0.62, 0.72, mx_noise_float(surfacePoint.mul(180))).mul(urban);
	/**
	 * Day and night are two palettes cross-faded on the Sun angle, like three.js' `webgpu_tsl_earth` example: scaling the day
	 * colors down instead turned green coasts black and sand yellow on the night side.
	 */
	const night = mix(mix(color('#020306'), color('#0e0f12'), land), color('#1f2227'), max(ice, snow)).add(
		color('#ffcf73').mul(cities).mul(0.9),
	);
	/** Colors drain toward a neutral grey as the light fades, dim sand and grass otherwise read as a brown-yellow band at dusk. */
	const dusk = mix(color('#8c9099').mul(luminance(day)), day, smoothstep(0, 0.35, sunFacing));
	const lit = mix(night, dusk, smoothstep(-0.2, 0.4, sunFacing));
	const atmosphereMix = saturate(smoothstep(-0.5, 1, sunFacing).mul(pow(fresnel, 2)).mul(sunsetDimming(sunFacing)).mul(0.7));
	const material = new MeshBasicNodeMaterial();
	material.colorNode = mix(lit, atmosphereTint(sunFacing), atmosphereMix).add(outline('#8fd3ff', '#26356e').mul(0.5));
	return material;
}

/** Blue by day, gold then orange going past the terminator, a tight ramp so the sunlit limb stays blue. */
const atmosphereTint = (facing: Node<'float'>) =>
	mix(mix(color('#ff8a2a'), color('#ffc46b'), smoothstep(-0.3, -0.08, facing)), color('#4db2ff'), smoothstep(-0.08, 0.15, facing));

/** Softens the sunset part of the atmosphere, the orange stays a hint along the terminator instead of a bright ring. */
const sunsetDimming = (facing: Node<'float'>) => mix(0.4, 1, smoothstep(-0.08, 0.15, facing));

/** Back-face shell slightly larger than the Earth, its fresnel fades the halo outward. Geometry normals keep the lit side on the Sun. */
function atmosphereMaterial() {
	const facing = dot(normalWorldGeometry, toSun);
	const shellFresnel = invert(abs(dot(normalView, positionViewDirection)));
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: BackSide, transparent: true });
	material.colorNode = atmosphereTint(facing);
	material.opacityNode = pow(remapClamp(shellFresnel, 0.73, 1, 1, 0), 3).mul(smoothstep(-0.5, 1, facing)).mul(sunsetDimming(facing));
	return material;
}

function cloudMaterial() {
	/** Stretched along the latitude so clouds form bands, and domain-warped over time so they drift and reshape instead of sliding as a block. */
	const stretched = surfacePoint.mul(vec3(4.5, 8, 4.5));
	const warp = mx_fractal_noise_float(stretched.mul(0.35).add(vec3(0, time.mul(0.012), 0)), 2, 2, 0.5).mul(0.9);
	const drift = vec3(time.mul(0.03), 0, time.mul(0.01));
	const cover = mx_fractal_noise_float(stretched.add(warp).add(drift), 5, 2.1, 0.5);
	const density = smoothstep(0.06, 0.45, cover).mul(smoothstep(-0.35, 0.2, mx_fractal_noise_float(surfacePoint.mul(1.2).add(31), 2, 2, 0.5)));
	const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
	/** A faint moonlit blue on the night side, at the ground's 2-3% floor the clouds vanished there and only showed against the Sun's glow. */
	const night = invert(smoothstep(-0.12, 0.08, sunFacing));
	material.colorNode = color('#ffffff').mul(toon(sunFacing, 0)).add(color('#7d8fb8').mul(night).mul(0.09));
	/** Thinner on the night side, so city lights show through. */
	material.opacityNode = density.mul(smoothstep(-0.3, 0.1, sunFacing).mul(0.45).add(0.4));
	return material;
}

function moonMaterial() {
	const maria = edge(0.12, mx_fractal_noise_float(surfacePoint.mul(1.6).add(3), 3, 2, 0.5), 0.1);
	const crater = mx_worley_noise_float(surfacePoint.mul(6));
	const floor = invert(edge(0.16, crater, 0.03));
	const lip = edge(0.16, crater, 0.03).mul(invert(edge(0.22, crater, 0.03)));
	const surface = mix(mix(color('#bab5ad'), color('#a19c95'), maria), color('#a8a29b'), floor).add(lip.mul(0.06));
	const material = new MeshBasicNodeMaterial();
	material.colorNode = surface.mul(toon(sunFacing, 0.02)).add(outline('#ffffff', '#26356e').mul(0.25));
	return material;
}

function marsMaterial(reveal: Node<'float'>) {
	const terrain = mx_fractal_noise_float(surfacePoint.mul(2).add(5), 3, 2, 0.5);
	const dark = edge(0.18, mx_fractal_noise_float(surfacePoint.mul(1.3).add(17), 2, 2, 0.5), 0.1);
	const caps = edge(0.9, abs(surfacePoint.y), 0.02);
	const surface = mix(mix(color('#c75a33'), color('#e0844d'), edge(0.05, terrain, 0.1)), color('#94412a'), dark);
	const lit = mix(surface, color('#f6eee6'), caps).mul(toon(sunFacing, 0.02)).add(outline('#ffc2a1', '#3e2a52').mul(0.5));
	const material = new MeshBasicNodeMaterial();
	/** Condenses out of the signal's light: starts as a cyan glow and cools down to the surface. */
	material.colorNode = mix(color('#8ff5ff').mul(3), lit, reveal);
	return material;
}

function sunMaterial() {
	const flow = mx_fractal_noise_float(surfacePoint.mul(2).add(vec3(0, time.mul(0.04), 0)), 3, 2, 0.5);
	const blobs = invert(edge(0.22, mx_worley_noise_float(surfacePoint.mul(5).add(vec3(time.mul(0.05)))), 0.08));
	const surface = mix(mix(color('#ffc233'), color('#ffe07a'), edge(0.1, flow, 0.15)), color('#ff9a1f'), blobs.mul(0.5));
	const material = new MeshBasicNodeMaterial();
	/** Past ~2x the neutral tone mapping washes the disc to white, the extra brightness comes from the corona and bloom instead. */
	material.colorNode = mix(surface, color('#ff6a1a'), smoothstep(0.4, 0.95, fresnel)).mul(1.8);
	return material;
}

/** Cartoon corona: two flat halo rings over a soft glow, drawn on one camera-facing sprite. */
function coronaSprite() {
	const distance = length(uv().sub(0.5)).mul(2);
	const inner = invert(edge(0.7, distance, 0.08)).mul(0.4);
	const outer = invert(edge(0.86, distance, 0.08)).mul(0.1);
	const glow = pow(saturate(invert(distance)), 4).mul(0.55);
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color('#ff9f35').mul(inner.add(outer).add(glow));
	const sprite = new Sprite(material);
	sprite.scale.setScalar(SUN_RADIUS * 3.6);
	return sprite;
}

/** Faint Milky Way dome: a noisy band with dust lanes and a dim warm core, kept well below the stars so space stays dark. */
function milkyWay(bandNormal: Vector3, core: Vector3) {
	const direction = positionLocal.normalize();
	const latitude = dot(direction, vec3(bandNormal.x, bandNormal.y, bandNormal.z));
	const band = exp(latitude.mul(latitude).mul(-48));
	const clouds = mx_fractal_noise_float(direction.mul(4), 3, 2, 0.5).mul(0.5).add(0.6);
	const dust = smoothstep(0, 0.3, mx_fractal_noise_float(direction.mul(8).add(4), 3, 2, 0.5)).mul(exp(latitude.mul(latitude).mul(-250)));
	const density = saturate(band.mul(clouds).mul(invert(dust.mul(0.7))));
	const coreGlow = pow(saturate(dot(direction, vec3(core.x, core.y, core.z))), 10).mul(band);
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: BackSide });
	material.colorNode = mix(color('#17151f'), color('#3a3447'), density)
		.mul(density)
		.mul(0.36)
		.add(color('#4a4552').mul(coreGlow).mul(0.12));
	const sky = new Mesh(new SphereGeometry(SKY_DISTANCE, 64, 32), material);
	sky.renderOrder = -1;
	return sky;
}

function glowSprite(tint: string, falloff: number, strength: number) {
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color(tint).mul(pow(saturate(invert(length(uv().sub(0.5)).mul(2))), falloff)).mul(strength);
	return new Sprite(material);
}

function signalSprite() {
	const distance = length(uv().sub(0.5)).mul(2);
	const phase = fract(time.mul(0.5));
	const ring = invert(smoothstep(0, 0.07, abs(distance.sub(phase)))).mul(invert(phase));
	const core = pow(saturate(invert(distance)), 6).mul(sin(time.mul(3)).mul(0.3).add(0.9));
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthTest: false, depthWrite: false, transparent: true });
	material.colorNode = color('#8ff5ff').mul(core.mul(2.2).add(ring.mul(1.3)));
	const sprite = new Sprite(material);
	sprite.renderOrder = 10;
	return sprite;
}

/** A Milky Way band plus a uniform field, one instanced sprite draw call for every star. */
function starField() {
	const data = new Float32Array(STAR_COUNT * 4);
	const tints = new Float32Array(STAR_COUNT * 3);
	const palette = [
		[0.72, 0.8, 1],
		[1, 1, 1],
		[1, 0.94, 0.8],
		[1, 0.8, 0.6],
	];
	const point = new Vector3();
	for (let i = 0; i < STAR_COUNT; i++) {
		const inBand = Math.random() < 0.5;
		const longitude = Math.random() * Math.PI * 2;
		const latitude = inBand
			? (Math.random() + Math.random() + Math.random() - 1.5) * 0.2
			: Math.asin(Math.random() * 2 - 1);
		point.set(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude));
		point.applyAxisAngle(GALAXY_AXIS, GALAXY_TILT).multiplyScalar(STAR_DISTANCE);
		data.set([point.x, point.y, point.z, 1 + Math.random() ** 6 * 2.6], i * 4);
		tints.set(palette[Math.floor(Math.random() * palette.length)], i * 3);
	}
	const star = instancedBufferAttribute<'vec4'>(new InstancedBufferAttribute(data, 4), 'vec4');
	const tint = instancedBufferAttribute<'vec3'>(new InstancedBufferAttribute(tints, 3), 'vec3');
	const twinkle = sin(time.mul(star.w.mul(1.3).add(0.5)).add(star.x.mul(0.37))).mul(0.2).add(0.85);
	/** The ~2% brightest stars get a bigger sprite with a faint four-point sparkle, the rest stay round dots. */
	const sparkle = smoothstep(3.2, 3.4, star.w);
	const offset = uv().sub(0.5);
	const disc = invert(smoothstep(0.08, 0.18, length(offset).mul(mix(1, 3, sparkle))));
	const ray = (along: Node<'float'>, across: Node<'float'>) =>
		invert(smoothstep(0, 0.025, abs(across))).mul(invert(smoothstep(0.03, 0.45, abs(along)))).mul(0.6);
	const material = new PointsNodeMaterial({ blending: AdditiveBlending, depthWrite: false, sizeAttenuation: false, transparent: true });
	material.positionNode = star.xyz;
	material.sizeNode = star.w.mul(mix(1.8, 6, sparkle));
	material.colorNode = tint.mul(twinkle).mul(star.w.mul(0.3).add(0.35));
	material.opacityNode = max(disc,ray(offset.x, offset.y).add(ray(offset.y, offset.x)).mul(sparkle));
	const stars = new Sprite(material);
	stars.count = STAR_COUNT;
	stars.frustumCulled = false;
	return stars;
}

function orbitLine(radius: number, tint: string, opacity: number) {
	const points: number[] = [];
	/** The WebGPU renderer has no LineLoop, the last point repeats the first to close the circle. */
	for (let i = 0; i <= 256; i++) {
		const angle = (i / 256) * Math.PI * 2;
		points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
	return new Line(geometry, new LineBasicNodeMaterial({ color: tint, depthWrite: false, opacity, transparent: true }));
}

/**
 * Prototype of the Cosmos realm: the Earth-Moon-Sun system, an observation mode where the player keeps a signal inside the
 * telescope reticle, and the discovery of Mars.
 * @example const scene = await CosmosScene.create(canvas, { arrow, progress });
 */
export class CosmosScene {
	backend = $state('');
	discovered = $state(false);
	fps = $state(0);
	mode = $state<CosmosMode>('intro');
	quality = $state<CosmosQuality>('high');

	readonly #camera = new PerspectiveCamera(50, 1, 0.05, 4000);
	readonly #canvas: HTMLCanvasElement;
	readonly #controls: OrbitControls;
	readonly #earth = new Mesh(new SphereGeometry(EARTH_RADIUS, 96, 64), earthMaterial());
	readonly #earthSystem = new Group();
	readonly #hud: CosmosHud;
	readonly #mars = new Group();
	readonly #marsFlash = glowSprite('#8ff5ff', 3, 2.5);
	readonly #marsOrbit = orbitLine(MARS_ORBIT, '#ff9d6e', 0.22);
	readonly #marsReveal = uniform(0);
	readonly #moonPivot = new Group();
	readonly #pipeline: RenderPipeline;
	readonly #pointers = new Map<number, { x: number; y: number }>();
	readonly #renderer: WebGPURenderer;
	readonly #resize: ResizeObserver;
	readonly #scene = new Scene();
	readonly #signal = signalSprite();
	readonly #sky = milkyWay(GALAXY_NORMAL, GALAXY_CORE);
	readonly #stars = starField();
	readonly #withBloom: Node;
	readonly #withoutBloom: Node;

	readonly #clouds = new Mesh(new SphereGeometry(EARTH_RADIUS * 1.015, 96, 64), cloudMaterial());
	/** Wheel zoom eases toward these goals every frame instead of jumping a whole step per notch. */
	#distanceGoal: number | null = null;
	#flight: Flight | null = null;
	#fovGoal = 55;
	#fpsFrames = 0;
	#fpsTime = 0;
	#lastEarth = new Vector3();
	#lastTime = 0;
	#pitch = 0;
	#progress = 0;
	#qualityProbe = { frames: 0, time: 0 };
	#revealTime = -1;
	#simTime = 0;
	#yaw = 0;

	private constructor(canvas: HTMLCanvasElement, renderer: WebGPURenderer, hud: CosmosHud) {
		this.#canvas = canvas;
		this.#hud = hud;
		this.#renderer = renderer;
		this.backend = 'isWebGPUBackend' in renderer.backend ? 'WebGPU' : 'WebGL 2';

		const sun = new Mesh(new SphereGeometry(SUN_RADIUS, 96, 64), sunMaterial());
		const tilt = new Group();
		tilt.rotation.z = AXIAL_TILT;
		tilt.add(this.#earth, this.#clouds, new Mesh(new SphereGeometry(EARTH_RADIUS * 1.04, 96, 64), atmosphereMaterial()));
		const moon = new Mesh(new SphereGeometry(MOON_RADIUS, 64, 48), moonMaterial());
		moon.position.x = MOON_DISTANCE;
		this.#moonPivot.add(moon);
		this.#earthSystem.add(tilt, this.#moonPivot, orbitLine(MOON_DISTANCE, '#9fb4d9', 0.18));

		const marsBody = new Mesh(new SphereGeometry(MARS_RADIUS, 80, 56), marsMaterial(this.#marsReveal));
		/** Drawn from the start at a near-zero scale, so its shader compiles now instead of stuttering the discovery. */
		marsBody.scale.setScalar(0.001);
		this.#mars.add(marsBody, this.#marsFlash);
		this.#marsOrbit.visible = false;
		this.#marsFlash.scale.setScalar(0);
		this.#signal.visible = false;

		this.#scene.add(sun, coronaSprite(), orbitLine(EARTH_ORBIT, '#6f8cff', 0.12), this.#earthSystem, this.#mars, this.#marsOrbit);
		this.#scene.add(this.#sky, this.#stars, this.#signal);

		const sceneColor = pass(this.#scene, this.#camera).getTextureNode('output');
		this.#withoutBloom = sceneColor;
		this.#withBloom = sceneColor.add(bloom(sceneColor, 0.65, 0.3, 1));
		this.#pipeline = new RenderPipeline(renderer, this.#withBloom);

		this.#controls = new OrbitControls(this.#camera, canvas);
		this.#controls.enableDamping = true;
		this.#controls.enablePan = false;
		this.#controls.minDistance = 3;
		this.#controls.maxDistance = 700;
		this.#controls.enabled = false;

		this.#placeBodies();
		this.#resize = new ResizeObserver(() => this.#fit());
		this.#resize.observe(canvas);
		this.#fit();

		canvas.addEventListener('pointerdown', this.#onPointerDown);
		canvas.addEventListener('wheel', this.#onWheel, { capture: true, passive: false });
		window.addEventListener('pointermove', this.#onPointerMove);
		window.addEventListener('pointerup', this.#onPointerUp);
		window.addEventListener('pointercancel', this.#onPointerUp);
		document.addEventListener('visibilitychange', this.#onVisibility);

		this.replayIntro();
		this.#start();
	}

	static async create(canvas: HTMLCanvasElement, hud: CosmosHud) {
		const renderer = new WebGPURenderer({ antialias: true, canvas });
		/** Neutral keeps the flat cartoon colors as picked, ACES shifted them toward brown and desaturated the highlights. */
		renderer.toneMapping = NeutralToneMapping;
		renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
		await renderer.init();
		return new CosmosScene(canvas, renderer, hud);
	}

	/** Leaves the discovery card for the overview, Mars stays in the system. */
	continue() {
		this.#flyTo(() => this.#overviewPosition(), () => this.#earthSystem.position, 50, 2.6, () => this.#enterOverview());
	}

	dispose() {
		this.#renderer.setAnimationLoop(null);
		this.#resize.disconnect();
		this.#controls.dispose();
		this.#canvas.removeEventListener('pointerdown', this.#onPointerDown);
		this.#canvas.removeEventListener('wheel', this.#onWheel, { capture: true });
		window.removeEventListener('pointermove', this.#onPointerMove);
		window.removeEventListener('pointerup', this.#onPointerUp);
		window.removeEventListener('pointercancel', this.#onPointerUp);
		document.removeEventListener('visibilitychange', this.#onVisibility);
		this.#scene.traverse(object => {
			if (!(object instanceof Mesh || object instanceof Sprite || object instanceof Line)) return;
			object.geometry.dispose();
			(object.material as Material).dispose();
		});
		this.#pipeline.dispose();
		this.#renderer.dispose();
	}

	/** Moves the camera next to the Earth's night side and hands the view to the player, the signal sits on Mars. */
	observe() {
		if (this.discovered) return;
		const toMars = this.#mars.position.clone().sub(this.#observerPosition()).normalize();
		const yaw = Math.atan2(toMars.x, toMars.z) + 1.1;
		const pitch = Math.asin(toMars.y) + 0.35;
		const look = () => this.#observerPosition().add(this.#direction(yaw, pitch));
		this.#flyTo(() => this.#observerPosition(), look, 55, 2.4, () => {
			this.#yaw = yaw;
			this.#pitch = pitch;
			this.#progress = 0;
			this.#fovGoal = 55;
			this.#signal.visible = true;
			this.mode = 'observe';
		});
	}

	replayIntro() {
		const away = this.#overviewPosition().sub(this.#earthSystem.position).normalize();
		this.#camera.position.copy(this.#earthSystem.position).addScaledVector(away, EARTH_RADIUS * 1.35);
		this.#camera.fov = 30;
		this.#camera.lookAt(this.#earthSystem.position);
		this.mode = 'intro';
		this.#flyTo(() => this.#overviewPosition(), () => this.#earthSystem.position, 50, 4.5, () => this.#enterOverview());
	}

	setQuality(quality: CosmosQuality) {
		this.quality = quality;
		this.#pipeline.outputNode = quality === 'high' ? this.#withBloom : this.#withoutBloom;
		this.#stars.count = quality === 'high' ? STAR_COUNT : STAR_COUNT / 2;
		this.#renderer.setPixelRatio(quality === 'high' ? Math.min(devicePixelRatio, 1.5) : 1);
		this.#fit();
	}

	#direction(yaw: number, pitch: number) {
		return new Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
	}

	#enterOverview() {
		this.#lastEarth.copy(this.#earthSystem.position);
		this.#controls.target.copy(this.#earthSystem.position);
		this.#controls.enabled = true;
		this.#controls.update();
		this.mode = 'overview';
	}

	#fit() {
		const { clientHeight, clientWidth } = this.#canvas;
		if (!clientWidth || !clientHeight) return;
		this.#renderer.setSize(clientWidth, clientHeight, false);
		this.#camera.aspect = clientWidth / clientHeight;
		this.#camera.updateProjectionMatrix();
	}

	#flyTo(to: () => Vector3, look: () => Vector3, fov: number, duration: number, onEnd = () => {}) {
		this.#controls.enabled = false;
		this.#distanceGoal = null;
		this.#flight = {
			duration,
			elapsed: 0,
			fromFov: this.#camera.fov,
			fromLook: this.#camera.getWorldDirection(new Vector3()).multiplyScalar(10).add(this.#camera.position),
			fromPosition: this.#camera.position.clone(),
			onEnd,
			toFov: fov,
			toLook: look,
			toPosition: to,
		};
	}

	#frame = (now: number) => {
		const dt = this.#lastTime ? Math.min((now - this.#lastTime) / 1000, 0.1) : 0;
		this.#lastTime = now;
		this.#simTime += dt;
		this.#placeBodies();
		this.#stars.position.copy(this.#camera.position);
		this.#sky.position.copy(this.#camera.position);

		if (this.#flight) this.#updateFlight(dt);
		else if (this.mode === 'overview') this.#updateOverview(dt);
		else if (this.mode === 'observe') this.#updateObserve(dt);
		if (this.#revealTime >= 0) this.#updateReveal(dt);

		this.#pipeline.render();
		this.#measure(dt);
	};

	/** Counts frames for the FPS readout, and drops to low quality once if the first seconds after the intro run slow. */
	#measure(dt: number) {
		this.#fpsFrames++;
		this.#fpsTime += dt;
		if (this.#fpsTime >= 1) {
			this.fps = Math.round(this.#fpsFrames / this.#fpsTime);
			this.#fpsFrames = 0;
			this.#fpsTime = 0;
		}
		const probe = this.#qualityProbe;
		if (this.mode === 'intro' || probe.frames < 0) return;
		probe.frames++;
		probe.time += dt;
		if (probe.frames < 90) return;
		if (probe.time / probe.frames > 1 / 40 && this.quality === 'high') this.setQuality('low');
		probe.frames = -1;
	}

	#observerPosition() {
		const away = this.#earthSystem.position.clone().normalize();
		return away.multiplyScalar(EARTH_RADIUS * 1.7).addScaledVector(UP, 0.4).add(this.#earthSystem.position);
	}

	#onPointerDown = (event: PointerEvent) => {
		/** A touch pinch goes through OrbitControls, a pending wheel goal would fight it. */
		this.#distanceGoal = null;
		if (this.mode !== 'observe') return;
		this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
	};

	#onPointerMove = (event: PointerEvent) => {
		const previous = this.#pointers.get(event.pointerId);
		if (!previous || this.mode !== 'observe') return;
		if (this.#pointers.size === 1) {
			/** One screen pixel of drag moves the sky by one pixel, whatever the zoom. */
			const perPixel = MathUtils.DEG2RAD * (this.#camera.fov / this.#canvas.clientHeight);
			this.#yaw += (event.clientX - previous.x) * perPixel;
			this.#pitch = Math.max(-1.45, Math.min(1.45, this.#pitch + (event.clientY - previous.y) * perPixel));
		} else {
			const other = [...this.#pointers].find(([id]) => id !== event.pointerId)?.[1];
			if (other) {
				const before = Math.hypot(previous.x - other.x, previous.y - other.y);
				const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
				if (before > 0) this.#zoom(before / after);
			}
		}
		this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
	};

	#onPointerUp = (event: PointerEvent) => {
		this.#pointers.delete(event.pointerId);
	};

	#onVisibility = () => {
		if (document.hidden) this.#renderer.setAnimationLoop(null);
		else this.#start();
	};

	/** Registered on the capture phase so it stops OrbitControls' own wheel handler, which jumps a whole step per notch. */
	#onWheel = (event: WheelEvent) => {
		event.preventDefault();
		event.stopImmediatePropagation();
		const factor = Math.exp(event.deltaY * 0.0012);
		if (this.mode === 'observe') this.#zoom(factor);
		if (this.mode !== 'overview') return;
		const current = this.#distanceGoal ?? this.#camera.position.distanceTo(this.#controls.target);
		this.#distanceGoal = MathUtils.clamp(current * factor, this.#controls.minDistance, this.#controls.maxDistance);
	};

	#overviewPosition() {
		const earth = this.#earthSystem.position;
		const away = earth.clone().normalize();
		const along = new Vector3().crossVectors(UP, away).normalize();
		/** Looks back toward the Sun, which sits ~25° off center behind a lit crescent Earth. */
		return along.multiplyScalar(7).addScaledVector(away, 14).addScaledVector(UP, 3.5).add(earth);
	}

	#placeBodies() {
		const turn = Math.PI * 2;
		const earthAngle = (this.#simTime / EARTH_YEAR) * turn + 0.6;
		this.#earthSystem.position.set(Math.cos(earthAngle) * EARTH_ORBIT, 0, Math.sin(earthAngle) * EARTH_ORBIT);
		this.#earth.rotation.y = (this.#simTime / EARTH_DAY) * turn;
		this.#clouds.rotation.y = this.#earth.rotation.y * 1.04;
		this.#moonPivot.rotation.y = (this.#simTime / MOON_MONTH) * turn;
		const marsAngle = (this.#simTime / MARS_YEAR) * turn + 1.1;
		this.#mars.position.set(Math.cos(marsAngle) * MARS_ORBIT, 1.2, Math.sin(marsAngle) * MARS_ORBIT);
		this.#mars.rotation.y = (this.#simTime / (EARTH_DAY * 1.03)) * turn;
	}

	#start() {
		this.#lastTime = 0;
		void this.#renderer.setAnimationLoop(this.#frame);
	}

	#startDiscovery() {
		this.#signal.visible = false;
		this.#hud.arrow.style.opacity = '0';
		this.#marsOrbit.visible = true;
		this.#revealTime = 0;
		this.discovered = true;
		this.mode = 'discovery';
		const litSide = () => {
			const fromSun = this.#mars.position.clone().normalize();
			const along = new Vector3().crossVectors(UP, fromSun).normalize();
			return this.#mars.position.clone().addScaledVector(fromSun, -3.2).addScaledVector(along, 1.6).addScaledVector(UP, 0.8);
		};
		this.#flyTo(litSide, () => this.#mars.position, 45, 3.2);
	}

	#updateFlight(dt: number) {
		const flight = this.#flight!;
		flight.elapsed += dt;
		const t = easeInOut(Math.min(1, flight.elapsed / flight.duration));
		this.#camera.position.lerpVectors(flight.fromPosition, flight.toPosition(), t);
		this.#camera.fov = flight.fromFov + (flight.toFov - flight.fromFov) * t;
		this.#camera.updateProjectionMatrix();
		this.#camera.lookAt(new Vector3().lerpVectors(flight.fromLook, flight.toLook(), t));
		if (flight.elapsed < flight.duration) return;
		this.#flight = null;
		flight.onEnd();
	}

	#updateObserve(dt: number) {
		this.#yaw -= SKY_DRIFT * dt;
		if (Math.abs(this.#fovGoal - this.#camera.fov) > 1e-3) {
			this.#camera.fov += (this.#fovGoal - this.#camera.fov) * (1 - Math.exp(-dt * ZOOM_EASE));
			this.#camera.updateProjectionMatrix();
		}
		const position = this.#observerPosition();
		this.#camera.position.copy(position);
		this.#camera.lookAt(position.add(this.#direction(this.#yaw, this.#pitch)));

		const signal = this.#signal;
		signal.position.copy(this.#mars.position);
		const distance = signal.position.distanceTo(this.#camera.position);
		const viewHeight = 2 * distance * Math.tan((this.#camera.fov * MathUtils.DEG2RAD) / 2);
		signal.scale.setScalar((viewHeight * SIGNAL_SIZE) / this.#canvas.clientHeight);

		const projected = signal.position.clone().project(this.#camera);
		const behind = projected.z > 1;
		const x = (projected.x * this.#canvas.clientWidth) / 2;
		const y = (-projected.y * this.#canvas.clientHeight) / 2;
		const inside = !behind && Math.hypot(x, y) < RETICLE_RADIUS;
		/** Zooming in resolves faster but makes the drift carry the signal out of the reticle sooner. */
		const rate = 0.1 * (55 / this.#camera.fov);
		this.#progress = inside ? Math.min(1, this.#progress + dt * rate) : Math.max(0, this.#progress - dt * 0.06);
		this.#hud.progress.style.transform = `scaleX(${this.#progress})`;

		const onScreen = !behind && Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.92;
		this.#hud.arrow.style.opacity = inside || onScreen ? '0' : '1';
		if (!onScreen) {
			const angle = Math.atan2(behind ? -y : y, behind ? -x : x);
			const radius = Math.min(this.#canvas.clientWidth, this.#canvas.clientHeight) / 2 - 36;
			this.#hud.arrow.style.transform = `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px) rotate(${angle}rad)`;
		}
		if (this.#progress >= 1) this.#startDiscovery();
	}

	#updateOverview(dt: number) {
		const delta = this.#earthSystem.position.clone().sub(this.#lastEarth);
		this.#camera.position.add(delta);
		this.#controls.target.add(delta);
		this.#lastEarth.copy(this.#earthSystem.position);
		if (this.#distanceGoal !== null) {
			const offset = this.#camera.position.clone().sub(this.#controls.target);
			const distance = offset.length();
			const next = distance + (this.#distanceGoal - distance) * (1 - Math.exp(-dt * ZOOM_EASE));
			this.#camera.position.copy(this.#controls.target).add(offset.setLength(next));
			if (Math.abs(this.#distanceGoal - next) < 1e-3) this.#distanceGoal = null;
		}
		this.#controls.update();
	}

	#updateReveal(dt: number) {
		this.#revealTime += dt;
		const grow = Math.min(1, this.#revealTime / 1.6);
		this.#mars.children[0].scale.setScalar(Math.max(0.001, easeOutBack(grow)));
		this.#marsReveal.value = Math.min(1, Math.max(0, (this.#revealTime - 0.6) / 1.4));
		const flash = Math.max(0, 1 - this.#revealTime / 1.2);
		this.#marsFlash.scale.setScalar(MARS_RADIUS * 9 * flash);
		if (this.#revealTime > 2.2) this.#revealTime = -1;
	}

	#zoom(factor: number) {
		this.#fovGoal = MathUtils.clamp(this.#fovGoal * factor, 12, 70);
	}
}
