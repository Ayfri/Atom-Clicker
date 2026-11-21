export const APP_REWARD_QUARKS = 10;

/** Most ids one claim request carries, the server refuses more and the client sends batches of this size. */
export const MAX_ACHIEVEMENT_IDS_PER_REQUEST = 250;

/** Every achievement grants a flat 1 Quark, one-time, enforced server-side via the `quark_ledger` unique ref. */
export const QUARK_ACHIEVEMENT_REWARD = 1;

export const QUARK_CHARGE_COLORS = {
	blue: '#4a9eff',
	green: '#3ddc84',
	red: '#ff4d4d',
} as const;
