import type { Provider } from '@supabase/supabase-js';
export type AuthProvider = Provider;

export interface AuthConnection {
	icon: string;
	id: string;
	name: string;
	provider: AuthProvider;
	backgroundColor: string;
	hoverBackgroundColor: string;
	textColor: string;
}
