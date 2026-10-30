import {
	cameraPosition,
	color,
	dot,
	float,
	fwidth,
	length,
	max,
	min,
	mix,
	normalView,
	normalWorld,
	normalWorldGeometry,
	oneMinus,
	positionLocal,
	positionViewDirection,
	positionWorld,
	pow,
	remapClamp,
	saturate,
	select,
	smoothstep,
	uniform,
	vec3,
} from 'three/tsl';
import { BackSide, type Material, Mesh, MeshBasicNodeMaterial, type Node, SphereGeometry, Vector3 } from 'three/webgpu';
import { EARTH_ORBIT, RADII, type RoundBody } from './space.js';

/** Sun at the origin, so the light direction is the way back to it. */
export const toSun = positionWorld.negate().normalize();
export const sunFacing = dot(normalWorld, toSun);
export const fresnel = oneMinus(saturate(dot(normalView, positionViewDirection)));
export const surfacePoint = positionLocal.normalize();

/** 0 for the cartoon lighting, 1 for the realistic one, eased in between so a switch cross-fades. */
export const realism = uniform(0);
/**
 * Squared distance from the Sun the view is exposed for. Sunlight falls off with the square of the distance, Neptune gets 1/900 of
 * the Earth's, so the exposure adapts to the body in view like a camera: a far planet reads once visited, dim seen from the Earth.
 */
export const exposure = uniform(EARTH_ORBIT ** 2);
/** Sunlight of the realistic lighting against the exposure, capped so an inner planet seen from far out doesn't burn white. */
export const sunlight = min(exposure.div(dot(positionWorld, positionWorld)), 3);
/** How much the Sun or a sunlit body in view dazzles, 0 to 1, see `CosmosScene.#adaptToGlare`. */
export const glare = uniform(0);
/**
 * Share of the sky's light left in the realistic lighting: eyes and cameras set for the Sun or a sunlit body lose every star, why
 * the sky is black on the Apollo photos. Only a view away from both shows the stars and the Milky Way.
 */
export const darkSky = oneMinus(realism.mul(glare));
/** 1 in high quality, 0 in low: the extra shading terms fade out instead of recompiling every body's material. */
export const detail = uniform(1);

/**
 * Diffuse sunlight of the realistic lighting. Airless dusty ground scatters light back toward the Sun (Lommel-Seeliger), blended
 * in by `regolith` like the lunar-Lambert model: a full Moon is a flat disc, not a shaded ball. Both terms are averaged over the
 * pixel, a crescent thinner than a pixel and the limb seen edge-on otherwise light single pixels that blink as the view moves.
 */
export function diffuse(regolith = 0) {
	const width = max(fwidth(sunFacing), 1e-4);
	const half = width.mul(0.5);
	const incidence = select(sunFacing.greaterThan(half), sunFacing, pow(max(sunFacing.add(half), 0), 2).div(width.mul(2)));
	if (!regolith) return incidence;
	const toCamera = dot(normalWorld, cameraPosition.sub(positionWorld).normalize());
	/** Held at the pixel's own spread, at the limb the backscatter ratio would spike toward 2 on a single pixel. */
	const emission = max(toCamera, fwidth(toCamera));
	return mix(incidence, incidence.mul(2).div(max(incidence.add(emission), 1e-3)), regolith);
}

/** A soft edge between two flat color areas, wide enough that regions blend instead of switching abruptly. */
export const edge = (at: number, value: Node<'float'>, width = 0.04) => smoothstep(at - width, at + width, value);

/** Softened cel shading: a smooth terminator plus a gentle second band, stylized without hard light steps. */
export const toon = (light: Node<'float'>, night: number) =>
	float(night)
		.add(smoothstep(-0.12, 0.08, light).mul(0.55 - night))
		.add(smoothstep(0.1, 0.5, light).mul(0.45));

/**
 * Flat atmosphere band on the lit limb, plus a faint outline on the night side so the silhouette stays readable against space.
 * `shade` dims the lit band like the rest of the sunlight, the night outline isn't sunlit.
 */
export const outline = (lit: string, night: string, shade: Node<'vec3'> = vec3(1)) =>
	color(lit)
		.mul(edge(0.72, fresnel))
		.mul(smoothstep(-0.25, 0.1, sunFacing))
		.mul(shade)
		.add(color(night).mul(edge(0.86, fresnel)).mul(oneMinus(smoothstep(-0.25, 0.1, sunFacing))));

/** Condenses out of the signal's light: starts as a cyan glow and cools down to the surface. */
export const condense = (lit: Node<'vec3'>, reveal: Node<'float'>) => mix(color('#8ff5ff').mul(3), lit, reveal);

/** Limb colors on the lit and night sides, and how strong the band is. */
export type Rim = readonly [lit: string, night: string, strength: number];
const ICY_RIM: Rim = ['#ffffff', '#26356e', 0.25];

export interface Finish {
	/** Light that isn't the Sun's, added on the night side: earthshine on the Moon. */
	glow?: Node<'vec3'>;
	/** How much a thick atmosphere dims toward the limb, 0.3 is a Jupiter. High quality only. */
	limb?: number;
	rim?: Rim;
	/** Tints the sunlight: eclipses, Saturn's ring shadow. */
	shade?: Node<'vec3'>;
}

/** Lights a body's albedo with the soft cel shading and its limb. */
export function bodyMaterial(reveal: Node<'float'>, albedo: Node<'vec3'>, { glow, limb = 0, rim: [rimLit, rimNight, strength] = ICY_RIM, shade = vec3(1) }: Finish = {}) {
	/** Limb darkening: the slanted line of sight at the edge crosses more haze above the cloud tops. */
	const limbDarkening = limb ? oneMinus(pow(fresnel, 2).mul(detail.mul(limb))) : float(1);
	/**
	 * Shadows only dim the sunlight: on the 2% night floor and the night outline they printed the shadow's line through the planet a
	 * second time, on its night side. On the lit limb band they leave no bright ring around a moon in shadow.
	 */
	const cartoon = toon(sunFacing, 0).mul(shade).add(0.02);
	/** Black at night, airless bodies get the lunar-Lambert backscatter and thick atmospheres keep their limb darkening alone. */
	const realistic = diffuse(limb ? 0 : 0.7).mul(shade).mul(sunlight);
	const sunlit = albedo.mul(mix(cartoon, realistic, realism)).mul(limbDarkening);
	const night = oneMinus(smoothstep(-0.12, 0.08, sunFacing));
	const lit = glow ? sunlit.add(albedo.mul(glow).mul(detail).mul(night).mul(mix(1, sunlight, realism))) : sunlit;
	const material = new MeshBasicNodeMaterial();
	/** The limb bands are drawn outlines, the realistic lighting drops them. */
	material.colorNode = condense(lit.add(outline(rimLit, rimNight, shade).mul(oneMinus(realism).mul(strength))), reveal);
	return material;
}

/** World position of every body's center, written each frame, so the shaders can tell where their shadows fall. */
const newCenter = () => uniform(new Vector3());
const centers = new Map<string, ReturnType<typeof newCenter>>();
export const centerOf = (id: string) => centers.get(id) ?? centers.set(id, newCenter()).get(id)!;

/**
 * Sunlight left once the shadows of `occluders` are cast: 0 in the umbra, softening toward a penumbra that widens with the shadow's
 * length. The Sun is much bigger than life here, its real angular size keeps the shadows crisp enough to read.
 */
export function eclipse(occluders: readonly RoundBody[]) {
	return occluders.reduce<Node<'float'>>((light, id) => {
		const radius = RADII[id];
		const toOccluder = centerOf(id).sub(positionWorld);
		const along = dot(toOccluder, toSun);
		const miss = length(toOccluder.sub(toSun.mul(along)));
		const soft = along.mul(0.004).add(radius * 0.12);
		const covered = oneMinus(smoothstep(soft.negate().add(radius), soft.add(radius), miss)).mul(smoothstep(0, radius, along));
		return light.mul(oneMinus(covered.mul(0.94)));
	}, float(1));
}

export const sphere = (radius: number, material: Material, detail = 64) => new Mesh(new SphereGeometry(radius, detail, Math.round(detail * 0.7)), material);

/** Back-face shell around a body: a haze fading outward from its limb, on the lit side, hidden until the body is revealed. */
export function hazeShell(radius: number, tint: string, reveal: Node<'float'>, strength: number) {
	const facing = dot(normalWorldGeometry, toSun);
	const shellFresnel = oneMinus(dot(normalView, positionViewDirection).abs());
	const material = new MeshBasicNodeMaterial({ depthWrite: false, side: BackSide, transparent: true });
	material.colorNode = color(tint).mul(mix(1, sunlight, realism));
	material.opacityNode = pow(remapClamp(shellFresnel, 0.7, 1, 1, 0), 2).mul(smoothstep(-0.4, 0.8, facing)).mul(reveal).mul(strength);
	return sphere(radius, material, 48);
}
