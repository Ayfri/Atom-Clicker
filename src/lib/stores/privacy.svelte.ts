import { getItem, setItem } from '$lib/utils/safeLocalStorage';

export const GA_ID = 'G-9M6JETNYJ5';
const KEY = 'atom-clicker-analytics';

class PrivacyStore {
	#analytics = $state(getItem(KEY) !== 'off');

	get analytics() {
		return this.#analytics;
	}

	/** gtag.js checks `window['ga-disable-<id>']` before every hit, so opting out also stops an already loaded tag. */
	set analytics(value: boolean) {
		this.#analytics = value;
		setItem(KEY, value ? 'on' : 'off');
		(window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = !value;
	}
}

export const privacy = new PrivacyStore();
