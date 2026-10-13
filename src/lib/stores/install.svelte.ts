import { browser } from '$app/env';
import { APP_DISPLAY_QUERY, isInstalledApp } from '#helpers/clientInfo.js';
import { gameManager } from '#helpers/GameManager.svelte.js';

class InstallStore {
	/** An install prompt can only be shown once, so the event is dropped as soon as `install()` takes it and when the app gets installed. */
	#event = $state.raw<BeforeInstallPromptEvent | null>(null);
	/** Set by the browser's `appinstalled` event, the Settings tab shows it in place of the button. */
	installed = $state(false);

	/** Takes the event the inline script of `app.html` caught before this module loaded, then follows the later ones. The installed app never offers it. */
	constructor() {
		if (!browser) return;
		/**
		 * Chrome can move a tab into the app window after an install, so the flag follows display-mode changes. Fullscreen hides
		 * whether the window is the app or a tab, so the flag keeps what it was before (F11 in the app keeps the bonus).
		 */
		const update = () => {
			if (matchMedia('(display-mode: fullscreen)').matches) return;
			gameManager.installedApp = isInstalledApp();
			if (gameManager.installedApp) this.#event = null;
		};
		update();
		matchMedia(APP_DISPLAY_QUERY).addEventListener('change', update);
		if (gameManager.installedApp) return;
		this.#event = window.installPrompt ?? null;
		window.addEventListener('beforeinstallprompt', event => (this.#event = event));
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
		window.installPrompt = undefined;
		try {
			await event.prompt();
		} catch {
			/** Chromium rejects a prompt it can't show, like one a second tap already used. */
		}
	}
}

export const installStore = new InstallStore();
