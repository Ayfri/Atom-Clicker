import { expect, test } from 'bun:test';
import { vec3 } from 'three/tsl';
import { MathUtils } from 'three/webgpu';
import { COSMOS_OBJECTS } from '#data/cosmos.js';
import { BODY_LOOKS } from './bodies.js';
import { trueAnomaly } from './orbits.js';
import { Sky } from './sky.js';

test('every object to discover is drawn in the scene, as a body or a nebula', () => {
	const { nebulae } = new Sky(() => vec3(0), 0, []);
	for (const object of COSMOS_OBJECTS.filter(object => !object.given)) expect(object.id in BODY_LOOKS || nebulae.has(object.id), object.id).toBe(true);
});

test("Kepler's equation holds up to Halley's eccentricity", () => {
	for (const eccentricity of [0, 0.0167, 0.2488, 0.86, 0.968]) {
		for (let i = 0; i < 360; i++) {
			const mean = MathUtils.degToRad(i - 180);
			const anomaly = trueAnomaly({ distance: 1, eccentricity, period: 1, phase: 0 }, mean);
			const eccentric = 2 * Math.atan(Math.sqrt((1 - eccentricity) / (1 + eccentricity)) * Math.tan(anomaly / 2));
			expect(Math.abs(MathUtils.euclideanModulo(eccentric - eccentricity * Math.sin(eccentric) - mean + Math.PI, Math.PI * 2) - Math.PI)).toBeLessThan(1e-8);
		}
	}
});
