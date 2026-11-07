/** Rock proportions with no Three.js import, so the sky list draws the same rocks as the 3D scene. `axes` are the real proportions, the longest reaches the body's radius. */
export interface RockShape {
	axes: readonly [x: number, y: number, z: number];
	seed: number;
}

export const ROCK_SHAPES: Readonly<Record<string, RockShape>> = {
	asteroid_belt: { axes: [1.15, 0.9, 0.95], seed: 4 },
	deimos: { axes: [1.17, 0.95, 0.86], seed: 9 },
	eros: { axes: [1.5, 0.52, 0.5], seed: 17 },
	halley: { axes: [1.2, 0.66, 0.66], seed: 13 },
	phobos: { axes: [1.2, 0.98, 0.82], seed: 2 },
};

/** Radial dent of a rock along a unit direction, from 0.87 to 1.13: the mesh and the thumbnail both scale their stretched sphere by it. */
export const rockLumps = (x: number, y: number, z: number, seed: number) =>
	1 + 0.08 * Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 2) + 0.05 * Math.sin(z * 5.3 + seed * 3);
