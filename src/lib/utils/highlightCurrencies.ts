import { CURRENCIES } from '#data/currencies.js';

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Every spelling prose uses for a currency: a multi-word name also matches with its other words in lowercase ("Decay events") and in the other
 * number ("Higgs Bosons", "Excited Photon"). One-word names keep their exact plural, so "Photon Realm" or "Atom Clicker" never light up.
 */
const spellings = new Map(
	Object.values(CURRENCIES).flatMap(({ color, name }) => {
		if (!name.includes(' ')) return [[name, color] as const];
		const numbers = [name, name.endsWith('s') ? name.slice(0, -1) : `${name}s`];
		return numbers.flatMap(spelling => [spelling, spelling.replace(/ (.+)$/, tail => tail.toLowerCase())]).map(spelling => [spelling, color] as const);
	}),
);

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Longest spellings first so "Excited Photons" matches before the shorter "Photons". */
const highlightPattern = new RegExp(
	`\\b(${[...spellings.keys()]
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp)
		.join('|')})\\b`,
	'g',
);

/**
 * Wraps known currency names in a colored `<strong>` so tutorial/help copy (plain strings, not
 * Svelte snippets) can call out "Neutrons", "Electrons" etc. the same way CurrencyLabel does inline.
 */
export function highlightCurrencies(text: string): string {
	return escapeHtml(text).replace(highlightPattern, name => `<strong style="color: ${spellings.get(name)}">${name}</strong>`);
}
