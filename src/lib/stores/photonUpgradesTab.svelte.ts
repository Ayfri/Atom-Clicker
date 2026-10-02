import { CurrenciesTypes } from '#data/currencies.js';

export type PhotonUpgradesTab = typeof CurrenciesTypes.EXCITED_PHOTONS | typeof CurrenciesTypes.PHOTONS | 'prism';

let selected = $state<PhotonUpgradesTab>(CurrenciesTypes.PHOTONS);

export const photonUpgradesTab = {
	get selected() {
		return selected;
	},
	set selected(value: PhotonUpgradesTab) {
		selected = value;
	},
};
