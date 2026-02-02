import { browser, dev } from '$app/environment';
import { gameManager } from '$helpers/GameManager.svelte';
import { supabaseAuth } from '$stores/supabaseAuth.svelte';

export interface BrowserInfo {
	language: string;
	platform: string;
	screenHeight: number;
	screenWidth: number;
	userAgent: string;
	vendor: string;
}

export interface ErrorReport {
	browserInfo: BrowserInfo | null;
	errorMessage: string;
	gameState: Record<string, unknown> | null;
	stackTrace: string | null;
	url: string | null;
	userId: string | null;
}

// Deduplication cache - stores hashes of recent errors to avoid sending duplicates
const recentErrorHashes = new Set<string>();
const DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a hash for deduplication based on error message and stack trace
 */
function getErrorHash(errorMessage: string, stackTrace: string | null): string {
	// Use first 500 chars of stack trace for hash (to catch same errors)
	const stackKey = stackTrace?.substring(0, 500) || '';
	return `${errorMessage}::${stackKey}`;
}

/**
 * Checks if this error was recently reported (deduplication)
 */
function isDuplicateError(errorMessage: string, stackTrace: string | null): boolean {
	const hash = getErrorHash(errorMessage, stackTrace);

	if (recentErrorHashes.has(hash)) {
		return true;
	}

	// Add to cache and schedule removal
	recentErrorHashes.add(hash);
	setTimeout(() => recentErrorHashes.delete(hash), DEDUP_WINDOW);

	return false;
}

/**
 * Captures browser information for error reports
 */
export function getBrowserInfo(): BrowserInfo | null {
	if (!browser) return null;

	return {
		language: navigator.language,
		platform: navigator.platform,
		screenHeight: window.screen.height,
		screenWidth: window.screen.width,
		userAgent: navigator.userAgent,
		vendor: navigator.vendor
	};
}

/**
 * Safely captures the current game state, removing circular references
 * and limiting the size of the payload
 */
export function captureGameState(): Record<string, unknown> | null {
	if (!browser) return null;

	try {
		const state = gameManager.getCurrentState();

		const safeState: Record<string, unknown> = {
			...state,
			achievements: state.achievements?.length ?? 0,
			activePowerUps: state.activePowerUps?.length ?? 0,
			buildings: Object.entries(state.buildings || {}).reduce(
				(acc, [key, building]) => {
					if (building) {
						acc[key] = { count: building.count, level: building.level };
					}
					return acc;
				},
				{} as Record<string, { count: number; level: number }>
			),
			skillUpgrades: state.skillUpgrades?.length ?? 0,
			upgrades: state.upgrades?.length ?? 0
		};

		return safeState;
	} catch {
		// If we can't capture state, return null rather than crashing
		return null;
	}
}

/**
 * Gets the current user ID from the auth store
 */
export function getCurrentUserId(): string | null {
	if (!browser) return null;

	try {
		return supabaseAuth.user?.id ?? null;
	} catch {
		return null;
	}
}

/**
 * Creates a full error report with all available context
 */
export function createErrorReport(error: Error | string): ErrorReport {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const stackTrace = error instanceof Error ? error.stack ?? null : null;

	return {
		browserInfo: getBrowserInfo(),
		errorMessage,
		gameState: captureGameState(),
		stackTrace,
		url: browser ? window.location.href : null,
		userId: getCurrentUserId()
	};
}

/**
 * Sends an error report to the server
 */
export async function reportError(error: Error | string): Promise<void> {
	if (!browser) return;

	if (dev) {
		console.log('[ErrorReporting] Skipping error report in dev mode:', error);
		return;
	}

	try {
		const report = createErrorReport(error);

		// Skip if this is a duplicate error
		if (isDuplicateError(report.errorMessage, report.stackTrace)) {
			console.log('[ErrorReporting] Skipping duplicate error');
			return;
		}

		await fetch('/api/errors', {
			body: JSON.stringify(report),
			headers: {
				'Content-Type': 'application/json'
			},
			method: 'POST'
		});
	} catch {
		// Silently fail - we don't want error reporting to cause more errors
		console.error('[ErrorReporting] Failed to report error');
	}
}

/**
 * Initializes global error handlers for uncaught errors
 * Call this once on app startup
 */
export function initGlobalErrorHandlers(): void {
	if (!browser) return;

	// Catch unhandled promise rejections
	window.addEventListener('unhandledrejection', (event) => {
		const error = event.reason instanceof Error
			? event.reason
			: new Error(String(event.reason));
		reportError(error);
	});

	// Catch global JS errors
	window.addEventListener('error', (event) => {
		// Skip if it's a script loading error (no stack trace)
		if (!event.error) return;
		reportError(event.error);
	});
}
