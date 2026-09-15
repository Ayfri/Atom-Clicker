import { CurrenciesTypes } from '$data/currencies';
import { RealmTypes, type RealmType } from '$data/realms';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { radiationManager } from '$helpers/RadiationManager.svelte';
import { photonUpgradesTab } from '$stores/photonUpgradesTab.svelte';

export interface RealmTutorialStep {
	/** Extra gate beyond "realm unlocked and selected": stays hidden until this returns true. */
	condition?: () => boolean;
	description: string;
	id: string;
	title: string;
}

/**
 * Shown once each, in order, the first time the player switches into a given realm (and it's
 * unlocked) and reaches each step's condition, independently of the main guided walkthrough's
 * progress. The Atom Realm is the starting realm and already covered by that walkthrough, so it
 * has no entry here.
 */
export const REALM_TUTORIALS: Partial<Record<RealmType, RealmTutorialStep[]>> = {
	[RealmTypes.PHOTONS]: [
		{
			id: 'intro',
			title: 'The Photon Realm',
			description:
				'Click the floating circles to collect Photons. Spend them on Photon Upgrades to boost your production, and keep an eye out, not everything that falls is quite so ordinary.',
		},
		{
			id: 'excited-photons',
			title: 'Excited Photons',
			description:
				'That glow was no accident. Excited Photons are a rare find, with their own upgrade tab full of stronger, pricier effects.',
			condition: () =>
				currenciesManager.getAmount(CurrenciesTypes.EXCITED_PHOTONS) > 0 &&
				photonUpgradesTab.selected === CurrenciesTypes.EXCITED_PHOTONS,
		},
	],
	[RealmTypes.RADIATION]: [
		{
			id: 'intro',
			title: 'The Radiation Realm',
			description:
				'A dormant reactor, waiting for fuel. Convert Electrons into core mass below and see what wakes up.',
		},
		{
			id: 'fuel',
			title: 'Core Fuel',
			description:
				'Fuel (mass) burns as soon as you raise the power, and nothing puts it back until you buy the Breeder Reactor upgrade. Keep an eye on the burn rate so the core never runs dry.',
			condition: () => radiationManager.mass > 0,
		},
		{
			id: 'power',
			title: 'Power Level',
			description:
				'Raise the power level to generate CPM (Cycles Per Minute): the higher the CPM, the bigger your production multiplier, but the faster fuel burns.',
			condition: () => radiationManager.mass > 0,
		},
		{
			id: 'upgrades',
			title: 'Reactor Upgrades',
			description:
				'The reactor has room to grow. Spend Electrons here to permanently improve it, though what exactly improves is best discovered by browsing.',
			condition: () => radiationManager.currentCpm >= 10,
		},
	],
};
