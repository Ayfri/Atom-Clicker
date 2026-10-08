import {
	abs,
	asin,
	atan,
	color,
	dot,
	exp,
	float,
	fract,
	length,
	max,
	mix,
	mx_fractal_noise_float,
	mx_noise_float,
	mx_worley_noise_float,
	oneMinus,
	pow,
	saturate,
	sin,
	smoothstep,
	vec2,
	vec3,
} from 'three/tsl';
import { MathUtils, type Node, Vector3 } from 'three/webgpu';
import { edge, surfacePoint } from './shading.js';
import { GALAXY_CORE, GALAXY_NORMAL } from './space.js';

/** The Earth's day colors, and its masks: land, city lights and ice or snow. */
export function earthSurface() {
	const height = mx_fractal_noise_float(surfacePoint.mul(1.5), 3, 2, 0.5);
	const latitude = abs(surfacePoint.y);
	const land = edge(0.03, height);
	const ocean = mix(color('#17427f'), color('#2b78b8'), edge(-0.06, height, 0.08));
	const dryBelt = oneMinus(smoothstep(0.02, 0.2, abs(latitude.sub(0.3))));
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
	const ranges = oneMinus(smoothstep(halfWidth.mul(0.4), halfWidth, foldDistance.add(rugged.mul(0.012))));
	const rock = smoothstep(0.2, 0.55, ranges.mul(rugged.mul(0.5).add(0.6)));
	const snow = smoothstep(0.75, 0.9, ranges.mul(spindle).mul(rugged.mul(0.5).add(0.6)));
	const terrain = mix(mix(ground, mix(color('#6e5f4f'), color('#9a8a76'), rugged), rock), color('#f2f4f7'), snow.mul(0.85));
	const ice = edge(0.87, latitude.add(height.mul(0.12)), 0.03);
	/** Fine points grouped in urban regions, a high frequency keeps them from reading as flat yellow blobs up close. */
	const urban = smoothstep(0.1, 0.4, mx_fractal_noise_float(surfacePoint.mul(5).add(23), 3, 2, 0.5)).mul(land).mul(oneMinus(ice));
	const cities = smoothstep(0.62, 0.72, mx_noise_float(surfacePoint.mul(180))).mul(urban);
	return { day: mix(mix(ocean, terrain, land), color('#eef3f8'), ice), masks: vec3(land, cities, max(ice, snow)) };
}

/** Cloud cover, stretched along the latitude so clouds form bands, domain-warped so they curl. */
export function cloudCover() {
	const stretched = surfacePoint.mul(vec3(4.5, 8, 4.5));
	const warp = mx_fractal_noise_float(stretched.mul(0.35), 2, 2, 0.5).mul(0.9);
	const cover = mx_fractal_noise_float(stretched.add(warp), 5, 2.1, 0.5);
	return smoothstep(0.06, 0.45, cover).mul(smoothstep(-0.35, 0.2, mx_fractal_noise_float(surfacePoint.mul(1.2).add(31), 2, 2, 0.5)));
}

/** Moons and small rocky planets: two flat color areas and worley craters, `craters` sets how many. */
export function rockySurface(light: string, dark: string, craters: number, seed: number) {
	const patches = edge(0.12, mx_fractal_noise_float(surfacePoint.mul(1.6).add(seed), 3, 2, 0.5), 0.1);
	const crater = mx_worley_noise_float(surfacePoint.mul(craters).add(seed));
	const floor = oneMinus(edge(0.16, crater, 0.03));
	const lip = edge(0.16, crater, 0.03).mul(oneMinus(edge(0.22, crater, 0.03)));
	return mix(mix(color(light), color(dark), patches), color(dark), floor.mul(0.45)).add(lip.mul(0.06));
}

/** Thick atmospheres: latitude bands bent by turbulence. */
export function bandedSurface([light, dark, pale]: readonly [string, string, string], bands: number, turbulence: number) {
	const swirl = mx_fractal_noise_float(surfacePoint.mul(vec3(2, 7, 2)), 3, 2, 0.5).mul(turbulence);
	const latitude = surfacePoint.y.add(swirl);
	const wide = sin(latitude.mul(bands)).mul(0.5).add(0.5);
	const thin = sin(latitude.mul(bands * 2.7).add(1.3)).mul(0.5).add(0.5);
	return mix(mix(color(light), color(dark), edge(0.55, wide, 0.12)), color(pale), edge(0.7, thin, 0.1).mul(0.5));
}

/** Unit vector at a latitude and east longitude in degrees. East runs toward -z, the way the bodies spin. */
const surfaceDirection = (latitude: number, longitude: number) => {
	const [lat, lon] = [MathUtils.degToRad(latitude), MathUtils.degToRad(longitude)];
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
		const size = MathUtils.degToRad(radius);
		return max(cover, oneMinus(smoothstep(size * 0.7, size * 1.1, angleTo(latitude, longitude).add(wobble.mul(size)))));
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

export function moonSurface() {
	const wobble = mx_fractal_noise_float(surfacePoint.mul(6), 2, 2, 0.5);
	const maria = spots(MARIA, wobble);
	const highlands = mix(color('#cbc6bd'), color('#bcb7ae'), edge(0.1, mx_fractal_noise_float(surfacePoint.mul(3).add(7), 3, 2, 0.5), 0.25));
	const crater = mx_worley_noise_float(surfacePoint.mul(9).add(3));
	/** The seas are younger lava plains, with far fewer craters than the highlands. */
	const pits = oneMinus(edge(0.13, crater, 0.03)).mul(oneMinus(maria).mul(0.7).add(0.3));
	/** Rays are noise read along the direction away from each crater, so they streak out radially and fade with distance. */
	const rays = RAY_CRATERS.reduce<Node<'float'>>((glow, [latitude, longitude, reach]) => {
		const away = surfacePoint.sub(surfaceDirection(latitude, longitude));
		const distance = length(away);
		const streaks = smoothstep(0.25, 0.6, mx_noise_float(away.div(max(distance, 1e-4)).mul(9).add(latitude)));
		const fade = oneMinus(smoothstep(0.02, MathUtils.degToRad(reach), distance));
		return max(glow, max(streaks.mul(fade).mul(0.55), oneMinus(smoothstep(0.025, 0.04, distance))));
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

export function marsSurface() {
	const wobble = mx_fractal_noise_float(surfacePoint.mul(5).add(9), 2, 2, 0.5);
	const terrain = mx_fractal_noise_float(surfacePoint.mul(2).add(5), 3, 2, 0.5);
	const dark = max(spots(MARS_DARK, wobble.mul(1.5)), edge(0.3, mx_fractal_noise_float(surfacePoint.mul(1.3).add(17), 2, 2, 0.5), 0.18));
	const tharsis = oneMinus(smoothstep(0.2, 0.55, angleTo(0, 248)));
	const hellas = angleTo(-42.4, 70.5).add(wobble.mul(0.05));
	const basin = oneMinus(smoothstep(0.24, 0.3, hellas));
	const basinRim = oneMinus(smoothstep(0.02, 0.06, abs(hellas.sub(0.31))));
	/** Valles Marineris: a 4000 km rift east of the volcanoes, widest in the middle and tapering at both ends, with a northern branch. */
	const along = longitudeDegrees.add(98).div(56);
	const taper = smoothstep(0, 0.15, along).mul(oneMinus(smoothstep(0.85, 1, along)));
	const rift = latitudeDegrees.add(9).add(sin(along.mul(Math.PI)).mul(4)).add(mx_noise_float(surfacePoint.mul(14)).mul(0.6));
	const canyon = max(
		oneMinus(smoothstep(taper.mul(1.2), taper.mul(2).add(1e-3), abs(rift))),
		oneMinus(smoothstep(taper.mul(0.5), taper.mul(1).add(1e-3), abs(rift.sub(3.2)))).mul(smoothstep(0.2, 0.3, along)).mul(oneMinus(smoothstep(0.45, 0.55, along))),
	);
	/** Noctis Labyrinthus, the maze of crossing troughs at the rift's western end. */
	const labyrinth = oneMinus(smoothstep(0.03, 0.07, abs(mx_noise_float(surfacePoint.mul(28))))).mul(oneMinus(smoothstep(0.04, 0.09, angleTo(-7, 255))));
	const volcano = THARSIS_VOLCANOES.reduce<Node<'vec3'>>(
		(shading, [latitude, longitude, radius]) => {
			const distance = angleTo(latitude, longitude).div(MathUtils.degToRad(radius));
			const dome = oneMinus(smoothstep(0.3, 1.05, distance));
			const scarp = oneMinus(smoothstep(0.08, 0.25, abs(distance.sub(0.95))));
			const caldera = oneMinus(smoothstep(0.08, 0.2, distance));
			return vec3(max(shading.x, dome), max(shading.y, scarp), max(shading.z, caldera));
		},
		vec3(0, 0, 0),
	);
	/** Every feature is a gentle shift of the same rust palette, Mars reads as one soft ochre world rather than a patchwork. */
	const ground = mix(mix(color('#c4633b'), color('#d4784b'), edge(0.05, terrain, 0.15)), color('#a55031'), dark.mul(oneMinus(tharsis)).mul(0.55));
	const relief = mix(mix(ground, color('#d8835a'), tharsis.mul(0.25)), color('#d99470'), basin.mul(0.3)).mul(oneMinus(basinRim.mul(0.06)));
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
const RED_SPOT_LATITUDE = MathUtils.degToRad(-22);

export function jupiterSurface() {
	const swirl = mx_fractal_noise_float(surfacePoint.mul(vec3(2, 9, 2)), 3, 2, 0.5);
	const latitude = surfacePoint.y.add(swirl.mul(0.025));
	const belts = JUPITER_BELTS.reduce<Node<'float'>>(
		(cover, [center, half, strength]) => max(cover, oneMinus(smoothstep(half - 0.02, half + 0.02, abs(latitude.sub(center)))).mul(strength)),
		float(0),
	);
	const streaks = mx_noise_float(surfacePoint.mul(vec3(3, 40, 3)).add(swirl)).mul(0.5).add(0.5);
	const zones = mix(color('#f1e4c8'), color('#e8c99c'), oneMinus(smoothstep(0.05, 0.11, abs(latitude))));
	const banded = mix(mix(zones, mix(color('#a46c45'), color('#c08a5e'), streaks), belts), color('#9c8c80'), smoothstep(0.62, 0.85, abs(latitude)).mul(0.7));
	/** An oval in longitude and latitude, ringed by the pale "hollow" it carves in the belt, its swirl turns counterclockwise. */
	const offset = vec2(atan(surfacePoint.z.negate(), surfacePoint.x).mul(Math.cos(RED_SPOT_LATITUDE)).div(0.13), asin(surfacePoint.y).sub(RED_SPOT_LATITUDE).div(0.075));
	const spot = length(offset);
	const spiral = sin(atan(offset.y, offset.x).add(spot.mul(5))).mul(0.5).add(0.5);
	const hollow = oneMinus(smoothstep(0.1, 0.25, abs(spot.sub(1.15))));
	const core = oneMinus(smoothstep(0.75, 0.95, spot));
	/** Dimmed under the bloom threshold, the pale zones otherwise blurred the disc. */
	return mix(mix(banded, color('#f3e8d4'), hollow.mul(0.85)), mix(color('#bf5a3a'), color('#dc8a62'), spiral.mul(spot)), core).mul(0.9);
}

/** Io has no impact craters, its volcanoes repave it: sulfur plains with faint green patches, dark calderas and Pele's great red ring. */
export function ioSurface() {
	const flows = mx_fractal_noise_float(surfacePoint.mul(3).add(23), 3, 2, 0.5);
	const greens = edge(0.25, mx_fractal_noise_float(surfacePoint.mul(2.2).add(61), 2, 2, 0.5), 0.15);
	const sulfur = mix(mix(color('#e4cf6c'), color('#ede2ad'), edge(0.15, flows, 0.2)), color('#d3a04e'), edge(-0.2, flows, 0.2).mul(0.4));
	const plains = mix(sulfur, color('#bfc27a'), greens.mul(0.45));
	const vent = mx_worley_noise_float(surfacePoint.mul(5).add(23));
	const active = smoothstep(-0.3, 0.1, mx_noise_float(surfacePoint.mul(4).add(41)));
	const calderas = oneMinus(edge(0.06, vent, 0.02)).mul(active);
	const halos = oneMinus(smoothstep(0.06, 0.2, vent)).mul(active).mul(0.4);
	const pele = angleTo(-18.7, 104.7);
	const peleRing = oneMinus(smoothstep(0.02, 0.09, abs(pele.sub(0.2)))).mul(0.6);
	const poles = smoothstep(0.55, 0.9, abs(surfacePoint.y));
	const deposits = mix(mix(plains, color('#a8683b'), poles.mul(0.6)), color('#c8552d'), max(halos, peleRing.mul(0.8)));
	return mix(deposits, color('#2e2219'), max(calderas, oneMinus(smoothstep(0.03, 0.05, pele))));
}

/** Europa's young ice shell: almost no craters, crossed by long reddish cracks (lineae) and patches of brown chaos terrain. */
export function europaSurface() {
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
		const line = oneMinus(smoothstep(0.03, 0.09, abs(wave)));
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
 * Saturn's haze mutes its bands into soft butterscotch stripes, with a pale equator, a blue-grey north pole and the hexagon: a
 * six-sided jet stream around the north pole at 78°N, with a dark vortex at its center.
 */
export function saturnSurface() {
	const swirl = mx_fractal_noise_float(surfacePoint.mul(vec3(2, 12, 2)), 3, 2, 0.5);
	const latitude = surfacePoint.y.add(swirl.mul(0.012));
	const belts = smoothstep(0.35, 0.9, sin(latitude.mul(11).add(0.6)).mul(0.5).add(0.5));
	const fine = sin(latitude.mul(70)).mul(0.5).add(0.5);
	const banded = mix(mix(color('#e2cf9f'), color('#c7a670'), belts.mul(0.55)), color('#d6c095'), fine.mul(0.2));
	const equator = mix(banded, color('#efe1bb'), oneMinus(smoothstep(0.06, 0.16, abs(latitude))));
	const north = smoothstep(0.9, 0.97, surfacePoint.y);
	const poles = mix(mix(equator, color('#b9a37a'), smoothstep(0.75, 0.95, abs(latitude)).mul(0.6)), color('#a3a796'), north.mul(0.55));
	/** Max of the distances along three directions 60° apart traces a hexagon, its sides at cos(78°) from the axis, a smooth max rounds its corners. */
	const polar = surfacePoint.xz;
	const smoothMax = (a: Node<'float'>, b: Node<'float'>, k = 0.05) => {
		const blend = max(float(k).sub(abs(a.sub(b))), 0).div(k);
		return max(a, b).add(blend.mul(blend).mul(k / 4));
	};
	const hexagon = smoothMax(abs(polar.x), smoothMax(abs(polar.x.mul(0.5).add(polar.y.mul(0.866))), abs(polar.x.mul(0.5).sub(polar.y.mul(0.866)))));
	const inside = oneMinus(smoothstep(0.17, 0.23, hexagon)).mul(north);
	const jet = oneMinus(smoothstep(0, 0.04, abs(hexagon.sub(0.208)))).mul(smoothstep(0.9, 0.95, surfacePoint.y));
	const eye = oneMinus(smoothstep(0, 0.06, length(polar))).mul(north);
	/** Kept under the bloom threshold, the pale cream otherwise blurred the whole disc. */
	return mix(mix(mix(poles, color('#8a989b'), inside.mul(0.35)), color('#76858b'), jet.mul(0.3)), color('#5d6a70'), eye.mul(0.5)).mul(0.88);
}

/** Dark grey rock, and the bright salt of Occator crater's faculae, the spots Dawn flew toward in 2015. */
export function ceresSurface() {
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
export function phobosSurface() {
	const stickney = angleTo(-1, -49);
	const floor = oneMinus(smoothstep(0.3, 0.38, stickney));
	const rim = oneMinus(smoothstep(0.02, 0.07, abs(stickney.sub(0.42))));
	/** Bent lines broken into short pitted segments, missing on the far side from Stickney: a plain sine read as stripes over the whole moon. */
	const across = surfacePoint.y.add(surfacePoint.x.mul(0.3)).add(mx_noise_float(surfacePoint.mul(3).add(13)).mul(0.06));
	const lines = oneMinus(smoothstep(0.1, 0.35, abs(sin(across.mul(28)))));
	const segments = smoothstep(0.05, 0.3, mx_noise_float(surfacePoint.mul(6).add(31)));
	const pits = smoothstep(0.2, 0.5, mx_worley_noise_float(surfacePoint.mul(45).add(7)));
	const grooves = lines.mul(segments).mul(oneMinus(pits.mul(0.6))).mul(oneMinus(smoothstep(1.3, 1.8, stickney))).mul(0.22);
	return mix(rockySurface('#857669', '#5e534a', 10, 61).mul(oneMinus(grooves)), color('#4f463e'), floor.mul(0.5)).add(rim.mul(0.08));
}

/** A pink nitrogen frost cap over the south, streaked by the dark plumes of its geysers, and the dimpled "cantaloupe terrain" up north. */
export function tritonSurface() {
	const cap = oneMinus(smoothstep(-0.35, -0.05, surfacePoint.y.add(mx_noise_float(surfacePoint.mul(4)).mul(0.1))));
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

export function plutoSurface() {
	const wobble = mx_fractal_noise_float(surfacePoint.mul(5).add(19), 2, 2, 0.5);
	const tan = mix(color('#c49a74'), color('#d9b994'), edge(0.05, mx_fractal_noise_float(surfacePoint.mul(3).add(41), 3, 2, 0.5), 0.2));
	const north = smoothstep(0.55, 0.85, surfacePoint.y);
	const heart = spots(PLUTO_HEART, wobble);
	/** Sputnik Planitia's nitrogen ice churns in slow convection cells, their edges show as a faint polygon net. */
	const cells = oneMinus(smoothstep(0.02, 0.06, mx_worley_noise_float(surfacePoint.mul(40)))).mul(oneMinus(smoothstep(0.15, 0.3, angleTo(25, 177))));
	const plains = mix(mix(tan, color('#a59a92'), north.mul(0.6)), color('#5a2f22'), spots(CTHULHU, wobble.mul(1.5)).mul(0.85));
	return mix(plains, color('#f1e6d8'), heart).mul(oneMinus(cells.mul(0.12)));
}

/**
 * Neptune as Voyager 2 saw it in 1989: the Great Dark Spot at 22°S edged by bright methane clouds, the small white "Scooter" below
 * it, and the second dark spot with a bright core further south.
 */
export function neptuneSurface() {
	const wobble = mx_noise_float(surfacePoint.mul(9).add(27)).mul(0.15);
	/** Oval in arc degrees around a latitude and longitude, its half sizes along and across the latitude line. */
	const oval = (latitude: number, longitude: number, along: number, across: number) => {
		const offset = vec2(longitudeDegrees.sub(longitude).mul(Math.cos(MathUtils.degToRad(latitude))).div(along), latitudeDegrees.sub(latitude).div(across));
		return oneMinus(smoothstep(0.7, 1.05, length(offset).add(wobble)));
	};
	const dark = max(oval(-22, 0, 15, 7.6), oval(-55, -60, 5, 3.5).mul(0.8));
	const white = max(max(oval(-29, -6, 11, 2.2), oval(-42, 40, 5, 2.4)), oval(-55, -60, 1.8, 1.2));
	/** Kept under the bloom threshold, like Saturn's pale zones. */
	return mix(mix(bandedSurface(['#4a7fe6', '#2f58bd', '#6f9cf0'], 3, 0.3), color('#1d3a8c'), dark.mul(0.85)), color('#dbe5ff'), white.mul(0.9));
}

/** The Sun's granulation flow and convection cells, as raw masks in the red and green channels. */
export const sunMasks = () =>
	vec3(edge(0.1, mx_fractal_noise_float(surfacePoint.mul(2), 3, 2, 0.5), 0.15), oneMinus(edge(0.22, mx_worley_noise_float(surfacePoint.mul(5)), 0.08)), 0);

/** Faint Milky Way: a noisy band with dust lanes and a dim warm core, kept well below the stars so space stays dark. */
export function milkyWay() {
	const latitude = dot(surfacePoint, vec3(GALAXY_NORMAL.x, GALAXY_NORMAL.y, GALAXY_NORMAL.z));
	const toward = dot(surfacePoint, vec3(GALAXY_CORE.x, GALAXY_CORE.y, GALAXY_CORE.z));
	/** Seen edge-on from inside the disc: brightest and thickest toward the center in Sagittarius, faint toward the anticenter in Taurus. */
	const band = exp(latitude.mul(latitude).mul(mix(-48, -22, pow(saturate(toward), 4))));
	const depth = mix(0.45, 1, pow(toward.mul(0.5).add(0.5), 1.5));
	const clouds = mx_fractal_noise_float(surfacePoint.mul(4), 3, 2, 0.5).mul(0.5).add(0.6);
	const dust = smoothstep(0, 0.3, mx_fractal_noise_float(surfacePoint.mul(8).add(4), 3, 2, 0.5)).mul(exp(latitude.mul(latitude).mul(-250)));
	const density = saturate(band.mul(clouds).mul(depth).mul(oneMinus(dust.mul(0.7))));
	const coreGlow = pow(saturate(toward), 10).mul(band);
	return mix(color('#17151f'), color('#3a3447'), density)
		.mul(density)
		.mul(0.36)
		.add(color('#4a4552').mul(coreGlow).mul(0.12));
}
