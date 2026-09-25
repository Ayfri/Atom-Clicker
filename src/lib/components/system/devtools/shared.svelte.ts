import type { CurrencyName } from '$data/currencies';
import { GENERATOR_LEVEL_UP_COST, GENERATORS, type GeneratorType } from '$data/generators';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { gameManager } from '$helpers/GameManager.svelte';
import { SAVE_KEY } from '$helpers/saves';
import { SUFFIXES } from '$lib/utils';
import { getItem, getJSON, removeItem, setItem } from '$lib/utils/safeLocalStorage';

const base =
	'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30';
export const btn = `${base} bg-white/5 text-white/80 hover:bg-white/10 hover:text-white`;
export const btnAccent = `${base} bg-accent-500/20 text-accent-200 hover:bg-accent-500/35`;
export const btnDanger = `${base} bg-red-500/15 text-red-300 hover:bg-red-500/25`;
export const field =
	'w-full min-w-0 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-xs text-white outline-none transition-colors placeholder:text-white/30 focus:border-accent-400/60';
export const checkbox = 'size-4 cursor-pointer accent-accent-500';

const SUFFIX_EXPONENTS = new Map(SUFFIXES.map((suffix, index) => [suffix.toLowerCase(), index * 3]));

/**
 * Reads plain numbers, scientific notation and the game's own suffixes, NaN on anything else.
 * @example parseNumber('1.5e30') // 1.5e30
 * @example parseNumber('250k') // 250000
 * @example parseNumber('3Qa') // 3e15
 */
export function parseNumber(text: string): number {
	const match = /^(-?[\d.]+(?:e[+-]?\d+)?)([a-z]*)$/i.exec(text.replace(/[\s,_]/g, ''));
	const exponent = match && SUFFIX_EXPONENTS.get(match[2].toLowerCase());
	return match && exponent !== undefined && exponent !== null ? Number(match[1]) * 10 ** exponent : NaN;
}

export const toggled = (list: string[], id: string) => (list.includes(id) ? list.filter(item => item !== id) : [...list, id]);

/** Goes through add/remove so a raise also counts as earned: achievements read it, and the save plausibility check flags an amount above earned. */
export function setCurrency(currency: CurrencyName, value: number) {
	const delta = value - currenciesManager.getAmount(currency);
	if (delta > 0) currenciesManager.add(currency, delta);
	else currenciesManager.remove(currency, -delta);
}

/** The level always follows the count in the real purchase path, so only the count is editable. */
export function setGeneratorCount(type: GeneratorType, count: number) {
	const { cost, rate } = GENERATORS[type];
	const safeCount = Math.max(0, Math.floor(count));
	gameManager.generators = {
		...gameManager.generators,
		[type]: { cost, rate, unlocked: true, ...gameManager.generators[type], count: safeCount, level: Math.floor(safeCount / GENERATOR_LEVEL_UP_COST) },
	};
	gameManager.generators[type]!.cost = { amount: gameManager.getGeneratorCost(type, 1), currency: cost.currency };
}

/** Silences `save()` first, else the page's 1s save loop can write the live state back before the reload lands. `null` wipes the save. */
export function reloadWithSave(data: string | null) {
	gameManager.save = () => {};
	if (data === null) removeItem(SAVE_KEY);
	else setItem(SAVE_KEY, data);
	location.reload();
}

interface Snapshot {
	data: string;
	date: number;
	name: string;
}

const SNAPSHOTS_KEY = 'atomic-clicker-devtools-snapshots';

/** Named copies of the stored save, to jump back to a given game state while testing. */
class Snapshots {
	list = $state<Snapshot[]>(getJSON<Snapshot[]>(SNAPSHOTS_KEY, []));

	capture(name: string) {
		gameManager.save();
		const data = getItem(SAVE_KEY);
		if (data) this.#write([{ data, date: Date.now(), name }, ...this.list]);
	}

	remove(date: number) {
		this.#write(this.list.filter(snapshot => snapshot.date !== date));
	}

	restore(snapshot: Snapshot) {
		reloadWithSave(snapshot.data);
	}

	#write(list: Snapshot[]) {
		this.list = list;
		setItem(SNAPSHOTS_KEY, JSON.stringify(list));
	}
}

export const snapshots = new Snapshots();
