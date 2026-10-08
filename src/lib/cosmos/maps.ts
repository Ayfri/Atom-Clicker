import { mix, pow, step, uv, vec3, vec4 } from 'three/tsl';
import {
	DoubleSide,
	Mesh,
	MeshBasicNodeMaterial,
	type Node,
	NoColorSpace,
	PerspectiveCamera,
	RenderTarget,
	RepeatWrapping,
	Scene,
	SphereGeometry,
	SRGBColorSpace,
	TextureLoader,
	type WebGPURenderer,
} from 'three/webgpu';
import { BODY_LOOKS } from './bodies.js';
import { cloudCover, earthSurface, milkyWay, sunMasks } from './surfaces.js';

/**
 * Suffix of a body's double width map, loaded in high quality for the followed body only: every body at that size would take ~200 MB
 * of GPU memory, more than phones have to spare.
 */
export const SHARP = '_hd';

/** Every baked surface with its texture width (the height is half): the bodies, the Earth's day colors, masks and clouds, the Sun and the sky. */
const BAKED_SURFACES: Record<string, { lossless?: boolean; node: () => Node<'vec3'>; width: number }> = {
	clouds: { node: () => vec3(cloudCover()), width: 2048 },
	earth: { node: () => earthSurface().day, width: 2048 },
	earth_masks: { node: () => earthSurface().masks, width: 2048 },
	/** Lossy WebP cut the faint gradients of the Milky Way into visible square blocks. */
	sky: { lossless: true, node: milkyWay, width: 1024 },
	sun: { node: sunMasks, width: 1024 },
	...Object.fromEntries(
		Object.entries(BODY_LOOKS).flatMap(([id, { surface }]) =>
			surface
				? [
						[id, { node: surface, width: 1024 }],
						[`${id}${SHARP}`, { node: surface, width: 2048 }],
					]
				: [],
		),
	),
};

/** Masks and covers stored as raw data, the color maps are sRGB. */
const RAW_SURFACES = new Set(['clouds', 'earth_masks', 'sun']);

/** A baked map is a single texture read, its live shader stacks dozens of noise octaves that take seconds to compile. */
export const liveSurface = (id: string) => BAKED_SURFACES[id].node();

export async function loadSurface(id: string) {
	const map = await new TextureLoader().loadAsync(`/cosmos/${id}.webp`);
	map.colorSpace = RAW_SURFACES.has(id) ? NoColorSpace : SRGBColorSpace;
	map.wrapS = RepeatWrapping;
	map.anisotropy = 4;
	return map;
}

/**
 * Loads every baked surface, the ones in `live` are left out and drawn from their shaders instead. A missing file (a body added
 * since the last bake) falls back to its shader too.
 */
export async function loadSurfaces(live: readonly string[]) {
	const entries = await Promise.all(
		Object.keys(BAKED_SURFACES)
			.filter(id => !live.includes(id) && !id.endsWith(SHARP))
			.map(id => loadSurface(id).then(map => [id, map] as const, () => null)),
	);
	return new Map(entries.filter(entry => entry !== null));
}

/** Linear to sRGB, the exact piecewise curve an sRGB texture decodes. */
const encodeSrgb = (linear: Node<'vec3'>) => mix(linear.mul(12.92), pow(linear, vec3(1 / 2.4)).mul(1.055).sub(0.055), step(0.0031308, linear));

/**
 * Renders every surface into its equirectangular map, as WebP files for `static/cosmos/`. Each vertex of a sphere is moved to where
 * its UV points in the map, so its fragments evaluate the surface at the matching spot.
 */
export async function bakeSurfaces(renderer: WebGPURenderer) {
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
		renderer.setRenderTarget(target);
		renderer.render(new Scene().add(mesh), camera);
		renderer.setRenderTarget(null);
		const pixels = (await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height)) as Uint8Array;
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
