import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { gameManager } from '$helpers/GameManager.svelte';
import { RealmTypes, type RealmType } from '$data/realms';
import type { Currency } from '$lib/types';

/** Delay plus duration of the arriving realm's swing in `+page.svelte`, rects measured before it ends are still transformed. */
export const REALM_SWITCH_MS = 800;

export interface RealmConfig {
	background?: string;
	/** Tint of the light sweep played when switching to this realm. */
	color: string;
	componentId: string;
	currency: Currency;
	id: RealmType;
	title: string;
}

class RealmManager {
	selectedRealmId = $state<RealmType>(RealmTypes.ATOMS);

	realms: RealmConfig[] = [
		{
			background:
				'radial-gradient(circle at 10% 20%, color-mix(in srgb, var(--color-accent-400), transparent 88%) 0%, color-mix(in srgb, var(--color-accent-400), transparent 92%) 30%, transparent 60%), radial-gradient(circle at 95% 90%, color-mix(in srgb, var(--color-accent-400), transparent 88%) 0%, color-mix(in srgb, var(--color-accent-400), transparent 92%) 25%, transparent 50%)',
			color: 'var(--color-accent-400)',
			componentId: 'AtomRealm',
			currency: CURRENCIES[CurrenciesTypes.ATOMS],
			id: RealmTypes.ATOMS,
			title: 'Atoms Realm',
		},
		{
			background:
				'linear-gradient(135deg, color-mix(in srgb, var(--color-realm-500), transparent 90%) 0%, color-mix(in srgb, var(--color-realm-950), transparent 90%) 50%, color-mix(in srgb, var(--color-realm-500), transparent 90%) 100%)',
			color: 'var(--color-realm-400)',
			componentId: 'PhotonRealm',
			currency: CURRENCIES[CurrenciesTypes.PHOTONS],
			id: RealmTypes.PHOTONS,
			title: 'Photon Realm',
		},
		{
			background:
				'radial-gradient(circle at 30% 30%, rgba(30, 70, 32, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(57, 255, 20, 0.1) 0%, transparent 40%)',
			color: 'var(--color-radiation)',
			componentId: 'RadiationRealm',
			currency: CURRENCIES[CurrenciesTypes.ELECTRONS],
			id: RealmTypes.RADIATION,
			title: 'Radiation Realm',
		},
	];

	get availableRealms() {
		return this.realms.filter(r => gameManager.realms[r.id]?.unlocked);
	}

	get realmValues() {
		return this.realms.reduce(
			(acc, realm) => {
				acc[realm.id] = currenciesManager.getAmount(realm.currency.name);
				return acc;
			},
			{} as Record<RealmType, number>,
		);
	}

	get selectedRealm() {
		return this.realms.find(r => r.id === this.selectedRealmId) || this.realms[0];
	}

	selectRealm(id: RealmType) {
		if (this.realms.find(r => r.id === id && gameManager.realms[r.id].unlocked)) {
			this.selectedRealmId = id;
		}
	}
}

export const realmManager = new RealmManager();
