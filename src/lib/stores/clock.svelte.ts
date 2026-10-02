import { browser } from '$app/env';

// Shared ticking clock used to drive reactive countdowns (e.g. "next auto-buy in Xs" tooltips)
// without every consumer spinning up its own setInterval.
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
