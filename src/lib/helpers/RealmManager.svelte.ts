import AtomRealm from '@components/prestige/AtomRealm.svelte';
import PhotonRealm from '@components/prestige/PhotonRealm.svelte';
import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
import { gameManager } from '$helpers/GameManager.svelte';
import { RealmTypes, type RealmType } from '$data/realms';
import type { Currency } from '$lib/types';
import type { Component } from 'svelte';

export interface RealmConfig {
	background?: string;
	component: Component;
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
			component: AtomRealm,
			currency: CURRENCIES[CurrenciesTypes.ATOMS],
			id: RealmTypes.ATOMS,
			title: 'Atoms Realm'
		},
		{
			background:
				'linear-gradient(135deg, color-mix(in srgb, var(--color-realm-500), transparent 90%) 0%, color-mix(in srgb, var(--color-realm-950), transparent 90%) 50%, color-mix(in srgb, var(--color-realm-500), transparent 90%) 100%)',
			component: PhotonRealm,
			currency: CURRENCIES[CurrenciesTypes.PHOTONS],
			id: RealmTypes.PHOTONS,
			title: 'Photon Realm'
		}
	];

	get availableRealms() {
		return this.realms.filter((r) => gameManager.realms[r.id].unlocked);
	}

	get realmValues() {
		return this.realms.reduce(
			(acc, realm) => {
				acc[realm.id] = currenciesManager.getAmount(realm.currency.name);
				return acc;
			},
			{} as Record<RealmType, number>
		);
	}

	get selectedRealm() {
		return this.realms.find((r) => r.id === this.selectedRealmId) || this.realms[0];
	}

	selectRealm(id: RealmType) {
		if (this.realms.find((r) => r.id === id && gameManager.realms[r.id].unlocked)) {
			this.selectedRealmId = id;
		}
	}
}

export const realmManager = new RealmManager();
