import { browser } from '$app/env';

class InstallStore {
	/** An install prompt can only be shown once, so the event is dropped as soon as `install()` takes it and when the app gets installed. */
	#event = $state.raw<BeforeInstallPromptEvent | null>(null);
	/** Set by the browser's `appinstalled` event, the Settings tab shows it in place of the button. */
	installed = $state(false);

	/** Registered from `hooks.client.ts`, the event fires early in the page load, before the layout mounts. */
	constructor() {
		if (!browser) return;
		window.addEventListener('beforeinstallprompt', event => {
			// Keeps Chrome's mini-infobar off the game, the Settings tab offers the install instead.
			event.preventDefault();
			this.#event = event;
		});
		window.addEventListener('appinstalled', () => {
			this.#event = null;
			this.installed = true;
		});
	}

	get canInstall() {
		return this.#event !== null;
	}

	async install() {
		const event = this.#event;
		if (!event) return;
		this.#event = null;
		try {
			await event.prompt();
		} catch {
			/** Chromium rejects a prompt it can't show, like one a second tap already used. */
		}
	}
}

export const installStore = new InstallStore();
