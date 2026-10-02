import { browser } from '$app/env';
import { colliderBonus } from '#data/collider.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import type { ColliderState } from '#lib/types.js';
import { obfuscateClientData } from '#lib/utils/obfuscation.js';
import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
import { toastStore } from '#stores/toasts.svelte.js';

/** Owns the `/api/collider` calls, GameManager only receives the bonus so the simulation worker never pulls in `fetch`. */
export class ColliderManager {
	injections = $state(0);
	pending = $state(false);
	/** Flipped by a timer when the cooldown ends, so nothing polls the clock. */
	ready = $state(false);
	/** Built from the server's remaining cooldown rather than its timestamp, so a skewed device clock changes nothing. */
	readyAt = $state(0);
	total = $state(0);
	private readyTimer: ReturnType<typeof setTimeout> | undefined;

	private apply(state: ColliderState) {
		this.injections = state.injections;
		this.total = state.total;
		gameManager.colliderBonus = colliderBonus(state.total);

		this.readyAt = Date.now() + state.readyInMs;
		this.ready = state.readyInMs <= 0;
		clearTimeout(this.readyTimer);
		if (!this.ready) this.readyTimer = setTimeout(() => this.ready = true, state.readyInMs);
	}

	private async headers(signedIn: boolean): Promise<Record<string, string>> {
		const accessToken = signedIn ? await supabaseAuth.getAccessToken() : null;
		return accessToken ? { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
	}

	/** A failed refresh keeps the last known bonus, the next one retries. */
	async sync(signedIn = supabaseAuth.isAuthenticated) {
		if (!browser) return;
		try {
			const response = await fetch('/api/collider', { headers: await this.headers(signedIn) });
			if (response.ok) this.apply(await response.json());
		} catch (error) {
			console.warn('Collider sync failed:', error);
		}
	}

	/** Returns whether the particle went in. */
	async inject(): Promise<boolean> {
		if (this.pending || !this.ready || !supabaseAuth.isAuthenticated) return false;
		this.pending = true;
		try {
			const response = await fetch('/api/collider', {
				body: JSON.stringify(obfuscateClientData({})),
				headers: await this.headers(true),
				method: 'POST',
			});
			if (!response.ok) {
				const { error }: { error?: string } = await response.json();
				toastStore.error({ message: error ?? 'Request failed.', title: 'Collider' });
				return false;
			}
			this.apply(await response.json());
			return true;
		} catch {
			toastStore.error({ message: 'Network error while talking to the Collider.', title: 'Collider' });
			return false;
		} finally {
			this.pending = false;
		}
	}
}

export const colliderManager = new ColliderManager();
