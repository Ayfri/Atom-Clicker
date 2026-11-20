import { supabaseAdmin } from '#lib/server/supabase.server.js';
import type { SessionProblem } from '#lib/types/session.js';
import type { Database, Json } from '#lib/types/supabase.js';

type ClientSessionInsert = Database['public']['Tables']['client_sessions']['Insert'];

/** A session id that is already stored: the page load already started, or someone is probing for ids. */
export class SessionConflictError extends Error {}

export const sessionsService = {
	/** Returns the write key the page load signs its updates with. */
	async start(row: ClientSessionInsert): Promise<string> {
		let { data, error } = await supabaseAdmin.from('client_sessions').insert(row).select('write_key').single();

		// A player's profile row can trail the sign-in by a moment, the session then starts anonymous instead of failing.
		if (error?.code === '23503' && row.user_id) {
			({ data, error } = await supabaseAdmin.from('client_sessions').insert({ ...row, user_id: null }).select('write_key').single());
		}

		if (error?.code === '23505') throw new SessionConflictError(error.message);
		if (error || !data) {
			console.error('Error starting client session:', error);
			throw error ?? new Error('Client session insert returned no row');
		}

		return data.write_key;
	},

	/** False when the id and write key match no live row, the RPC also refuses sessions past their update cap or two days old. */
	async update(args: { cause: string | null; degraded: boolean; game: Json; id: string; perf: Json; problem: SessionProblem | null; summary: string | null; writeKey: string }): Promise<boolean> {
		const { data, error } = await supabaseAdmin.rpc('update_client_session', {
			p_cause: args.cause as string,
			p_degraded: args.degraded,
			p_game: args.game,
			p_id: args.id,
			p_perf: args.perf,
			p_problem: args.problem as string,
			p_summary: args.summary as string,
			p_write_key: args.writeKey,
		});

		if (error) {
			console.error('Error updating client session:', error);
			throw error;
		}

		return data;
	},
}
