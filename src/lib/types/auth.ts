import type { Provider } from '@supabase/supabase-js';

export interface AuthConnection {
	/** Brand color behind the provider logo. */
	color: string;
	icon: string;
	id: string;
	name: string;
	provider: Provider;
}
