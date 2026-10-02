import type { Provider } from '@supabase/supabase-js';
export type AuthProvider = Provider;

export interface AuthConnection {
	/** Brand color behind the provider logo. */
	color: string;
	icon: string;
	id: string;
	name: string;
	provider: AuthProvider;
}
