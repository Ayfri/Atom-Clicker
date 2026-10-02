import { SAVE_KEY } from '#helpers/saves.js';
import { getItem, setItem } from '#lib/utils/safeLocalStorage.js';

const KEY = 'atom-clicker-changelog-seen';

class ChangelogStore {
	#seen = $state(getItem(KEY));

	/** A player without a save starts with the current changelog read, so only returning players get the dot. */
	constructor() {
		if (this.#seen === null && getItem(SAVE_KEY) === null) this.markSeen();
	}

	get unread() {
		return this.#seen !== __CHANGELOG_VERSION__;
	}

	markSeen() {
		this.#seen = __CHANGELOG_VERSION__;
		setItem(KEY, __CHANGELOG_VERSION__);
	}
}

export const changelog = new ChangelogStore();
