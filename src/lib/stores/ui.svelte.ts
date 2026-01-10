import type { Component } from 'svelte';

type ModalComponent = Component<{ onClose: () => void }>;

class UIStore {
	#activeModal = $state<ModalComponent | null>(null);
	#activeTab = $state<string | null>(null);
	#settingsComponent = $state<ModalComponent | null>(null);

	get activeModal() {
		return this.#activeModal;
	}

	set activeModal(value: ModalComponent | null) {
		this.#activeModal = value;
	}

	get activeTab() {
		return this.#activeTab;
	}

	set activeTab(value: string | null) {
		this.#activeTab = value;
	}

	openModal(component: ModalComponent, tab: string | null = null) {
		this.activeModal = component;
		this.activeTab = tab;
	}

	registerSettings(component: ModalComponent) {
		this.#settingsComponent = component;
	}

	openSettings(tab: string = 'profile') {
		if (this.#settingsComponent) {
			this.openModal(this.#settingsComponent, tab);
		}
	}

	closeModal() {
		this.activeModal = null;
		this.activeTab = null;
	}
}

export const ui = new UIStore();
