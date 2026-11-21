import { GoTrueClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import type { Database } from '#lib/types/supabase.js';

interface AuthOptions {
	autoRefreshToken: boolean;
	detectSessionInUrl: boolean;
	persistSession: boolean;
}

/**
 * The part of `@supabase/supabase-js` the game uses, `auth` and PostgREST (`from`, `rpc`), without Realtime, Storage and Functions, which
 * halves the client chunk. It wires them like `SupabaseClient` does, so sessions stored by supabase-js keep working: same
 * `sb-<project ref>-auth-token` storage key, `apikey` header on every request, and a bearer that is the session's access token, or the key
 * itself when signed out.
 */
export class SupabaseLite extends PostgrestClient<Database> {
	readonly auth: GoTrueClient;

	constructor(url: string, key: string, authOptions: AuthOptions) {
		const base = new URL(url);
		const auth = new GoTrueClient({
			...authOptions,
			headers: { apikey: key, Authorization: `Bearer ${key}` },
			storageKey: `sb-${base.hostname.split('.')[0]}-auth-token`,
			url: new URL('auth/v1', base).href,
		});

		super(new URL('rest/v1', base).href, {
			/** The cast only drops the `preconnect` member Bun's typings add to `typeof fetch`. */
			fetch: (async (input, init) => {
				const { data: { session } } = await auth.getSession();
				const headers = new Headers(init?.headers);
				headers.set('apikey', key);
				if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${session?.access_token ?? key}`);
				return fetch(input, { ...init, headers });
			}) as typeof fetch,
			schema: 'public',
		});

		this.auth = auth;
	}
}
