/** One injection per player per cooldown, enforced server-side by the `inject_collider` RPC. */
export const COLLIDER_COOLDOWN_SECONDS = 60;
/** Other players keep feeding the counter, so an open game picks up their injections this often. */
export const COLLIDER_REFRESH_MS = 600_000;
export const COLLIDER_STEP = 1_000;
export const COLLIDER_STEP_BONUS = 0.001;

/** @example colliderBonus(12_345) === 0.012, production × 1.012 */
export const colliderBonus = (total: number) => Math.floor(total / COLLIDER_STEP) * COLLIDER_STEP_BONUS;
