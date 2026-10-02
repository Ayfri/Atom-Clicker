import { CURRENCIES, type CurrencyName } from '#data/currencies.js';

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Longest names first so "Excited Photons" matches before the shorter "Photons".
const currencyNames = Object.values(CURRENCIES)
	.map(currency => currency.name)
	.sort((a, b) => b.length - a.length);

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const highlightPattern = new RegExp(`\\b(${currencyNames.map(escapeRegExp).join('|')})\\b`, 'g');

/**
 * Wraps known currency names in a colored `<strong>` so tutorial/help copy (plain strings, not
 * Svelte snippets) can call out "Neutrons", "Electrons" etc. the same way CurrencyLabel does inline.
 */
export function highlightCurrencies(text: string): string {
	return escapeHtml(text).replace(highlightPattern, name => {
		const color = CURRENCIES[name as CurrencyName]?.color;
		return `<strong style="color: ${color}">${name}</strong>`;
	});
}
