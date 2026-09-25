import type { SupabaseClient, User, Session, Provider } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import type { GameState } from '$lib/types';
import type { Database, Json, Profile } from '$lib/types/supabase';
import { isLocalStorageAvailable } from '$lib/utils/safeLocalStorage';
import { multiTabDetector } from '$stores/multiTab.svelte';
import { isValidGameState, SAVE_VERSION, migrateSavedState, validateAndRepairGameState } from '$helpers/saves';

/** postMessage type the /callback page sends to the window that opened it as a login popup. */
export const AUTH_CALLBACK_MESSAGE = 'atom-clicker:auth-callback';

export class SupabaseAuth {
	isAuthenticated = $state(false);
	user = $state<User | null>(null);
	profile = $state<Profile | null>(null);
	/** The profile row wins over the OAuth provider metadata, which only seeds it. */
	avatarUrl = $derived<string | null>(this.profile?.picture || this.user?.user_metadata?.avatar_url || this.user?.user_metadata?.picture || null);
	displayName = $derived<string | null>(
		this.profile?.username || this.user?.user_metadata?.username || this.user?.user_metadata?.full_name || this.user?.email?.split('@')[0] || null,
	);
	loading = $state(true);
	supabase = $state<SupabaseClient<Database> | null>(null);
	error = $state<Error | null>(null);

	private currentSession: Session | null = null;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private initialized = false;

	/**
	 * Initializes the Supabase client and sets up auth listeners.
	 * Must be called in a browser environment.
	 */
	async init() {
		if (!browser || this.initialized) {
			this.loading = false;
			return;
		}

		// Not available in Web Workers, and blocked outright when site data is disabled or storage is partitioned
		if (!isLocalStorageAvailable()) {
			console.warn('SupabaseAuth: localStorage not available, skipping init');
			this.loading = false;
			return;
		}

		try {
			// Kept out of the initial bundle: the client weighs ~60 kB gzipped and nothing renders through it.
			const { createClient } = await import('@supabase/supabase-js');
			this.supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
				auth: {
					autoRefreshToken: true,
					persistSession: true,
					detectSessionInUrl: true,
				},
			});

			multiTabDetector.init();

			this.initialized = true;

			const {
				data: { session },
			} = await this.supabase.auth.getSession();
			this.currentSession = session;
			await this.handleAuthStateChange(session?.user || null);

			this.supabase.auth.onAuthStateChange(async (event, session) => {
				console.log('Auth state changed:', event);
				this.currentSession = session;
				await this.handleAuthStateChange(session?.user || null);
			});

			window.addEventListener('beforeunload', () => {
				if (this.currentSession?.access_token) {
					fetch('/api/auth/status', {
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${this.currentSession.access_token}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ is_online: false }),
						keepalive: true,
					});
				}
			});
		} catch (err) {
			console.error('Supabase auth initialization error:', err);
			this.error = err as Error;
			this.loading = false;
		}
	}

	private async handleAuthStateChange(user: User | null) {
		try {
			if (user) {
				this.isAuthenticated = true;
				this.user = user;
				if (this.profile?.id === user.id) {
					this.loading = false;
					this.error = null;
					return;
				}
				this.loading = true;

				console.log('Auth state change for user:', user.id);

				let { data: profile, error } = await this.supabase!.from('profiles').select('*').eq('id', user.id).single();

				// If profile doesn't exist yet (might be due to trigger lag), wait a bit and retry
				if (error && error.code === 'PGRST116') {
					console.log('Profile not found yet, retrying in 1s...');
					await new Promise(resolve => setTimeout(resolve, 1000));
					const retry = await this.supabase!.from('profiles').select('*').eq('id', user.id).single();
					profile = retry.data;
					error = retry.error;
				}

				if (profile) {
					this.profile = profile;
					console.log('Found profile:', profile.username);

					// Fire and forget: nothing downstream reads it, and awaiting it would stall the boot sequence.
					void this.supabase!.from('profiles')
						.update({
							is_online: true,
							updated_at: new Date().toISOString(),
						})
						.eq('id', user.id);

					this.startHeartbeat();
				} else {
					console.error('Failed to find or create profile:', error?.message);
				}

				this.loading = false;
				this.error = null;
			} else {
				console.log('User signed out');
				this.stopHeartbeat();
				this.isAuthenticated = false;
				this.user = null;
				this.profile = null;
				this.loading = false;
				this.error = null;
			}
		} catch (err) {
			console.error('Error handling auth state change:', err);
			this.error = err as Error;
			this.loading = false;
		}
	}

	private startHeartbeat() {
		this.stopHeartbeat();
		this.heartbeatInterval = setInterval(async () => {
			if (this.currentSession?.access_token) {
				try {
					await fetch('/api/auth/status', {
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${this.currentSession.access_token}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ is_online: true }),
					});
				} catch (err) {
					console.error('Heartbeat failed:', err);
				}
			}
		}, 45_000); // Pulse every 45 seconds
	}

	private stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	/**
	 * Returns a fresh access token for authenticating requests to our own API routes.
	 * Reads from Supabase (which auto-refreshes) rather than the cached session, so it stays valid.
	 */
	async getAccessToken(): Promise<string | null> {
		if (!this.supabase) return null;
		const { data: { session } } = await this.supabase.auth.getSession();
		this.currentSession = session;
		return session?.access_token ?? null;
	}

	async signInWithProvider(provider: Provider) {
		if (!browser || !this.supabase) {
			await this.init();
			if (!this.supabase) return;
		}

		// Google refuses to render inside a frame, so embeds (itch.io, galaxy.click) log in through a popup that posts the callback URL back.
		const embedded = window.self !== window.top;
		// Opened synchronously in the click handler, popup blockers reject a window.open that comes after an await.
		const popup = embedded ? window.open('', 'atom-clicker-login', 'popup,width=520,height=700') : null;

		try {
			const { data, error } = await this.supabase.auth.signInWithOAuth({
				provider,
				options: {
					redirectTo: `${window.location.origin}/callback`,
					queryParams: {
						access_type: 'offline',
						prompt: 'consent',
					},
					skipBrowserRedirect: embedded,
				},
			});

			if (error) {
				popup?.close();
				this.error = error;
				throw error;
			}
			if (!embedded || !data.url) return;
			if (!popup) throw new Error('Your browser blocked the login window, allow popups for this page and try again.');
			popup.location.href = data.url;
			this.listenForPopupCallback(popup);
		} catch (err) {
			console.error('Sign in error:', err);
			throw err;
		}
	}

	private popupListener: ((event: MessageEvent) => void) | null = null;

	private listenForPopupCallback(popup: Window) {
		if (this.popupListener) window.removeEventListener('message', this.popupListener);
		this.popupListener = async (event: MessageEvent) => {
			if (event.origin !== window.location.origin || event.data?.type !== AUTH_CALLBACK_MESSAGE) return;
			window.removeEventListener('message', this.popupListener!);
			this.popupListener = null;
			popup.close();
			const url = new URL(String(event.data.url));
			const code = url.searchParams.get('code');
			const hash = new URLSearchParams(url.hash.slice(1));
			const accessToken = hash.get('access_token');
			const refreshToken = hash.get('refresh_token');
			try {
				if (code) await this.supabase!.auth.exchangeCodeForSession(code);
				else if (accessToken && refreshToken) await this.supabase!.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
			} catch (err) {
				console.error('Popup sign in error:', err);
				this.error = err as Error;
			}
		};
		window.addEventListener('message', this.popupListener);
	}

	async signOut() {
		if (!browser || !this.supabase) return;

		try {
			const {
				data: { user },
			} = await this.supabase.auth.getUser();
			if (user) {
				await this.supabase
					.from('profiles')
					.update({
						is_online: false,
						updated_at: new Date().toISOString(),
					})
					.eq('id', user.id);
			}

			const { error } = await this.supabase.auth.signOut();
			if (error) {
				this.error = error;
				throw error;
			}
		} catch (err) {
			console.error('Sign out error:', err);
			throw err;
		}
	}

	async updateProfile(updates: Partial<Profile>) {
		if (!browser || !this.supabase) return;

		try {
			const {
				data: { user },
			} = await this.supabase.auth.getUser();
			if (!user) throw new Error('No authenticated user');

			const { error } = await this.supabase
				.from('profiles')
				.update({
					...updates,
					updated_at: new Date().toISOString(),
				})
				.eq('id', user.id);

			if (error) throw error;

			if (this.profile) {
				this.profile = { ...this.profile, ...updates };
			}
		} catch (err) {
			console.error('Error updating profile:', err);
			throw err;
		}
	}

	async saveGameToCloud(currentState: GameState) {
		if (!browser || !this.supabase) return;

		try {
			const {
				data: { user },
			} = await this.supabase.auth.getUser();
			if (!user) throw new Error('No authenticated user');

			const saveData = {
				...currentState,
				version: SAVE_VERSION,
				lastSaveDate: Date.now(),
			} as unknown as Json;

			const { error } = await this.supabase
				.from('profiles')
				.update({
					save: saveData,
					updated_at: new Date().toISOString(),
				})
				.eq('id', user.id);

			if (error) throw error;

			if (this.profile) {
				this.profile = {
					...this.profile,
					save: saveData,
					updated_at: new Date().toISOString(),
				};
			}
		} catch (err) {
			console.error('Error saving game to cloud:', err);
			throw err;
		}
	}

	async loadGameFromCloud(): Promise<GameState | null> {
		if (!browser || !this.supabase) return null;

		try {
			const {
				data: { user },
			} = await this.supabase.auth.getUser();
			if (!user) throw new Error('No authenticated user');

			const { data: profile, error } = await this.supabase.from('profiles').select('save').eq('id', user.id).single();

			if (error) throw error;
			if (!profile?.save) return null;

			const migratedState = migrateSavedState(profile.save);

			if (migratedState && isValidGameState(migratedState)) {
				return migratedState as GameState;
			}
			return null;
		} catch (err) {
			console.error('Error loading game from cloud:', err);
			throw err;
		}
	}

	/** Only the play time of the cloud save, so the "cloud save available" check never downloads the whole blob. */
	async getCloudSaveTime(): Promise<number | null> {
		if (!browser || !this.supabase || !this.user) return null;

		try {
			const { data, error } = await this.supabase
				.from('profiles')
				.select('inGameTime:save->inGameTime')
				.eq('id', this.user.id)
				.single()
				.returns<{ inGameTime: number | null }>();

			if (error) throw error;
			return typeof data?.inGameTime === 'number' ? data.inGameTime : null;
		} catch (err) {
			console.error('Error getting cloud save time:', err);
			return null;
		}
	}

	async getCloudSaveInfo() {
		if (!browser || !this.supabase || !this.user) return null;

		try {
			const user = this.user;
			const { data: profile, error } = await this.supabase.from('profiles').select('save, last_updated').eq('id', user.id).single();

			if (error) throw error;
			if (!profile?.save) return null;

			const migratedData = migrateSavedState(profile.save);
			if (!migratedData) return null;

			const repairResult = validateAndRepairGameState(migratedData);
			const finalData = repairResult.state || migratedData;

			return {
				lastSaveDate: (profile.save as { lastSaveDate?: number }).lastSaveDate || null,
				...finalData,
			};
		} catch (err) {
			console.error('Error getting cloud save info:', err);
			return null;
		}
	}

}

export const supabaseAuth = new SupabaseAuth();
