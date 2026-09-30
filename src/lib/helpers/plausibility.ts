import type { GameState } from '$lib/types';

/** Tolerance for clock drift when comparing inGameTime to wall-clock time. */
const TIME_TOLERANCE_MS = 60_000;

/** Run counters only ever grow together with their all-time total, and reset to zero on their own. */
const RUN_COUNTERS = [
	['totalClicksRun', 'totalClicksAllTime'],
	['totalElectronizesRun', 'totalElectronizesAllTime'],
	['totalProtonisesRun', 'totalProtonisesAllTime'],
] as const satisfies readonly (readonly [keyof GameState, keyof GameState])[];

/** A save straight from storage or the database, where any field can hold anything. */
type UntrustedState = Partial<Record<keyof GameState, unknown>>;

const isNumber = (value: unknown): value is number => typeof value === 'number';

/** A value that must never exceed its limit, labels only feed the warning text. */
type Bound = [label: string, value: unknown, limitLabel: string, limit: unknown];

/** Balance-independent sanity checks shared by the client and the leaderboard route, an empty list means nothing looks edited. */
export function checkStatePlausibility(state: UntrustedState): string[] {
	const bounds: Bound[] = RUN_COUNTERS.map(([run, allTime]) => [run, state[run], allTime, state[allTime]]);

	const currencies = state.currencies && typeof state.currencies === 'object' ? Object.entries(state.currencies) : [];
	for (const [name, currency] of currencies) {
		const { amount, earnedAllTime, earnedRun } = (currency ?? {}) as Record<string, unknown>;
		bounds.push([`Currency ${name}: amount`, amount, 'earnedAllTime', earnedAllTime], [`Currency ${name}: earnedRun`, earnedRun, 'earnedAllTime', earnedAllTime]);
	}

	const { inGameTime, lastSave, startDate } = state;
	if (isNumber(lastSave) && isNumber(startDate)) bounds.push(['inGameTime', inGameTime, 'wall-clock time since startDate', lastSave - startDate + TIME_TOLERANCE_MS]);

	return bounds.filter(([, value, , limit]) => isNumber(value) && isNumber(limit) && value > limit).map(([label, value, limitLabel, limit]) => `${label} (${value}) exceeds ${limitLabel} (${limit})`);
}
