import { describe, expect, test } from 'bun:test';
import { autoLevel, globeLut, MAP_HEIGHT, MAP_WIDTH, shadeGlobe } from './skyGlobe.js';

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
