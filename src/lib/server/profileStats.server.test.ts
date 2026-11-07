import { describe, expect, test } from 'bun:test';
import { CLICKABLE_OBJECTS, COSMOS_OBJECTS } from '#data/cosmos.js';
import { ELEMENT_COUNT } from '#data/elements.js';
import { readStats } from '#lib/server/profileStats.server.js';

const given = COSMOS_OBJECTS.filter(object => object.given);
const found = COSMOS_OBJECTS.find(object => !object.given)!;
const moon = COSMOS_OBJECTS.find(object => object.orbits)!;
const [first, second] = CLICKABLE_OBJECTS;

describe('readStats', () => {
	test('a save from before the Cosmos reads as zeros', () => {
		const stats = readStats({ totalClicksAllTime: 12 });
		expect(stats).toMatchObject({ clicks: 12, discoveries: 0, elements: 0, guestStars: 0, neutrinos: 0, skyTaps: 0 });
	});

	test('nothing but an empty save is refused', () => {
		expect(readStats({})).toBeNull();
		expect(readStats(null)).toBeNull();
	});

	test('the Cosmos and the Table are counted as the game counts them', () => {
		const stats = readStats({
			cosmos: {
				clicks: { [first.id]: 40.9, [second.id]: 'many', [moon.id]: 999, ghost: 5 },
				discovered: [found.id, found.id, 'ghost'],
				guestStars: 3,
			},
			periodic: { identified: [1, 1, 2, 0, ELEMENT_COUNT + 1, 2.5, '3'], neutrinos: 7 },
			totalIonizesAllTime: 1,
		});
		expect(stats).toMatchObject({ discoveries: given.length + 1, elements: 2, guestStars: 3, neutrinos: 7, skyTaps: 40 });
	});

	test('the given objects only count once the first Ionize opened the Cosmos', () => {
		expect(readStats({ cosmos: { discovered: [found.id] }, totalClicksAllTime: 1 })?.discoveries).toBe(0);
	});

	test('a hand-edited save with the wrong shapes reads as zeros', () => {
		const stats = readStats({ cosmos: 'x', periodic: { identified: 'all', neutrinos: -4 }, totalIonizesAllTime: 1 });
		expect(stats).toMatchObject({ elements: 0, guestStars: 0, neutrinos: 0, skyTaps: 0 });
	});
});
