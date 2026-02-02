import { createClient, type SupabaseClient, type User, type Session, type Provider } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import type { GameState } from '$lib/types';
import type { Database, Profile } from '$lib/types/supabase';
import { gameManager } from '$helpers/GameManager.svelte';
import { multiTabDetector } from '$stores/multiTab.svelte';
import { isValidGameState, SAVE_VERSION, migrateSavedState, validateAndRepairGameState } from '$helpers/saves';


export class SupabaseAuth {
	isAuthenticated = $state(false);
	user = $state<User | null>(null);
	profile = $state<Profile | null>(null);
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

		try {
			this.supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
				auth: {
					autoRefreshToken: true,
					persistSession: true,
					detectSessionInUrl: true
				}
			});

			multiTabDetector.init();

			this.initialized = true;

			// Get initial session
			const { data: { session } } = await this.supabase.auth.getSession();
			this.currentSession = session;
			await this.handleAuthStateChange(session?.user || null);

			// Listen for auth changes
			this.supabase.auth.onAuthStateChange(async (event, session) => {
				console.log('Auth state changed:', event);
				this.currentSession = session;
				await this.handleAuthStateChange(session?.user || null);
			});

			// Update offline status on unload
			window.addEventListener('beforeunload', () => {
				if (this.currentSession?.access_token) {
					fetch('/api/auth/status', {
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${this.currentSession.access_token}`,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ is_online: false }),
						keepalive: true
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
				this.loading = true;

				console.log('Auth state change for user:', user.id);

				// Fetch user profile
				let { data: profile, error } = await this.supabase!
					.from('profiles')
					.select('*')
					.eq('id', user.id)
					.single();

				// If profile doesn't exist yet (might be due to trigger lag), wait a bit and retry
				if (error && error.code === 'PGRST116') {
					console.log('Profile not found yet, retrying in 1s...');
					await new Promise(resolve => setTimeout(resolve, 1000));
					const retry = await this.supabase!
						.from('profiles')
						.select('*')
						.eq('id', user.id)
						.single();
					profile = retry.data;
					error = retry.error;
				}

				if (profile) {
					this.profile = profile;
					console.log('Found profile:', profile.username);

					// Update online status
					await this.supabase!
						.from('profiles')
						.update({
							is_online: true,
							updated_at: new Date().toISOString()
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
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ is_online: true })
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

	async signInWithProvider(provider: Provider) {
		if (!browser || !this.supabase) {
			await this.init();
			if (!this.supabase) return;
		}

		try {
			const { error } = await this.supabase.auth.signInWithOAuth({
				provider,
				options: {
					redirectTo: `${window.location.origin}/callback`,
					queryParams: {
						access_type: 'offline',
						prompt: 'consent'
					}
				}
			});

			if (error) {
				this.error = error;
				throw error;
			}
		} catch (err) {
			console.error('Sign in error:', err);
			throw err;
		}
	}

	async signOut() {
		if (!browser || !this.supabase) return;

		try {
			const { data: { user } } = await this.supabase.auth.getUser();
			if (user) {
				await this.supabase
					.from('profiles')
					.update({
						is_online: false,
						updated_at: new Date().toISOString()
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
			const { data: { user } } = await this.supabase.auth.getUser();
			if (!user) throw new Error('No authenticated user');

			const { error } = await this.supabase
				.from('profiles')
				.update({
					...updates,
					updated_at: new Date().toISOString()
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

	async saveGameToCloud() {
		if (!browser || !this.supabase) return;

		try {
			const { data: { user } } = await this.supabase.auth.getUser();
			if (!user) throw new Error('No authenticated user');

			const currentState = gameManager.getCurrentState();
			const saveData = {
				...currentState,
				version: SAVE_VERSION,
				lastSaveDate: Date.now()
			};

			const { error } = await this.supabase
				.from('profiles')
				.update({
					save: saveData as any,
					updated_at: new Date().toISOString()
				})
				.eq('id', user.id);

			if (error) throw error;

			if (this.profile) {
				this.profile = {
					...this.profile,
					save: saveData as any,
					updated_at: new Date().toISOString()
				};
			}
		} catch (err) {
			console.error('Error saving game to cloud:', err);
			throw err;
		}
	}

	async loadGameFromCloud() {
		if (!browser || !this.supabase) return false;

		try {
			const { data: { user } } = await this.supabase.auth.getUser();
			if (!user) throw new Error('No authenticated user');

			const { data: profile, error } = await this.supabase
				.from('profiles')
				.select('save')
				.eq('id', user.id)
				.single();

			if (error) throw error;
			if (!profile?.save) return false;

			const savedState = profile.save as any;
			const migratedState = migrateSavedState(savedState);

			if (migratedState && isValidGameState(migratedState)) {
				gameManager.loadSaveData(migratedState);
				return true;
			}
			return false;
		} catch (err) {
			console.error('Error loading game from cloud:', err);
			throw err;
		}
	}

	async getCloudSaveInfo() {
		if (!browser || !this.supabase) return null;

		try {
			const { data: { user } } = await this.supabase.auth.getUser();
			if (!user) return null;

			const { data: profile, error } = await this.supabase
				.from('profiles')
				.select('save, last_updated')
				.eq('id', user.id)
				.single();

			if (error) throw error;
			if (!profile?.save) return null;

			const saveData = profile.save as any;
			const migratedData = migrateSavedState(saveData);
			if (!migratedData) return null;

			const repairResult = validateAndRepairGameState(migratedData);
			const finalData = repairResult.state || (migratedData as GameState);

			return {
				lastSaveDate: saveData.lastSaveDate || null,
				...finalData
			};
		} catch (err) {
			console.error('Error getting cloud save info:', err);
			return null;
		}
	}

	// For compatibility with code using .subscribe()
	subscribe(fn: (value: SupabaseAuth) => void) {
		const unsubscribe = $effect.root(() => {
			$effect(() => {
				fn(this);
			});
		});
		return unsubscribe;
	}
}

export const supabaseAuth = new SupabaseAuth();
