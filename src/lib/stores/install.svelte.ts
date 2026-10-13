import { browser } from '$app/env';

class InstallStore {
	/** An install prompt can only be shown once, so the event is dropped as soon as `install()` takes it and when the app gets installed. */
	#event = $state.raw<BeforeInstallPromptEvent | null>(null);
	/** Set by the browser's `appinstalled` event, the Settings tab shows it in place of the button. */
	installed = $state(false);

	/** Takes the event the inline script of `app.html` caught before this module loaded, then follows the later ones. The installed app (any display mode but `browser`) never offers it. */
	constructor() {
		if (!browser || !matchMedia('(display-mode: browser)').matches) return;
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
