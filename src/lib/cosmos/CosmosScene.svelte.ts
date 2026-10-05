import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
	abs,
	asin,
	atan,
	cameraPosition,
	color,
	cos,
	dot,
	exp,
	float,
	fract,
	fwidth,
	instancedBufferAttribute,
	length,
	luminance,
	max,
	mix,
	modelPosition,
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
	step,
	texture,
	time,
	uniform,
	uv,
	vec2,
	vec3,
	vec4,
} from 'three/tsl';
import {
	AdditiveBlending,
	BackSide,
	BufferGeometry,
	DoubleSide,
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
	NodeUpdateType,
	type Node,
	NoColorSpace,
	type Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	PointsNodeMaterial,
	RenderPipeline,
	RenderTarget,
	RepeatWrapping,
	RingGeometry,
	Scene,
	SphereGeometry,
	Sprite,
	SpriteNodeMaterial,
	SRGBColorSpace,
	type Texture,
	TextureLoader,
	Vector3,
	WebGPURenderer,
} from 'three/webgpu';
import { COSMOS_OBJECTS, type CosmosObject, skySight } from '#data/cosmos.js';
import type { BenchOptions } from './CosmosBench.js';

type CosmosMode = 'discovery' | 'intro' | 'observe' | 'overview';
export type CosmosQuality = 'high' | 'low';

interface CosmosHud {
	/** Chevron at the screen edge pointing at the signal while it is outside the reticle. */
	arrow: HTMLElement;
	/** Ring centered on the signal, filled through its `--progress` variable. Written directly because it changes every frame. */
	progress: HTMLElement;
}

interface CosmosOptions {
	/** Ids of the objects already in the sky, the others stay hidden until discovered. */
	discovered: readonly string[];
	/** Object to start on, skipping the intro, so a reload lands back where the player was. */
	focus?: string;
	hud: CosmosHud;
	/** Starting limiting magnitude, see `setLimit`. */
	limit: number;
	/** Surfaces drawn from their shaders instead of their baked maps, to see edits without baking. */
	live?: readonly string[];
	/** Called once the signal is fully resolved, as the object starts condensing. */
	onDiscover: (id: string) => void;
	/** Records the GPU time of every render pass, which the benchmark reads. */
	timestamps?: boolean;
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

/**
 * Real ratios for the planet sizes, the planet orbits and the orbital periods. Moon distances and the Sun are shrunk so all of it
 * fits a screen, the Sun stays a bit larger than Jupiter.
 */
const EARTH_RADIUS = 1.6;
const EARTH_ORBIT = 260;
const SUN_RADIUS = 20;
const STAR_DISTANCE = 1500;
const SKY_DISTANCE = 1800;
/** Seconds per turn, compressed so the system visibly moves without turning days into a blur. */
const EARTH_YEAR = 720;
const EARTH_DAY = 40;
const AXIAL_TILT = 0.41;
/** Objects past the naked eye era are too faint to resolve with a wider field of view, the player has to zoom in on them. */
const REFRACTOR_FOV = 25;
/** Smallest angle between a target and the Sun, closer ones are waited out so the player never observes into the glare. */
const MIN_ELONGATION = 35 * MathUtils.DEG2RAD;
/** Observation zoom range, wider than the default view stretched the sky like a fisheye. */
const FOV_RANGE = [12, 55] as const;
/** Screen radius under which an object still counts as clicked, so far planets stay easy to pick. */
const PICK_RADIUS = 18;
const TURN = Math.PI * 2;
const ORIGIN = new Vector3();
const NOWHERE = new Vector3(1e7, 1e7, 1e7);
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
/** Faint stars past the naked eye's reach, one dot each, they fill in one magnitude at a time past the bright field. */
const FAINT_STAR_COUNT = 14_000;
const FAINT_STAR_MAGNITUDES = [8, 17] as const;
/** Between the stars and the Milky Way dome, so the stars draw over the nebulae. */
const DEEP_SKY_DISTANCE = 1650;

/** Sky direction of a galactic longitude and latitude in degrees, the same frame the Milky Way is drawn in, right-handed like the real one. */
const galactic = (longitude: number, latitude: number) => {
	const [l, b] = [longitude * MathUtils.DEG2RAD, latitude * MathUtils.DEG2RAD];
	return new Vector3(Math.cos(b) * Math.cos(l), Math.sin(b), -Math.cos(b) * Math.sin(l)).applyAxisAngle(GALAXY_AXIS, GALAXY_TILT);
};

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

/** The Earth's day colors, and its masks: land, city lights and ice or snow. */
function earthSurface() {
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
	/** Fine points grouped in urban regions, a high frequency keeps them from reading as flat yellow blobs up close. */
	const urban = smoothstep(0.1, 0.4, mx_fractal_noise_float(surfacePoint.mul(5).add(23), 3, 2, 0.5)).mul(land).mul(invert(ice));
	const cities = smoothstep(0.62, 0.72, mx_noise_float(surfacePoint.mul(180))).mul(urban);
	return { day: mix(mix(ocean, terrain, land), color('#eef3f8'), ice), masks: vec3(land, cities, max(ice, snow)) };
}

/** Lights the baked or live Earth surface: sea glint, night side with city lights, dusk greying and the atmosphere's limb. */
function earthMaterial(surface: Node<'vec3'>, masks: Node<'vec3'>) {
	const [land, cities, frozen] = [masks.x, masks.y, masks.z];
	/** Divided by a clamped length: with the Sun right behind the Earth the sum is near zero and `normalize` returned NaN pixels. */
	const halfwaySum = toSun.add(cameraPosition.sub(positionWorld).normalize());
	const halfway = halfwaySum.div(max(length(halfwaySum), 1e-4));
	const highlight = edge(0.985, dot(normalWorld, halfway), 0.01).mul(invert(land)).mul(0.35);
	const day = surface.mul(smoothstep(-0.1, 0.55, sunFacing).mul(0.7).add(0.3)).add(highlight);
	/**
	 * Day and night are two palettes cross-faded on the Sun angle, like three.js' `webgpu_tsl_earth` example: scaling the day
	 * colors down instead turned green coasts black and sand yellow on the night side.
	 */
	const night = mix(mix(color('#020306'), color('#0e0f12'), land), color('#1f2227'), frozen).add(color('#ffcf73').mul(cities).mul(0.9));
	/** Colors drain toward a neutral grey as the light fades, dim sand and grass otherwise read as a brown-yellow band at dusk. */
	const dusk = mix(color('#8c9099').mul(luminance(day)), day, smoothstep(0, 0.35, sunFacing));
	/** A solar eclipse: the Moon's shadow crosses the day side as a dark spot ringed by its penumbra. */
	const lit = mix(night, dusk.mul(eclipse(['moon'])), smoothstep(-0.2, 0.4, sunFacing));
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

/** Cloud cover, stretched along the latitude so clouds form bands, domain-warped so they curl. */
function cloudCover() {
	const stretched = surfacePoint.mul(vec3(4.5, 8, 4.5));
	const warp = mx_fractal_noise_float(stretched.mul(0.35), 2, 2, 0.5).mul(0.9);
	const cover = mx_fractal_noise_float(stretched.add(warp), 5, 2.1, 0.5);
	return smoothstep(0.06, 0.45, cover).mul(smoothstep(-0.35, 0.2, mx_fractal_noise_float(surfacePoint.mul(1.2).add(31), 2, 2, 0.5)));
}

/** Clouds from their cover map, two drifting reads cross-faded so they slowly reshape instead of sliding as a block. */
function cloudMaterial(cover: (offset: Node<'vec2'>) => Node<'float'>) {
	const phase = sin(time.mul(0.05)).mul(0.5).add(0.5);
	const density = mix(cover(vec2(time.mul(0.0006), 0)), cover(vec2(time.mul(-0.0004), 0.004)), phase);
	const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
	/** A faint moonlit blue on the night side, at the ground's 2-3% floor the clouds vanished there and only showed against the Sun's glow. */
	const night = invert(smoothstep(-0.12, 0.08, sunFacing));
	material.colorNode = color('#ffffff').mul(toon(sunFacing, 0)).add(color('#7d8fb8').mul(night).mul(0.09));
	/** Thinner on the night side, so city lights show through. */
	material.opacityNode = density.mul(smoothstep(-0.3, 0.1, sunFacing).mul(0.45).add(0.4));
	return material;
}

/** Condenses out of the signal's light: starts as a cyan glow and cools down to the surface. */
const condense = (lit: Node<'vec3'>, reveal: Node<'float'>) => mix(color('#8ff5ff').mul(3), lit, reveal);

/** Limb colors on the lit and night sides, and how strong the band is. */
type Rim = readonly [lit: string, night: string, strength: number];
const ICY_RIM: Rim = ['#ffffff', '#26356e', 0.25];

/** Lights a body's albedo with the soft cel shading and its limb, `shade` tints the sunlight (eclipses, Saturn's ring shadow). */
function bodyMaterial(reveal: Node<'float'>, albedo: Node<'vec3'>, [lit, night, strength]: Rim, shade: Node<'vec3'> = vec3(1)) {
	const material = new MeshBasicNodeMaterial();
	material.colorNode = condense(albedo.mul(toon(sunFacing, 0.02)).mul(shade).add(outline(lit, night).mul(strength)), reveal);
	return material;
}

/** World position of every body's center, written each frame, so the shaders can tell where their shadows fall. */
const newCenter = () => uniform(new Vector3());
const centers = new Map<string, ReturnType<typeof newCenter>>();
const centerOf = (id: string) => centers.get(id) ?? centers.set(id, newCenter()).get(id)!;

/**
 * Sunlight left once the shadows of `occluders` are cast: 0 in the umbra, softening toward a penumbra that widens with the shadow's
 * length. The Sun is much bigger than life here, its real angular size keeps the shadows crisp enough to read.
 */
function eclipse(occluders: readonly string[]) {
	/** Past the terminator there is no sunlight left to block, the line through the planet would otherwise print the shadow on its night side. */
	const dayless = invert(smoothstep(-0.2, 0.05, sunFacing));
	return occluders.reduce<Node<'float'>>((light, id) => {
		const radius = id === 'earth' ? EARTH_RADIUS : BODY_LOOKS[id].radius;
		const toOccluder = centerOf(id).sub(positionWorld);
		const along = dot(toOccluder, toSun);
		const miss = length(toOccluder.sub(toSun.mul(along)));
		const soft = along.mul(0.004).add(radius * 0.12);
		const covered = invert(smoothstep(soft.negate().add(radius), soft.add(radius), miss)).mul(smoothstep(0, radius, along));
		return light.mul(invert(covered.mul(0.94)));
	}, float(1)).max(dayless);
}

/** In the Earth's shadow the Moon turns copper: the only light left is sunlight bent and reddened through the Earth's atmosphere. */
const lunarEclipse = () => mix(color('#b4532e').mul(0.45), vec3(1), eclipse(['earth']));

/** Moons and small rocky planets: two flat color areas and worley craters, `craters` sets how many. */
function rockySurface(light: string, dark: string, craters: number, seed: number) {
	const patches = edge(0.12, mx_fractal_noise_float(surfacePoint.mul(1.6).add(seed), 3, 2, 0.5), 0.1);
	const crater = mx_worley_noise_float(surfacePoint.mul(craters).add(seed));
	const floor = invert(edge(0.16, crater, 0.03));
	const lip = edge(0.16, crater, 0.03).mul(invert(edge(0.22, crater, 0.03)));
	return mix(mix(color(light), color(dark), patches), color(dark), floor.mul(0.45)).add(lip.mul(0.06));
}

/** Thick atmospheres: latitude bands bent by turbulence. */
function bandedSurface([light, dark, pale]: readonly [string, string, string], bands: number, turbulence: number) {
	const swirl = mx_fractal_noise_float(surfacePoint.mul(vec3(2, 7, 2)), 3, 2, 0.5).mul(turbulence);
	const latitude = surfacePoint.y.add(swirl);
	const wide = sin(latitude.mul(bands)).mul(0.5).add(0.5);
	const thin = sin(latitude.mul(bands * 2.7).add(1.3)).mul(0.5).add(0.5);
	return mix(mix(color(light), color(dark), edge(0.55, wide, 0.12)), color(pale), edge(0.7, thin, 0.1).mul(0.5));
}

/** Unit vector at a latitude and east longitude in degrees. East runs toward -z, the way the bodies spin. */
const surfaceDirection = (latitude: number, longitude: number) => {
	const [lat, lon] = [latitude * MathUtils.DEG2RAD, longitude * MathUtils.DEG2RAD];
	return vec3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
};

/** Chord from a surface point to a spot, close enough to the angle in radians for the spot sizes used here. */
const angleTo = (latitude: number, longitude: number) => length(surfacePoint.sub(surfaceDirection(latitude, longitude)));

const latitudeDegrees = asin(surfacePoint.y).mul(MathUtils.RAD2DEG);
const longitudeDegrees = atan(surfacePoint.z.negate(), surfacePoint.x).mul(MathUtils.RAD2DEG);

type Spot = readonly [latitude: number, longitude: number, radiusDegrees: number];

/** Coverage of soft round spots, `wobble` (around -0.5..0.5) roughens their edges so they don't read as perfect circles. */
const spots = (list: readonly Spot[], wobble: Node<'float'>) =>
	list.reduce<Node<'float'>>((cover, [latitude, longitude, radius]) => {
		const size = radius * MathUtils.DEG2RAD;
		return max(cover, invert(smoothstep(size * 0.7, size * 1.1, angleTo(latitude, longitude).add(wobble.mul(size)))));
	}, float(0));

/** The near side's seas at their real places, the Moon is tidally locked so the same "face" always looks at the Earth. */
const MARIA: Spot[] = [
	[32.8, -15.6, 17],
	[28, 17.5, 10],
	[8.5, 31.4, 12],
	[13.3, 3.6, 5],
	[17, 59, 8],
	[-7.8, 51.3, 11],
	[-15, 35, 6],
	[-21, -16.6, 10],
	[-24, -39, 6],
	[-5, -22, 7],
	[20, -55, 16],
	[2, -60, 13],
	[-12, -46, 9],
	[56, -22, 6],
	[57, 0, 6],
	[55, 22, 6],
];

/** Bright young craters whose rays streak across the near side: Tycho, Copernicus, Kepler. */
const RAY_CRATERS: Spot[] = [
	[-43.3, -11.2, 50],
	[9.6, -20, 26],
	[8.1, -38, 18],
];

function moonSurface() {
	const wobble = mx_fractal_noise_float(surfacePoint.mul(6), 2, 2, 0.5);
	const maria = spots(MARIA, wobble);
	const highlands = mix(color('#cbc6bd'), color('#bcb7ae'), edge(0.1, mx_fractal_noise_float(surfacePoint.mul(3).add(7), 3, 2, 0.5), 0.25));
	const crater = mx_worley_noise_float(surfacePoint.mul(9).add(3));
	/** The seas are younger lava plains, with far fewer craters than the highlands. */
	const pits = invert(edge(0.13, crater, 0.03)).mul(invert(maria).mul(0.7).add(0.3));
	/** Rays are noise read along the direction away from each crater, so they streak out radially and fade with distance. */
	const rays = RAY_CRATERS.reduce<Node<'float'>>((glow, [latitude, longitude, reach]) => {
		const away = surfacePoint.sub(surfaceDirection(latitude, longitude));
		const distance = length(away);
		const streaks = smoothstep(0.25, 0.6, mx_noise_float(away.div(max(distance, 1e-4)).mul(9).add(latitude)));
		const fade = invert(smoothstep(0.02, reach * MathUtils.DEG2RAD, distance));
		return max(glow, max(streaks.mul(fade).mul(0.55), invert(smoothstep(0.025, 0.04, distance))));
	}, float(0));
	return mix(mix(highlands, color('#77746f'), maria.mul(0.9)), color('#8f8b85'), pits.mul(0.4)).add(rays.mul(0.22));
}

/** Olympus Mons and the three Tharsis Montes, a bit wider than life so they read as dots from afar. */
const THARSIS_VOLCANOES: Spot[] = [
	[18.65, 226.2, 6.5],
	[-8.26, 239.9, 4.2],
	[1.48, 247, 4],
	[11.92, 255.9, 4.4],
];

/** Dark plains seen through telescopes since the 1600s: Syrtis Major, Acidalia, Mare Erythraeum and the southern seas. */
const MARS_DARK: Spot[] = [
	[8.4, 69.5, 10],
	[46.7, 338, 12],
	[-25, 305, 14],
	[-28, 170, 14],
	[-20, 130, 12],
	[-30, 20, 12],
];

function marsSurface() {
	const wobble = mx_fractal_noise_float(surfacePoint.mul(5).add(9), 2, 2, 0.5);
	const terrain = mx_fractal_noise_float(surfacePoint.mul(2).add(5), 3, 2, 0.5);
	const dark = max(spots(MARS_DARK, wobble.mul(1.5)), edge(0.3, mx_fractal_noise_float(surfacePoint.mul(1.3).add(17), 2, 2, 0.5), 0.18));
	const tharsis = invert(smoothstep(0.2, 0.55, angleTo(0, 248)));
	const hellas = angleTo(-42.4, 70.5).add(wobble.mul(0.05));
	const basin = invert(smoothstep(0.24, 0.3, hellas));
	const basinRim = invert(smoothstep(0.02, 0.06, abs(hellas.sub(0.31))));
	/** Valles Marineris: a 4000 km rift east of the volcanoes, widest in the middle and tapering at both ends, with a northern branch. */
	const along = longitudeDegrees.add(98).div(56);
	const taper = smoothstep(0, 0.15, along).mul(invert(smoothstep(0.85, 1, along)));
	const rift = latitudeDegrees.add(9).add(sin(along.mul(Math.PI)).mul(4)).add(mx_noise_float(surfacePoint.mul(14)).mul(0.6));
	const canyon = max(
		invert(smoothstep(taper.mul(1.2), taper.mul(2).add(1e-3), abs(rift))),
		invert(smoothstep(taper.mul(0.5), taper.mul(1).add(1e-3), abs(rift.sub(3.2)))).mul(smoothstep(0.2, 0.3, along)).mul(invert(smoothstep(0.45, 0.55, along))),
	);
	/** Noctis Labyrinthus, the maze of crossing troughs at the rift's western end. */
	const labyrinth = invert(smoothstep(0.03, 0.07, abs(mx_noise_float(surfacePoint.mul(28))))).mul(invert(smoothstep(0.04, 0.09, angleTo(-7, 255))));
	const volcano = THARSIS_VOLCANOES.reduce<Node<'vec3'>>(
		(shading, [latitude, longitude, radius]) => {
			const size = radius * MathUtils.DEG2RAD;
			const distance = angleTo(latitude, longitude).div(size);
			const dome = invert(smoothstep(0.3, 1.05, distance));
			const scarp = invert(smoothstep(0.08, 0.25, abs(distance.sub(0.95))));
			const caldera = invert(smoothstep(0.08, 0.2, distance));
			return vec3(max(shading.x, dome), max(shading.y, scarp), max(shading.z, caldera));
		},
		vec3(0, 0, 0),
	);
	/** Every feature is a gentle shift of the same rust palette, Mars reads as one soft ochre world rather than a patchwork. */
	const ground = mix(mix(color('#c4633b'), color('#d4784b'), edge(0.05, terrain, 0.15)), color('#a55031'), dark.mul(invert(tharsis)).mul(0.55));
	const relief = mix(mix(ground, color('#d8835a'), tharsis.mul(0.25)), color('#d99470'), basin.mul(0.3)).mul(invert(basinRim.mul(0.06)));
	const carved = mix(mix(relief, color('#9a4529'), max(canyon, labyrinth.mul(0.4)).mul(0.6)), color('#dc8c60'), volcano.x.mul(0.45));
	const surface = mix(mix(carved, color('#b45a37'), volcano.y.mul(0.2)), color('#94442a'), volcano.z.mul(0.5));
	return mix(surface, color('#f6eee6'), edge(0.9, abs(surfacePoint.y), 0.02));
}

/** Belts at their real latitudes as [sine of latitude, half width, strength]: north and south equatorial, north and south temperate. */
const JUPITER_BELTS = [
	[0.215, 0.095, 1],
	[0.465, 0.05, 0.6],
	[-0.23, 0.11, 1],
	[-0.505, 0.05, 0.6],
] as const;
/** The Great Red Spot sits on the southern edge of the South Equatorial Belt, about 22°S. */
const RED_SPOT_LATITUDE = -22 * MathUtils.DEG2RAD;

function jupiterSurface() {
	const swirl = mx_fractal_noise_float(surfacePoint.mul(vec3(2, 9, 2)), 3, 2, 0.5);
	const latitude = surfacePoint.y.add(swirl.mul(0.025));
	const belts = JUPITER_BELTS.reduce<Node<'float'>>(
		(cover, [center, half, strength]) => max(cover, invert(smoothstep(half - 0.02, half + 0.02, abs(latitude.sub(center)))).mul(strength)),
		float(0),
	);
	const streaks = mx_noise_float(surfacePoint.mul(vec3(3, 40, 3)).add(swirl)).mul(0.5).add(0.5);
	const zones = mix(color('#f1e4c8'), color('#e8c99c'), invert(smoothstep(0.05, 0.11, abs(latitude))));
	const banded = mix(mix(zones, mix(color('#a46c45'), color('#c08a5e'), streaks), belts), color('#9c8c80'), smoothstep(0.62, 0.85, abs(latitude)).mul(0.7));
	/** An oval in longitude and latitude, ringed by the pale "hollow" it carves in the belt, its swirl turns counterclockwise. */
	const offset = vec2(atan(surfacePoint.z.negate(), surfacePoint.x).mul(Math.cos(RED_SPOT_LATITUDE)).div(0.13), asin(surfacePoint.y).sub(RED_SPOT_LATITUDE).div(0.075));
	const spot = length(offset);
	const spiral = sin(atan(offset.y, offset.x).add(spot.mul(5))).mul(0.5).add(0.5);
	const hollow = invert(smoothstep(0.1, 0.25, abs(spot.sub(1.15))));
	const core = invert(smoothstep(0.75, 0.95, spot));
	/** Dimmed under the bloom threshold, the pale zones otherwise blurred the disc. */
	return mix(mix(banded, color('#f3e8d4'), hollow.mul(0.85)), mix(color('#bf5a3a'), color('#dc8a62'), spiral.mul(spot)), core).mul(0.9);
}

/** Io has no impact craters, its volcanoes repave it: sulfur plains with faint green patches, dark calderas and Pele's great red ring. */
function ioSurface() {
	const flows = mx_fractal_noise_float(surfacePoint.mul(3).add(23), 3, 2, 0.5);
	const greens = edge(0.25, mx_fractal_noise_float(surfacePoint.mul(2.2).add(61), 2, 2, 0.5), 0.15);
	const sulfur = mix(mix(color('#e4cf6c'), color('#ede2ad'), edge(0.15, flows, 0.2)), color('#d3a04e'), edge(-0.2, flows, 0.2).mul(0.4));
	const plains = mix(sulfur, color('#bfc27a'), greens.mul(0.45));
	const vent = mx_worley_noise_float(surfacePoint.mul(5).add(23));
	const active = smoothstep(-0.3, 0.1, mx_noise_float(surfacePoint.mul(4).add(41)));
	const calderas = invert(edge(0.06, vent, 0.02)).mul(active);
	const halos = invert(smoothstep(0.06, 0.2, vent)).mul(active).mul(0.4);
	const pele = angleTo(-18.7, 104.7);
	const peleRing = invert(smoothstep(0.02, 0.09, abs(pele.sub(0.2)))).mul(0.6);
	const poles = smoothstep(0.55, 0.9, abs(surfacePoint.y));
	const deposits = mix(mix(plains, color('#a8683b'), poles.mul(0.6)), color('#c8552d'), max(halos, peleRing.mul(0.8)));
	return mix(deposits, color('#2e2219'), max(calderas, invert(smoothstep(0.03, 0.05, pele))));
}

/** Europa's young ice shell: almost no craters, crossed by long reddish cracks (lineae) and patches of brown chaos terrain. */
function europaSurface() {
	const ice = mix(color('#d3d6dc'), color('#bfc4cc'), edge(0.1, mx_fractal_noise_float(surfacePoint.mul(2.5).add(29), 3, 2, 0.5), 0.2));
	/**
	 * Sets of bent stripes at scattered angles, cut into segments and confined to their own regions, so they read as broken scratches,
	 * crowded in places and absent in others. Every set mixes the same four noise fields with its own weights: a noise call per set
	 * per mask made the shader heavy enough to time the GPU out.
	 */
	const fields = [0.9, 1.6, 3.5, 4].map((scale, i) => mx_noise_float(surfacePoint.mul(scale).add(29 + i * 17)));
	/** Fixed-seed generator, Europa looks the same on every load. */
	let state = 7;
	const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
	const weighted = (scale = 1) => fields.reduce<Node<'float'>>((sum, field) => sum.add(field.mul((random() * 2 - 1) * scale)), float(0));
	const lineae = Array.from({ length: 14 }, () => {
		const normal = new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
		const across = dot(surfacePoint, vec3(normal.x, normal.y, normal.z)).mul(3 + random() * 6).add(weighted(0.5));
		/** Zero crossings of two incommensurate sines, so the stripes of a set sit at uneven gaps. */
		const wave = sin(across.add(random() * 6)).add(sin(across.mul(1.618).add(random() * 6)).mul(0.7));
		const line = invert(smoothstep(0.03, 0.09, abs(wave)));
		const segments = smoothstep(-0.15, 0.15, weighted());
		const region = smoothstep(0, 0.35, weighted());
		return line.mul(segments).mul(region).mul(0.55 + random() * 0.45);
	}).reduce((all, set) => max(all, set));
	/** Low-frequency regions keep the reddish terrain gathered in a few large provinces instead of scattered blots. */
	const regions = smoothstep(0.05, 0.35, mx_fractal_noise_float(surfacePoint.mul(1.2).add(5), 2, 2, 0.5));
	const tint = regions.mul(mx_fractal_noise_float(surfacePoint.mul(5).add(17), 2, 2, 0.5).mul(0.3).add(0.7));
	/** Dimmed under the bloom threshold, the bright ice otherwise haloed and washed the thin lines out. */
	return mix(mix(ice, color('#d8ab86'), tint.mul(0.55)), color('#b48e7b'), lineae.mul(0.65)).mul(0.88);
}

/**
 * Ring opacity at a distance from Saturn's center in Saturn radii, with the real ring radii: the faint C ring, the dense B ring, the
 * Cassini Division and the A ring split by the Encke Gap. The gaps and the ringlets only show once `detail` resolves them.
 */
function ringDensity(radius: Node<'float'>, detail: Node<'float'>) {
	const band = (from: number, to: number, soft = 0.012) => smoothstep(from - soft, from + soft, radius).mul(invert(smoothstep(to - soft, to + soft, radius)));
	const ringlets = mix(1, mx_noise_float(vec3(radius.mul(70), 0, 0)).mul(0.25).add(0.75), detail);
	const gap = (at: number, width: number) => mix(1, smoothstep(width * 0.5, width, abs(radius.sub(at))), detail);
	const rings = band(1.24, 1.53).mul(0.22).add(band(1.53, 1.95).mul(0.97)).add(band(1.95, 2.03, 0.01).mul(mix(0.6, 0.08, detail))).add(band(2.03, 2.27).mul(0.8));
	return rings.mul(ringlets).mul(gap(2.214, 0.008));
}

/** 1 where the ring's planet, centered on the ring mesh, hides the Sun. */
function planetShadow(planetRadius: number) {
	const toPlanet = modelPosition.sub(positionWorld);
	const along = dot(toPlanet, toSun);
	return smoothstep(0, 1, along).mul(invert(smoothstep(planetRadius * 0.96, planetRadius * 1.04, length(toPlanet.sub(toSun.mul(along))))));
}

/** Uranus' nine rings at their real radii in Uranus radii as [radius, half width], ε last and widest. */
const URANUS_RINGS = [
	[1.637, 0.004],
	[1.652, 0.004],
	[1.666, 0.004],
	[1.75, 0.005],
	[1.786, 0.005],
	[1.846, 0.004],
	[1.863, 0.005],
	[1.89, 0.005],
	[2.001, 0.012],
] as const;

/**
 * Hairlines a few times wider than life, true to size they vanish under a pixel. Below a pixel the line keeps a pixel's width and
 * fades by the same ratio, so it stays as faint as it should without flickering.
 */
function uranusRingMaterial(reveal: Node<'float'>) {
	const radius = length(positionLocal.xy).div(URANUS_RADIUS);
	const pixel = fwidth(radius);
	const rings = URANUS_RINGS.reduce<Node<'float'>>((cover, [at, half]) => {
		const width = max(pixel, half);
		return max(cover, invert(smoothstep(width.mul(0.5), width, abs(radius.sub(at)))).mul(float(half).div(width)));
	}, float(0));
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: DoubleSide, transparent: true });
	/** Darker than coal in truth, lifted to a dim grey so they read against space at all. */
	material.colorNode = condense(color('#a3a9b2').mul(invert(planetShadow(URANUS_RADIUS).mul(0.85))), reveal);
	material.opacityNode = rings.mul(0.85);
	return material;
}

/**
 * Saturn's rings, drawn with the planet from the start as the soft blur Galileo saw. Their discovery is Huygens resolving them: the
 * reveal sharpens the ringlets and the Cassini Division, and the planet's shadow falls across them.
 */
function ringMaterial(reveal: Node<'float'>) {
	const radius = length(positionLocal.xy).div(SATURN_RADIUS);
	const shadow = planetShadow(SATURN_RADIUS);
	const ringlets = mx_noise_float(vec3(radius.mul(70), 0, 0)).mul(0.5).add(0.5);
	/** Water ice, a light grey with a faint warm cast, the dusty C ring darker than the bright B ring. */
	const ice = mix(color('#a9a59d'), color('#e2dfd8'), mix(0.5, ringlets, reveal)).mul(mix(0.7, 1, smoothstep(1.45, 1.6, radius)));
	const lit = ice.mul(0.92).mul(invert(shadow.mul(0.85)));
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: DoubleSide, transparent: true });
	/** Peaks halfway through the reveal, the rings already exist so they flare cyan instead of condensing from it. */
	material.colorNode = mix(lit, color('#8ff5ff').mul(3), reveal.mul(invert(reveal)).mul(4));
	material.opacityNode = ringDensity(radius, reveal).mul(mix(0.75, 1, reveal));
	return material;
}

/**
 * Saturn's haze mutes its bands into soft butterscotch stripes, with a pale equator, a blue-grey north pole and the hexagon: a
 * six-sided jet stream around the north pole at 78°N, with a dark vortex at its center.
 */
function saturnSurface() {
	const swirl = mx_fractal_noise_float(surfacePoint.mul(vec3(2, 12, 2)), 3, 2, 0.5);
	const latitude = surfacePoint.y.add(swirl.mul(0.012));
	const belts = smoothstep(0.35, 0.9, sin(latitude.mul(11).add(0.6)).mul(0.5).add(0.5));
	const fine = sin(latitude.mul(70)).mul(0.5).add(0.5);
	const banded = mix(mix(color('#e2cf9f'), color('#c7a670'), belts.mul(0.55)), color('#d6c095'), fine.mul(0.2));
	const equator = mix(banded, color('#efe1bb'), invert(smoothstep(0.06, 0.16, abs(latitude))));
	const north = smoothstep(0.9, 0.97, surfacePoint.y);
	const poles = mix(mix(equator, color('#b9a37a'), smoothstep(0.75, 0.95, abs(latitude)).mul(0.6)), color('#a3a796'), north.mul(0.55));
	/** Max of the distances along three directions 60° apart traces a hexagon, its sides at cos(78°) from the axis, a smooth max rounds its corners. */
	const polar = surfacePoint.xz;
	const smoothMax = (a: Node<'float'>, b: Node<'float'>, k = 0.05) => {
		const blend = max(float(k).sub(abs(a.sub(b))), 0).div(k);
		return max(a, b).add(blend.mul(blend).mul(k / 4));
	};
	const hexagon = smoothMax(abs(polar.x), smoothMax(abs(polar.x.mul(0.5).add(polar.y.mul(0.866))), abs(polar.x.mul(0.5).sub(polar.y.mul(0.866)))));
	const inside = invert(smoothstep(0.17, 0.23, hexagon)).mul(north);
	const jet = invert(smoothstep(0, 0.04, abs(hexagon.sub(0.208)))).mul(smoothstep(0.9, 0.95, surfacePoint.y));
	const eye = invert(smoothstep(0, 0.06, length(polar))).mul(north);
	/** Kept under the bloom threshold, the pale cream otherwise blurred the whole disc. */
	return mix(mix(mix(poles, color('#8a989b'), inside.mul(0.35)), color('#76858b'), jet.mul(0.3)), color('#5d6a70'), eye.mul(0.5)).mul(0.88);
}

/** Where the rings shade Saturn: the way to the Sun crosses the ring plane inside the rings. */
function ringShadow() {
	const normal = UP.clone().applyAxisAngle(new Vector3(0, 0, 1), SATURN_TILT);
	const ringNormal = vec3(normal.x, normal.y, normal.z);
	const toCenter = modelPosition.sub(positionWorld);
	const distance = dot(toCenter, ringNormal).div(dot(toSun, ringNormal).add(1e-5));
	const crossing = positionWorld.add(toSun.mul(distance)).sub(modelPosition);
	return invert(ringDensity(length(crossing).div(SATURN_RADIUS), float(1)).mul(smoothstep(0, 0.5, distance)).mul(0.65));
}

const GALILEAN_MOONS = ['io', 'europa', 'ganymede', 'callisto'];
/** The Galilean moons go dark each time they pass behind Jupiter, how Rømer first measured the speed of light in 1676. */
const jupiterShadow = () => vec3(eclipse(['jupiter']));
const marsShadow = () => vec3(eclipse(['mars']));

/** Dark grey rock, and the bright salt of Occator crater's faculae, the spots Dawn flew toward in 2015. */
function ceresSurface() {
	const salt = spots(
		[
			[19.8, 239.3, 2.4],
			[20.5, 242.5, 1.2],
		],
		mx_noise_float(surfacePoint.mul(30)).mul(0.5),
	);
	return mix(rockySurface('#8c8780', '#67635d', 8, 53), color('#f4f2ee'), salt);
}

/** Phobos: craters, the long parallel grooves left by debris of old impacts, and Stickney, a crater almost half as wide as the moon. */
function phobosSurface() {
	const stickney = angleTo(-1, -49);
	const floor = invert(smoothstep(0.3, 0.38, stickney));
	const rim = invert(smoothstep(0.02, 0.07, abs(stickney.sub(0.42))));
	const grooves = invert(smoothstep(0.05, 0.3, abs(sin(surfacePoint.y.add(surfacePoint.x.mul(0.3)).mul(40))))).mul(0.2);
	return mix(rockySurface('#857669', '#5e534a', 10, 61).mul(invert(grooves)), color('#4f463e'), floor.mul(0.5)).add(rim.mul(0.08));
}

/** A pink nitrogen frost cap over the south, streaked by the dark plumes of its geysers, and the dimpled "cantaloupe terrain" up north. */
function tritonSurface() {
	const cap = invert(smoothstep(-0.35, -0.05, surfacePoint.y.add(mx_noise_float(surfacePoint.mul(4)).mul(0.1))));
	const dimples = smoothstep(0.08, 0.3, mx_worley_noise_float(surfacePoint.mul(16).add(7)));
	const ground = mix(color('#8f907f'), color('#b4b39f'), dimples);
	const frost = mix(color('#e3cbc2'), color('#f1e2da'), edge(0.1, mx_fractal_noise_float(surfacePoint.mul(3).add(5), 2, 2, 0.5), 0.2));
	/** Short streaks: noise squeezed along one direction, kept only where a second noise allows. */
	const streaks = smoothstep(0.3, 0.55, mx_noise_float(surfacePoint.mul(vec3(28, 5, 5)).add(5))).mul(smoothstep(0, 0.3, mx_noise_float(surfacePoint.mul(6).add(17))));
	return mix(mix(ground, frost, cap), color('#6f5650'), streaks.mul(cap).mul(0.65));
}

/** Pluto as New Horizons saw it in 2015: tan plains, the dark red Cthulhu belt along the equator, the pale heart of Tombaugh Regio. */
const PLUTO_HEART: Spot[] = [
	[25, 177, 16],
	[12, 162, 10],
	[10, 203, 15],
	[28, 197, 10],
];
const CTHULHU: Spot[] = [
	[-5, 20, 20],
	[-12, 55, 22],
	[-15, 95, 18],
	[-8, 130, 12],
	[-20, 345, 14],
];

function plutoSurface() {
	const wobble = mx_fractal_noise_float(surfacePoint.mul(5).add(19), 2, 2, 0.5);
	const tan = mix(color('#c49a74'), color('#d9b994'), edge(0.05, mx_fractal_noise_float(surfacePoint.mul(3).add(41), 3, 2, 0.5), 0.2));
	const north = smoothstep(0.55, 0.85, surfacePoint.y);
	const heart = spots(PLUTO_HEART, wobble);
	/** Sputnik Planitia's nitrogen ice churns in slow convection cells, their edges show as a faint polygon net. */
	const cells = invert(smoothstep(0.02, 0.06, mx_worley_noise_float(surfacePoint.mul(40)))).mul(invert(smoothstep(0.15, 0.3, angleTo(25, 177))));
	const plains = mix(mix(tan, color('#a59a92'), north.mul(0.6)), color('#5a2f22'), spots(CTHULHU, wobble.mul(1.5)).mul(0.85));
	return mix(plains, color('#f1e6d8'), heart).mul(invert(cells.mul(0.12)));
}

/**
 * Neptune as Voyager 2 saw it in 1989: the Great Dark Spot at 22°S edged by bright methane clouds, the small white "Scooter" below
 * it, and the second dark spot with a bright core further south.
 */
function neptuneSurface() {
	const wobble = mx_noise_float(surfacePoint.mul(9).add(27)).mul(0.15);
	/** Oval in arc degrees around a latitude and longitude, its half sizes along and across the latitude line. */
	const oval = (latitude: number, longitude: number, along: number, across: number) => {
		const offset = vec2(longitudeDegrees.sub(longitude).mul(Math.cos(latitude * MathUtils.DEG2RAD)).div(along), latitudeDegrees.sub(latitude).div(across));
		return invert(smoothstep(0.7, 1.05, length(offset).add(wobble)));
	};
	const dark = max(oval(-22, 0, 15, 7.6), oval(-55, -60, 5, 3.5).mul(0.8));
	const white = max(max(oval(-29, -6, 11, 2.2), oval(-42, 40, 5, 2.4)), oval(-55, -60, 1.8, 1.2));
	/** Kept under the bloom threshold, like Saturn's pale zones. */
	return mix(mix(bandedSurface(['#4a7fe6', '#2f58bd', '#6f9cf0'], 3, 0.3), color('#1d3a8c'), dark.mul(0.85)), color('#dbe5ff'), white.mul(0.9));
}

/** Simulation clock for the shaders, the belt's rocks keep pace with the bodies through a warp. */
const simClock = uniform(0);
const BELT_ROCKS = 2400;
/** Kirkwood gaps as [AU, half width]: Jupiter's pull clears out the orbits that resonate with its own, 3:1, 5:2 and 7:3. */
const KIRKWOOD_GAPS = [
	[2.5, 0.035],
	[2.82, 0.025],
	[2.95, 0.02],
] as const;

/** Thousands of rocks on their own Kepler orbits, the inner ones faster, between 2.1 AU and the 2:1 resonance at 3.27 AU. */
function asteroidBelt(reveal: Node<'float'>) {
	const orbits = new Float32Array(BELT_ROCKS * 4);
	for (let i = 0; i < BELT_ROCKS; ) {
		const au = 2.1 + Math.random() * 1.17;
		if (KIRKWOOD_GAPS.some(([at, half]) => Math.abs(au - at) < half)) continue;
		orbits.set([au, Math.random() * TURN, (Math.random() + Math.random()) * 0.12, Math.random() * TURN], i++ * 4);
	}
	const orbit = instancedBufferAttribute<'vec4'>(new InstancedBufferAttribute(orbits, 4), 'vec4');
	const radius = orbit.x.mul(EARTH_ORBIT);
	const angle = orbit.y.sub(simClock.div(pow(orbit.x, 1.5).mul(EARTH_YEAR)).mul(TURN));
	const material = new PointsNodeMaterial({ blending: AdditiveBlending, depthWrite: false, sizeAttenuation: false, transparent: true });
	material.positionNode = vec3(cos(angle).mul(radius), sin(angle.sub(orbit.w)).mul(sin(orbit.z)).mul(radius), sin(angle).mul(radius));
	material.sizeNode = float(2);
	material.colorNode = color('#b8a58c').mul(0.5).mul(reveal);
	material.opacityNode = invert(smoothstep(0.2, 0.5, length(uv().sub(0.5))));
	const belt = new Sprite(material);
	belt.count = BELT_ROCKS;
	belt.frustumCulled = false;
	return belt;
}

/** Potato-shaped rock: a sphere stretched to its three axes and dented by a few low waves, too small for its gravity to round it. */
function lumpyGeometry(radius: number, [x, y, z]: readonly [number, number, number], seed: number) {
	const geometry = new SphereGeometry(radius, 48, 32);
	const position = geometry.getAttribute('position');
	const point = new Vector3();
	for (let i = 0; i < position.count; i++) {
		point.fromBufferAttribute(position, i).normalize();
		const lumps = 1 + 0.08 * Math.sin(point.x * 3.1 + seed) * Math.sin(point.y * 2.7 + seed * 2) + 0.05 * Math.sin(point.z * 5.3 + seed * 3);
		position.setXYZ(i, point.x * x * radius * lumps, point.y * y * radius * lumps, point.z * z * radius * lumps);
	}
	geometry.computeVertexNormals();
	return geometry;
}

interface DeepSkyObject {
	/** Position angle of the long axis, in degrees. */
	angle: number;
	/** Glow from the plane's coordinates, -1 to 1 on both axes. */
	draw: (p: Node<'vec2'>) => Node<'vec3'>;
	/** Galactic longitude and latitude in degrees. */
	at: readonly [number, number];
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
		angle: 35,
		at: [121.17, -21.57],
		draw: p => {
			const disc = exp(length(p).mul(-3.2));
			const lanes = max(
				invert(smoothstep(0, 0.05, abs(p.y.sub(0.24).add(p.x.mul(p.x).mul(0.15))))),
				invert(smoothstep(0, 0.04, abs(p.y.sub(0.42).add(p.x.mul(p.x).mul(0.2))))).mul(0.6),
			).mul(invert(smoothstep(0.5, 0.9, abs(p.x))));
			const companions = blob(p, [0.03, -0.55], [3, 1], 30).add(blob(p, [-0.2, 0.8], [3, 1.6], 18).mul(0.7));
			return color('#c9cdf0')
				.mul(disc.mul(0.22).mul(invert(lanes.mul(0.6))))
				.add(color('#ffe0b0').mul(blob(p, [0, 0], [3, 1], 40).mul(0.5).add(companions.mul(0.25))));
		},
		magnitude: 3.4,
		size: [4.2, 1.4],
	},
	{
		/** The Orion Nebula: red hydrogen wings around a green-white core lit by the Trapezium, and the dark bay of the "fish's mouth". */
		angle: 0,
		at: [209.01, -19.38],
		draw: p => {
			const core = blob(p, [0.05, 0.1], [1, 1], 18);
			const bay = invert(smoothstep(0.05, 0.25, length(p.sub(vec2(0.35, 0.3)).mul(vec2(1, 2.2)))));
			return mix(color('#ff6f86'), color('#9ff0dc'), core).mul(cloud(p.mul(vec2(1, 1.2)), 3, 3).add(core).mul(0.32)).mul(invert(bay.mul(0.85)));
		},
		magnitude: 4,
		size: [1.4, 1.4],
	},
	{
		/** The Lagoon Nebula, named after the dark lane of dust that crosses its glow, with the bright Hourglass near its heart. */
		angle: 90,
		at: [6.05, -1.2],
		draw: p => {
			const lane = invert(smoothstep(0.02, 0.12, abs(p.y.add(p.x.mul(0.35)).sub(0.05)))).mul(smoothstep(-0.6, -0.1, p.x)).mul(invert(smoothstep(0.3, 0.7, p.x)));
			return color('#ff7a8c').mul(cloud(p, 2.6, 7).mul(0.3).add(blob(p, [-0.3, 0.05], [2, 1], 14).mul(0.35))).mul(invert(lane.mul(0.8)));
		},
		magnitude: 6,
		size: [1.6, 0.8],
	},
	{
		/** The Eagle Nebula, with the Pillars of Creation: three columns of dust rising into the glow, the left one the tallest. */
		angle: 0,
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
					max(cover, invert(smoothstep(half * 0.6, half, abs(p.x.sub(x).add(p.y.mul(0.15))))).mul(invert(smoothstep(top - 0.08, top, p.y))).mul(smoothstep(-0.7, -0.4, p.y))),
				float(0),
			);
			return mix(color('#ffb36b'), color('#ff7a5c'), saturate(length(p))).mul(cloud(p, 2.4, 11).mul(0.32)).mul(invert(pillars.mul(0.85)));
		},
		magnitude: 6,
		size: [1, 1],
	},
	{
		/** The Crab Nebula, what is left of the supernova of 1054: orange filaments over the blue-white glow of its pulsar's wind. */
		angle: 125,
		at: [184.56, -5.78],
		draw: p => {
			const shell = invert(smoothstep(0.55, 0.95, length(p).add(mx_noise_float(vec3(p.mul(3), 9)).mul(0.15))));
			const filaments = invert(smoothstep(0.02, 0.1, abs(mx_noise_float(vec3(p.mul(7), 5)))));
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
			const inner = invert(smoothstep(0.2, 0.55, radius)).mul(0.08).add(blob(p, [0, 0], [1, 1], 900).mul(0.3));
			return mix(color('#7fe0d0'), color('#ff7062'), smoothstep(0.45, 0.75, radius)).mul(ring.mul(0.5)).add(color('#cfe6ff').mul(inner));
		},
		magnitude: 8.8,
		size: [0.25, 0.2],
	},
];

/** One flat glow per deep-sky object, facing the center of the sky, faded in by the eased limiting magnitude. */
function deepSky(limit: Node<'float'>) {
	const span = (degrees: number) => 2 * DEEP_SKY_DISTANCE * Math.tan((degrees * MathUtils.DEG2RAD) / 2);
	return DEEP_SKY.map(({ angle, at, draw, magnitude, size }) => {
		const p = uv().sub(0.5).mul(2);
		const material = new MeshBasicNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
		material.colorNode = draw(p)
			.mul(invert(smoothstep(0.75, 1, max(abs(p.x), abs(p.y)))))
			.mul(smoothstep(magnitude - 0.3, magnitude + 1.5, limit));
		const mesh = new Mesh(new PlaneGeometry(span(size[0]), span(size[1])), material);
		mesh.position.copy(galactic(...at)).multiplyScalar(DEEP_SKY_DISTANCE);
		mesh.lookAt(ORIGIN);
		mesh.rotateZ(angle * MathUtils.DEG2RAD);
		return { magnitude, mesh };
	});
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
		const inBand = Math.random() < 0.3 + (0.4 * (magnitude - brightest)) / (faintest - brightest);
		const latitude = inBand ? (Math.random() + Math.random() + Math.random() - 1.5) * 9 : Math.asin(Math.random() * 2 - 1) * MathUtils.RAD2DEG;
		const point = galactic(Math.random() * 360, latitude).multiplyScalar(STAR_DISTANCE);
		data.set([point.x, point.y, point.z, magnitude], i * 4);
	}
	const star = instancedBufferAttribute<'vec4'>(new InstancedBufferAttribute(data, 4), 'vec4');
	const material = new PointsNodeMaterial({ blending: AdditiveBlending, depthWrite: false, sizeAttenuation: false, transparent: true });
	material.positionNode = star.xyz;
	material.sizeNode = float(2);
	/** Dimmer the fainter, the brightest of them stay under the faintest of the bright field. */
	const glow = mix(0.45, 0.18, star.w.sub(brightest).div(faintest - brightest));
	material.colorNode = color('#dfe6ff').mul(glow).mul(smoothstep(star.w.sub(0.3), star.w.add(0.7), limit));
	material.opacityNode = invert(smoothstep(0.15, 0.5, length(uv().sub(0.5))));
	const stars = new Sprite(material);
	stars.count = FAINT_STAR_COUNT;
	stars.frustumCulled = false;
	return stars;
}

/** The Sun's granulation flow and convection cells for the bake, as raw masks in the red and green channels. */
const sunMasks = () =>
	vec3(edge(0.1, mx_fractal_noise_float(surfacePoint.mul(2), 3, 2, 0.5), 0.15), invert(edge(0.22, mx_worley_noise_float(surfacePoint.mul(5)), 0.08)), 0);

/** `masks` reads the baked flow and cells, two reads drifting apart in longitude stand in for the live noise moving through the surface. */
function sunMaterial(masks: Texture | null) {
	const [flow, blobs] = masks
		? [texture(masks, uv().add(vec2(time.mul(0.0015), 0))).r, texture(masks, uv().add(vec2(time.mul(-0.002), 0))).g]
		: [
				edge(0.1, mx_fractal_noise_float(surfacePoint.mul(2).add(vec3(0, time.mul(0.04), 0)), 3, 2, 0.5), 0.15),
				invert(edge(0.22, mx_worley_noise_float(surfacePoint.mul(5).add(vec3(time.mul(0.05)))), 0.08)),
			];
	const surface = mix(mix(color('#ffedc2'), color('#fffaea'), flow), color('#ffd78c'), blobs.mul(0.4));
	const material = new MeshBasicNodeMaterial();
	/** Near white with a warm limb, past ~2x the neutral tone mapping washes the disc out, the glow comes from the corona and bloom instead. */
	material.colorNode = mix(surface, color('#ffb470'), smoothstep(0.55, 0.98, fresnel)).mul(1.7);
	return material;
}

/** Cartoon corona: two flat halo rings over a soft glow, drawn on one camera-facing sprite. */
function coronaSprite() {
	const distance = length(uv().sub(0.5)).mul(2);
	const inner = invert(edge(0.7, distance, 0.08)).mul(0.4);
	const outer = invert(edge(0.86, distance, 0.08)).mul(0.1);
	const glow = pow(saturate(invert(distance)), 4).mul(0.55);
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color('#ffd296').mul(inner.add(outer).add(glow));
	const sprite = new Sprite(material);
	sprite.scale.setScalar(SUN_RADIUS * 3.6);
	return sprite;
}

/** Faint Milky Way: a noisy band with dust lanes and a dim warm core, kept well below the stars so space stays dark. */
function milkyWay() {
	const latitude = dot(surfacePoint, vec3(GALAXY_NORMAL.x, GALAXY_NORMAL.y, GALAXY_NORMAL.z));
	const band = exp(latitude.mul(latitude).mul(-48));
	const clouds = mx_fractal_noise_float(surfacePoint.mul(4), 3, 2, 0.5).mul(0.5).add(0.6);
	const dust = smoothstep(0, 0.3, mx_fractal_noise_float(surfacePoint.mul(8).add(4), 3, 2, 0.5)).mul(exp(latitude.mul(latitude).mul(-250)));
	const density = saturate(band.mul(clouds).mul(invert(dust.mul(0.7))));
	const coreGlow = pow(saturate(dot(surfacePoint, vec3(GALAXY_CORE.x, GALAXY_CORE.y, GALAXY_CORE.z))), 10).mul(band);
	return mix(color('#17151f'), color('#3a3447'), density)
		.mul(density)
		.mul(0.36)
		.add(color('#4a4552').mul(coreGlow).mul(0.12));
}

/** The Milky Way rises out of the dark in the second half of the sight. */
function milkyWayDome(albedo: Node<'vec3'>, sight: Node<'float'>) {
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: BackSide });
	material.colorNode = albedo.mul(smoothstep(0.3, 1, sight));
	const sky = new Mesh(new SphereGeometry(SKY_DISTANCE, 64, 32), material);
	sky.renderOrder = -1;
	return sky;
}

/** Stands in for bloom around the Sun: a bright halo hugging the disc and a faint warm wash spreading far past it. */
function sunGlowSprite() {
	const fade = saturate(invert(length(uv().sub(0.5)).mul(2)));
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color('#ffe4b8').mul(pow(fade, 7).mul(0.9)).add(color('#ffc890').mul(pow(fade, 2).mul(0.07)));
	const sprite = new Sprite(material);
	sprite.scale.setScalar(SUN_RADIUS * 12);
	return sprite;
}

function glowSprite(tint: string, falloff: number, strength: number) {
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color(tint).mul(pow(saturate(invert(length(uv().sub(0.5)).mul(2))), falloff)).mul(strength);
	return new Sprite(material);
}

/** Pulsing light on the Earth where an instrument is being built, it rotates with the planet and hides behind it. */
function beaconSprite() {
	const distance = length(uv().sub(0.5)).mul(2);
	const phase = fract(time.mul(0.8));
	const ring = invert(smoothstep(0, 0.1, abs(distance.sub(phase)))).mul(invert(phase));
	const core = pow(saturate(invert(distance)), 8).mul(sin(time.mul(4)).mul(0.4).add(1));
	const material = new SpriteNodeMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true });
	material.colorNode = color('#ffd27a').mul(core.mul(2.5).add(ring));
	const sprite = new Sprite(material);
	sprite.position.setFromSphericalCoords(EARTH_RADIUS * 1.03, 45 * MathUtils.DEG2RAD, 0);
	sprite.scale.setScalar(EARTH_RADIUS * 0.6);
	sprite.visible = false;
	return sprite;
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
/** `sight` runs from 0, only the brightest stars, to 1, the whole field. */
function starField(sight: Node<'float'>) {
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
	/** A star shows once the sight reaches its brightness: the brightest ~8% from the start, the faint majority last. */
	const seen = smoothstep(mix(2.5, 0.7, sight), mix(2.8, 1, sight), star.w);
	material.colorNode = tint.mul(twinkle).mul(star.w.mul(0.3).add(0.35)).mul(seen);
	material.opacityNode = max(disc,ray(offset.x, offset.y).add(ray(offset.y, offset.x)).mul(sparkle));
	const stars = new Sprite(material);
	stars.count = STAR_COUNT;
	stars.frustumCulled = false;
	return stars;
}

/** An ellipse with the Sun at a focus, `perihelion` the angle of its closest point. */
function orbitLine(radius: number, tint: string, opacity: number, eccentricity = 0, perihelion = 0) {
	const points: number[] = [];
	/** The WebGPU renderer has no LineLoop, the last point repeats the first to close the circle. */
	for (let i = 0; i <= 256; i++) {
		const angle = (i / 256) * Math.PI * 2;
		const reach = (radius * (1 - eccentricity ** 2)) / (1 + eccentricity * Math.cos(angle - perihelion));
		points.push(Math.cos(angle) * reach, 0, Math.sin(angle) * reach);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
	return new Line(geometry, new LineBasicNodeMaterial({ color: tint, depthWrite: false, opacity, transparent: true }));
}

interface BodyLook {
	/** `sun`, `earth` or the id of the body it orbits. */
	around: string;
	/** `albedo` is the baked texture or the live `surface`. */
	build: (reveal: Node<'float'>, albedo: Node<'vec3'>) => Mesh;
	distance: number;
	eccentricity?: number;
	/** Orbit tilt in radians, its orbit line is tilted the same way. */
	inclination?: number;
	/** Drawn instead of the orbit line once discovered, centered on the parent. */
	orbit?: (reveal: Node<'float'>) => Object3D;
	/** Seconds per orbit. */
	period: number;
	/** Angle of the closest point of an eccentric orbit. */
	perihelion?: number;
	phase: number;
	/** Frames the discovery close-up, the outer edge for the rings. */
	radius: number;
	/** Drawn as soon as that body is in the sky, before its own discovery: Saturn never shows up without its rings. */
	shownWith?: string;
	/** Seconds per turn on itself, negative for a retrograde spin, 0 for none, `locked` to always show the same face to its parent. */
	spin: number | 'locked';
	/** Albedo from `surfacePoint`, baked into `static/cosmos/<id>.webp`. */
	surface?: () => Node<'vec3'>;
	/** Axial tilt in radians. */
	tilt?: number;
}

const sphere = (radius: number, material: Material, detail = 64) => new Mesh(new SphereGeometry(radius, detail, Math.round(detail * 0.7)), material);
const globe =
	(radius: number, rim: Rim = ICY_RIM, detail = 64, shade?: () => Node<'vec3'>) =>
	(reveal: Node<'float'>, albedo: Node<'vec3'>) =>
		sphere(radius, bodyMaterial(reveal, albedo, rim, shade?.()), detail);
const BANDED_RIM = (pale: string): Rim => [pale, '#3e2a52', 0.4];

/** Back-face shell around a body: a haze fading outward from its limb, on the lit side, hidden until the body is revealed. */
function hazeShell(radius: number, tint: string, reveal: Node<'float'>) {
	const facing = dot(normalWorldGeometry, toSun);
	const shellFresnel = invert(abs(dot(normalView, positionViewDirection)));
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: BackSide, transparent: true });
	material.colorNode = color(tint);
	material.opacityNode = pow(remapClamp(shellFresnel, 0.7, 1, 1, 0), 2).mul(smoothstep(-0.4, 0.8, facing)).mul(reveal).mul(0.75);
	return sphere(radius, material, 48);
}
const planet = (earthRadii: number) => EARTH_RADIUS * earthRadii;
/** Orbits in AU and years scale with the Earth's, so the planets keep their real spacing and pace. */
const solarOrbit = (au: number, years: number, phase: number, inclinationDegrees: number) => ({
	around: 'sun',
	distance: EARTH_ORBIT * au,
	inclination: inclinationDegrees * MathUtils.DEG2RAD,
	period: EARTH_YEAR * years,
	phase,
});
const MARS_RADIUS = planet(0.532);
const JUPITER_RADIUS = planet(11.21);
const SATURN_RADIUS = planet(9.45);
const SATURN_TILT = 0.47;
const RING_INNER = SATURN_RADIUS * 1.24;
const RING_OUTER = SATURN_RADIUS * 2.27;
const URANUS_RADIUS = planet(4.01);
const URANUS_TILT = 97.8 * MathUtils.DEG2RAD;
const NEPTUNE_RADIUS = planet(3.88);

/**
 * Rocks a few dozen km wide, drawn 5 to 25 times larger than life: true to size Phobos would be a speck beside Mars. `axes` stretch
 * them to their real proportions.
 */
const rock =
	(radius: number, axes: readonly [number, number, number], seed: number, shade?: () => Node<'vec3'>) => (reveal: Node<'float'>, albedo: Node<'vec3'>) =>
		new Mesh(lumpyGeometry(radius, axes, seed), bodyMaterial(reveal, albedo, ICY_RIM, shade?.()));
const ASTRAEA_RADIUS = 0.07;
const PHOBOS_RADIUS = 0.06;
const DEIMOS_RADIUS = 0.04;

/**
 * Scene side of the objects in `#data/cosmos.js`. Moon distances are in planet radii and compressed, the Galilean moons keep their
 * 1:2:4 resonance so they visibly race around Jupiter and have to be tracked.
 */
const BODY_LOOKS: Record<string, BodyLook> = {
	/** The signal and the close-up are Astraea, the rock whose find in 1845 opened the flood, its belt fills the gap around it. */
	asteroid_belt: {
		...solarOrbit(2.574, 4.13, 0.7, 5.37),
		build: rock(ASTRAEA_RADIUS, [1.15, 0.9, 0.95], 4),
		orbit: asteroidBelt,
		radius: ASTRAEA_RADIUS * 1.15,
		spin: EARTH_DAY * 0.7,
		surface: () => rockySurface('#9a8f82', '#6f665c', 7, 83),
	},
	callisto: {
		around: 'jupiter',
		build: globe(planet(0.378), ICY_RIM, 64, jupiterShadow),
		distance: JUPITER_RADIUS * 6.4,
		period: 226,
		phase: 4.9,
		radius: planet(0.378),
		spin: 'locked',
		surface: () => rockySurface('#6f675e', '#4a443e', 9, 41),
	},
	/** Its real size, a fifth of the Moon, sharing the belt with the rocks found after it. */
	ceres: {
		...solarOrbit(2.767, 4.6, 2.6, 10.6),
		build: globe(planet(0.0737), ICY_RIM, 48),
		radius: planet(0.0737),
		spin: EARTH_DAY * 0.378,
		surface: ceresSurface,
		tilt: 0.07,
	},
	deimos: {
		around: 'mars',
		build: rock(DEIMOS_RADIUS, [1.17, 0.95, 0.86], 9, marsShadow),
		distance: MARS_RADIUS * 5,
		inclination: 1.8 * MathUtils.DEG2RAD,
		/** 1.23 Mars days, slower than the planet turns, unlike Phobos. */
		period: 51,
		phase: 3,
		radius: DEIMOS_RADIUS * 1.17,
		spin: 'locked',
		surface: () => rockySurface('#b0a394', '#8f8476', 5, 71),
	},
	europa: {
		around: 'jupiter',
		build: globe(planet(0.245), ['#ffffff', '#26356e', 0.15], 64, jupiterShadow),
		distance: JUPITER_RADIUS * 3.6,
		period: 48,
		phase: 1.6,
		radius: planet(0.245),
		spin: 'locked',
		surface: europaSurface,
	},
	ganymede: {
		around: 'jupiter',
		build: globe(planet(0.413), ICY_RIM, 64, jupiterShadow),
		distance: JUPITER_RADIUS * 4.8,
		period: 97,
		phase: 3.3,
		radius: planet(0.413),
		spin: 'locked',
		surface: () => rockySurface('#9c8f80', '#6b6157', 5, 37),
	},
	io: { around: 'jupiter', build: globe(planet(0.286), ICY_RIM, 64, jupiterShadow), distance: JUPITER_RADIUS * 2.6, period: 24, phase: 0, radius: planet(0.286), spin: 'locked', surface: ioSurface },
	jupiter: {
		...solarOrbit(5.203, 11.86, 1.2, 1.3),
		/** The moons' shadows cross its clouds as black dots, a sight small telescopes catch every few days. */
		build: globe(JUPITER_RADIUS, ['#f3e6d0', '#3e2a52', 0.25], 96, () => vec3(eclipse(GALILEAN_MOONS))),
		radius: JUPITER_RADIUS,
		spin: 16,
		surface: jupiterSurface,
		tilt: 0.05,
	},
	mars: {
		...solarOrbit(1.524, 1.88, 1.1, 1.85),
		build: globe(MARS_RADIUS, ['#ffc2a1', '#3e2a52', 0.5], 96),
		radius: MARS_RADIUS,
		spin: EARTH_DAY * 1.03,
		surface: marsSurface,
		tilt: 0.44,
	},
	/** Spins three times for every two orbits, the reason one of its solar days lasts two of its years. */
	mercury: {
		...solarOrbit(0.387, 0.241, 2.1, 7),
		build: globe(planet(0.383)),
		radius: planet(0.383),
		spin: (EARTH_YEAR * 0.241 * 2) / 3,
		surface: () => rockySurface('#a39a90', '#7b736b', 7, 13),
	},
	/** Its orbit is tilted 5°, so it only crosses the Earth's shadow, or casts its own, during the two eclipse seasons of the year. */
	moon: {
		around: 'earth',
		build: globe(planet(0.273), ICY_RIM, 64, lunarEclipse),
		distance: 10,
		inclination: 5.14 * MathUtils.DEG2RAD,
		period: 180,
		phase: 0,
		radius: planet(0.273),
		spin: 'locked',
		surface: moonSurface,
	},
	neptune: {
		...solarOrbit(30.07, 164.8, 5.1, 1.8),
		build: globe(NEPTUNE_RADIUS, BANDED_RIM('#9fbcff'), 80),
		radius: NEPTUNE_RADIUS,
		spin: 11,
		surface: neptuneSurface,
		tilt: 28.3 * MathUtils.DEG2RAD,
	},
	/** Its real distance, at 2.76 Mars radii, and its real pace against the planet's day: it laps Mars three times a day. */
	phobos: {
		around: 'mars',
		build: rock(PHOBOS_RADIUS, [1.2, 0.98, 0.82], 2, marsShadow),
		distance: MARS_RADIUS * 2.76,
		inclination: 1.1 * MathUtils.DEG2RAD,
		period: 13,
		phase: 0.5,
		radius: PHOBOS_RADIUS * 1.2,
		spin: 'locked',
		surface: phobosSurface,
	},
	/**
	 * Its stretched orbit dips inside Neptune's. Like in 1989 it starts at perihelion, a quarter turn from Neptune: the 3:2 resonance
	 * of their years keeps them from ever meeting.
	 */
	pluto: {
		...solarOrbit(39.48, 247.9, 0.39, 17.1),
		build: globe(planet(0.186), ['#ffe9d2', '#3e2a52', 0.3], 64),
		eccentricity: 0.249,
		perihelion: 0.39,
		radius: planet(0.186),
		spin: EARTH_DAY * 6.39,
		surface: plutoSurface,
		tilt: 122.5 * MathUtils.DEG2RAD,
	},
	saturn: {
		...solarOrbit(9.537, 29.46, 0, 2.5),
		build: globe(SATURN_RADIUS, ['#f0e4c4', '#3e2a52', 0.25], 96, () => vec3(ringShadow().mul(eclipse(['titan'])))),
		radius: SATURN_RADIUS,
		spin: 17,
		surface: saturnSurface,
		tilt: SATURN_TILT,
	},
	saturn_rings: {
		around: 'saturn',
		build: reveal => {
			const rings = new Mesh(new RingGeometry(RING_INNER, RING_OUTER, 160, 1), ringMaterial(reveal));
			rings.rotation.x = -Math.PI / 2;
			return rings;
		},
		distance: 0,
		period: 1,
		phase: 0,
		radius: RING_OUTER,
		shownWith: 'saturn',
		spin: 0,
		tilt: SATURN_TILT,
	},
	titan: {
		around: 'saturn',
		/** Its upper haze scatters blue light, a pale blue glow spills past the orange disc. */
		build: (reveal, albedo) => {
			const titan = globe(planet(0.404), ['#a9c8ff', '#2c3f7a', 0.45], 64, () => vec3(eclipse(['saturn'])))(reveal, albedo);
			titan.add(hazeShell(planet(0.404) * 1.05, '#9fc0ff', reveal));
			return titan;
		},
		distance: SATURN_RADIUS * 4.5,
		period: 120,
		phase: 2,
		radius: planet(0.404),
		spin: 'locked',
		surface: () => bandedSurface(['#e0a64a', '#c27f2e', '#ebbd6a'], 3, 0.2),
	},
	/** The only large moon on a backward orbit, tilted 130° to Neptune's path. */
	triton: {
		around: 'neptune',
		build: globe(planet(0.212), ICY_RIM, 64, () => vec3(eclipse(['neptune']))),
		distance: NEPTUNE_RADIUS * 4,
		inclination: 130 * MathUtils.DEG2RAD,
		period: 80,
		phase: 1,
		radius: planet(0.212),
		spin: 'locked',
		surface: tritonSurface,
	},
	/** Rolls on its side: its 98° tilt points one pole at the Sun for decades at a time. */
	uranus: {
		...solarOrbit(19.19, 84.01, 3.2, 0.8),
		build: globe(URANUS_RADIUS, BANDED_RIM('#d6f6f8'), 80),
		radius: URANUS_RADIUS,
		spin: -12,
		surface: () => bandedSurface(['#a8e2e8', '#8ccfd8', '#c4eef1'], 2, 0.08),
		tilt: URANUS_TILT,
	},
	/** In the planet's equator like Saturn's, so they stand on edge along with it. */
	uranus_rings: {
		around: 'uranus',
		build: reveal => {
			const rings = new Mesh(new RingGeometry(URANUS_RADIUS * 1.6, URANUS_RADIUS * 2.03, 192, 1), uranusRingMaterial(reveal));
			rings.rotation.x = -Math.PI / 2;
			return rings;
		},
		distance: 0,
		period: 1,
		phase: 0,
		radius: URANUS_RADIUS * 2.03,
		spin: 0,
		tilt: URANUS_TILT,
	},
	venus: {
		...solarOrbit(0.723, 0.615, 4, 3.4),
		build: globe(planet(0.949), BANDED_RIM('#f7ecc8'), 80),
		radius: planet(0.949),
		spin: -600,
		surface: () => bandedSurface(['#f0dca0', '#d9b877', '#f7ecc8'], 4, 0.3),
	},
};

/** Linear to sRGB, the exact piecewise curve an sRGB texture decodes. */
const encodeSrgb = (linear: Node<'vec3'>) => mix(linear.mul(12.92), pow(linear, vec3(1 / 2.4)).mul(1.055).sub(0.055), step(0.0031308, linear));

/** Every baked surface with its texture width (the height is half): the bodies, the Earth's day colors, masks and clouds, the Sun and the sky. */
export const BAKED_SURFACES: Record<string, { lossless?: boolean; node: () => Node<'vec3'>; width: number }> = {
	clouds: { node: () => vec3(cloudCover()), width: 2048 },
	earth: { node: () => earthSurface().day, width: 2048 },
	earth_masks: { node: () => earthSurface().masks, width: 2048 },
	/** Lossy WebP cut the faint gradients of the Milky Way into visible square blocks. */
	sky: { lossless: true, node: milkyWay, width: 1024 },
	sun: { node: sunMasks, width: 1024 },
	...Object.fromEntries(Object.entries(BODY_LOOKS).flatMap(([id, { surface }]) => (surface ? [[id, { node: surface, width: 1024 }]] : []))),
};

/** Masks and covers stored as raw data, the color maps are sRGB. */
const RAW_SURFACES = new Set(['clouds', 'earth_masks', 'sun']);

/**
 * Loads every baked surface, the ones in `live` are left out and drawn from their shaders instead. A missing file (a body added
 * since the last bake) falls back to its shader too.
 */
async function loadSurfaces(live: readonly string[]) {
	const loader = new TextureLoader();
	const entries = await Promise.all(
		Object.keys(BAKED_SURFACES)
			.filter(id => !live.includes(id))
			.map(id =>
				loader.loadAsync(`/cosmos/${id}.webp`).then(
					map => {
						map.colorSpace = RAW_SURFACES.has(id) ? NoColorSpace : SRGBColorSpace;
						map.wrapS = RepeatWrapping;
						map.anisotropy = 4;
						return [id, map] as const;
					},
					() => null,
				),
			),
	);
	return new Map(entries.filter(entry => entry !== null));
}

/** One discoverable object: hidden until discovered, then grown out of the signal's flash. */
class Body {
	readonly flash = glowSprite('#8ff5ff', 3, 2.5);
	readonly group = new Group();
	readonly mesh: Mesh;
	readonly orbit: Object3D | null;
	readonly reveal = uniform(0);
	/** Seconds since the discovery started, -1 when not condensing. */
	revealTime = -1;
	#discovering = false;
	#grows = false;

	constructor(
		readonly object: CosmosObject,
		readonly look: BodyLook,
		public discovered: boolean,
		shown: boolean,
		albedo: Node<'vec3'>,
	) {
		this.mesh = look.build(this.reveal, albedo);
		this.group.rotation.z = look.tilt ?? 0;
		this.group.add(this.mesh, this.flash);
		this.group.visible = shown;
		this.flash.scale.setScalar(0);
		this.reveal.value = discovered ? 1 : 0;
		if (!shown) this.mesh.scale.setScalar(0.001);
		const line = () => {
			const orbit = orbitLine(look.distance, object.color, look.around === 'sun' ? 0.18 : 0.12, look.eccentricity, look.perihelion);
			orbit.rotation.x = look.inclination ?? 0;
			return orbit;
		};
		this.orbit = look.orbit ? look.orbit(this.reveal) : look.distance > 0 ? line() : null;
		if (this.orbit) this.orbit.visible = discovered;
	}

	/** Orbits run counterclockwise seen from the north, like the real Solar System. */
	place(parent: Vector3, time: number) {
		const { distance, eccentricity = 0, inclination = 0, perihelion = 0, period, phase, spin } = this.look;
		let angle = phase - (time / period) * TURN;
		let reach = distance;
		if (eccentricity) {
			/** Kepler's equation by Newton's method, from the mean anomaly counted along the motion: fast near the Sun, slow far out. */
			const mean = perihelion - angle;
			let eccentric = mean;
			for (let i = 0; i < 4; i++) eccentric -= (eccentric - eccentricity * Math.sin(eccentric) - mean) / (1 - eccentricity * Math.cos(eccentric));
			angle = perihelion - 2 * Math.atan2(Math.sqrt(1 + eccentricity) * Math.sin(eccentric / 2), Math.sqrt(1 - eccentricity) * Math.cos(eccentric / 2));
			reach = distance * (1 - eccentricity * Math.cos(eccentric));
		}
		const along = Math.sin(angle) * reach;
		this.group.position.set(Math.cos(angle) * reach, -along * Math.sin(inclination), along * Math.cos(inclination)).add(parent);
		/** Turns the local +x axis, where the maps put longitude 0, toward the parent. */
		if (spin === 'locked') this.mesh.rotation.y = Math.PI - angle;
		else if (spin) this.mesh.rotation.y = (time / spin) * TURN;
		this.orbit?.position.copy(parent);
		/** A body not in the sky yet casts no shadow. */
		centerOf(this.object.id).value.copy(this.group.visible ? this.group.position : NOWHERE);
	}

	/** `discovering` false only grows a `shownWith` companion in alongside its parent, it stays undiscovered. */
	startReveal(discovering = true) {
		this.#grows = !this.group.visible;
		this.#discovering = discovering;
		this.discovered ||= discovering;
		this.group.visible = true;
		if (this.orbit && discovering) this.orbit.visible = true;
		this.revealTime = 0;
	}

	/** Grows with an overshoot while the flash fades, then cools from the signal's cyan to its own colors. */
	updateReveal(dt: number) {
		this.revealTime += dt;
		const t = this.revealTime;
		if (this.#grows) this.mesh.scale.setScalar(Math.max(0.001, easeOutBack(Math.min(1, t / 1.6))));
		if (this.#discovering) {
			this.reveal.value = MathUtils.clamp((t - 0.6) / 1.4, 0, 1);
			this.flash.scale.setScalar(this.look.radius * 9 * Math.max(0, 1 - t / 1.2));
		}
		if (t > 2.2) this.revealTime = -1;
	}
}

/** Rendering switches the benchmark compares, `DEFAULT_TUNING` is what players get. */
export interface CosmosTuning {
	/** Size of the bloom buffers against the canvas, 0 turns bloom off. */
	bloom: number;
	/** Bloom is redrawn every that many frames and reused in between, its passes cost far more CPU time than the scene's objects. */
	bloomEvery: number;
	/** The overview renders at 30 fps while the player isn't touching it. */
	idleCap: boolean;
	pixelRatio: number;
}

const DEFAULT_TUNING: CosmosTuning = { bloom: 0.5, bloomEvery: 2, idleCap: true, pixelRatio: 1.5 };

export type BenchScenario = 'home' | 'jupiter' | 'saturn' | 'sky' | 'sun' | 'system';

/** OrbitControls' damping keeps the view moving for about this long after the last input. */
const INPUT_SETTLE = 1500;
const IDLE_FRAME = 1000 / 30;

/**
 * The sky of the Cosmos realm around the Earth: an observation mode where the player keeps a signal inside the telescope reticle,
 * then the discovered object condenses out of it and stays in the system.
 * @example const scene = await CosmosScene.create(canvas, { discovered: ['moon'], hud: { arrow, progress }, onDiscover });
 */
export class CosmosScene {
	backend = $state('');
	/** The signal is in the reticle but needs a narrower field of view to resolve. */
	faint = $state(false);
	/** Object the camera orbits and follows. */
	focused = $state('earth');
	fps = $state(0);
	/** Object under the mouse in the overview, for its tooltip. */
	hovered = $state<string | null>(null);
	mode = $state<CosmosMode>('intro');
	quality = $state<CosmosQuality>('high');
	/** Id of the object of the last discovery, shown by the discovery card. */
	revealed = $state<string | null>(null);
	/** Object whose info panel is open, the view clears it to close the panel. */
	selected = $state<string | null>(null);

	readonly #beacon = beaconSprite();
	readonly #atmosphere = new Mesh(new SphereGeometry(EARTH_RADIUS * 1.04, 96, 64), atmosphereMaterial());
	readonly #bodies = new Map<string, Body>();
	readonly #corona = coronaSprite();
	readonly #sunGlow = sunGlowSprite();
	readonly #camera = new PerspectiveCamera(50, 1, 0.05, 8000);
	readonly #canvas: HTMLCanvasElement;
	readonly #controls: OrbitControls;
	readonly #earth: Mesh;
	readonly #earthSystem = new Group();
	readonly #hud: CosmosHud;
	readonly #onDiscover: (id: string) => void;
	readonly #pipeline: RenderPipeline;
	readonly #pointers = new Map<number, { x: number; y: number }>();
	readonly #renderer: WebGPURenderer;
	readonly #resize: ResizeObserver;
	readonly #scene = new Scene();
	readonly #signal = signalSprite();
	readonly #sky: Mesh;
	/** Limiting magnitude, eased toward `#limitGoal` so a wider aperture visibly fills the sky with stars. */
	readonly #limit = uniform(0);
	#limitGoal = 0;
	/** Share of the bright field and Milky Way shown at the eased limit, see `skySight`. */
	readonly #sight = uniform(0);
	readonly #stars = starField(this.#sight);
	readonly #faintStars = faintStars(this.#limit);
	readonly #deepSky = deepSky(this.#limit);
	readonly #deepSkyGroup = new Group().add(...this.#deepSky.map(({ mesh }) => mesh));

	readonly #withBloom: Node;
	readonly #withoutBloom: Node;

	readonly #bloom: ReturnType<typeof bloom>;
	readonly #clouds: Mesh;
	/** The benchmark or a freeze owns the loop, a tab coming back to the foreground must not restart it. */
	#held = false;
	#lastInput = 0;
	#lastRender = 0;
	#renders = 0;
	#tuning: CosmosTuning = { ...DEFAULT_TUNING, pixelRatio: Math.min(devicePixelRatio, DEFAULT_TUNING.pixelRatio) };
	/** Wheel zoom eases toward these goals every frame instead of jumping a whole step per notch. */
	#distanceGoal: number | null = null;
	#flight: Flight | null = null;
	#fovGoal = 55;
	#fpsFrames = 0;
	#fpsTime = 0;
	#lastFocus = new Vector3();
	#lastTime = 0;
	#paused = false;
	#pitch = 0;
	/** Where a pointer went down outside observation, a release close to it is a click. */
	#press: { x: number; y: number } | null = null;
	#progress = 0;
	#qualityProbe = { frames: 0, time: 0 };
	/** The discovered body condensing, plus the companions growing in with it. */
	#revealing: Body[] = [];
	#simTime = 0;
	#target: Body | null = null;
	/** Sky clock fast-forward played during a flight, it carries a target out of the Sun's glare. */
	#warp: { from: number; to: number } | null = null;
	#yaw = 0;

	private constructor(canvas: HTMLCanvasElement, renderer: WebGPURenderer, { discovered, focus, hud, limit, onDiscover }: CosmosOptions, maps: Map<string, Texture>) {
		this.#limit.value = this.#limitGoal = limit;
		this.#sight.value = skySight(limit);
		this.#showSkyDepth();
		/** A baked map is a single texture read, its live shader stacks dozens of noise octaves that take seconds to compile. */
		const albedo = (id: string) => {
			const map = maps.get(id);
			return map ? texture(map).rgb : BAKED_SURFACES[id].node();
		};
		const clouds = maps.get('clouds');
		this.#earth = new Mesh(new SphereGeometry(EARTH_RADIUS, 96, 64), earthMaterial(albedo('earth'), albedo('earth_masks')));
		this.#clouds = new Mesh(
			new SphereGeometry(EARTH_RADIUS * 1.015, 96, 64),
			cloudMaterial(offset => (clouds ? texture(clouds, uv().add(offset)).r : cloudCover())),
		);
		this.#canvas = canvas;
		this.#hud = hud;
		this.#onDiscover = onDiscover;
		this.#renderer = renderer;
		this.backend = 'isWebGPUBackend' in renderer.backend ? 'WebGPU' : 'WebGL 2';

		this.#sky = milkyWayDome(albedo('sky'), this.#sight);
		const sun = new Mesh(new SphereGeometry(SUN_RADIUS, 96, 64), sunMaterial(maps.get('sun') ?? null));
		const tilt = new Group();
		tilt.rotation.z = AXIAL_TILT;
		tilt.add(this.#earth, this.#clouds, this.#atmosphere);
		this.#earth.add(this.#beacon);
		this.#earthSystem.add(tilt);
		this.#signal.visible = false;

		this.#scene.add(sun, this.#corona, this.#sunGlow, orbitLine(EARTH_ORBIT, '#6f8cff', 0.12), this.#earthSystem);
		/** In discovery order, so every parent is placed before the moons orbiting it. */
		for (const object of COSMOS_OBJECTS) {
			const look = BODY_LOOKS[object.id];
			if (!look) continue;
			const shown = discovered.includes(object.id) || (look.shownWith !== undefined && discovered.includes(look.shownWith));
			const body = new Body(object, look, discovered.includes(object.id), shown, look.surface ? albedo(object.id) : vec3(0));
			this.#bodies.set(object.id, body);
			this.#scene.add(body.group);
			if (body.orbit) this.#scene.add(body.orbit);
		}
		this.#scene.add(this.#sky, this.#deepSkyGroup, this.#stars, this.#faintStars, this.#signal);

		const sceneColor = pass(this.#scene, this.#camera).getTextureNode('output');
		this.#bloom = bloom(sceneColor, 0.65, 0.3, 1);
		this.#withoutBloom = sceneColor;
		this.#withBloom = sceneColor.add(this.#bloom);
		this.#pipeline = new RenderPipeline(renderer, this.#withBloom);

		this.#controls = new OrbitControls(this.#camera, canvas);
		this.#controls.enableDamping = true;
		this.#controls.enablePan = false;
		this.#controls.minDistance = 3;
		this.#controls.enabled = false;
		this.#fitZoomRange();

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

		if (focus && this.#pickable().includes(focus)) {
			this.#camera.position.copy(this.#viewpoint(focus));
			this.#camera.lookAt(this.#positionOf(focus)!);
			this.#orbit(focus);
			this.mode = 'overview';
		} else this.replayIntro();
	}

	/** Startup phases land in the performance timeline as `cosmos:*` measures, the startup benchmark reads them. */
	static async create(canvas: HTMLCanvasElement, options: CosmosOptions) {
		const start = performance.now();
		const renderer = new WebGPURenderer({ antialias: true, canvas, trackTimestamp: options.timestamps });
		/** Neutral keeps the flat cartoon colors as picked, ACES shifted them toward brown and desaturated the highlights. */
		renderer.toneMapping = NeutralToneMapping;
		renderer.setPixelRatio(Math.min(devicePixelRatio, DEFAULT_TUNING.pixelRatio));
		const [maps] = await Promise.all([
			loadSurfaces(options.live ?? []).finally(() => performance.measure('cosmos:textures', { start })),
			renderer.init().finally(() => performance.measure('cosmos:device', { start })),
		]);
		const building = performance.now();
		const scene = new CosmosScene(canvas, renderer, options, maps);
		const compiling = performance.now();
		scene.#compileHidden();
		performance.measure('cosmos:build', { end: compiling, start: building });
		performance.measure('cosmos:compile', { start: compiling });
		performance.measure('cosmos:ready', { start });
		scene.#start();
		return scene;
	}

	/** Closes the discovery card, the camera keeps orbiting the new object and its info panel opens. */
	continue() {
		if (this.mode !== 'discovery') return;
		this.mode = 'overview';
		this.selected = this.revealed;
	}

	/** Flies to an object and orbits it from then on, `earth` goes back to the home view. */
	focus(id: string) {
		if (this.mode !== 'overview' || !this.#positionOf(id)) return;
		this.selected = id;
		this.#flyTo(() => this.#viewpoint(id), () => this.#positionOf(id)!, 50, 2.2, () => this.#orbit(id));
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

	/**
	 * Renders every surface of `BAKED_SURFACES` into its equirectangular map, as WebP files for `static/cosmos/`. Each vertex of a
	 * sphere is moved to where its UV points in the map, so its fragments evaluate the surface at the matching spot.
	 */
	async bakeSurfaces() {
		const camera = new PerspectiveCamera();
		const sphereGeometry = new SphereGeometry(1, 512, 256);
		const baked: { blob: Blob; id: string }[] = [];
		for (const [id, { lossless, node, width }] of Object.entries(BAKED_SURFACES)) {
			const height = width / 2;
			const target = new RenderTarget(width, height);
			const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false, side: DoubleSide });
			material.vertexNode = vec4(uv().mul(2).sub(1), 0, 1);
			/** Colors are stored in sRGB to keep 8 bits of precision in the darks, masks and cloud cover are raw data. */
			material.colorNode = RAW_SURFACES.has(id) ? node() : encodeSrgb(node());
			const mesh = new Mesh(sphereGeometry, material);
			mesh.frustumCulled = false;
			const scene = new Scene().add(mesh);
			this.#renderer.setRenderTarget(target);
			this.#renderer.render(scene, camera);
			this.#renderer.setRenderTarget(null);
			const pixels = (await this.#renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height)) as Uint8Array;
			const canvas = new OffscreenCanvas(width, height);
			canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
			/** Chrome encodes a WebP at quality 1 losslessly. */
			baked.push({ blob: await canvas.convertToBlob({ quality: lossless ? 1 : 0.9, type: 'image/webp' }), id });
			material.dispose();
			target.dispose();
		}
		sphereGeometry.dispose();
		return baked;
	}

	/** Dev only: times every tuning variant on fixed views with the GPU's timestamps, see `CosmosBench.ts`. Needs `timestamps`. */
	async bench(options?: Partial<BenchOptions>) {
		if (this.mode !== 'overview') throw new Error('The benchmark starts from the overview.');
		const { runBench } = await import('./CosmosBench.js');
		const restore = this.#snapshot();
		this.setQuality('high');
		this.#renderer.setAnimationLoop(null);
		this.#held = true;
		try {
			return await runBench(
				{
					defaults: DEFAULT_TUNING,
					loop: on => (on ? this.#start() : this.#renderer.setAnimationLoop(null)),
					render: () => this.#render(),
					renderer: this.#renderer,
					restore,
					stage: scenario => this.#stage(scenario),
					tune: tuning => this.tune(tuning),
				},
				options,
			);
		} finally {
			this.#held = false;
			restore();
			this.#start();
		}
	}

	/** Dev only: stops on a benchmark view, so screenshots of two variants show the exact same frame. A reload resumes. */
	freeze(scenario: BenchScenario) {
		this.#held = true;
		this.#renderer.setAnimationLoop(null);
		this.#stage(scenario);
		this.#render();
	}

	/** Puts back everything `#stage` and the benchmark's tuning change. */
	#snapshot() {
		const bodies = [...this.#bodies.values()].map(body => ({ body, orbit: body.orbit?.visible ?? false, reveal: body.reveal.value, scale: body.mesh.scale.x, visible: body.group.visible }));
		const { far, fov } = this.#camera;
		const position = this.#camera.position.clone();
		const quaternion = this.#camera.quaternion.clone();
		const [quality, simTime, tuning] = [this.quality, this.#simTime, this.#tuning];
		return () => {
			for (const { body, orbit, reveal, scale, visible } of bodies) {
				body.group.visible = visible;
				body.mesh.scale.setScalar(scale);
				body.reveal.value = reveal;
				if (body.orbit) body.orbit.visible = orbit;
			}
			Object.assign(this.#camera, { far, fov });
			this.#camera.position.copy(position);
			this.#camera.quaternion.copy(quaternion);
			this.#camera.updateProjectionMatrix();
			this.#simTime = simTime;
			this.#placeBodies();
			this.setQuality(quality);
			this.tune(tuning);
		};
	}

	/** Every body in the sky, the clock frozen and the camera on a fixed view, so each variant renders the exact same frame. */
	#stage(scenario: BenchScenario) {
		for (const body of this.#bodies.values()) {
			body.group.visible = true;
			body.mesh.scale.setScalar(1);
			body.reveal.value = 1;
			if (body.orbit) body.orbit.visible = true;
		}
		this.#simTime = 100;
		this.#placeBodies();
		const views: Record<BenchScenario, () => [Vector3, Vector3]> = {
			home: () => [this.#overviewPosition(), this.#earthSystem.position],
			jupiter: () => [this.#viewpoint('jupiter'), this.#positionOf('jupiter')!],
			saturn: () => [this.#viewpoint('saturn'), this.#positionOf('saturn')!],
			sky: () => [this.#observerPosition(), this.#observerPosition().add(GALAXY_CORE)],
			sun: () => [this.#viewpoint('sun'), ORIGIN],
			system: () => [new Vector3(0, 1600, 2600), ORIGIN],
		};
		const [position, look] = views[scenario]();
		this.#camera.fov = 50;
		this.#camera.far = 4 * EARTH_ORBIT * 9.6 + SKY_DISTANCE;
		this.#camera.position.copy(position);
		this.#camera.lookAt(look);
		this.#camera.updateProjectionMatrix();
	}

	/** Moves the camera next to the Earth and hands the view to the player, the signal sits on the object to discover. */
	observe(id: string) {
		const target = this.#bodies.get(id);
		if (!target || target.discovered || this.mode !== 'overview') return;
		this.selected = null;
		this.#target = target;
		this.#warp = { from: this.#simTime, to: this.#clearOfSun(target) };
		/** The starting view is aimed where the target will be once the warp ends, the flight lands looking past it. */
		const aim = () => {
			const toTarget = target.group.position.clone().sub(this.#observerPosition()).normalize();
			return { pitch: Math.asin(toTarget.y) + 0.35, yaw: Math.atan2(toTarget.x, toTarget.z) + 1.1 };
		};
		const look = () => {
			const { pitch, yaw } = aim();
			return this.#observerPosition().add(this.#direction(yaw, pitch));
		};
		this.#flyTo(() => this.#observerPosition(), look, 50, 2.4, () => {
			({ pitch: this.#pitch, yaw: this.#yaw } = aim());
			this.#progress = 0;
			this.#fovGoal = 50;
			this.#signal.visible = true;
			this.mode = 'observe';
			this.#applyGlare();
		});
	}

	/** Canvas pixel position of every object in the sky that is in front of the camera and inside the view. */
	onScreen(): { id: string; x: number; y: number }[] {
		if (this.mode === 'observe' || this.mode === 'intro') return [];
		const { clientHeight, clientWidth } = this.#canvas;
		return this.#pickable().flatMap(id => {
			const projected = this.#positionOf(id)!.clone().project(this.#camera);
			if (projected.z > 1 || Math.abs(projected.x) > 0.95 || Math.abs(projected.y) > 0.95) return [];
			return [{ id, x: ((projected.x + 1) / 2) * clientWidth, y: ((1 - projected.y) / 2) * clientHeight }];
		});
	}

	/** Gives up on the signal and flies back to the home view, the progress is lost. */
	stopObserving() {
		if (this.mode !== 'observe') return;
		this.#target = null;
		this.#signal.visible = false;
		this.#hud.arrow.style.opacity = '0';
		this.#hud.progress.style.opacity = '0';
		this.faint = false;
		this.mode = 'intro';
		this.#applyGlare();
		this.#flyTo(() => this.#overviewPosition(), () => this.#earthSystem.position, 50, 2.4, () => this.#enterOverview());
	}

	replayIntro() {
		const away = this.#overviewPosition().sub(this.#earthSystem.position).normalize();
		this.#camera.position.copy(this.#earthSystem.position).addScaledVector(away, EARTH_RADIUS * 1.35);
		this.#camera.fov = 30;
		this.#camera.lookAt(this.#earthSystem.position);
		this.mode = 'intro';
		this.#flyTo(() => this.#overviewPosition(), () => this.#earthSystem.position, 50, 4.5, () => this.#enterOverview());
	}

	/** Eases the sky toward a limiting magnitude: the bright field and the Milky Way, then the deep-sky objects and the faint stars past them. */
	setLimit(limit: number) {
		this.#limitGoal = limit;
	}

	/** Skips drawing what the eased limit doesn't reach yet. */
	#showSkyDepth() {
		const limit = this.#limit.value;
		for (const { magnitude, mesh } of this.#deepSky) mesh.visible = limit > magnitude - 0.3;
		this.#faintStars.visible = limit > FAINT_STAR_MAGNITUDES[0] - 0.3;
	}

	/** Lights the beacon on the Earth while an instrument is being built. */
	setBuilding(building: boolean) {
		this.#beacon.visible = building;
	}

	/** Low drops bloom, the Milky Way dome, the clouds, the atmosphere shell and the corona, and keeps a quarter of the stars. */
	setQuality(quality: CosmosQuality) {
		const high = quality === 'high';
		this.quality = quality;
		this.#stars.count = high ? STAR_COUNT : STAR_COUNT / 4;
		this.#faintStars.count = high ? FAINT_STAR_COUNT : FAINT_STAR_COUNT / 4;
		for (const object of [this.#atmosphere, this.#clouds, this.#sky]) object.visible = high;
		this.tune({ pixelRatio: high ? Math.min(devicePixelRatio, DEFAULT_TUNING.pixelRatio) : 1 });
	}

	tune(tuning: Partial<CosmosTuning>) {
		this.#tuning = { ...this.#tuning, ...tuning };
		if (this.#tuning.bloom) this.#bloom.setResolutionScale(this.#tuning.bloom);
		this.#renderer.setPixelRatio(this.#tuning.pixelRatio);
		this.#applyGlare();
		this.#fit();
	}

	/** Bloom and the corona, off in low quality and at the eyepiece, where the Sun would dazzle the player hunting a faint signal. */
	#applyGlare() {
		const glare = this.quality === 'high' && this.mode !== 'observe';
		this.#corona.visible = glare;
		this.#sunGlow.visible = glare && !this.#tuning.bloom;
		const output = glare && this.#tuning.bloom > 0 ? this.#withBloom : this.#withoutBloom;
		if (this.#pipeline.outputNode === output) return;
		this.#pipeline.outputNode = output;
		this.#pipeline.needsUpdate = true;
	}

	/**
	 * Earliest sky clock within a year where the target sits far enough from the Sun as seen from the Earth: MIN_ELONGATION, or 90% of
	 * the widest angle an inner planet ever reaches, Mercury never strays past ~23°.
	 */
	#clearOfSun(target: Body) {
		const { around, distance } = target.look;
		const widest = around === 'sun' && distance < EARTH_ORBIT ? Math.asin(distance / EARTH_ORBIT) * 0.9 : Infinity;
		const needed = Math.min(MIN_ELONGATION, widest);
		const now = this.#simTime;
		let clear = now;
		for (let time = now; time < now + EARTH_YEAR; time += 2) {
			this.#simTime = time;
			this.#placeBodies();
			const earth = this.#earthSystem.position;
			if (target.group.position.clone().sub(earth).angleTo(earth.clone().negate()) >= needed) {
				clear = time;
				break;
			}
		}
		this.#simTime = now;
		this.#placeBodies();
		return clear;
	}

	#positionOf(id: string): Vector3 | null {
		if (id === 'sun') return ORIGIN;
		if (id === 'earth') return this.#earthSystem.position;
		return this.#bodies.get(id)?.group.position ?? null;
	}

	#radiusOf(id: string) {
		if (id === 'sun') return SUN_RADIUS;
		if (id === 'earth') return EARTH_RADIUS;
		return this.#bodies.get(id)?.look.radius ?? EARTH_RADIUS;
	}

	/** Lit-side close-up, the Earth keeps its home view and the Sun is framed from the Earth's side. */
	#viewpoint(id: string) {
		if (id === 'earth') return this.#overviewPosition();
		const position = this.#positionOf(id)!;
		const size = this.#radiusOf(id);
		const fromSun = id === 'sun' ? this.#earthSystem.position.clone().normalize().negate() : position.clone().normalize();
		const along = new Vector3().crossVectors(UP, fromSun).normalize();
		return position.clone().addScaledVector(fromSun, -5.6 * size).addScaledVector(along, 2.8 * size).addScaledVector(UP, 1.4 * size);
	}

	/** Hands the camera to the orbit controls around an object, which then carry the camera along its orbit. */
	#orbit(id: string) {
		const position = this.#positionOf(id)!;
		this.focused = id;
		this.#lastFocus.copy(position);
		this.#controls.target.copy(position);
		this.#controls.minDistance = this.#radiusOf(id) * 1.6;
		this.#controls.enabled = true;
		this.#controls.update();
	}

	/** Visible object under the pointer, the smallest one wins where they overlap so a planet stays clickable over its rings. */
	#objectAt(clientX: number, clientY: number): string | null {
		const rect = this.#canvas.getBoundingClientRect();
		const x = clientX - rect.left - rect.width / 2;
		const y = clientY - rect.top - rect.height / 2;
		const halfView = Math.tan((this.#camera.fov * MathUtils.DEG2RAD) / 2);
		let best: { id: string; size: number } | null = null;
		for (const id of this.#pickable()) {
			const position = this.#positionOf(id)!;
			const projected = position.clone().project(this.#camera);
			if (projected.z > 1) continue;
			const size = Math.max(PICK_RADIUS, (this.#radiusOf(id) / (position.distanceTo(this.#camera.position) * halfView)) * (rect.height / 2));
			const hit = Math.hypot(x - (projected.x * rect.width) / 2, y + (projected.y * rect.height) / 2) <= size;
			if (hit && (!best || size < best.size)) best = { id, size };
		}
		return best?.id ?? null;
	}

	/** Discovered objects done condensing, undiscovered rings drawn with Saturn stay out of reach. */
	#pickable() {
		return ['sun', 'earth', ...[...this.#bodies].filter(([, body]) => body.discovered && body.revealTime < 0).map(([id]) => id)];
	}

	/** The farther the discoveries reach from the Sun, the farther the view pulls back, the sky grows with the player's knowledge. */
	#fitZoomRange() {
		const reach = Math.max(
			EARTH_ORBIT,
			...[...this.#bodies.values()].filter(body => body.discovered && body.look.around === 'sun').map(body => body.look.distance * (1 + (body.look.eccentricity ?? 0))),
		);
		this.#controls.maxDistance = reach * 1.8;
		this.#camera.far = reach * 3.6 + SKY_DISTANCE;
		this.#camera.updateProjectionMatrix();
	}

	/**
	 * Renders one frame with every hidden body drawn at a near-zero scale, plus the sky depth the limit doesn't reach yet, so a
	 * discovery or a wider aperture never stalls on compiling a shader.
	 */
	#compileHidden() {
		const hidden = [...this.#bodies.values()].filter(body => !body.group.visible);
		const orbits = [...this.#bodies.values()].flatMap(body => (body.orbit && !body.orbit.visible ? [body.orbit] : []));
		const beacon = this.#beacon.visible;
		const depth = [...this.#deepSky.map(({ mesh }) => mesh), this.#faintStars];
		for (const object of [...hidden.map(body => body.group), ...orbits, ...depth]) object.visible = true;
		this.#beacon.visible = true;
		this.#pipeline.render();
		for (const body of hidden) body.group.visible = false;
		for (const orbit of orbits) orbit.visible = false;
		this.#beacon.visible = beacon;
		this.#showSkyDepth();
	}

	#direction(yaw: number, pitch: number) {
		return new Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
	}

	#enterOverview() {
		this.#orbit('earth');
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
		if (this.#limit.value !== this.#limitGoal) {
			const gap = this.#limitGoal - this.#limit.value;
			this.#limit.value = Math.abs(gap) < 1e-3 ? this.#limitGoal : this.#limit.value + gap * Math.min(1, dt * 1.2);
			this.#sight.value = skySight(this.#limit.value);
			this.#showSkyDepth();
		}

		if (this.#flight) this.#updateFlight(dt);
		else if (this.mode === 'overview' || this.mode === 'discovery') this.#updateOverview(dt);
		else if (this.mode === 'observe') this.#updateObserve(dt);
		if (this.#revealing.length) {
			for (const body of this.#revealing) body.updateReveal(dt);
			this.#revealing = this.#revealing.filter(body => body.revealTime >= 0);
		}

		/** A few ms of slack so a 60 Hz display renders every other frame instead of drifting between one and two. */
		const idle = this.#tuning.idleCap && this.mode === 'overview' && !this.#flight && now - this.#lastInput > INPUT_SETTLE;
		if (!idle || now - this.#lastRender >= IDLE_FRAME - 4) {
			this.#lastRender = now;
			this.#render();
			this.#fpsFrames++;
		}
		this.#measure(dt);
	};

	#render() {
		/** After the camera moved, a frame behind they slid against the planets on every zoom step. */
		for (const backdrop of [this.#stars, this.#faintStars, this.#sky, this.#deepSkyGroup]) backdrop.position.copy(this.#camera.position);
		this.#bloom.updateBeforeType = ++this.#renders % this.#tuning.bloomEvery ? NodeUpdateType.NONE : NodeUpdateType.FRAME;
		this.#pipeline.render();
	}

	/** Counts rendered frames for the FPS readout, and drops to low quality once if the first seconds after the intro run slow. */
	#measure(dt: number) {
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

	/**
	 * Just above the side of the Earth facing the target, the day side for Mercury and Venus, so the Earth stays behind the
	 * observer instead of hiding the target when the search swings around.
	 */
	#observerPosition() {
		const earth = this.#earthSystem.position;
		const toward = this.#target ? this.#target.group.position.clone().sub(earth).normalize() : new Vector3().crossVectors(UP, earth).normalize();
		return toward.multiplyScalar(EARTH_RADIUS * 1.7).addScaledVector(UP, 0.4).add(earth);
	}

	#onPointerDown = (event: PointerEvent) => {
		/** A touch pinch goes through OrbitControls, a pending wheel goal would fight it. */
		this.#distanceGoal = null;
		this.#lastInput = event.timeStamp;
		if (this.mode !== 'observe') {
			this.#press = { x: event.clientX, y: event.clientY };
			return;
		}
		this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
	};

	#onPointerMove = (event: PointerEvent) => {
		if (event.buttons) this.#lastInput = event.timeStamp;
		if (event.pointerType === 'mouse' && !event.buttons) {
			const hovered = this.mode === 'overview' && !this.#flight && event.target === this.#canvas ? this.#objectAt(event.clientX, event.clientY) : null;
			if (hovered !== this.hovered) this.hovered = hovered;
		}
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
		const press = this.#press;
		this.#press = null;
		if (press && !this.#flight && this.mode === 'overview' && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) {
			const id = this.#objectAt(event.clientX, event.clientY);
			if (id) this.focus(id);
		}
	};

	#onVisibility = () => {
		if (this.#held) return;
		if (document.hidden || this.#paused) this.#renderer.setAnimationLoop(null);
		else this.#start();
	};

	/** Stops the render loop while something covers the view, like a modal. */
	setPaused(paused: boolean) {
		if (paused === this.#paused) return;
		this.#paused = paused;
		this.#onVisibility();
	}

	/** Registered on the capture phase so it stops OrbitControls' own wheel handler, which jumps a whole step per notch. */
	#onWheel = (event: WheelEvent) => {
		event.preventDefault();
		event.stopImmediatePropagation();
		this.#lastInput = event.timeStamp;
		const factor = Math.exp(event.deltaY * 0.0008);
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
		const earthAngle = 0.6 - (this.#simTime / EARTH_YEAR) * TURN;
		this.#earthSystem.position.set(Math.cos(earthAngle) * EARTH_ORBIT, 0, Math.sin(earthAngle) * EARTH_ORBIT);
		this.#earth.rotation.y = (this.#simTime / EARTH_DAY) * TURN;
		this.#clouds.rotation.y = this.#earth.rotation.y * 1.04;
		for (const body of this.#bodies.values()) {
			const { around } = body.look;
			const parent = around === 'sun' ? ORIGIN : around === 'earth' ? this.#earthSystem.position : this.#bodies.get(around)!.group.position;
			body.place(parent, this.#simTime);
		}
		centerOf('earth').value.copy(this.#earthSystem.position);
		simClock.value = this.#simTime;
	}

	#start() {
		this.#lastTime = 0;
		void this.#renderer.setAnimationLoop(this.#frame);
	}

	#startDiscovery(body: Body) {
		this.#signal.visible = false;
		this.#hud.arrow.style.opacity = '0';
		this.#hud.progress.style.opacity = '0';
		this.#target = null;
		this.faint = false;
		const { id } = body.object;
		const companions = [...this.#bodies.values()].filter(other => other.look.shownWith === id && !other.group.visible);
		body.startReveal();
		for (const companion of companions) companion.startReveal(false);
		this.#revealing = [body, ...companions];
		this.#fitZoomRange();
		this.revealed = id;
		this.mode = 'discovery';
		this.#applyGlare();
		this.#onDiscover(id);
		this.#flyTo(() => this.#viewpoint(id), () => body.group.position, 50, 3.2, () => this.#orbit(id));
	}

	#updateFlight(dt: number) {
		const flight = this.#flight!;
		flight.elapsed += dt;
		const t = easeInOut(Math.min(1, flight.elapsed / flight.duration));
		if (this.#warp) {
			this.#simTime = this.#warp.from + (this.#warp.to - this.#warp.from) * t;
			if (t >= 1) this.#warp = null;
		}
		this.#camera.position.lerpVectors(flight.fromPosition, flight.toPosition(), t);
		this.#camera.fov = flight.fromFov + (flight.toFov - flight.fromFov) * t;
		this.#camera.updateProjectionMatrix();
		this.#camera.lookAt(new Vector3().lerpVectors(flight.fromLook, flight.toLook(), t));
		if (flight.elapsed < flight.duration) return;
		this.#flight = null;
		flight.onEnd();
	}

	#updateObserve(dt: number) {
		const target = this.#target;
		if (!target) return;
		this.#yaw -= SKY_DRIFT * dt;
		if (Math.abs(this.#fovGoal - this.#camera.fov) > 1e-3) {
			this.#camera.fov += (this.#fovGoal - this.#camera.fov) * (1 - Math.exp(-dt * ZOOM_EASE));
			this.#camera.updateProjectionMatrix();
		}
		const position = this.#observerPosition();
		this.#camera.position.copy(position);
		this.#camera.lookAt(position.add(this.#direction(this.#yaw, this.#pitch)));

		const signal = this.#signal;
		signal.position.copy(target.group.position);
		const distance = signal.position.distanceTo(this.#camera.position);
		const viewHeight = 2 * distance * Math.tan((this.#camera.fov * MathUtils.DEG2RAD) / 2);
		signal.scale.setScalar((viewHeight * SIGNAL_SIZE) / this.#canvas.clientHeight);

		const projected = signal.position.clone().project(this.#camera);
		const behind = projected.z > 1;
		const x = (projected.x * this.#canvas.clientWidth) / 2;
		const y = (-projected.y * this.#canvas.clientHeight) / 2;
		const inside = !behind && Math.hypot(x, y) < RETICLE_RADIUS;
		const faint = inside && target.object.era !== 'naked_eye' && this.#camera.fov > REFRACTOR_FOV;
		if (faint !== this.faint) this.faint = faint;
		/** Zooming in resolves faster but makes the drift carry the signal out of the reticle sooner. */
		const rate = 0.1 * (55 / this.#camera.fov);
		this.#progress = inside && !faint ? Math.min(1, this.#progress + dt * rate) : Math.max(0, this.#progress - dt * 0.06);
		const onScreen = !behind && Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.92;
		const ring = this.#hud.progress.style;
		ring.opacity = onScreen ? '1' : '0';
		ring.transform = `translate(${x}px, ${y}px)`;
		ring.setProperty('--progress', String(this.#progress));
		this.#hud.arrow.style.opacity = inside || onScreen ? '0' : '1';
		if (!onScreen) {
			const angle = Math.atan2(behind ? -y : y, behind ? -x : x);
			const radius = Math.min(this.#canvas.clientWidth, this.#canvas.clientHeight) / 2 - 36;
			this.#hud.arrow.style.transform = `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px) rotate(${angle}rad)`;
		}
		if (this.#progress >= 1) this.#startDiscovery(target);
	}

	#updateOverview(dt: number) {
		const focus = this.#positionOf(this.focused)!;
		const delta = focus.clone().sub(this.#lastFocus);
		this.#camera.position.add(delta);
		this.#controls.target.add(delta);
		this.#lastFocus.copy(focus);
		if (this.#distanceGoal !== null) {
			const offset = this.#camera.position.clone().sub(this.#controls.target);
			const distance = offset.length();
			const next = distance + (this.#distanceGoal - distance) * (1 - Math.exp(-dt * ZOOM_EASE));
			this.#camera.position.copy(this.#controls.target).add(offset.setLength(next));
			if (Math.abs(this.#distanceGoal - next) < 1e-3) this.#distanceGoal = null;
		}
		this.#controls.update();
	}

	#zoom(factor: number) {
		this.#fovGoal = MathUtils.clamp(this.#fovGoal * factor, ...FOV_RANGE);
	}
}
