import type { SupabaseClient, User, Session, Provider } from '@supabase/supabase-js';
import { browser } from '$app/env';
import { PUBLIC_GOOGLE_CLIENT_ID, PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$app/env/public';
import type { GameState } from '#lib/types.js';
import type { Database, Profile } from '#lib/types/supabase.js';
import { getItem, isLocalStorageAvailable, removeItem, setItem } from '#lib/utils/safeLocalStorage.js';
import { multiTabDetector } from '#stores/multiTab.svelte.js';
import { SAVE_VERSION, migrateSavedState, validateAndRepairGameState } from '#helpers/saves.js';

/** postMessage type the /callback page sends to the window that opened it as a login popup. */
export const AUTH_CALLBACK_MESSAGE = 'atom-clicker:auth-callback';

/** The profile columns the client reads, the save blob stays out of it and is only fetched by the cloud save calls. */
type AccountProfile = Pick<Profile, 'id' | 'picture' | 'username'>;
const PROFILE_COLUMNS = 'id, picture, username';

export type CloudSaveInfo = GameState & { lastSaveDate: number | null };

export class SupabaseAuth {
	isAuthenticated = $state(false);
	user = $state<User | null>(null);
	profile = $state.raw<AccountProfile | null>(null);
	/** The profile row wins over the OAuth provider metadata, which only seeds it. */
	avatarUrl = $derived<string | null>(this.profile?.picture || this.user?.user_metadata?.avatar_url || this.user?.user_metadata?.picture || null);
	displayName = $derived<string | null>(
		this.profile?.username || this.user?.user_metadata?.username || this.user?.user_metadata?.full_name || this.user?.email?.split('@')[0] || null,
	);
	loading = $state(true);
	supabase = $state<SupabaseClient<Database> | null>(null);
	error = $state<Error | null>(null);
	/** Another device wrote the cloud save since this one last synced, auto-save holds off until an upload or a load picks a side. */
	cloudConflict = $state(false);

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

				let { data: profile, error } = await (this.supabase!).from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).single();

				// If profile doesn't exist yet (might be due to trigger lag), wait a bit and retry
				if (error && error.code === 'PGRST116') {
					console.log('Profile not found yet, retrying in 1s...');
					await new Promise((resolve) => setTimeout(resolve, 1000));
					const retry = await (this.supabase!).from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).single();
					profile = retry.data;
					error = retry.error;
				}

				if (profile) {
					this.profile = profile;
					console.log('Found profile:', profile.username);

					// Fire and forget: nothing downstream reads it, and awaiting it would stall the boot sequence.
					void (this.supabase!).from('profiles').update({ is_online: true, updated_at: new Date().toISOString() }).eq('id', user.id);

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
			/** supabase-js pauses its token refresh in hidden tabs, so the cached session can be expired here, getSession() refreshes it. */
			const accessToken = await this.getAccessToken();
			if (!accessToken) return;
			try {
				await fetch('/api/auth/status', {
					body: JSON.stringify({ is_online: true }),
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					method: 'POST',
				});
			} catch (err) {
				console.error('Heartbeat failed:', err);
			}
		}, 45_000);
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

	private oneTapPrompted = false;

	/** Signs in from Google's One Tap prompt without leaving the page, Google itself backs off for days once a player dismisses it. */
	async promptGoogleOneTap() {
		// FedCM only runs in a frame whose host grants `identity-credentials-get`, which itch.io and galaxy.click don't.
		if (!PUBLIC_GOOGLE_CLIENT_ID || !this.supabase || this.isAuthenticated || this.oneTapPrompted || window.self !== window.top) return;
		this.oneTapPrompted = true;

		try {
			await new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = 'https://accounts.google.com/gsi/client';
				script.onload = resolve;
				script.onerror = reject;
				document.head.append(script);
			});

			/** Google signs the SHA-256 of the nonce into the ID token, Supabase hashes the raw one to compare them. */
			const nonce = crypto.randomUUID();
			const hashedNonce = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))).toHex();

			window.google!.accounts.id.initialize({
				callback: async ({ credential }) => {
					const { error } = await this.supabase!.auth.signInWithIdToken({ nonce, provider: 'google', token: credential });
					if (error) {
						console.error('Google One Tap sign in error:', error);
						this.error = error;
					}
				},
				client_id: PUBLIC_GOOGLE_CLIENT_ID,
				context: 'signin',
				itp_support: true,
				nonce: hashedNonce,
				use_fedcm_for_prompt: true,
			});
			window.google!.accounts.id.prompt();
		} catch (err) {
			// Content blockers commonly block the Google script, the regular sign in dialog still works without it.
			console.warn('Google One Tap unavailable:', err);
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
				if (code) await (this.supabase!).auth.exchangeCodeForSession(code); else if (accessToken && refreshToken) await (this.supabase!).auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
			} catch(err) {
				console.error('Popup sign in error:', err);
				this.error = err as Error;
			}
		};
		window.addEventListener('message', this.popupListener);
	}

	async signOut() {
		if (!browser || !this.supabase) return;

		try {
			if (this.user) {
				await this.supabase
					.from('profiles')
					.update({
						is_online: false,
						updated_at: new Date().toISOString(),
					})
					.eq('id', this.user.id);
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

	async updateProfile(updates: Partial<Pick<Profile, 'picture' | 'username'>>) {
		if (!browser || !this.supabase) return;

		try {
			if (!this.user) throw new Error('No authenticated user');

			const { error } = await this.supabase
				.from('profiles')
				.update({
					...updates,
					updated_at: new Date().toISOString(),
				})
				.eq('id', this.user.id);

			if (error) throw error;

			if (this.profile) {
				this.profile = { ...this.profile, ...updates };
			}
		} catch (err) {
			console.error('Error updating profile:', err);
			throw err;
		}
	}

	/** `lastSaveDate` of the cloud copy this device last uploaded or loaded, per account. */
	private get syncedSaveDate(): number | null {
		const stored = Number(getItem(`cloudSaveSyncedAt:${this.user?.id}`));
		return stored > 0 ? stored : null;
	}

	private markSynced(lastSaveDate: number | null) {
		setItem(`cloudSaveSyncedAt:${this.user?.id}`, String(lastSaveDate ?? 0));
		removeItem(`cloudSavePendingAt:${this.user?.id}`);
		this.cloudConflict = false;
	}

	/**
	 * A device that never synced adopts the cloud copy as its own unless the cloud has more play time, so the first auto-save goes through.
	 * A cloud copy matching the last upload sent also counts as synced, a tab closing mid-upload never gets the answer that confirms it.
	 */
	adoptCloudSave(lastSaveDate: number | null, cloudAhead: boolean) {
		const pending = Number(getItem(`cloudSavePendingAt:${this.user?.id}`));
		if ((this.syncedSaveDate === null && !cloudAhead) || (pending > 0 && lastSaveDate === pending)) this.markSynced(lastSaveDate);
	}

	/**
	 * Returns what now sits in the cloud, a snapshot so it stops following the live game state. With `onlyIfSynced` the write only lands
	 * while the cloud still holds the copy this device last synced, otherwise it flags `cloudConflict` and returns null.
	 */
	async saveGameToCloud(currentState: GameState, onlyIfSynced = false): Promise<CloudSaveInfo | null> {
		if (!browser || !this.supabase) return null;
		return this.uploadSave(currentState, onlyIfSynced, await this.getAccessToken());
	}

	/** `saveGameToCloud` sent synchronously with the cached token, for the tab hiding or closing, where an await may never resume. */
	flushSaveToCloud(currentState: GameState): Promise<CloudSaveInfo | null> {
		return this.uploadSave(currentState, true, this.currentSession?.access_token ?? null);
	}

	/** A raw PostgREST call, supabase-js can't set `keepalive` (which lets the request outlive the tab) and awaits a session lock first. */
	private async uploadSave(currentState: GameState, onlyIfSynced: boolean, accessToken: string | null): Promise<CloudSaveInfo | null> {
		const userId = this.user?.id;
		if (!userId || !accessToken) throw new Error('No authenticated user');

		const saveData: CloudSaveInfo = $state.snapshot({ ...currentState, lastSaveDate: Date.now(), version: SAVE_VERSION });
		const query = new URLSearchParams({ id: `eq.${userId}`, select: 'id' });
		if (onlyIfSynced) {
			const synced = this.syncedSaveDate;
			query.set('save->>lastSaveDate', synced === null ? 'is.null' : `eq.${synced}`);
		}
		setItem(`cloudSavePendingAt:${userId}`, String(saveData.lastSaveDate));

		const response = await fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/profiles?${query}`, {
			body: JSON.stringify({ save: saveData, updated_at: new Date().toISOString() }),
			headers: {
				'apikey': PUBLIC_SUPABASE_PUBLISHABLE_KEY,
				'Authorization': `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
				'Prefer': 'return=representation',
			},
			keepalive: true,
			method: 'PATCH',
		});
		if (!response.ok) throw new Error(`Cloud save failed: ${response.status} ${await response.text()}`);
		if ((await response.json() as unknown[]).length === 0) {
			this.cloudConflict = true;
			return null;
		}
		this.markSynced(saveData.lastSaveDate);
		return saveData;
	}

	/** The repaired state, since `loadSaveData` skips missing keys and would keep this device's values for them. */
	private async fetchCloudSave(): Promise<CloudSaveInfo | null> {
		if (!browser || !this.supabase || !this.user) return null;

		const { data: profile, error } = await this.supabase.from('profiles').select('save').eq('id', this.user.id).single();
		if (error) throw error;
		if (!profile?.save) return null;

		const state = validateAndRepairGameState(migrateSavedState(profile.save)).state;
		return state && { ...state, lastSaveDate: (profile.save as { lastSaveDate?: number }).lastSaveDate ?? null };
	}

	async loadGameFromCloud(): Promise<CloudSaveInfo | null> {
		const save = await this.fetchCloudSave();
		if (save) this.markSynced(save.lastSaveDate);
		return save;
	}

	getCloudSaveInfo(): Promise<CloudSaveInfo | null> {
		return this.fetchCloudSave().catch(err => {
			console.error('Error getting cloud save info:', err);
			return null;
		});
	}

	/** Only the play time and date of the cloud save, so the "cloud save available" check never downloads the whole blob. */
	async getCloudSaveStamp(): Promise<{ inGameTime: number | null; lastSaveDate: number | null } | null> {
		if (!browser || !this.supabase || !this.user) return null;

		const { data, error } = await this.supabase
			.from('profiles')
			.select('inGameTime:save->inGameTime, lastSaveDate:save->lastSaveDate')
			.eq('id', this.user.id)
			.single()
			.overrideTypes<{ inGameTime: number | null; lastSaveDate: number | null }, { merge: false }>();
		if (error) throw error;
		return data;
	}
}

export const supabaseAuth = new SupabaseAuth();
