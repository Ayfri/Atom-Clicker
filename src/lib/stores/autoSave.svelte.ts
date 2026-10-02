import { browser } from '$app/env';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { getItem, setItem } from '#lib/utils/safeLocalStorage.js';
import { supabaseAuth, type CloudSaveInfo } from '#stores/supabaseAuth.svelte.js';
import { toastStore } from '#stores/toasts.svelte.js';
import { ui } from '#stores/ui.svelte.js';

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

	/** Never overwrites a cloud save another device wrote in the meantime, the player picks which progress to keep. */
	async performAutoSave() {
		if (this.isSaving || supabaseAuth.cloudConflict) return;
		this.isSaving = true;

		try {
			const saved = await supabaseAuth.saveGameToCloud(gameManager.getCurrentState(), true);
			if (!saved) {
				toastStore.warning({
					action: () => ui.openSettings('cloud'),
					actionLabel: 'Open Cloud Save',
					duration: 12_000,
					message: 'Your cloud save changed on another device. Auto-save is paused until you load it or save this device over it.',
					title: 'Cloud Save Changed',
				});
				return;
			}
			this.lastSaved = saved;
			this.lastSaveTime = Date.now();
		} catch (error) {
			console.warn('Auto-save failed:', error);
		} finally {
			this.isSaving = false;
		}
	}
}

export const autoSave = new AutoSaveStore();
