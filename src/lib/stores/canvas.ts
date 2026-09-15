import {writable} from 'svelte/store';
import type {Particle} from '$helpers/particles';

// We use an internal array managed by the Canvas component for the update loop.
export const particleQueue = writable<Particle[]>([]);

// Resolved once: the checks are environment-level and this runs on the click path.
const environmentSuitable = (() => {
	if (typeof window === 'undefined') return false;

	if (typeof navigator !== 'undefined') {
		const userAgent = navigator.userAgent.toLowerCase();
		if (userAgent.includes('headless') || userAgent.includes('phantom') || userAgent.includes('selenium')) {
			return false;
		}
	}

	if (typeof process !== 'undefined' && (process.env?.CI || process.env?.NODE_ENV === 'test' || process.env?.JEST_WORKER_ID)) {
		return false;
	}

	return true;
})();

export function shouldCreateParticles(): boolean {
	return environmentSuitable;
}

export function addParticles(newParticles: Particle[]) {
	if (!environmentSuitable || newParticles.length === 0) return;
	particleQueue.update(current => (current.length === 0 ? newParticles : [...current, ...newParticles]));
}
