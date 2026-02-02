import { browser } from '$app/environment';
import { derived, writable } from 'svelte/store';
import { supabaseAuth } from '$stores/supabaseAuth.svelte';

export interface AutoSaveState {
	lastSaveTime: number;
	isSaving: boolean;
}

export const autoSaveEnabled = writable(false);
export const autoSaveState = writable<AutoSaveState>({
	isSaving: false,
	lastSaveTime: 0
});

export const shouldAutoSave = derived(
	[supabaseAuth, autoSaveEnabled],
	([$auth, $enabled]) => $enabled && $auth.isAuthenticated
);

export const autoSaveInterval = derived(shouldAutoSave, ($shouldAutoSave) => ($shouldAutoSave ? 30000 : 0));

if (browser) {
	let timer: ReturnType<typeof setInterval> | null = null;

	autoSaveEnabled.set(localStorage.getItem('cloudAutoSaveEnabled') === 'true');

	autoSaveEnabled.subscribe(enabled => {
		localStorage.setItem('cloudAutoSaveEnabled', enabled.toString());
	});

	autoSaveInterval.subscribe(interval => {
		if (timer) clearInterval(timer);
		timer = interval > 0 ? setInterval(async () => {
			try {
				autoSaveState.update(state => ({ ...state, isSaving: true, lastSaveTime: Date.now() }));
				await supabaseAuth.saveGameToCloud();
			} catch (error) {
				console.warn('Auto-save failed:', error);
			} finally {
				autoSaveState.update(state => ({ ...state, isSaving: false }));
			}
		}, interval) : null;
	});
}

export const autoSaveStore = {
	subscribe: autoSaveState.subscribe,
	startSave: () => autoSaveState.update(state => ({ ...state, isSaving: true, lastSaveTime: Date.now() })),
	stopSave: () => autoSaveState.update(state => ({ ...state, isSaving: false }))
};
