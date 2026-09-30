import { browser } from '$app/environment';
import { gameManager } from '$helpers/GameManager.svelte';
import { getItem, setItem } from '$lib/utils/safeLocalStorage';
import { supabaseAuth, type CloudSaveInfo } from '$stores/supabaseAuth.svelte';

class AutoSaveStore {
	enabled = $state(browser && getItem('cloudAutoSaveEnabled') === 'true');
	isSaving = $state(false);
	/** What the last auto-save uploaded, so the Cloud Save tab shows it without downloading it back. */
	lastSaved = $state.raw<CloudSaveInfo | null>(null);
	lastSaveTime = $state(0);

	shouldAutoSave = $derived(this.enabled && supabaseAuth.isAuthenticated);

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => {
					setItem('cloudAutoSaveEnabled', String(this.enabled));
				});

				$effect(() => {
					if (!this.shouldAutoSave) return;
					const timer = setInterval(() => this.performAutoSave(), 30_000);
					return () => clearInterval(timer);
				});
			});
		}
	}

	async performAutoSave() {
		if (this.isSaving) return;
		this.isSaving = true;

		try {
			this.lastSaved = await supabaseAuth.saveGameToCloud(gameManager.getCurrentState());
			this.lastSaveTime = Date.now();
		} catch (error) {
			console.warn('Auto-save failed:', error);
		} finally {
			this.isSaving = false;
		}
	}
}

export const autoSave = new AutoSaveStore();
