import {
	cameraPosition,
	color,
	dot,
	length,
	luminance,
	max,
	mix,
	normalView,
	normalWorld,
	normalWorldGeometry,
	oneMinus,
	positionViewDirection,
	positionWorld,
	pow,
	remapClamp,
	saturate,
	sin,
	smoothstep,
	texture,
	time,
	uv,
	vec2,
} from 'three/tsl';
import { BackSide, Group, MathUtils, Mesh, MeshBasicNodeMaterial, type Node, SphereGeometry, type Texture } from 'three/webgpu';
import { EARTH_PATH, OrbitLine, orbitPoint, startLongitude, trueAnomaly } from './orbits.js';
import { centerOf, diffuse, eclipse, edge, fresnel, outline, realism, sunFacing, sunlight, toon, toSun } from './shading.js';
import { EARTH_DAY, EARTH_POLE, EARTH_RADIUS, EARTH_YEAR, TURN, UP } from './space.js';
import { beaconSprite } from './sprites.js';
import { cloudCover } from './surfaces.js';

/** Blue by day, gold then orange going past the terminator, a tight ramp so the sunlit limb stays blue. */
const atmosphereTint = (facing: Node<'float'>) =>
	mix(mix(color('#ff8a2a'), color('#ffc46b'), smoothstep(-0.3, -0.08, facing)), color('#4db2ff'), smoothstep(-0.08, 0.15, facing));

/** Softens the sunset part of the atmosphere, the orange stays a hint along the terminator instead of a bright ring. */
const sunsetDimming = (facing: Node<'float'>) => mix(0.4, 1, smoothstep(-0.08, 0.15, facing));

/** Lights the baked or live Earth surface: sea glint, night side with city lights, dusk greying and the atmosphere's limb. */
function earthMaterial(surface: Node<'vec3'>, masks: Node<'vec3'>) {
	const [land, cities, frozen] = [masks.x, masks.y, masks.z];
	/** Divided by a clamped length: with the Sun right behind the Earth the sum is near zero and `normalize` returned NaN pixels. */
	const halfwaySum = toSun.add(cameraPosition.sub(positionWorld).normalize());
	const halfway = halfwaySum.div(max(length(halfwaySum), 1e-4));
	const highlight = edge(0.985, dot(normalWorld, halfway), 0.01).mul(oneMinus(land)).mul(0.35);
	const cartoon = surface.mul(smoothstep(-0.1, 0.55, sunFacing).mul(0.7).add(0.3)).add(highlight);
	const day = mix(cartoon, surface.mul(diffuse()).add(highlight).mul(sunlight), realism);
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
	material.colorNode = mix(lit, atmosphereTint(sunFacing).mul(mix(1, sunlight, realism)), atmosphereMix).add(outline('#8fd3ff', '#26356e').mul(oneMinus(realism).mul(0.5)));
	return material;
}

/** Back-face shell slightly larger than the Earth, its fresnel fades the halo outward. Geometry normals keep the lit side on the Sun. */
function atmosphereMaterial() {
	const facing = dot(normalWorldGeometry, toSun);
	const shellFresnel = oneMinus(dot(normalView, positionViewDirection).abs());
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: BackSide, transparent: true });
	material.colorNode = atmosphereTint(facing).mul(mix(1, sunlight, realism));
	material.opacityNode = pow(remapClamp(shellFresnel, 0.73, 1, 1, 0), 3).mul(smoothstep(-0.5, 1, facing)).mul(sunsetDimming(facing));
	return material;
}

/** Clouds from their cover map, two drifting reads cross-faded so they slowly reshape instead of sliding as a block. */
function cloudMaterial(cover: (offset: Node<'vec2'>) => Node<'float'>) {
	const phase = sin(time.mul(0.05)).mul(0.5).add(0.5);
	const density = mix(cover(vec2(time.mul(0.0006), 0)), cover(vec2(time.mul(-0.0004), 0.004)), phase);
	const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true });
	/** A faint moonlit blue on the night side, at the ground's 2-3% floor the clouds vanished there and only showed against the Sun's glow. */
	const night = oneMinus(smoothstep(-0.12, 0.08, sunFacing));
	material.colorNode = color('#ffffff')
		.mul(mix(toon(sunFacing, 0), diffuse().mul(sunlight), realism))
		.add(color('#7d8fb8').mul(night).mul(oneMinus(realism).mul(0.09)));
	/** Thinner on the night side, so city lights show through. */
	material.opacityNode = density.mul(smoothstep(-0.3, 0.1, sunFacing).mul(0.45).add(0.4));
	return material;
}

/** The Earth with its clouds, atmosphere and instrument beacon, carried along its orbit. */
export class Earth {
	/** Lit while an instrument is being built. */
	readonly beacon = beaconSprite();
	readonly group = new Group();
	readonly orbit = new OrbitLine(EARTH_PATH, '#6f8cff', 0.09);
	readonly #atmosphere = new Mesh(new SphereGeometry(EARTH_RADIUS * 1.04, 96, 64), atmosphereMaterial());
	readonly #clouds: Mesh;
	readonly #globe: Mesh;
	/** Mean longitude when the scene opened. */
	readonly #start: number;

	constructor(day: Node<'vec3'>, masks: Node<'vec3'>, clouds: Texture | undefined, sinceJ2000: number) {
		this.#globe = new Mesh(new SphereGeometry(EARTH_RADIUS, 96, 64), earthMaterial(day, masks));
		this.#clouds = new Mesh(
			new SphereGeometry(EARTH_RADIUS * 1.015, 96, 64),
			cloudMaterial(offset => (clouds ? texture(clouds, uv().add(offset)).r : cloudCover())),
		);
		this.#start = startLongitude(EARTH_PATH, sinceJ2000);
		this.beacon.position.setFromSphericalCoords(EARTH_RADIUS * 1.03, MathUtils.degToRad(45), 0);
		this.beacon.scale.setScalar(EARTH_RADIUS * 0.6);
		this.beacon.visible = false;
		this.#globe.add(this.beacon);
		/** The real tilt toward the real direction: the Earth's seasons match the date. */
		const tilt = new Group();
		tilt.quaternion.setFromUnitVectors(UP, EARTH_POLE);
		tilt.add(this.#globe, this.#clouds, this.#atmosphere);
		this.group.add(tilt);
	}

	get position() {
		return this.group.position;
	}

	place(time: number) {
		orbitPoint(EARTH_PATH, trueAnomaly(EARTH_PATH, this.#start + (time / EARTH_YEAR) * TURN), this.group.position);
		this.#globe.rotation.y = (time / EARTH_DAY) * TURN;
		this.#clouds.rotation.y = this.#globe.rotation.y * 1.04;
		centerOf('earth').value.copy(this.group.position);
	}

	/** Low quality drops the clouds and the atmosphere shell. */
	setQuality(high: boolean) {
		this.#atmosphere.visible = this.#clouds.visible = high;
	}
}
