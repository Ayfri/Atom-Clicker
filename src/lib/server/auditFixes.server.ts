import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
import { RUN_COUNTERS, TIME_TOLERANCE_MS } from '#helpers/plausibility.js';
import { fieldOf, patchFor } from '#helpers/stateFixes.js';
import { type AuditContext, inspectScore, runSpending } from '#lib/server/scoreAudit.server.js';
import type { CurrencyState, GameState } from '#lib/types.js';
import type { DevAuditReport, StateFix, StateFixTarget } from '#lib/types/audit.js';

/** Each pass can expose a check the earlier ones hid, or move a cap the next one has to follow. */
const MAX_PASSES = 10;

const isNumber = (value: unknown): value is number => typeof value === 'number';

/**
 * Edits a copy of the state until the leaderboard audit passes, each edit lowering a claim down to what the audit allows.
 * What no rule covers stays in `remaining`.
 */
export function planAuditFixes(raw: unknown, context: AuditContext): DevAuditReport | 'malformed' | 'outdated' {
	const first = inspectScore(raw, context);
	if (typeof first === 'string') return first;
	if (first.issues.some(id => id.startsWith('malformed:'))) return { checks: first.checks, fixes: [], issues: first.issues, remaining: first.issues };

	const state = structuredClone(raw) as GameState;
	const touched = new Map<string, StateFix>();
	let changed = false;

	const set = (target: StateFixTarget, to: number, issue: string) => {
		const from = fieldOf(state, target);
		if (from === to) return;
		const id = 'currency' in target ? `${target.currency}.${target.field}` : target.key;
		const previous = touched.get(id);
		touched.set(id, { ...target, from: previous?.from ?? from, issue: previous?.issue ?? issue, to });
		Object.assign(state, patchFor(state, [{ ...target, from, issue, to }]));
		changed = true;
	};

	let last = first;
	for (let pass = 0; pass <= MAX_PASSES; pass++) {
		const inspection = pass === 0 ? first : inspectScore(state, context);
		if (typeof inspection === 'string') break;
		last = inspection;
		if (pass === MAX_PASSES) break;

		changed = false;
		const ids = new Set(inspection.issues);
		const limitOf = (id: string) => inspection.checks.find(check => check.id === id)?.limit ?? 0;
		/** A fix swaps the currencies object, so the entry is read fresh each time. */
		const atoms = () => state.currencies[CurrenciesTypes.ATOMS];

		if (ids.has('plausibility')) {
			for (const [run, allTime] of RUN_COUNTERS) {
				if (isNumber(state[run]) && isNumber(state[allTime])) set({ key: allTime }, Math.max(state[allTime], state[run]), 'plausibility');
			}
			for (const [name, currency] of Object.entries(state.currencies) as [CurrencyName, CurrencyState][]) {
				if (!currency) continue;
				const { amount, earnedAllTime, earnedRun } = currency;
				if ([amount, earnedAllTime, earnedRun].every(isNumber)) set({ currency: name, field: 'earnedAllTime' }, Math.max(earnedAllTime, amount, earnedRun), 'plausibility');
			}
			if (state.inGameTime > state.lastSave - state.startDate + TIME_TOLERANCE_MS) set({ key: 'startDate' }, Math.floor(state.lastSave - state.inGameTime), 'plausibility');
		}
		if (ids.has('runStart')) set({ key: 'runStartedAt' }, 0, 'runStart');
		if (atoms()) {
			/** What the run's generators and upgrades cost, `earnedRun - amount` has to keep covering it or the spending check fails next. */
			const spent = () => (state.runStartedAt > 0 ? runSpending(state) : 0);
			if (ids.has('production')) {
				const cap = limitOf('production');
				const before = atoms();
				set({ currency: CurrenciesTypes.ATOMS, field: 'earnedRun' }, cap, 'production');
				set({ currency: CurrenciesTypes.ATOMS, field: 'earnedAllTime' }, Math.max(cap, before.earnedAllTime - (before.earnedRun - cap)), 'production');
				set({ currency: CurrenciesTypes.ATOMS, field: 'amount' }, Math.max(0, Math.min(before.amount, cap - spent())), 'production');
			}
			const { amount, earnedAllTime, earnedRun } = atoms();
			if (ids.has('atoms') && amount > earnedRun * (1 + 1e-9) + 1) {
				const maxEarnedRun = inspection.maxEarnedRun ?? 0;
				if (amount <= maxEarnedRun) {
					const needed = amount + spent();
					const raised = Math.min(needed, maxEarnedRun);
					set({ currency: CurrenciesTypes.ATOMS, field: 'earnedAllTime' }, Math.max(earnedAllTime, raised), 'atoms');
					set({ currency: CurrenciesTypes.ATOMS, field: 'earnedRun' }, raised, 'atoms');
					if (needed > raised) set({ currency: CurrenciesTypes.ATOMS, field: 'amount' }, Math.max(0, raised - spent()), 'atoms');
				} else set({ currency: CurrenciesTypes.ATOMS, field: 'amount' }, Math.max(0, earnedRun - spent()), 'atoms');
			}
		}
		if (ids.has('xp')) set({ key: 'totalXP' }, Math.max(0, Math.floor(limitOf('xp') - 1)), 'xp');
		/** Earned and held atoms may already have fixed it, the next pass tells. */
		if (ids.has('spending') && !changed) set({ key: 'runStartedAt' }, 0, 'spending');

		if (!changed) break;
	}

	return { checks: first.checks, fixes: [...touched.values()].filter(fix => fix.from !== fix.to), issues: first.issues, remaining: last.issues };
}
