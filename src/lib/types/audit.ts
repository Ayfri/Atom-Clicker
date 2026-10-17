import type { CurrencyName } from '#data/currencies.js';

export interface AuditCheck {
	id: string;
	label: string;
	limit: number | null;
	value: number | null;
}

type StatFixKey = 'runStartedAt' | 'startDate' | 'totalClicksAllTime' | 'totalElectronizesAllTime' | 'totalProtonisesAllTime' | 'totalXP';

export type StateFixTarget = { currency: CurrencyName; field: 'amount' | 'earnedAllTime' | 'earnedRun' } | { key: StatFixKey };

export type StateFix = StateFixTarget & { from: number; issue: string; to: number };

export interface DevAuditRequest {
	colliderTotal: number;
	state: unknown;
	totalUsers: number;
}

export interface DevAuditReport {
	checks: AuditCheck[];
	fixes: StateFix[];
	issues: string[];
	remaining: string[];
}

export type DevAuditResponse = { status: 'malformed' | 'outdated' } | ({ status: 'checked' } & DevAuditReport);
