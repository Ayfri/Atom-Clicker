import { uniform } from 'three/tsl';
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicNodeMaterial, MathUtils, Vector3 } from 'three/webgpu';
import { EARTH_ORBIT, EARTH_YEAR, TURN } from './space.js';

/** 2000-01-01 12:00, the epoch of the orbital elements: the planets start where they are in the real sky today. */
export const J2000 = Date.UTC(2000, 0, 1, 12);
export const DAY_MS = 86_400_000;

/**
 * Keplerian elements, angles in radians, against the ecliptic around the Sun and the Earth and against the planet's equator around
 * the other planets.
 */
export interface Orbit {
	/** Real sidereal period in days, which carries `phase` from J2000 to today. Without it the scene starts on `phase`. */
	days?: number;
	/** Semi-major axis. */
	distance: number;
	eccentricity?: number;
	inclination?: number;
	/** Longitude of the ascending node, where the orbit climbs through its reference plane. */
	node?: number;
	/** Seconds per orbit. */
	period: number;
	/** Longitude of the closest point, counted along the reference plane to the node, then along the orbit. */
	perihelion?: number;
	/** Mean longitude at J2000. */
	phase: number;
}

/** Point of an orbit at a true anomaly, in its reference frame. */
export function orbitPoint({ distance, eccentricity = 0, inclination = 0, node = 0, perihelion = 0 }: Orbit, anomaly: number, out: Vector3) {
	const reach = (distance * (1 - eccentricity ** 2)) / (1 + eccentricity * Math.cos(anomaly));
	/** Angle from the ascending node along the orbit. */
	const fromNode = anomaly + perihelion - node;
	const [x, y] = [Math.cos(fromNode) * reach, Math.sin(fromNode) * reach * Math.cos(inclination)];
	return out.set(Math.cos(node) * x - Math.sin(node) * y, Math.sin(fromNode) * reach * Math.sin(inclination), -(Math.sin(node) * x + Math.cos(node) * y));
}

export const orbitNormal = ({ inclination = 0, node = 0 }: Orbit) =>
	new Vector3(Math.sin(inclination) * Math.sin(node), Math.cos(inclination), Math.sin(inclination) * Math.cos(node));

/** True anomaly at a mean longitude, Kepler's equation by Newton's method: fast near the Sun, slow far out. */
export function trueAnomaly({ eccentricity = 0, perihelion = 0 }: Orbit, meanLongitude: number) {
	const mean = meanLongitude - perihelion;
	if (!eccentricity) return mean;
	let eccentric = mean;
	for (let i = 0; i < 4; i++) eccentric -= (eccentric - eccentricity * Math.sin(eccentric) - mean) / (1 - eccentricity * Math.cos(eccentric));
	return 2 * Math.atan2(Math.sqrt(1 + eccentricity) * Math.sin(eccentric / 2), Math.sqrt(1 - eccentricity) * Math.cos(eccentric / 2));
}

/** Mean longitude when the scene opens: the real one of today for an orbit with its real period. */
export const startLongitude = ({ days, phase }: Orbit, sinceJ2000: number) => phase + (days ? (TURN * sinceJ2000) / days : 0);

/**
 * Orbits in AU and years scale with the Earth's, so the planets keep their real spacing and pace. Then JPL's J2000 elements in
 * degrees: mean longitude, inclination, ascending node and perihelion longitude.
 */
export const solarOrbit = (au: number, years: number, eccentricity: number, elements: readonly [number, number, number, number]): Orbit => {
	const [phase, inclination, node, perihelion] = elements.map(MathUtils.degToRad);
	return { days: years * 365.25, distance: EARTH_ORBIT * au, eccentricity, inclination, node, period: EARTH_YEAR * years, perihelion, phase };
};

export const EARTH_PATH = solarOrbit(1, 1, 0.0167, [100.464, 0, 0, 102.937]);

/** Fades every orbit line in and out with the orbits switch. */
export const orbitFade = uniform(1);

/** An ellipse with its parent at a focus. Its chords stray under 0.02 from the curve, at a fixed 256 the line missed Pluto by twice its radius. */
export class OrbitLine extends Line<BufferGeometry, LineBasicNodeMaterial> {
	readonly #anchor = new Vector3();
	/** The vertices in double precision, around the parent. */
	readonly #points: Float64Array;

	constructor(orbit: Orbit, tint: string, opacity: number) {
		const reach = orbit.distance * (1 + (orbit.eccentricity ?? 0));
		const segments = Math.min(4096, Math.max(256, Math.ceil(Math.PI * Math.sqrt(reach / 0.04))));
		const points = new Float64Array((segments + 1) * 3);
		const point = new Vector3();
		/** The WebGPU renderer has no LineLoop, the last point repeats the first to close the circle. */
		for (let i = 0; i <= segments; i++) {
			orbitPoint(orbit, (i / segments) * TURN, point);
			points.set([point.x, point.y, point.z], i * 3);
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
		super(geometry, new LineBasicNodeMaterial({ color: tint, depthWrite: false, transparent: true }));
		this.material.opacityNode = orbitFade.mul(opacity);
		this.#points = points;
	}

	/**
	 * Moves the vertices' origin to a point of the orbit once the body is 50 units from the last one, and returns it. Thousands of
	 * units out, float32 vertices are a thousandth off and the line shook beside a close-up Pluto.
	 */
	anchor(point: Vector3) {
		if (point.distanceTo(this.#anchor) < 50) return this.#anchor;
		const { x, y, z } = this.#anchor.copy(point);
		const position = this.geometry.getAttribute('position');
		for (let i = 0; i < position.count; i++) position.setXYZ(i, this.#points[i * 3] - x, this.#points[i * 3 + 1] - y, this.#points[i * 3 + 2] - z);
		position.needsUpdate = true;
		this.geometry.computeBoundingSphere();
		return this.#anchor;
	}
}
