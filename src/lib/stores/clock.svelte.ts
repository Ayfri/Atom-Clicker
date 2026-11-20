import { browser } from '$app/env';

/** Shared 1 s clock behind reactive countdowns (the "next auto-buy in Xs" tooltips), so no consumer runs its own setInterval. */
class Clock {
	now = $state(Date.now());

	constructor() {
		if (browser) {
			setInterval(() => {
				this.now = Date.now();
			}, 1000);
		}
	}
}

export const clock = new Clock();
