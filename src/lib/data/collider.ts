/** One injection per player per cooldown, enforced server-side by the `inject_collider` RPC. */
export const COLLIDER_COOLDOWN_SECONDS = 60;
/** Other players keep feeding the counter, so an open game picks up their injections this often. */
export const COLLIDER_REFRESH_MS = 600_000;
export const COLLIDER_STEP = 1_000;
export const COLLIDER_STEP_BONUS = 0.001;

/** @example colliderBonus(12_345) === 0.012, production × 1.012 */
export const colliderBonus = (total: number) => Math.floor(total / COLLIDER_STEP) * COLLIDER_STEP_BONUS;

/** One tick per cooldown second around the ring, a longer one every 5, like a stopwatch bezel. */
function ticks(major: boolean): string {
	let path = '';
	for (let i = 0; i < COLLIDER_COOLDOWN_SECONDS; i++) {
		if ((i % 5 === 0) !== major) continue;
		const angle = (i / COLLIDER_COOLDOWN_SECONDS) * 2 * Math.PI;
		const inner = major ? 47.6 : 48.4;
		path += `M${50 + inner * Math.cos(angle)} ${50 + inner * Math.sin(angle)}L${50 + 49.6 * Math.cos(angle)} ${50 + 49.6 * Math.sin(angle)}`;
	}
	return path;
}

export const MAJOR_TICKS = ticks(true);
export const MINOR_TICKS = ticks(false);

/** Particles drawn around the ring. */
export const RING_PARTICLES = 8;
