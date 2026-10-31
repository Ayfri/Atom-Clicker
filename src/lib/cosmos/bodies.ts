import {
	cameraPosition,
	color,
	context,
	cos,
	dot,
	float,
	fwidth,
	highpModelViewMatrix,
	instancedBufferAttribute,
	length,
	max,
	mix,
	modelPosition,
	mx_noise_float,
	normalView,
	normalWorld,
	oneMinus,
	positionLocal,
	positionViewDirection,
	positionWorld,
	pow,
	saturate,
	sin,
	smoothstep,
	step,
	uniform,
	uv,
	vec3,
} from 'three/tsl';
import {
	AdditiveBlending,
	DoubleSide,
	Group,
	InstancedBufferAttribute,
	LatheGeometry,
	Line,
	MathUtils,
	Mesh,
	MeshBasicNodeMaterial,
	type Node,
	type NodeMaterial,
	type Object3D,
	PointsNodeMaterial,
	Quaternion,
	RingGeometry,
	SphereGeometry,
	Sprite,
	Vector2,
	Vector3,
} from 'three/webgpu';
import type { CosmosObject } from '#data/cosmos.js';
import { type Orbit, OrbitLine, orbitNormal, orbitPoint, solarOrbit, startLongitude, trueAnomaly } from './orbits.js';
import { ROCK_SHAPES, type RockShape, rockLumps } from './rockShapes.js';
import { bodyMaterial, centerOf, condense, darkSky, eclipse, type Finish, hazeShell, realism, type Rim, sphere, sunlight, toSun } from './shading.js';
import { EARTH_DAY, EARTH_ORBIT, EARTH_YEAR, ecliptic, RADII, type RoundBody, TURN, UP } from './space.js';
import { glowSprite } from './sprites.js';
import {
	bandedSurface,
	ceresSurface,
	europaSurface,
	ioSurface,
	jupiterSurface,
	marsSurface,
	moonSurface,
	neptuneSurface,
	phobosSurface,
	plutoSurface,
	rockySurface,
	saturnSurface,
	tritonSurface,
} from './surfaces.js';

const SATURN_POLE = ecliptic(79.53, 61.95);
const URANUS_POLE = ecliptic(77.65, -7.72);
const RING_INNER = RADII.saturn * 1.24;
const RING_OUTER = RADII.saturn * 2.27;
/** The Galilean moons at their real spacing, 0.41 times their real distance in Jupiter radii. */
const JOVIAN_SPREAD = 0.41;
const NOWHERE = new Vector3(1e7, 1e7, 1e7);

/** Ring opacity at a distance from Saturn's center in Saturn radii, with the Cassini Division and Encke Gap. Unresolved, one soft band, Galileo's blur. */
function ringDensity(radius: Node<'float'>, resolved: Node<'float'>) {
	const band = (from: number, to: number, soft = 0.012) => smoothstep(from - soft, from + soft, radius).mul(oneMinus(smoothstep(to - soft, to + soft, radius)));
	const ringlets = mx_noise_float(vec3(radius.mul(70), 0, 0)).mul(0.25).add(0.75);
	const gap = smoothstep(0.004, 0.008, radius.sub(2.214).abs());
	const rings = band(1.24, 1.53).mul(0.22).add(band(1.53, 1.95).mul(0.97)).add(band(1.95, 2.03, 0.01).mul(0.08)).add(band(2.03, 2.27).mul(0.8));
	return mix(band(1.4, 2.2, 0.15).mul(0.75), rings.mul(ringlets).mul(gap), resolved);
}

/** 1 where the ring's planet, centered on the ring mesh, hides the Sun. */
function planetShadow(planetRadius: number) {
	const toPlanet = modelPosition.sub(positionWorld);
	const along = dot(toPlanet, toSun);
	return smoothstep(0, 1, along).mul(oneMinus(smoothstep(planetRadius * 0.96, planetRadius * 1.04, length(toPlanet.sub(toSun.mul(along))))));
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

/** Hairlines wider than life: under a pixel a line keeps a pixel's width and fades by the same ratio, so it stays faint without flickering. */
function uranusRingMaterial(reveal: Node<'float'>) {
	const radius = length(positionLocal.xy).div(RADII.uranus);
	const pixel = fwidth(radius);
	const rings = URANUS_RINGS.reduce<Node<'float'>>((cover, [at, half]) => {
		const width = max(pixel, half);
		return max(cover, oneMinus(smoothstep(width.mul(0.5), width, radius.sub(at).abs())).mul(float(half).div(width)));
	}, float(0));
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: DoubleSide, transparent: true });
	/** Darker than coal in truth, lifted to a dim grey so they read against space, darker again in the realistic lighting. */
	const light = oneMinus(planetShadow(RADII.uranus).mul(0.85)).mul(mix(1, sunlight.mul(0.35), realism));
	material.colorNode = condense(color('#a3a9b2').mul(light), reveal);
	material.opacityNode = rings.mul(0.85);
	return material;
}

const saturnRingNormal = () => vec3(SATURN_POLE.x, SATURN_POLE.y, SATURN_POLE.z);

/** Saturn's rings, a soft blur from the start. Their discovery is Huygens resolving them: the reveal sharpens the ringlets and the Cassini Division. */
function ringMaterial(reveal: Node<'float'>) {
	const radius = length(positionLocal.xy).div(RADII.saturn);
	const shadow = planetShadow(RADII.saturn);
	const ringlets = mx_noise_float(vec3(radius.mul(70), 0, 0)).mul(0.5).add(0.5);
	/** Water ice, the dusty C ring darker than the bright B ring. */
	const ice = mix(color('#a9a59d'), color('#e2dfd8'), mix(0.5, ringlets, reveal)).mul(mix(1, mix(0.7, 1, smoothstep(1.45, 1.6, radius)), reveal));
	/** Seen from the side away from the Sun, the rings only pass the light filtering through them and turn dark. */
	const normal = saturnRingNormal();
	const sunSide = step(0, dot(toSun, normal).mul(dot(cameraPosition.sub(positionWorld), normal)));
	const lit = ice.mul(0.92).mul(oneMinus(shadow.mul(0.85))).mul(mix(1, sunlight.mul(mix(0.25, 1, sunSide)), realism));
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: DoubleSide, transparent: true });
	/** Peaks halfway through the reveal, the rings already exist so they flare cyan instead of condensing from it. */
	material.colorNode = mix(lit, color('#8ff5ff').mul(3), reveal.mul(oneMinus(reveal)).mul(4));
	material.opacityNode = ringDensity(radius, reveal).mul(mix(0.75, 1, reveal));
	return material;
}

/** Where the rings shade Saturn: the way to the Sun crosses the ring plane inside the rings. */
function ringShadow() {
	const normal = saturnRingNormal();
	const toCenter = modelPosition.sub(positionWorld);
	const distance = dot(toCenter, normal).div(dot(toSun, normal).add(1e-5));
	const crossing = positionWorld.add(toSun.mul(distance)).sub(modelPosition);
	return oneMinus(ringDensity(length(crossing).div(RADII.saturn), float(1)).mul(smoothstep(0, 0.5, distance)).mul(0.65));
}

/** Simulation clock for the shaders, the belt's rocks keep pace with the bodies through a warp. */
export const simClock = uniform(0);
const BELT_ROCKS = 2400;
/** Kirkwood gaps as [AU, half width]: Jupiter's pull clears out the orbits that resonate with its own, 3:1, 5:2 and 7:3. */
const KIRKWOOD_GAPS = [
	[2.5, 0.035],
	[2.82, 0.025],
	[2.95, 0.02],
] as const;

/** Rocks on their own Kepler orbits between 2.1 AU and the 2:1 resonance at 3.27 AU. */
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
	const rock = vec3(cos(angle).mul(radius), sin(angle.sub(orbit.w)).mul(sin(orbit.z)).mul(radius), sin(angle).mul(radius));
	material.positionNode = rock;
	material.sizeNode = float(2);
	/** Dots keep their pixel size at any distance and would pile up into a bright band far away, so they dim to half. */
	const distant = smoothstep(EARTH_ORBIT, EARTH_ORBIT * 6, length(rock.sub(cameraPosition)));
	/** Single rocks are far too small to see in truth, the realistic lighting keeps them as a faint dust. */
	material.colorNode = color('#a4a4a8').mul(mix(0.45, 0.22, distant)).mul(mix(1, 0.5, realism)).mul(darkSky).mul(reveal);
	material.opacityNode = oneMinus(smoothstep(0.2, 0.5, length(uv().sub(0.5))));
	const belt = new Sprite(material);
	belt.count = BELT_ROCKS;
	belt.frustumCulled = false;
	return belt;
}

/** Potato-shaped rock: a sphere stretched to its three axes and dented by low waves. */
function lumpyGeometry(radius: number, [x, y, z]: RockShape['axes'], seed: number) {
	const geometry = new SphereGeometry(radius, 48, 32);
	const position = geometry.getAttribute('position');
	const point = new Vector3();
	for (let i = 0; i < position.count; i++) {
		point.fromBufferAttribute(position, i).normalize();
		const lumps = rockLumps(point.x, point.y, point.z, seed);
		position.setXYZ(i, point.x * x * radius * lumps, point.y * y * radius * lumps, point.z * z * radius * lumps);
	}
	geometry.computeVertexNormals();
	return geometry;
}

/** Tail length in scene units at its fullest, about 0.1 AU like Halley's in 1986. */
const TAIL_LENGTH = 30;

/** Unit tail profile, a paraboloid with its apex on the nucleus, points crowding near the head where the curve bends most. */
const TAIL_PROFILE = Array.from({ length: 24 }, (_, i) => new Vector2(0.1 * (i / 23), (i / 23) ** 2));

/** A comet's tail, blown straight away from the Sun: a paraboloid fading along its length and toward its edges, around a coma. */
class CometTail extends Group {
	readonly #away = new Vector3();
	readonly #coma: Sprite;
	readonly #plume: Mesh;

	constructor(reveal: Node<'float'>) {
		super();
		const material = new MeshBasicNodeMaterial({ blending: AdditiveBlending, depthWrite: false, side: DoubleSide, transparent: true });
		const along = positionLocal.y;
		const facing = dot(normalView, positionViewDirection).abs();
		material.colorNode = mix(color('#e6f4ff'), color('#6fa8ff'), along).mul(pow(oneMinus(along), 1.6)).mul(pow(facing, 2)).mul(reveal.mul(0.45));
		this.#plume = new Mesh(new LatheGeometry(TAIL_PROFILE, 32), material);
		this.#coma = glowSprite('#d8ecff', 2, reveal.mul(0.9));
		this.add(this.#plume, this.#coma);
	}

	/**
	 * Turns away from the Sun and grows as the nucleus at `position` nears it, its ice only boils off within a few AU. Real comets have no
	 * tail past Jupiter, the cartoon lighting keeps a short one so a far comet still reads as one. `unturn` undoes the parent's rotation.
	 */
	update(position: Vector3, unturn: Quaternion) {
		const activity = Math.min(1, (3 * EARTH_ORBIT) ** 2 / position.lengthSq());
		const length = TAIL_LENGTH * MathUtils.lerp(Math.max(activity, 0.3), activity, realism.value);
		this.visible = length > 0.05;
		this.quaternion.setFromUnitVectors(UP, this.#away.copy(position).normalize()).premultiply(unturn);
		this.#plume.scale.setScalar(length);
		this.#coma.scale.setScalar(Math.min(length * 0.05, 1.5));
	}
}

interface BodyLook extends Orbit {
	/** `albedo` is the baked texture or the live `surface`, `radius` the look's own. */
	build: (reveal: Node<'float'>, albedo: Node<'vec3'>, radius: number) => Mesh;
	comet?: boolean;
	/** Drawn instead of the orbit line once discovered, centered on the parent. */
	orbit?: (reveal: Node<'float'>) => Object3D;
	/** The pole the body spins counterclockwise around, also its moons' orbit plane. Venus', Uranus' and Pluto's point below their orbits. */
	pole?: Vector3;
	/** Frames the discovery close-up and the pointer picking, the outer edge for the rings. */
	radius: number;
	/** Drawn as soon as that body is in the sky, before its own discovery: Saturn never shows up without its rings. */
	shownWith?: string;
	/** Seconds per turn on itself, 0 for none, `locked` to always show the same face to its parent. */
	spin: number | 'locked';
	/** Albedo from `surfacePoint`, baked into `static/cosmos/<id>.webp`. */
	surface?: () => Node<'vec3'>;
}

interface GlobeOptions extends Finish {
	/** Fast spinning giants bulge at the equator. */
	flattening?: number;
	/** A thin haze `thickness` radii above the surface, drawn in high quality only. */
	haze?: readonly [tint: string, thickness: number, strength: number];
	segments?: number;
}

const globe =
	({ flattening, haze, segments = 64, ...finish }: GlobeOptions = {}): BodyLook['build'] =>
	(reveal, albedo, radius) => {
		const body = sphere(radius, bodyMaterial(reveal, albedo, finish), segments);
		if (flattening) body.geometry.scale(1, 1 - flattening, 1);
		if (haze) {
			const [tint, thickness, strength] = haze;
			const shell = hazeShell(radius * (1 + thickness), tint, reveal, strength);
			shell.userData.highOnly = true;
			body.add(shell);
		}
		return body;
	};

/** Rocks drawn 5 to 25 times larger than life, `axes` set their real proportions with the longest reaching the look's radius. */
const rock =
	({ axes, seed }: RockShape, shade?: Node<'vec3'>): BodyLook['build'] =>
	(reveal, albedo, radius) =>
		new Mesh(lumpyGeometry(radius / Math.max(...axes), axes, seed), bodyMaterial(reveal, albedo, { shade }));

const shadowOf = (...occluders: RoundBody[]) => vec3(eclipse(occluders));
const BANDED_RIM = (pale: string): Rim => [pale, '#3e2a52', 0.4];
const GASEOUS: Finish = { limb: 0.35 };
/** Rings sit on their planet, the orbit fields only place them at its center. */
const ON_PARENT = { distance: 0, period: 1, phase: 0 } as const;

/** Scene side of `#data/cosmos.js`. Moon distances are compressed except Mars' moons, the Galilean moons keep their 1:2:4 resonance. */
export const BODY_LOOKS: Record<string, BodyLook> = {
	/** The signal and the close-up are Astraea, found in 1845, its belt fills the gap around it. */
	asteroid_belt: {
		...solarOrbit(2.577, 4.137, 0.1876, [181.62, 5.36, 141.447, 140.823]),
		build: rock(ROCK_SHAPES.asteroid_belt),
		orbit: asteroidBelt,
		radius: 0.07 * 1.15,
		spin: EARTH_DAY * 0.7,
		surface: () => rockySurface('#9a8f82', '#6f665c', 7, 83),
	},
	callisto: {
		build: globe({ shade: shadowOf('jupiter') }),
		distance: RADII.jupiter * 26.33 * JOVIAN_SPREAD,
		period: 226,
		phase: 4.9,
		radius: RADII.callisto,
		spin: 'locked',
		surface: () => rockySurface('#6f675e', '#4a443e', 9, 41),
	},
	/** Its real size, a fifth of the Moon. */
	ceres: {
		...solarOrbit(2.766, 4.599, 0.0797, [158.74, 10.588, 80.249, 153.543]),
		build: globe({ segments: 48 }),
		pole: ecliptic(11.21, 81.55),
		radius: RADII.ceres,
		spin: EARTH_DAY * 0.378,
		surface: ceresSurface,
	},
	deimos: {
		build: rock(ROCK_SHAPES.deimos, shadowOf('mars')),
		distance: RADII.mars * 6.92,
		inclination: MathUtils.degToRad(1.79),
		/** 1.23 Mars days, slower than the planet turns, unlike Phobos. */
		period: 51,
		phase: 3,
		radius: 0.04 * 1.17,
		spin: 'locked',
		surface: () => rockySurface('#b0a394', '#8f8476', 5, 71),
	},
	eris: {
		...solarOrbit(67.934, 559.94, 0.43824, [21.578, 43.926, 36.005, 186.8]),
		build: globe(),
		radius: RADII.eris,
		spin: EARTH_DAY * 1.08,
		surface: () => rockySurface('#ecebe8', '#d2cec8', 3, 29),
	},
	/** A 34 km long peanut, drawn about as large as Phobos. */
	eros: {
		...solarOrbit(1.458244, 1.761, 0.22288, [181.469, 10.829, 304.268, 123.186]),
		build: rock(ROCK_SHAPES.eros),
		pole: ecliptic(17.24, 11.34),
		radius: 0.0625 * 1.5,
		spin: EARTH_DAY * 0.22,
		surface: () => rockySurface('#b59a76', '#8a7458', 8, 101),
	},
	europa: {
		build: globe({ rim: ['#ffffff', '#26356e', 0.15], shade: shadowOf('jupiter') }),
		distance: RADII.jupiter * 9.39 * JOVIAN_SPREAD,
		period: 48,
		phase: 1.6,
		radius: RADII.europa,
		spin: 'locked',
		surface: europaSurface,
	},
	ganymede: {
		build: globe({ shade: shadowOf('jupiter') }),
		distance: RADII.jupiter * 14.97 * JOVIAN_SPREAD,
		period: 97,
		phase: 3.3,
		radius: RADII.ganymede,
		spin: 'locked',
		surface: () => rockySurface('#9c8f80', '#6b6157', 5, 37),
	},
	/** The nucleus, 15 km long and darker than coal, on a backward orbit tilted 162°. */
	halley: {
		...solarOrbit(17.929, 75.915, 0.96794, [237.231, 162.191, 59.099, 171.34]),
		build: rock(ROCK_SHAPES.halley),
		comet: true,
		radius: 0.04 * 1.2,
		spin: EARTH_DAY * 2.2,
		surface: () => rockySurface('#4f4945', '#2f2b29', 6, 97),
	},
	io: {
		build: globe({ shade: shadowOf('jupiter') }),
		distance: RADII.jupiter * 5.9 * JOVIAN_SPREAD,
		period: 24,
		phase: 0,
		radius: RADII.io,
		spin: 'locked',
		surface: ioSurface,
	},
	jupiter: {
		...solarOrbit(5.203, 11.862, 0.0484, [34.396, 1.304, 100.474, 14.728]),
		/** The moons' shadows cross its clouds as black dots. */
		build: globe({ ...GASEOUS, flattening: 0.0649, rim: ['#f3e6d0', '#3e2a52', 0.25], segments: 96, shade: shadowOf('io', 'europa', 'ganymede', 'callisto') }),
		pole: ecliptic(247.82, 87.78),
		radius: RADII.jupiter,
		spin: EARTH_DAY * 0.4135,
		surface: jupiterSurface,
	},
	mars: {
		...solarOrbit(1.524, 1.881, 0.0934, [355.447, 1.85, 49.56, 336.056]),
		/** Dust hangs high in its thin air, a faint salmon haze on the lit limb. */
		build: globe({ haze: ['#f0a983', 0.03, 0.35], rim: ['#ffc2a1', '#3e2a52', 0.5], segments: 96 }),
		pole: ecliptic(352.91, 63.28),
		radius: RADII.mars,
		spin: EARTH_DAY * 1.026,
		surface: marsSurface,
	},
	/** Spins three times for every two orbits, the reason one of its solar days lasts two of its years. */
	mercury: {
		...solarOrbit(0.387, 0.2408, 0.2056, [252.251, 7.005, 48.331, 77.456]),
		build: globe(),
		radius: RADII.mercury,
		spin: (EARTH_YEAR * 0.2408 * 2) / 3,
		surface: () => rockySurface('#a39a90', '#7b736b', 7, 13),
	},
	/** Starts where it really is, so it shows tonight's phase. Its orbit is tilted 5°, so eclipses only happen in the two eclipse seasons of the year. */
	moon: {
		build: globe({
			/** Earthshine: sunlight the Earth reflects onto the night side. */
			glow: color('#8c96a6').mul(saturate(dot(normalWorld, centerOf('earth').sub(positionWorld).normalize()))).mul(0.08),
			/** In the Earth's shadow it turns copper: the only light left is sunlight bent and reddened through the Earth's atmosphere. */
			shade: mix(color('#b4532e').mul(0.45), vec3(1), eclipse(['earth'])),
		}),
		days: 27.3217,
		distance: 10,
		eccentricity: 0.0549,
		inclination: MathUtils.degToRad(5.145),
		node: MathUtils.degToRad(125.045),
		period: 180,
		perihelion: MathUtils.degToRad(83.353),
		phase: MathUtils.degToRad(218.316),
		radius: RADII.moon,
		spin: 'locked',
		surface: moonSurface,
	},
	neptune: {
		...solarOrbit(30.07, 164.8, 0.0086, [304.88, 1.77, 131.784, 44.965]),
		build: globe({ ...GASEOUS, flattening: 0.0171, rim: BANDED_RIM('#9fbcff'), segments: 80 }),
		pole: ecliptic(319.24, 61.97),
		radius: RADII.neptune,
		spin: EARTH_DAY * 0.671,
		surface: neptuneSurface,
	},
	/** Its real distance, at 2.76 Mars radii, and its real pace against the planet's day: it laps Mars three times a day. */
	phobos: {
		build: rock(ROCK_SHAPES.phobos, shadowOf('mars')),
		distance: RADII.mars * 2.76,
		eccentricity: 0.0151,
		inclination: MathUtils.degToRad(1.08),
		period: 13,
		phase: 0.5,
		radius: 0.06 * 1.2,
		spin: 'locked',
		surface: phobosSurface,
	},
	/** Its stretched orbit dips inside Neptune's, the 3:2 resonance of their years keeps them from ever meeting. */
	pluto: {
		...solarOrbit(39.48, 247.9, 0.2488, [238.929, 17.14, 110.304, 224.069]),
		build: globe({ rim: ['#ffe9d2', '#3e2a52', 0.3] }),
		pole: ecliptic(137.35, -22.82),
		radius: RADII.pluto,
		spin: EARTH_DAY * 6.387,
		surface: plutoSurface,
	},
	saturn: {
		...solarOrbit(9.537, 29.457, 0.0539, [49.954, 2.486, 113.662, 92.599]),
		build: globe({ ...GASEOUS, flattening: 0.098, rim: ['#f0e4c4', '#3e2a52', 0.25], segments: 96, shade: vec3(ringShadow().mul(eclipse(['titan']))) }),
		pole: SATURN_POLE,
		radius: RADII.saturn,
		spin: EARTH_DAY * 0.44,
		surface: saturnSurface,
	},
	saturn_rings: {
		...ON_PARENT,
		build: reveal => {
			const rings = new Mesh(new RingGeometry(RING_INNER, RING_OUTER, 160, 1), ringMaterial(reveal));
			rings.rotation.x = -Math.PI / 2;
			return rings;
		},
		pole: SATURN_POLE,
		radius: RING_OUTER,
		shownWith: 'saturn',
		spin: 0,
	},
	sedna: {
		...solarOrbit(543.72, 12678.6, 0.85988, [93.45, 11.925, 144.506, 95.605]),
		build: globe(),
		radius: RADII.sedna,
		spin: EARTH_DAY * 0.428,
		surface: () => rockySurface('#b8613f', '#8c4530', 4, 23),
	},
	titan: {
		/** Its upper haze scatters blue light, a pale blue glow spills past the orange disc. */
		build: globe({ haze: ['#9fc0ff', 0.05, 0.75], rim: ['#a9c8ff', '#2c3f7a', 0.45], shade: shadowOf('saturn') }),
		distance: RADII.saturn * 4.5,
		eccentricity: 0.0288,
		period: 120,
		phase: 2,
		radius: RADII.titan,
		spin: 'locked',
		surface: () => bandedSurface(['#e0a64a', '#c27f2e', '#ebbd6a'], 3, 0.2),
	},
	/** The only large moon on a backward orbit, tilted 157° to Neptune's equator. */
	triton: {
		build: globe({ shade: shadowOf('neptune') }),
		distance: RADII.neptune * 4,
		inclination: MathUtils.degToRad(156.9),
		period: 80,
		phase: 1,
		radius: RADII.triton,
		spin: 'locked',
		surface: tritonSurface,
	},
	/** Rolls on its side: its 98° tilt points one pole at the Sun for decades at a time. */
	uranus: {
		...solarOrbit(19.19, 84.01, 0.0473, [313.238, 0.773, 74.017, 170.954]),
		build: globe({ flattening: 0.0229, limb: 0.25, rim: BANDED_RIM('#d6f6f8'), segments: 80 }),
		pole: URANUS_POLE,
		radius: RADII.uranus,
		spin: EARTH_DAY * 0.718,
		surface: () => bandedSurface(['#a8e2e8', '#8ccfd8', '#c4eef1'], 2, 0.08),
	},
	/** In the planet's equator like Saturn's, so they stand on edge along with it. */
	uranus_rings: {
		...ON_PARENT,
		build: (reveal, _, radius) => {
			const rings = new Mesh(new RingGeometry(RADII.uranus * 1.6, radius, 192, 1), uranusRingMaterial(reveal));
			rings.rotation.x = -Math.PI / 2;
			return rings;
		},
		pole: URANUS_POLE,
		radius: RADII.uranus * 2.03,
		spin: 0,
	},
	/** Turns backward so slowly that one of its days outlasts its year. */
	venus: {
		...solarOrbit(0.723, 0.6152, 0.0068, [181.979, 3.395, 76.68, 131.602]),
		/** Its sulfuric acid clouds sit under a thick haze that glows pale yellow past the limb. */
		build: globe({ ...GASEOUS, haze: ['#fff0c8', 0.04, 0.6], rim: BANDED_RIM('#f7ecc8'), segments: 80 }),
		pole: ecliptic(210.19, -88.76),
		radius: RADII.venus,
		spin: EARTH_YEAR * 0.6152 * 1.0815,
		surface: () => bandedSurface(['#f0dca0', '#d9b877', '#f7ecc8'], 4, 0.3),
	},
};

/**
 * Model-view matrices multiplied on the CPU in double precision, past Saturn only: in float32, 10 000 units from the Sun cancel down to a
 * thousandth and Pluto shook. On every object it costs 0.1 ms of GPU a frame.
 */
const PRECISE = context({ modelViewMatrix: highpModelViewMatrix });
const PRECISE_BEYOND = EARTH_ORBIT * 12;

const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/** One discoverable object: hidden until discovered, then grown out of the signal's flash. */
export class Body {
	/** `sun`, `earth` or the id of the body it orbits. */
	readonly around: string;
	readonly flash = glowSprite('#8ff5ff', 3, 2.5);
	readonly group = new Group();
	readonly mesh: Mesh;
	readonly orbit: Object3D | null;
	readonly reveal = uniform(0);
	/** Seconds since the discovery started, -1 when not condensing. */
	revealTime = -1;
	#discovering = false;
	/** Rotation from the orbit's reference plane, the ecliptic or the parent's equator, to the scene. */
	readonly #frame = new Quaternion();
	#grows = false;
	readonly #local = new Vector3();
	readonly #start: number;
	readonly #tail: CometTail | null;
	readonly #toParent = new Vector3();
	/** Inverse of the group's rotation, to read the way to the parent in a locked moon's own axes. */
	readonly #unturn: Quaternion;

	constructor(
		readonly object: CosmosObject,
		readonly look: BodyLook,
		public discovered: boolean,
		shown: boolean,
		albedo: Node<'vec3'>,
		sinceJ2000: number,
	) {
		this.around = object.orbits ?? 'sun';
		this.mesh = look.build(this.reveal, albedo, look.radius);
		const parent = BODY_LOOKS[this.around];
		if (parent?.pole) this.#frame.setFromUnitVectors(UP, parent.pole);
		this.#start = startLongitude(look, sinceJ2000);
		/** A locked moon spins around its orbit's axis, anything else around its pole. */
		if (look.spin === 'locked') this.group.quaternion.setFromUnitVectors(UP, orbitNormal(look)).premultiply(this.#frame);
		else if (look.pole) this.group.quaternion.setFromUnitVectors(UP, look.pole);
		this.#unturn = this.group.quaternion.clone().invert();
		this.group.add(this.mesh, this.flash);
		this.#tail = look.comet ? new CometTail(this.reveal) : null;
		if (this.#tail) this.group.add(this.#tail);
		this.group.visible = shown;
		this.flash.scale.setScalar(0);
		this.reveal.value = discovered ? 1 : 0;
		if (!shown) this.mesh.scale.setScalar(0.001);
		if (look.orbit) this.orbit = look.orbit(this.reveal);
		else this.orbit = look.distance > 0 ? new OrbitLine(look, object.color, this.around === 'sun' ? 0.13 : 0.09).applyQuaternion(this.#frame) : null;
		if (this.orbit) this.orbit.visible = discovered;
		if ((this.around === 'sun' ? look.distance : (parent?.distance ?? 0)) > PRECISE_BEYOND)
			for (const object of [this.group, this.orbit])
				object?.traverse(child => {
					if (child instanceof Mesh || child instanceof Line) (child.material as NodeMaterial).contextNode = PRECISE;
				});
	}

	/** Orbits run counterclockwise seen from the north, like the real Solar System. */
	place(parent: Vector3, time: number) {
		const { look } = this;
		orbitPoint(look, trueAnomaly(look, this.#start + (time / look.period) * TURN), this.#local);
		this.group.position.copy(this.#local).applyQuaternion(this.#frame).add(parent);
		if (look.spin === 'locked') {
			/** Turns the local +x axis, where the maps put longitude 0, toward the parent. */
			const toParent = this.#toParent.copy(parent).sub(this.group.position).applyQuaternion(this.#unturn);
			this.mesh.rotation.y = Math.atan2(-toParent.z, toParent.x);
		} else if (look.spin) this.mesh.rotation.y = (time / look.spin) * TURN;
		this.#tail?.update(this.group.position, this.#unturn);
		if (this.orbit instanceof OrbitLine) this.orbit.position.copy(this.orbit.anchor(this.#local)).applyQuaternion(this.#frame).add(parent);
		else this.orbit?.position.copy(parent);
		/** A body not in the sky yet casts no shadow. */
		centerOf(this.object.id).value.copy(this.group.visible ? this.group.position : NOWHERE);
	}

	/** Shows what was discovered of the orbit, its line only with `lines` on: the asteroid belt stays, it is made of the bodies themselves. */
	showOrbit(lines: boolean) {
		if (this.orbit) this.orbit.visible = this.discovered && (lines || !(this.orbit instanceof OrbitLine));
	}

	/** `discovering` false only grows a `shownWith` companion in alongside its parent, it stays undiscovered. */
	startReveal(discovering = true) {
		this.#grows = !this.group.visible;
		this.#discovering = discovering;
		this.discovered ||= discovering;
		this.group.visible = true;
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
