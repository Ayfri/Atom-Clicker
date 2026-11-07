import { describe, expect, test } from 'bun:test';
import { COSMOS_INSTRUMENTS, COSMOS_OBJECTS_BY_ID } from '#data/cosmos.js';
import { CHAINS, SITE_IDS, SITES } from '#data/sites.js';
import { instrumentLinks, instrumentReadyMessage, objectLinks, unlockPhrase } from '#data/tableLinks.js';

const instrument = (id: string) => COSMOS_INSTRUMENTS.find(item => item.id === id)!;

describe('instrumentLinks', () => {
	test('Hess balloon brings the cosmic rays, which open their source', () => {
		expect(instrumentLinks('balloon')).toEqual({ sites: ['cosmic'], steps: [], table: false });
	});

	test('Holmdel antenna brings the background light, which lets the Big Bang forge lithium', () => {
		expect(instrumentLinks('horn_antenna')).toEqual({ sites: [], steps: [{ site: 'bigbang', z: 3 }], table: false });
	});

	test('LIGO brings the kilonova, which opens the neutron star source', () => {
		expect(instrumentLinks('ligo').sites).toEqual(['neutron']);
	});

	test('the Spectroscope opens the Table itself and no source', () => {
		expect(instrumentLinks('spectroscope')).toEqual({ sites: [], steps: [], table: true });
	});

	test('an instrument whose objects lead nowhere links to nothing', () => {
		expect(instrumentLinks('reflector')).toEqual({ sites: [], steps: [], table: false });
		expect(instrumentLinks('unknown')).toEqual({ sites: [], steps: [], table: false });
	});

	test('every object a source or a chain step waits for exists and sits in the era of exactly one instrument', () => {
		const waited = SITE_IDS.flatMap(id => [SITES[id].object, ...Object.values(CHAINS[id].seeds).map(seed => seed.object)]).filter((object): object is string => !!object);
		expect(waited.length).toBeGreaterThan(0);
		for (const id of waited) {
			const object = COSMOS_OBJECTS_BY_ID[id];
			expect(object).toBeDefined();
			expect(COSMOS_INSTRUMENTS.filter(item => item.era === object.era)).toHaveLength(1);
		}
	});
});

describe('objectLinks', () => {
	test('the background light unblocks lithium without opening a source', () => {
		expect(objectLinks('cmb')).toEqual({ sites: [], steps: [{ site: 'bigbang', z: 3 }], table: false });
	});

	test('the Crab Nebula opens the supernova source', () => {
		expect(objectLinks('crab_nebula').sites).toEqual(['massive']);
	});

	test('a plain planet links to nothing', () => {
		expect(objectLinks('mars')).toEqual({ sites: [], steps: [], table: false });
	});
});

describe('unlockPhrase and instrumentReadyMessage', () => {
	test('a source reads as opening, a chain step as letting the source forge the element', () => {
		expect(unlockPhrase(objectLinks('cosmic_rays'), 'line')).toBe('opens Cosmic rays');
		expect(unlockPhrase(objectLinks('cmb'), 'line')).toBe('lets the Big Bang forge Li');
		expect(unlockPhrase(objectLinks('cmb'), 'toast')).toBe('let the Big Bang forge lithium');
	});

	test('the toast names the object to discover, and is empty for an instrument that leads nowhere', () => {
		expect(instrumentReadyMessage(instrument('horn_antenna'))).toBe('Discover Cosmic microwave background to let the Big Bang forge lithium in the Periodic Table.');
		expect(instrumentReadyMessage(instrument('balloon'))).toBe('Discover Cosmic rays to open Cosmic rays in the Periodic Table.');
		expect(instrumentReadyMessage(instrument('spectroscope'))).toBeNull();
		expect(instrumentReadyMessage(instrument('reflector'))).toBeNull();
	});
});
