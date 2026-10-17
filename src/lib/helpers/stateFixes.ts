import type { GameState } from '#lib/types.js';
import type { StateFix, StateFixTarget } from '#lib/types/audit.js';

export const fieldOf = (state: GameState, target: StateFixTarget): number => ('currency' in target ? state.currencies[target.currency][target.field] : state[target.key]);

const TIMESTAMP_KEYS: readonly string[] = ['runStartedAt', 'startDate'];

/** A fix moves its field by `to - from`, so a live game that kept earning since the check keeps its gains. Timestamps and a target of 0 land as is. */
export function patchFor(state: GameState, fixes: readonly StateFix[]): Partial<GameState> {
	const patch: Partial<GameState> = {};
	for (const fix of fixes) {
		const current = fieldOf({ ...state, ...patch }, fix);
		const absolute = fix.to === 0 || ('key' in fix && TIMESTAMP_KEYS.includes(fix.key));
		const next = absolute || current === fix.from ? fix.to : current + (fix.to - fix.from);
		if ('currency' in fix) {
			const currencies = patch.currencies ?? state.currencies;
			patch.currencies = { ...currencies, [fix.currency]: { ...currencies[fix.currency], [fix.field]: next } };
		} else patch[fix.key] = next;
	}
	return patch;
}
