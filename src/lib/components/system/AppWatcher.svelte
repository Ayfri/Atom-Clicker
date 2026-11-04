<script lang="ts">
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';

	/** The NavBar's quest dot, as a number on the app icon. Only read inside the app, so a browser tab never computes it. */
	const badge = $derived(supabaseAuth.isAuthenticated && quarksManager.hasSynced ? quarksManager.claimableQuestCount : 0);

	/**
	 * The save lives in localStorage, which the browser can evict under storage pressure. Chromium and Safari grant persistence to
	 * installed apps without asking, while Firefox asks with a permission prompt, which a taskbar tab would show on launch, so it's skipped.
	 */
	$effect(() => {
		if (!gameManager.installedApp || !('storage' in navigator) || /Firefox\//.test(navigator.userAgent)) return;
		navigator.storage
			.persisted()
			.then(persisted => persisted || navigator.storage.persist())
			.catch(() => {});
	});

	/** The badge stays on the icon after the app closes, so quests finished just before still show as waiting. Safari only draws it with notifications allowed. */
	$effect(() => {
		if (!gameManager.installedApp || !('setAppBadge' in navigator)) return;
		void (badge ? navigator.setAppBadge(badge) : navigator.clearAppBadge()).catch(() => {});
	});

	/** The browser drops the lock whenever the page is hidden, so it's taken again each time the game comes back on screen. */
	$effect(() => {
		if (!gameManager.settings.gameplay.keepScreenOn || !('wakeLock' in navigator)) return;
		let lock: WakeLockSentinel | null = null;
		/** A page shown again while a request is still pending would otherwise take a second lock and lose the first. */
		let pending = false;
		let stopped = false;
		const request = async () => {
			if (pending || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
			pending = true;
			try {
				lock = await navigator.wakeLock.request('screen');
				if (stopped) void lock.release();
			} catch {
				/** Refused on low battery or by a permissions policy, the screen then sleeps as usual. */
			} finally {
				pending = false;
			}
		};
		void request();
		document.addEventListener('visibilitychange', request);
		return () => {
			stopped = true;
			document.removeEventListener('visibilitychange', request);
			void lock?.release();
		};
	});
</script>
