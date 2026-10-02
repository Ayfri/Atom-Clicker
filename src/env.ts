import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_GOOGLE_CLIENT_ID: {
		description: 'Web client ID of the Supabase Google provider, the One Tap prompt only shows when it is set.',
		public: true,
		schema: (value) => value || undefined,
		static: true,
	},
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: { public: true, static: true },
	PUBLIC_SUPABASE_URL: { public: true, static: true },
	SUPABASE_SECRET_KEY: { static: true },
});
