import type { RealmType } from '#data/realms.js';
import { REALM_SWITCH_MS, realmManager } from '#helpers/RealmManager.svelte.js';

/**
 * Bounding rect of an element of a realm, for the hot paths (auto-clicks, pointer moves): `getBoundingClientRect` forces a
 * synchronous layout, so one measurement is kept until a scroll, a resize or a realm switch moves the element. Created during
 * component init, its effects live and die with the component.
 */
export class CachedRect {
	readonly #element: () => Element | undefined;
	readonly #realm: RealmType;
	#rect: DOMRect | null = null;

	constructor(realm: RealmType, element: () => Element | undefined) {
		this.#element = element;
		this.#realm = realm;
		$effect(() => {
			const invalidate = () => (this.#rect = null);
			window.addEventListener('resize', invalidate, { passive: true });
			window.addEventListener('scroll', invalidate, { capture: true, passive: true });
			return () => {
				window.removeEventListener('resize', invalidate);
				window.removeEventListener('scroll', invalidate, { capture: true });
			};
		});

		// A rect measured while the realm swings in is transformed, so it is dropped again once the realm has settled.
		$effect(() => {
			realmManager.selectedRealmId;
			this.#rect = null;
			const timeout = setTimeout(() => (this.#rect = null), REALM_SWITCH_MS + 50);
			return () => clearTimeout(timeout);
		});
	}

	/** Null while the realm is off screen: it is translated sideways, a rect measured then points past the element. */
	get current(): DOMRect | null {
		const element = this.#element();
		if (!element || realmManager.selectedRealmId !== this.#realm) return null;
		return (this.#rect ??= element.getBoundingClientRect());
	}

	invalidate() {
		this.#rect = null;
	}
}
