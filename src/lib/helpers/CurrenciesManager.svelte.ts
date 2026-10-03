
import { CurrenciesTypes, type CurrencyName, CURRENCIES } from '#data/currencies.js';
import { type LayerType, LAYERS } from '#helpers/statConstants.js';
import type { CurrencyStateMap } from '#lib/types.js';

export class CurrenciesManager {
	currencies = $state<CurrencyStateMap>({} as CurrencyStateMap);

	constructor() {
		this.hardReset();
	}

	/** Written `!(amount > 0)` so a NaN amount is refused too instead of corrupting the balance for good. */
	add(type: CurrencyName, amount: number) {
		if (!(amount > 0)) return;

		const currency = this.currencies[type];
		currency.amount += amount;
		currency.earnedRun += amount;
		currency.earnedAllTime += amount;
	}

	remove(type: CurrencyName, amount: number) {
		if (!(amount > 0)) return;
		this.currencies[type].amount = Math.max(0, this.currencies[type].amount - amount);
	}

	getAmount(type: CurrencyName) {
		return this.currencies[type]?.amount || 0;
	}

	getEarnedAllTime(type: CurrencyName) {
		return this.currencies[type]?.earnedAllTime || 0;
	}

	hardReset() {
		for (const type of Object.values(CurrenciesTypes)) {
			this.currencies[type] = {
				amount: 0,
				earnedAllTime: 0,
				earnedRun: 0
			};
		}
	}

	reset(layer: LayerType) {
		for (const [type, data] of Object.entries(CURRENCIES)) {
			const currencyLayer = data.layer ?? LAYERS.NEVER;

			// Reset currencies that are at or below the triggered layer, but ignore NEVER (0) and SPECIAL (-1)
			if (currencyLayer > 0 && currencyLayer <= layer) {
				const currencyName = type as CurrencyName;
				this.currencies[currencyName].amount = 0;
				this.currencies[currencyName].earnedRun = 0;
			}
		}
	}
}

export const currenciesManager = new CurrenciesManager();
