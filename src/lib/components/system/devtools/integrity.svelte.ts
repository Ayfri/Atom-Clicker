import { colliderManager } from '#helpers/ColliderManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { checkStatePlausibility } from '#helpers/plausibility.js';
import { SAVE_KEY } from '#helpers/saves.js';
import { patchFor } from '#helpers/stateFixes.js';
import type { DevAuditRequest, DevAuditResponse } from '#lib/types/audit.js';
import { getItem } from '#lib/utils/safeLocalStorage.js';
import { unwrapStoredSave } from '#lib/utils/saveIntegrity.js';

/** Runs the leaderboard audit on the dev server against the live game and applies the fixes it plans, see /api/dev/audit. */
class IntegrityCheck {
	busy = $state(false);
	checkedAt = $state(0);
	error = $state<string | null>(null);
	report = $state.raw<DevAuditResponse | null>(null);
	storedTampered = $state(false);

	get fixable(): boolean {
		return (this.report?.status === 'checked' && this.report.fixes.length > 0) || gameManager.integrityFlagged || gameManager.saveIntegrityWarnings.length > 0 || this.storedTampered;
	}

	private async check() {
		const { dailyStats, settings, tutorial, ...state } = gameManager.getCurrentState();
		const body = { colliderTotal: colliderManager.total, state, totalUsers: gameManager.totalUsers } satisfies DevAuditRequest;
		const response = await fetch('/api/dev/audit', { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, method: 'POST' });
		if (!response.ok) throw new Error(`Audit request failed (${response.status})`);
		this.report = (await response.json()) as DevAuditResponse;
		this.storedTampered = unwrapStoredSave(getItem(SAVE_KEY) ?? '').tampered;
		this.checkedAt = Date.now();
	}

	private async busyWith(work: () => Promise<void>) {
		this.busy = true;
		this.error = null;
		try {
			await work();
		} catch (error) {
			this.error = (error as Error).message;
		} finally {
			this.busy = false;
		}
	}

	run() {
		return this.busyWith(() => this.check());
	}

	/** Applies the planned fixes to the live game, then clears the client's edit flags and re-signs the stored save only once the audit passes on the patched state. */
	fix() {
		return this.busyWith(async () => {
			await this.check();
			if (this.report?.status === 'checked') gameManager.loadSaveData(patchFor(gameManager.getCurrentState(), this.report.fixes));
			await this.check();
			if (this.report?.status !== 'checked') throw new Error(`The audit answered ${this.report?.status}, nothing was cleared`);
			const { length } = this.report.remaining;
			if (length > 0) throw new Error(`${length} ${length === 1 ? 'issue has' : 'issues have'} no automatic fix`);
			gameManager.integrityFlagged = false;
			gameManager.saveIntegrityWarnings = checkStatePlausibility(gameManager.getCurrentState());
			gameManager.save();
			await this.check();
		});
	}
}

export const integrityCheck = new IntegrityCheck();
