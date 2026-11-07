import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { perfTracker } from '#helpers/perfTracker.js';
import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
import { RealmTypes, type RealmType } from '#data/realms.js';
import type { Currency } from '#lib/types.js';
import { untrack } from 'svelte';

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
	/** Cosmos object the scene flies to next, read once. */
	cosmosFocus = $state<string | null>(null);
	/** The Cosmos is a view above the realms, opened from any of them, the selected realm stays underneath. */
	cosmosOpen = $state(false);
	/** Element the introduction opens the Table on, read once when it ends. */
	introFocus: number | null = null;
	/** The Periodic Table's introduction covers the whole page while it plays. */
	introPlaying = $state(false);
	/** The Periodic Table is a page-level view above every realm and the Cosmos. */
	tableOpen = $state(false);
	/** Element the Table selects on its next mount, read once. */
	tableFocus = $state<number | null>(null);

	get selectedRealmId() {
		return gameManager.selectedRealmId;
	}

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

	get selectedIndex() {
		return this.availableRealms.findIndex(r => r.id === this.selectedRealmId);
	}

	/** What fills the screen. */
	get view(): RealmType | 'cosmos' {
		return this.cosmosOpen && cosmosManager.unlocked ? 'cosmos' : this.selectedRealmId;
	}

	/** What the hints may point at: the Periodic Table covers whatever is on screen, whose controls stay underneath it. */
	get hintScope(): RealmType | 'cosmos' | 'table' {
		return this.tableOpen ? 'table' : this.view;
	}

	get selectedRealm() {
		return this.realms.find(r => r.id === this.selectedRealmId) || this.realms[0];
	}

	/** An off-screen realm stays mounted, a value read through this freezes there instead of rerunning on every atom commit. The opaque Cosmos and Periodic Table hide the selected realm too. */
	live<T>(realm: RealmType, read: () => T): T {
		return this.selectedRealmId === realm && this.view !== 'cosmos' && !this.tableOpen ? read() : untrack(read);
	}

	/** `objectId` is the Cosmos object the view flies to once it is up. */
	openCosmos(objectId?: string) {
		perfTracker.action('cosmos:open');
		this.cosmosFocus = objectId ?? null;
		this.cosmosOpen = true;
	}

	/** `z` is the element the Table selects when it opens, a player who never saw the introduction gets it first. */
	openTable(z?: number) {
		if (!periodicManager.unlocked) return;
		if (!periodicManager.introSeen) return this.playIntro(z ?? null);
		perfTracker.action('periodic:open');
		this.tableFocus = z ?? null;
		this.tableOpen = true;
	}

	/** `focus` is the element the Table opens on once the introduction ends with "Open the Table". */
	playIntro(focus: number | null = null) {
		if (!periodicManager.unlocked) return;
		perfTracker.action('periodic:intro');
		this.introFocus = focus;
		this.introPlaying = true;
	}

	/** A loaded save can lock the Table, so nothing that shows it stays set. */
	resetTable() {
		this.introFocus = null;
		this.introPlaying = false;
		this.tableOpen = false;
	}

	selectRealm(id: RealmType) {
		if (this.realms.find(r => r.id === id && gameManager.realms[r.id]?.unlocked)) {
			perfTracker.action(`realm:${id}`);
			gameManager.selectedRealmId = id;
		}
	}
}

export const realmManager = new RealmManager();
