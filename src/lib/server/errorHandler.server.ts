import { dev } from '$app/env';
import { isNoiseError } from '#helpers/errorNoise.js';
import { supabaseAdmin } from '#lib/server/supabase.server.js';
import type { Json } from '#lib/types/supabase.js';

interface ServerErrorReport {
	browserInfo?: Record<string, unknown> | null;
	errorMessage: string;
	gameState?: Record<string, unknown> | null;
	stackTrace?: string | null;
	url?: string | null;
	userId?: string | null;
}

const DEDUP_WINDOW_MINUTES = 5;

async function isDuplicateError(errorMessage: string, stackTrace: string | null): Promise<boolean> {
	const windowStart = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();

	const { data } = await supabaseAdmin
		.from('error_logs')
		.select('id')
		.eq('error_message', errorMessage)
		.eq('stack_trace', stackTrace || '')
		.gte('created_at', windowStart)
		.limit(1);

	return (data?.length ?? 0) > 0;
}

/** The Discord notification is a Postgres trigger on the insert. */
export async function logError(report: ServerErrorReport): Promise<{ id: string } | null> {
	if (dev) {
		console.log('[ErrorHandler] Skipping error log in dev mode:', report.errorMessage.substring(0, 50));
		return null;
	}

	const { browserInfo, errorMessage, gameState, stackTrace, url, userId } = report;

	/** Filtered here as well so reports from builds that predate the client-side filter stay out of Discord. */
	if (isNoiseError(errorMessage, stackTrace ?? null)) return null;

	if (await isDuplicateError(errorMessage, stackTrace || null)) return null;

	const { data, error: dbError } = await supabaseAdmin
		.from('error_logs')
		.insert({
			browser_info: browserInfo as Json,
			error_message: errorMessage,
			game_state: gameState as Json,
			stack_trace: stackTrace,
			url,
			user_id: userId
		})
		.select('id')
		.single();

	if (dbError) {
		console.error('[ErrorHandler] Failed to insert error log:', dbError);
		return null;
	}

	return data;
}
