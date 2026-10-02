import { ACHIEVEMENTS } from '#data/achievements.js';

/** Every achievement grants a flat 1 Quark, one-time, enforced server-side via the `quark_ledger` unique ref. */
export const QUARK_ACHIEVEMENT_REWARD = 1;

export function isQuarkAchievement(achievementId: string): boolean {
	return achievementId in ACHIEVEMENTS;
}
