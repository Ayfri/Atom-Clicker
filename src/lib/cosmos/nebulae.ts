import { atan, color, cos, dot, exp, float, length, log, max, mix, mx_fractal_noise_float, mx_worley_noise_float, oneMinus, pow, saturate, smoothstep, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

export interface DeepSkyObject {
	/** Position angle of the drawing's +x axis, its long axis, in degrees from the sky's north through east. */
	angle: number;
	/** Galactic longitude and latitude in degrees. */
	at: readonly [number, number];
	/** Cosmos object id of one the player discovers, and the tint of the smudge it shows until then. */
	discovery?: readonly [id: string, smudge: string];
	/** Glow from the plane's coordinates, -1 to 1 on both axes, baked into `static/cosmos/<id>.webp`. */
	draw: (p: Node<'vec2'>) => Node<'vec3'>;
	/** Its catalogue number, the name of its baked map. */
	id: string;
	/** Integrated apparent magnitude, the object fades in as the sight passes it. */
	magnitude: number;
	/** Width and height in degrees. */
	size: readonly [number, number];
}

/** Hydrogen alpha, the red-pink of every emission nebula, and doubly ionized oxygen, the teal of the hottest gas around young stars. */
const HYDROGEN = '#ff4d70';
const OXYGEN = '#7fe6d4';

const noise = (p: Node<'vec2'>, scale: number, seed: number, octaves = 4) => mx_fractal_noise_float(vec3(p.mul(scale), seed), octaves, 2, 0.55);

/** Fractal noise read through a second one, so gas curls into wisps and knots instead of round blobs: about 0 to 1. */
const gas = (p: Node<'vec2'>, scale: number, seed: number) => {
	const warp = vec2(noise(p, scale * 0.6, seed, 3), noise(p, scale * 0.6, seed + 17, 3));
	return saturate(noise(p.add(warp.mul(0.35 / scale)), scale, seed, 6).mul(0.7).add(0.5));
};

/** Thin bright strands along the zero lines of warped noise, `width` sets how thin. */
const strands = (p: Node<'vec2'>, scale: number, seed: number, width: number) => {
	const warp = vec2(noise(p, scale * 0.5, seed + 5, 3), noise(p, scale * 0.5, seed + 9, 3));
	return oneMinus(smoothstep(0, width, noise(p.add(warp.mul(0.5 / scale)), scale, seed, 4).abs()));
};

/** Gaussian blob, `stretch` undoes the plane's aspect so it stays round on the sky. */
const blob = (p: Node<'vec2'>, [x, y]: readonly [number, number], stretch: readonly [number, number], sharpness: number) => {
	const offset = p.sub(vec2(x, y)).mul(vec2(...stretch));
	return exp(dot(offset, offset).mul(-sharpness));
};

/** Stars of a cluster: a slice through 3D cells, so the dots come at uneven sizes and brightness, `size` in cells. */
const cluster = (p: Node<'vec2'>, scale: number, seed: number, size: number) => pow(oneMinus(smoothstep(0, size, mx_worley_noise_float(vec3(p.mul(scale), seed)))), 3);

/** Named stars as [x, y, brightness], drawn as sharp dots `size` wide. */
const stars = (p: Node<'vec2'>, list: readonly (readonly [number, number, number])[], stretch: readonly [number, number], size: number) =>
	list.reduce<Node<'float'>>((sum, [x, y, brightness]) => sum.add(blob(p, [x, y], stretch, 1 / size ** 2).mul(brightness)), float(0));

/**
 * The brightest galaxy and nebulae, at their real places in the galactic frame of the Milky Way dome, colored as long exposures show
 * them. The small ones are drawn a few times larger than life, at true size the Crab and the Ring would be a few pixels even at the
 * narrowest zoom.
 */
export const DEEP_SKY: DeepSkyObject[] = [
	{
		/**
		 * Andromeda, 2.5 million light years away and tilted 77° to us: a warm bulge, a cooler disc whose spiral arms read as rings of
		 * dust, darker on the near side, dotted with pink star-forming knots, and its companions M32 and M110.
		 */
		angle: 215,
		at: [121.17, -21.57],
		discovery: ['andromeda', '#d6d4ea'],
		draw: p => {
			/** The plane is three times wider than tall, `sky` measures it in true angles and `disc` in the galaxy's own plane. */
			const sky = p.mul(vec2(3, 1));
			const disc = vec2(p.x, p.y.mul(1.08));
			const radius = length(disc);
			const angle = atan(disc.y, disc.x);
			const bulge = exp(pow(length(sky).div(0.16), 0.75).mul(-2.4));
			/** Arms wound so tight they read as rings, as its 77° tilt shows them, and none inside the bulge. */
			const arms = cos(angle.mul(2).sub(log(max(radius, 0.05)).mul(9))).mul(0.5).add(0.5).mul(smoothstep(0.2, 0.38, radius));
			const texture = gas(disc, 5, 31);
			const near = smoothstep(-0.2, 0.4, p.y);
			const lanes = smoothstep(0.62, 0.86, arms.mul(texture.mul(0.6).add(0.7))).mul(oneMinus(smoothstep(0.8, 1, radius))).mul(mix(0.25, 1, near));
			const glow = exp(radius.mul(-3)).mul(texture.mul(0.3).add(0.85)).mul(arms.mul(0.2).add(0.9)).mul(oneMinus(smoothstep(0.75, 1, radius)));
			const knots = cluster(disc, 34, 7, 0.18).mul(arms).mul(smoothstep(0.3, 0.5, radius)).mul(oneMinus(smoothstep(0.75, 0.95, radius)));
			const m32 = exp(length(p.sub(vec2(0.04, -0.56)).mul(vec2(3, 1))).mul(-30));
			const m110 = blob(p, [-0.22, 0.8], [3, 1.7], 22);
			return mix(color('#b4c2ec'), color('#eadcc6'), exp(radius.mul(-5)))
				.mul(glow.mul(0.3).mul(oneMinus(lanes.mul(0.7))))
				.add(color('#ffe7c4').mul(bulge.mul(0.7)))
				.add(color('#ff9fbd').mul(knots.mul(0.1)))
				.add(color('#f4e6d0').mul(m32.mul(0.45).add(m110.mul(0.14))));
		},
		id: 'm31',
		magnitude: 3.4,
		size: [4.2, 1.4],
	},
	{
		/**
		 * The Orion Nebula, +x north and +y east: hydrogen wings fanning south around the teal, near white Huygens region the four
		 * Trapezium stars light, the dark Fish's Mouth reaching in from the east, and M43, a smaller glow around its own star to the north.
		 */
		angle: 0,
		at: [209.01, -19.38],
		discovery: ['orion_nebula', '#d7b8d8'],
		draw: p => {
			const envelope = exp(length(p.sub(vec2(-0.12, 0)).mul(vec2(1, 1.25))).mul(-3.4));
			const texture = gas(p, 2.6, 3);
			const wings = strands(p, 2.2, 7, 0.14).mul(envelope).mul(smoothstep(0.15, -0.35, p.x));
			const core = blob(p, [0.01, -0.02], [1, 1.2], 22).mul(gas(p, 6, 51).mul(0.6).add(0.6));
			const m43 = blob(p, [0.43, 0.05], [1, 1.1], 70);
			const mouth = blob(p, [0.2, 0.2], [1.6, 0.9], 30).add(blob(p, [0.29, 0.07], [1, 1], 120).mul(0.7));
			const dust = saturate(mouth.add(smoothstep(0.62, 0.8, gas(p, 3.5, 21)).mul(0.5).mul(smoothstep(0.1, 0.45, length(p)))));
			const inner = exp(length(p.sub(vec2(-0.03, 0))).mul(-6)).mul(texture.mul(0.6).add(0.6));
			const glow = envelope
				.mul(pow(texture, 1.5).mul(1.2).add(0.08))
				.add(inner.mul(0.6))
				.add(wings.mul(0.3))
				.add(core.mul(0.8))
				.add(m43.mul(0.35))
				.mul(oneMinus(dust.mul(0.85)));
			const hot = smoothstep(0.25, 1.1, core).mul(0.75).add(m43.mul(0.2));
			const trapezium = stars(
				p,
				[
					[0.008, 0.006, 1],
					[-0.009, 0.007, 0.8],
					[0.004, -0.01, 0.9],
					[-0.007, -0.004, 0.6],
					[-0.05, -0.03, 0.5],
					[0.44, 0.05, 0.6],
				],
				[1, 1],
				0.008,
			);
			const young = cluster(p, 28, 13, 0.14).mul(envelope).mul(0.5);
			const hydrogen = mix(color('#b8284a'), color('#ff7088'), saturate(envelope.mul(1.6).add(inner)));
			return mix(mix(hydrogen, color(OXYGEN), hot), color('#fff6f2'), saturate(core.sub(0.75).mul(2.5)))
				.mul(glow.mul(0.45))
				.add(color('#e8f0ff').mul(trapezium.add(young)));
		},
		id: 'm42',
		magnitude: 4,
		size: [1.4, 1.4],
	},
	{
		/** The Lagoon Nebula, named after the dark lane of dust that crosses its glow, with the bright Hourglass west of the lane and the young cluster NGC 6530 east of it. */
		angle: 90,
		at: [6.05, -1.2],
		draw: p => {
			const sky = p.mul(vec2(2, 1));
			const envelope = exp(length(sky.mul(vec2(0.6, 1))).mul(-3));
			const lane = oneMinus(smoothstep(0.02, 0.14, p.y.add(p.x.mul(0.35)).sub(0.05).add(noise(p, 4, 41, 3).mul(0.06)).abs()))
				.mul(smoothstep(-0.6, -0.1, p.x))
				.mul(oneMinus(smoothstep(0.3, 0.7, p.x)));
			const hourglass = blob(p, [-0.32, 0.02], [2, 1], 60).add(blob(p, [-0.3, 0.12], [2, 1], 90).mul(0.6));
			const glow = envelope.mul(gas(p, 2.8, 7).mul(0.9).add(0.15)).add(strands(sky, 1.6, 9, 0.12).mul(envelope).mul(0.3)).add(hourglass.mul(0.8));
			const young = cluster(sky, 14, 3, 0.16).mul(blob(p, [0.35, -0.05], [2, 1], 6)).add(cluster(sky, 30, 5, 0.12).mul(envelope).mul(0.4));
			return mix(color(HYDROGEN), color('#ffd2dc'), saturate(hourglass))
				.mul(glow.mul(0.38).mul(oneMinus(lane.mul(0.8))))
				.add(color('#dfe8ff').mul(young.mul(0.8)));
		},
		id: 'm8',
		magnitude: 6,
		size: [1.6, 0.8],
	},
	{
		/**
		 * The Eagle Nebula, with the Pillars of Creation: three columns of dust rising into the glow, the left one the tallest, tapering
		 * toward their heads, whose rims glow where the stars of NGC 6611 above them boil their surface away.
		 */
		angle: 225,
		at: [16.95, 0.79],
		draw: p => {
			/** Each pillar as its distance from its leaning, lumpy axis in widths, rounded over its head: 1 on its outline. */
			const pillars = (
				[
					[-0.18, 0.075, 0.42],
					[0.05, 0.06, 0.18],
					[0.22, 0.045, 0.06],
				] as const
			).reduce<Node<'vec2'>>(
				(cover, [x, half, top]) => {
					const width = mix(half * 1.5, half * 0.8, saturate(p.y.add(0.75).div(top + 0.75)));
					const across = p.x.sub(x).add(p.y.mul(0.14)).add(noise(p, 4, x * 10, 3).mul(0.022)).abs().div(width);
					const distance = length(vec2(across, max(p.y.sub(top), 0).div(half * 1.4)));
					const mask = oneMinus(smoothstep(0.75, 1, distance)).mul(smoothstep(-0.85, -0.55, p.y));
					const rim = smoothstep(0.7, 0.92, distance).mul(oneMinus(smoothstep(0.95, 1.12, distance))).mul(smoothstep(-0.4, top, p.y));
					return vec2(max(cover.x, mask), max(cover.y, rim));
				},
				vec2(0, 0),
			);
			const envelope = exp(length(p).mul(-2.8));
			const glow = envelope.mul(gas(p, 2.6, 11).mul(0.9).add(0.2)).add(strands(p, 2, 15, 0.12).mul(envelope).mul(0.25));
			const young = cluster(p, 16, 23, 0.16).mul(blob(p, [-0.3, 0.55], [1, 1], 4));
			return mix(color(HYDROGEN), color('#ffb08a'), smoothstep(0, 0.6, p.y))
				.mul(glow.mul(0.4).mul(oneMinus(pillars.x.mul(gas(p, 6, 61).mul(0.3).add(0.65)))))
				.add(color('#ffd6b0').mul(pillars.y.mul(envelope).mul(0.5)))
				.add(color('#e4ecff').mul(young.mul(0.9)));
		},
		id: 'm16',
		magnitude: 6,
		size: [1, 1],
	},
	{
		/**
		 * The Crab Nebula, what is left of the supernova of 1054: a lumpy oval cage of red and yellow filaments around the blue glow
		 * its pulsar's wind of electrons gives off, brightest toward the middle.
		 */
		angle: 125,
		at: [184.56, -5.78],
		discovery: ['crab_nebula', '#c9c4d8'],
		draw: p => {
			const radius = length(p).add(noise(p, 2.5, 9, 3).mul(0.1));
			const shell = oneMinus(smoothstep(0.72, 0.92, radius));
			const wind = exp(radius.mul(-2.6)).mul(gas(p, 3, 4).mul(0.4).add(0.7));
			const web = max(strands(p, 4.5, 5, 0.08), strands(p, 8, 12, 0.06).mul(0.7)).mul(smoothstep(0.1, 0.6, radius));
			const hue = smoothstep(0.75, 0.3, radius).mul(smoothstep(-0.3, 0.3, noise(p, 2, 33, 2)));
			return color('#8fb0ff')
				.mul(wind.mul(0.4))
				.add(mix(color('#ff5a3c'), color('#e9e27a'), hue).mul(web.mul(0.4)))
				.mul(shell)
				.add(color('#ffffff').mul(blob(p, [0.02, -0.03], [1.4, 1], 4000).mul(0.5)));
		},
		id: 'm1',
		magnitude: 8.4,
		size: [0.42, 0.3],
	},
	{
		/** The Ring Nebula, a dying star's shell of gas: a clumpy ring, teal inside, red at its rim, a faint red halo, the white dwarf a dot at its center. */
		angle: 60,
		at: [63.17, 13.98],
		draw: p => {
			const sky = p.mul(vec2(1.25, 1));
			const radius = length(sky).add(noise(p, 6, 3, 3).mul(0.025));
			const knots = gas(p, 7, 19).mul(0.6).add(0.6);
			const ring = exp(radius.sub(0.5).mul(radius.sub(0.5)).mul(-110)).mul(knots);
			const inside = oneMinus(smoothstep(0.1, 0.45, radius)).mul(0.08);
			const halo = exp(radius.sub(0.7).mul(radius.sub(0.7)).mul(-80)).mul(0.015);
			return mix(mix(color(OXYGEN), color('#c9dc8a'), smoothstep(0.38, 0.48, radius)), color('#ff5a4e'), smoothstep(0.5, 0.6, radius))
				.mul(ring.mul(0.55).add(inside))
				.add(color('#ff5a4e').mul(halo))
				.add(color('#e6f0ff').mul(blob(sky, [0, 0], [1, 1], 2500).mul(0.4)));
		},
		id: 'm57',
		magnitude: 8.8,
		size: [0.25, 0.2],
	},
	{
		/**
		 * Tycho's Supernova remnant as X-rays show it: a round shell of hot ejecta, red and gold knots inside a thin blue rim where the
		 * blast wave runs into the gas around it. Shown from the start, the supernova outshone Venus.
		 */
		angle: 0,
		at: [120.09, 1.42],
		discovery: ['tycho', '#e6e8f6'],
		draw: p => {
			const radius = length(p).add(noise(p, 3, 14, 3).mul(0.05));
			const rim = exp(radius.sub(0.8).mul(radius.sub(0.8)).mul(-260));
			const ejecta = smoothstep(0.85, 0.3, radius).mul(gas(p, 4, 27));
			const knots = smoothstep(0.55, 0.8, gas(p, 7, 33)).mul(smoothstep(0.85, 0.45, radius));
			return mix(color('#ff6a4a'), color('#ffd36b'), smoothstep(-0.3, 0.3, noise(p, 2, 61, 2)))
				.mul(ejecta.mul(0.3).add(knots.mul(0.4)))
				.add(color('#7fb2ff').mul(rim.mul(0.7)));
		},
		id: 'sn1572',
		magnitude: -4,
		size: [0.4, 0.4],
	},
	{
		/** Mira, a red giant racing through space and shedding a 13 light year tail of gas behind it, as ultraviolet images found it in 2007. */
		angle: 0,
		at: [167.76, -57.97],
		discovery: ['mira', '#ffb08a'],
		draw: p => {
			const core = blob(p, [0.72, 0], [3, 1], 700);
			const halo = blob(p, [0.72, 0], [3, 1], 30);
			const spread = p.x.mul(-0.5).add(0.6);
			const tail = exp(p.y.div(spread).mul(p.y.div(spread)).mul(-6))
				.mul(smoothstep(-0.95, 0.4, p.x))
				.mul(oneMinus(smoothstep(0.6, 0.75, p.x)))
				.mul(gas(p.mul(vec2(3, 1)), 3, 71).mul(0.6).add(0.4));
			return color('#ffe1b8').mul(core).add(color('#ff6a3a').mul(halo.mul(0.45))).add(color('#8fb6ff').mul(tail.mul(0.18)));
		},
		id: 'mira',
		magnitude: 0.5,
		size: [0.9, 0.3],
	},
	{
		/** Cosmic rays falling out of the Milky Way toward Cygnus: streaks of particles crossing the sky in the same slant, like rain. */
		angle: 0,
		at: [80, 1],
		discovery: ['cosmic_rays', '#a8f2da'],
		draw: p => {
			const across = p.x.mul(0.6).sub(p.y.mul(0.8));
			const along = p.x.mul(0.8).add(p.y.mul(0.6));
			const streaks = pow(saturate(noise(vec2(across.mul(16), along.mul(0.9)), 1, 5, 2).mul(1.6).add(0.2)), 8);
			return color('#6ff0c4').mul(streaks.mul(exp(dot(p, p).mul(-1.6))).mul(0.6));
		},
		id: 'cosmic_rays',
		magnitude: 14.3,
		size: [5, 5],
	},
	{
		/** The cosmic microwave background as Planck mapped it: the Big Bang's afterglow, warmer and cooler by a few parts in 100,000, in its false colors. */
		angle: 0,
		at: [264, 48],
		discovery: ['cmb', '#ffcf9a'],
		draw: p => mix(color('#2b4cff'), color('#ff6a3a'), saturate(noise(p, 7, 3, 5).mul(1.4).add(0.5))).mul(0.14),
		id: 'cmb',
		magnitude: 16.5,
		size: [36, 24],
	},
	{
		/** NGC 4993, the elliptical galaxy around the GW170817 kilonova, with the kilonova's violet flash off its core as it was in August 2017. */
		angle: 0,
		at: [308.37, 39.3],
		discovery: ['kilonova', '#d9c4ff'],
		draw: p => {
			const galaxy = exp(pow(length(p.mul(vec2(1, 1.25))).div(0.3), 0.8).mul(-2.4));
			const flash = blob(p, [0.32, -0.2], [1, 1.25], 900);
			const glow = blob(p, [0.32, -0.2], [1, 1.25], 50);
			return color('#f0dcc0').mul(galaxy.mul(0.5)).add(color('#ffffff').mul(flash)).add(color('#b98aff').mul(glow.mul(0.35)));
		},
		id: 'ngc4993',
		magnitude: 17.5,
		size: [0.25, 0.2],
	},
];
