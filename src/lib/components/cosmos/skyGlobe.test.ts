import { describe, expect, test } from 'bun:test';
import { ROCK_SHAPES } from '#lib/cosmos/rockShapes.js';
import { autoLevel, globeLut, MAP_HEIGHT, MAP_WIDTH, rockLut, shadeGlobe } from './skyGlobe.js';

const SIZE = 32;

/** A map whose red channel encodes the column (100 to 227), so a wrong or missing read shows in the pixel. */
function columnMap() {
	const map = new Uint8ClampedArray(MAP_WIDTH * MAP_HEIGHT * 4);
	for (let i = 0; i < MAP_WIDTH * MAP_HEIGHT; i++) map.set([100 + (i % MAP_WIDTH), 0, 0, 255], i * 4);
	return map;
}

describe('shadeGlobe', () => {
	const lut = globeLut(SIZE, SIZE / 2);
	const source = columnMap();
	const frame = (turn: number) => {
		const out = new Uint8ClampedArray(SIZE * SIZE * 4);
		shadeGlobe(out, source, lut, turn);
		return out;
	};

	test('reads a map column for every pixel of the disc whatever the turn, negative or past a full revolution', () => {
		for (const turn of [-0.4, -MAP_WIDTH * 3 - 0.5, MAP_WIDTH - 0.01, MAP_WIDTH * 5]) {
			const out = frame(turn);
			for (let i = 0; i < lut.pixel.length; i++) {
				const column = (((Math.floor(lut.column[i] + turn) % MAP_WIDTH) + MAP_WIDTH) % MAP_WIDTH) + 100;
				expect(Math.abs(out[lut.pixel[i] * 4] - column * lut.shade[i])).toBeLessThanOrEqual(0.5);
			}
		}
	});

	test('a turn and the same turn plus whole revolutions give the same frame', () => {
		expect(frame(-0.4 + MAP_WIDTH * 2)).toEqual(frame(-0.4));
	});

	test('the corners outside the disc stay transparent', () => {
		expect(frame(3).slice(0, 4)).toEqual(new Uint8ClampedArray(4));
	});
});

describe('rockLut', () => {
	const bounds = (lut: ReturnType<typeof rockLut>) => {
		const xs = Array.from(lut.pixel, pixel => pixel % lut.size);
		const ys = Array.from(lut.pixel, pixel => Math.floor(pixel / lut.size));
		return { height: Math.max(...ys) - Math.min(...ys) + 1, width: Math.max(...xs) - Math.min(...xs) + 1 };
	};

	test('every rock stays inside its box and reads valid map cells', () => {
		for (const shape of Object.values(ROCK_SHAPES)) {
			const lut = rockLut(64, 32, shape);
			const { width } = bounds(lut);
			expect(width).toBeLessThanOrEqual(64);
			expect(width).toBeGreaterThan(56);
			expect(lut.row.every(row => row < MAP_HEIGHT)).toBe(true);
			expect(lut.column.every(column => Math.abs(column) <= MAP_WIDTH / 2)).toBe(true);
			expect(lut.shade.every(light => light >= 0.07 && light <= 1)).toBe(true);
		}
	});

	test('a peanut like Eros is drawn much wider than tall, a round-ish potato is not', () => {
		const eros = bounds(rockLut(64, 32, ROCK_SHAPES.eros));
		const deimos = bounds(rockLut(64, 32, ROCK_SHAPES.deimos));
		expect(eros.width / eros.height).toBeGreaterThan(2);
		expect(deimos.width / deimos.height).toBeLessThan(1.8);
	});

	test('the corner stays transparent and the outline is anti-aliased', () => {
		const lut = rockLut(64, 32, ROCK_SHAPES.eros);
		expect(lut.pixel.includes(0)).toBe(false);
		expect(lut.alpha.some(alpha => alpha > 0 && alpha < 255)).toBe(true);
	});
});

describe('autoLevel', () => {
	test('a black image stays black', () => {
		const data = new Uint8ClampedArray(64 * 4).fill(0);
		autoLevel(data);
		expect(data.every(value => value === 0)).toBe(true);
	});

	test('raises the brightest pixels to the target and leaves the alpha alone', () => {
		const data = new Uint8ClampedArray(100 * 4);
		for (let i = 0; i < 100; i++) data.set([i < 50 ? 10 : 20, 10, 10, 255], i * 4);
		autoLevel(data, 200);
		expect([data[0], data[4 * 99], data[3]]).toEqual([100, 200, 255]);
	});

	test('a small bright spot in a black image still levels on the spot', () => {
		const data = new Uint8ClampedArray(1000 * 4);
		data.set([40, 40, 40, 255], 0);
		autoLevel(data, 200);
		expect(data[0]).toBe(200);
	});
});
