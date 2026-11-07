import { NEUTRINO_MAX_INTERVAL_MS, NEUTRINO_MIN_INTERVAL_MS } from '#data/neutrinos.js';

/** Counts down the Table time a player spends looking at it. Never saved, a reload draws a new wait. */
export class NeutrinoTimer {
	/** Not reactive on purpose: the effect that spends it also reads it. */
	remainingMs: number;
	readonly #random: () => number;

	constructor(random: () => number = Math.random) {
		this.#random = random;
		this.remainingMs = this.#draw();
	}

	/** Spends eligible time, true once a neutrino is due. */
	consume(ms: number): boolean {
		this.remainingMs = Math.max(0, this.remainingMs - ms);
		return this.remainingMs === 0;
	}

	restart() {
		this.remainingMs = this.#draw();
	}

	#draw(): number {
		return NEUTRINO_MIN_INTERVAL_MS + this.#random() * (NEUTRINO_MAX_INTERVAL_MS - NEUTRINO_MIN_INTERVAL_MS);
	}
}

/** UI state of the neutrino crossing the Periodic Table, the game state never reads it. */
class NeutrinoStore {
	/** The DevTools ask for one right away, the Table spawns it once it is mounted. */
	requested = $state(false);
	timer = new NeutrinoTimer();
	/** Set while one crosses the Table, the hint reads it. */
	visible = $state(false);
}

export const neutrino = new NeutrinoStore();
