import { ACHIEVEMENTS } from '#data/achievements.js';

/** Every achievement grants a flat 1 Quark, one-time, enforced server-side via the `quark_ledger` unique ref. */
export const QUARK_ACHIEVEMENT_REWARD = 1;

/** Most ids one claim request carries, the server refuses more and the client sends batches of this size. */
export const MAX_ACHIEVEMENT_IDS_PER_REQUEST = 250;

export function isQuarkAchievement(achievementId: string): boolean {
	return achievementId in ACHIEVEMENTS;
}
