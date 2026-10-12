import { browser, dev } from '$app/env';
import { CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
import { getBrowserInfo, isCrawler, type BrowserInfo } from '#helpers/clientInfo.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { isNoiseError } from '#lib/utils/errorNoise.js';
import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';

interface ErrorReport {
	browserInfo: BrowserInfo | null;
	errorMessage: string;
	gameState: Record<string, unknown> | null;
	stackTrace: string | null;
	url: string | null;
}

const recentErrorHashes = new Set<string>();
const DEDUP_WINDOW = 5 * 60 * 1000;

/** Zaraz frames carry a `?z=<base64>` payload that encodes the player's referrer and inflates the field. */
function sanitizeStackTrace(stackTrace: string | null): string | null {
	if (!stackTrace) return null;
	return stackTrace.replace(/\?z=[^\s):]*/g, '');
}

function isDuplicateError(errorMessage: string, stackTrace: string | null): boolean {
	const hash = `${errorMessage}::${stackTrace?.substring(0, 500) || ''}`;
	if (recentErrorHashes.has(hash)) return true;

	recentErrorHashes.add(hash);
	setTimeout(() => recentErrorHashes.delete(hash), DEDUP_WINDOW);
	return false;
}

/** An allow-list rather than the whole state, so the payload stays small and a newly saved field never leaks in by accident. */
function captureGameState(): Record<string, unknown> | null {
	if (!browser) return null;

	try {
		const state = gameManager.getCurrentState();
		const amount = (currency: CurrencyName) => state.currencies?.[currency]?.amount ?? 0;

		return {
			achievements: state.achievements?.length ?? 0,
			activePowerUps: state.activePowerUps?.length ?? 0,
			atoms: amount(CurrenciesTypes.ATOMS),
			generators: Object.entries(state.generators || {}).reduce(
				(acc, [key, generator]) => {
					if (generator) {
						acc[key] = { count: generator.count, level: generator.level };
					}
					return acc;
				},
				{} as Record<string, { count: number; level: number }>
			),
			electronizes: state.totalElectronizesAllTime ?? 0,
			electrons: amount(CurrenciesTypes.ELECTRONS),
			excitedPhotons: amount(CurrenciesTypes.EXCITED_PHOTONS),
			higgsBoson: amount(CurrenciesTypes.HIGGS_BOSON),
			highestAPS: state.highestAPS ?? 0,
			inGameTime: state.inGameTime ?? 0,
			photons: amount(CurrenciesTypes.PHOTONS),
			protonises: state.totalProtonisesAllTime ?? 0,
			protons: amount(CurrenciesTypes.PROTONS),
			radiationMass: state.radiation?.mass ?? 0,
			radiationUnlocked: state.radiation?.unlocked ?? false,
			// Every realm stays mounted, so this is the visible one only
			realm: state.selectedRealmId ?? null,
			saveTampered: gameManager.integrityFlagged,
			saveWarnings: gameManager.saveIntegrityWarnings,
			skillUpgrades: state.skillUpgrades?.length ?? 0,
			totalClicks: state.totalClicksAllTime ?? 0,
			totalXP: state.totalXP ?? 0,
			upgrades: state.upgrades?.length ?? 0,
			version: state.version
		};
	} catch {
		return null;
	}
}

function createErrorReport(error: Error | string): ErrorReport {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const stackTrace = error instanceof Error ? error.stack ?? null : null;

	return {
		browserInfo: getBrowserInfo(),
		errorMessage,
		gameState: captureGameState(),
		stackTrace: sanitizeStackTrace(stackTrace),
		url: browser ? window.location.href : null
	};
}

export async function reportError(error: Error | string): Promise<void> {
	if (!browser) return;

	if (dev) {
		console.log('[ErrorReporting] Skipping error report in dev mode:', error);
		return;
	}

	if (isCrawler()) return;

	try {
		const report = createErrorReport(error);
		if (isNoiseError(report.errorMessage, report.stackTrace)) return;
		if (isDuplicateError(report.errorMessage, report.stackTrace)) return;

		// The server attributes the report to the session behind this token, so an unauthenticated report stays anonymous.
		const token = await supabaseAuth.getAccessToken().catch(() => null);
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (token) headers.Authorization = `Bearer ${token}`;

		await fetch('/api/errors', {
			body: JSON.stringify(report),
			headers,
			method: 'POST'
		});
	} catch {
		console.error('[ErrorReporting] Failed to report error');
	}
}

/**
 * Errors thrown by extension content scripts fail `instanceof Error` (other realm), and `new Error(String(reason))`
 * would stamp our own frame on them, so the original message and stack are carried over as-is.
 */
function toReportable(reason: unknown): Error | string {
	if (reason instanceof Error) return reason;
	if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') {
		const error = new Error(reason.message);
		error.stack = 'stack' in reason && typeof reason.stack === 'string' ? reason.stack : undefined;
		return error;
	}
	return String(reason);
}

export function initGlobalErrorHandlers(): void {
	if (!browser) return;

	window.addEventListener('unhandledrejection', (event) => {
		reportError(toReportable(event.reason));
	});

	window.addEventListener('error', (event) => {
		// Script loading errors carry no error object and nothing actionable
		if (!event.error) return;
		reportError(event.error);
	});
}
