import type { RealmType } from '#data/realms.js';
import { REALM_SWITCH_MS, realmManager } from '#helpers/RealmManager.svelte.js';

/**
 * Bounding rect of an element of a realm, for the hot paths (auto-clicks, pointer moves): `getBoundingClientRect` forces a
 * synchronous layout, so one measurement is kept until a scroll, a resize, a realm switch or a layout shift moves the element.
 * Created during component init, its effects live and die with the component.
 */
export class CachedRect {
	readonly #element: () => Element | undefined;
	#observer: IntersectionObserver | null = null;
	readonly #realm: RealmType;
	#rect: DOMRect | null = null;

	constructor(realm: RealmType, element: () => Element | undefined) {
		this.#element = element;
		this.#realm = realm;
		$effect(() => {
			const invalidate = () => this.invalidate();
			window.addEventListener('resize', invalidate, { passive: true });
			window.addEventListener('scroll', invalidate, { capture: true, passive: true });
			return () => {
				window.removeEventListener('resize', invalidate);
				window.removeEventListener('scroll', invalidate, { capture: true });
				this.invalidate();
			};
		});

		// A rect measured while the realm swings in is transformed, so it is dropped again once the realm has settled.
		$effect(() => {
			realmManager.selectedRealmId;
			this.invalidate();
			const timeout = setTimeout(() => this.invalidate(), REALM_SWITCH_MS + 50);
			return () => clearTimeout(timeout);
		});
	}

	/** Null while the realm is off screen: it is translated sideways, a rect measured then points past the element. */
	get current(): DOMRect | null {
		const element = this.#element();
		if (!element || realmManager.selectedRealmId !== this.#realm) return null;
		return (this.#rect ??= this.#measure(element));
	}

	invalidate() {
		this.#observer?.disconnect();
		this.#observer = null;
		this.#rect = null;
	}

	/** Watches the element against a root shrunk to its own rect, so a shift of the layout (the level bar toggling) drops the rect. */
	#measure(element: Element): DOMRect {
		const rect = element.getBoundingClientRect();
		const { clientHeight, clientWidth } = document.documentElement;
		const rootMargin = [rect.top, clientWidth - rect.right, clientHeight - rect.bottom, rect.left].map(inset => `${-Math.floor(inset)}px`).join(' ');
		this.#observer = new IntersectionObserver(
			([entry]) => {
				const moved = entry?.boundingClientRect;
				if (moved && (moved.x !== rect.x || moved.y !== rect.y || moved.width !== rect.width || moved.height !== rect.height)) this.invalidate();
			},
			{ root: document, rootMargin, threshold: 1 },
		);
		this.#observer.observe(element);
		return rect;
	}
}
