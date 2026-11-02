import { CURRENCIES } from '#data/currencies.js';
import { QUARK_CHARGE_COLORS } from '#data/quarks.js';

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Every spelling prose uses for a currency: a multi-word name also matches with its other words in lowercase ("Decay events") and in the other
 * number ("Higgs Bosons", "Excited Photon"). One-word names keep their exact plural, so "Photon Realm" or "Atom Clicker" never light up.
 */
const spellings = new Map<string, string>([
	...Object.values(CURRENCIES).flatMap(({ color, name }) => {
		const style = `color: ${color}`;
		if (!name.includes(' ')) return [[name, style] as const];
		const numbers = [name, name.endsWith('s') ? name.slice(0, -1) : `${name}s`];
		return numbers.flatMap(spelling => [spelling, spelling.replace(/ (.+)$/, tail => tail.toLowerCase())]).map(spelling => [spelling, style] as const);
	}),
	/** Quarks live on the account, outside CURRENCIES, and read as the same three-color wordmark as `QuarkLabel`. */
	[
		'Quarks',
		`background: linear-gradient(90deg, ${QUARK_CHARGE_COLORS.blue}, ${QUARK_CHARGE_COLORS.green}, ${QUARK_CHARGE_COLORS.red}); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent`,
	],
]);

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
	return escapeHtml(text).replace(highlightPattern, name => `<strong style="${spellings.get(name)}">${name}</strong>`);
}
