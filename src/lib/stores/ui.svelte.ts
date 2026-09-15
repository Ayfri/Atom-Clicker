import type { Component } from 'svelte';

type ModalComponent = Component<{ onClose: () => void }>;
type ModalLoader = () => Promise<{ default: ModalComponent }>;

class UIStore {
	#activeModal = $state<ModalComponent | null>(null);
	#activeModalId = $state<string | null>(null);
	#activeTab = $state<string | null>(null);
	#loaded = new Map<string, ModalComponent>();
	#settingsLoader: ModalLoader | null = null;

	get activeModal() {
		return this.#activeModal;
	}

	set activeModal(value: ModalComponent | null) {
		this.#activeModal = value;
	}

	/** Identity of the open modal, so gated tutorial steps can match it without importing its (lazily loaded) component. */
	get activeModalId() {
		return this.#activeModalId;
	}

	get activeTab() {
		return this.#activeTab;
	}

	set activeTab(value: string | null) {
		this.#activeTab = value;
	}

	openModal(component: ModalComponent, tab: string | null = null, id: string | null = null) {
		this.#activeModal = component;
		this.#activeModalId = id;
		this.#activeTab = tab;
	}

	/** Opens a code-split modal, keeping its chunk out of the initial bundle. A newer open wins if the import resolves late. */
	async openModalLazy(id: string, loader: ModalLoader, tab: string | null = null) {
		this.#activeModalId = id;
		this.#activeTab = tab;
		const cached = this.#loaded.get(id);
		if (cached) {
			this.#activeModal = cached;
			return;
		}
		this.#activeModal = null;
		const component = (await loader()).default;
		this.#loaded.set(id, component);
		if (this.#activeModalId === id) this.#activeModal = component;
	}

	/** Warms a modal chunk (idle time, hover) so the first open renders instantly. */
	async preloadModal(id: string, loader: ModalLoader) {
		if (this.#loaded.has(id)) return;
		this.#loaded.set(id, (await loader()).default);
	}

	registerSettings(loader: ModalLoader) {
		this.#settingsLoader = loader;
	}

	openSettings(tab: string = 'profile') {
		if (this.#settingsLoader) this.openModalLazy('settings', this.#settingsLoader, tab);
	}

	closeModal() {
		this.#activeModal = null;
		this.#activeModalId = null;
		this.#activeTab = null;
	}
}

export const ui = new UIStore();
