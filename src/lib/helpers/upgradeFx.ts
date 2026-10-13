import { CURRENCIES, type CurrencyName } from '#data/currencies.js';
import { RealmTypes } from '#data/realms.js';
import { AmbientField } from '#helpers/AmbientField.js';
import { AtomRenderer } from '#helpers/AtomRenderer.js';
import { type FamilyView, upgradeFamilies } from '#helpers/UpgradeFamilies.svelte.js';

/** A click, or a point in viewport pixels for purchases without one (the auto-upgrade). */
type Origin = MouseEvent | { x: number; y: number };

/** The game's own bloom: one comet for a single purchase, a bigger burst with one comet per purchase for several, all landing on the nucleus. */
export function bloomPurchase(origin: Origin, currency: CurrencyName, bought: number) {
	if (bought <= 0) return;
	const nucleus = AtomRenderer.current?.target();
	const color = CURRENCIES[currency].color;
	if (bought === 1) AmbientField.emit(RealmTypes.ATOMS, 'bloom', origin, { color, surge: 6, target: nucleus });
	else
		AmbientField.emit(RealmTypes.ATOMS, 'bloom', origin, {
			color,
			count: 10 + Math.min(14, bought),
			surge: Math.min(20, 4 + bought * 2),
			target: nucleus && Array.from({ length: Math.min(10, bought) }, () => nucleus),
		});
}

export function buyAllFamilies(currency: CurrencyName, event: MouseEvent) {
	bloomPurchase(event, currency, upgradeFamilies.buyAll(currency));
}

/** One level, or every level the balance pays for when `max` is set. */
export function buyFamily(view: FamilyView, event: MouseEvent, max: boolean) {
	bloomPurchase(event, view.family.currency, max ? upgradeFamilies.buyMax(view) : upgradeFamilies.buyNext(view) ? 1 : 0);
}
