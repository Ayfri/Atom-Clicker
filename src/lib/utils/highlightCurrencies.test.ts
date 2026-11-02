import { expect, test } from 'bun:test';
import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
import { highlightCurrencies } from '#lib/utils/highlightCurrencies.js';

const strong = (name: string, currency: keyof typeof CURRENCIES) => `<strong style="color: ${CURRENCIES[currency].color}">${name}</strong>`;

test('multi-word currencies match in both numbers and with a lowercase tail, one-word names only as written', () => {
	expect(highlightCurrencies('It stays on while your Higgs Bosons last.')).toBe(`It stays on while your ${strong('Higgs Bosons', CurrenciesTypes.HIGGS_BOSON)} last.`);
	expect(highlightCurrencies('+3 Decay events/s')).toBe(`+3 ${strong('Decay events', CurrenciesTypes.DECAY_EVENTS)}/s`);
	expect(highlightCurrencies('An Excited Photon, then Photons')).toBe(
		`An ${strong('Excited Photon', CurrenciesTypes.EXCITED_PHOTONS)}, then ${strong('Photons', CurrenciesTypes.PHOTONS)}`,
	);
	expect(highlightCurrencies('Install Atom Clicker from the Photon Realm')).toBe('Install Atom Clicker from the Photon Realm');
	expect(highlightCurrencies('makes Blue Light')).toBe(`makes ${strong('Blue Light', CurrenciesTypes.BLUE_LIGHT)}`);
});
