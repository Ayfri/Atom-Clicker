import type { Particle } from '$helpers/particles';

/** Resolved once: the check is environment-level and this runs on the click path. */
export const particlesEnabled = typeof window !== 'undefined' && !/headless|phantom|selenium/.test(navigator.userAgent.toLowerCase());

let sink: ((particles: Particle[]) => void) | null = null;

/** Canvas.svelte plugs its engine in once the particle sprites are loaded, particles added before that are dropped. */
export function setParticleSink(next: typeof sink) {
	sink = next;
}

export function addParticles(particles: Particle[]) {
	if (particles.length > 0) sink?.(particles);
}
