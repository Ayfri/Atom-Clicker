import { MathUtils, Vector3 } from 'three/webgpu';

/**
 * Real ratios for the planet sizes, the planet orbits and the orbital periods. Moon distances and the Sun are shrunk so all of it
 * fits a screen, the Sun stays a bit larger than Jupiter.
 */
export const EARTH_RADIUS = 1.6;
export const EARTH_ORBIT = 260;
export const SUN_RADIUS = 18.5;
export const STAR_DISTANCE = 1500;
/** Between the stars and the Milky Way dome, so the stars draw over the nebulae. */
export const DEEP_SKY_DISTANCE = 1650;
export const SKY_DISTANCE = 1800;
/** Seconds per turn, compressed so the system visibly moves without turning days into a blur. */
export const EARTH_YEAR = 720;
export const EARTH_DAY = 40;
export const TURN = Math.PI * 2;
export const ORIGIN = new Vector3();
export const UP = new Vector3(0, 1, 0);

/** Every round body at its real size against the Earth. */
export const RADII = {
	callisto: EARTH_RADIUS * 0.378,
	ceres: EARTH_RADIUS * 0.0737,
	earth: EARTH_RADIUS,
	eris: EARTH_RADIUS * 0.1825,
	europa: EARTH_RADIUS * 0.245,
	ganymede: EARTH_RADIUS * 0.413,
	io: EARTH_RADIUS * 0.286,
	jupiter: EARTH_RADIUS * 11.21,
	mars: EARTH_RADIUS * 0.532,
	mercury: EARTH_RADIUS * 0.383,
	moon: EARTH_RADIUS * 0.273,
	neptune: EARTH_RADIUS * 3.88,
	pluto: EARTH_RADIUS * 0.186,
	saturn: EARTH_RADIUS * 9.45,
	sedna: EARTH_RADIUS * 0.078,
	titan: EARTH_RADIUS * 0.404,
	triton: EARTH_RADIUS * 0.212,
	uranus: EARTH_RADIUS * 4.01,
	venus: EARTH_RADIUS * 0.949,
} as const;

export type RoundBody = keyof typeof RADII;

/**
 * Scene direction of an ecliptic longitude and latitude in degrees. The orbits lie in the ecliptic, +y is its north and longitude 0,
 * the vernal equinox, is +x, longitudes grow counterclockwise seen from the north like the planets move.
 */
export const ecliptic = (longitude: number, latitude: number) => {
	const [l, b] = [MathUtils.degToRad(longitude), MathUtils.degToRad(latitude)];
	return new Vector3(Math.cos(b) * Math.cos(l), Math.sin(b), -Math.cos(b) * Math.sin(l));
};

/** The Earth's north pole, also the sky's: deep-sky objects are turned against it, the way their position angles are measured. */
export const EARTH_POLE = ecliptic(90, 66.56);
/** The galactic plane crosses the ecliptic at 60°, its center in Sagittarius lies just south of the ecliptic, where the Sun passes in December. */
export const GALAXY_NORMAL = ecliptic(180.02, 29.81);
export const GALAXY_CORE = ecliptic(266.84, -5.54);
/** Galactic longitude 90°, where the Sun heads on its own orbit around the galaxy. */
const GALAXY_HEADING = GALAXY_NORMAL.clone().cross(GALAXY_CORE);

/** Sky direction of a galactic longitude and latitude in degrees. */
export const galactic = (longitude: number, latitude: number) => {
	const [l, b] = [MathUtils.degToRad(longitude), MathUtils.degToRad(latitude)];
	return GALAXY_CORE.clone()
		.multiplyScalar(Math.cos(b) * Math.cos(l))
		.addScaledVector(GALAXY_HEADING, Math.cos(b) * Math.sin(l))
		.addScaledVector(GALAXY_NORMAL, Math.sin(b));
};
