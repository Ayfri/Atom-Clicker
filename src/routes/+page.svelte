<script lang="ts">
	import { COLLIDER_REFRESH_MS } from '#data/collider.js';
	import { FeatureTypes } from '#data/features.js';
	import { getQuarkShopItem } from '#data/quarkShop.js';
	import type { RealmConfig } from '#helpers/RealmManager.svelte.js';
	import { colliderManager } from '#helpers/ColliderManager.svelte.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { reveals } from '#helpers/reveals.svelte.js';
	import { setGlobals } from '#lib/globals.js';
	import { isLocalStorageUnavailable } from '#lib/utils/safeLocalStorage.js';
	import { autoBuyManager } from '#stores/autoBuy.svelte.js';
	import { autoUpgradeManager } from '#stores/autoUpgrade.svelte.js';
	import { saveRecovery } from '#stores/saveRecovery.svelte.js';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import { toastStore } from '#stores/toasts.svelte.js';
	import { ui } from '#stores/ui.svelte.js';
	import { mobile } from '#stores/window.svelte.js';
	import Canvas from '#components/game/Canvas.svelte';
	import Levels from '#components/game/Levels.svelte';
	import NavBar from '#components/layout/NavBar.svelte';
	import RealmFooter from '#components/layout/RealmFooter.svelte';
	import RealmSwitcher from '#components/layout/RealmSwitcher.svelte';
	import RemoteBanner from '#components/layout/RemoteBanner.svelte';
	import Toaster from '#components/layout/Toaster.svelte';
	import OfflineProgress from '#components/modals/OfflineProgress.svelte';
	import SaveRecovery from '#components/modals/SaveRecovery.svelte';
	import AtomRealm from '#components/prestige/AtomRealm.svelte';
	import PhotonRealm from '#components/prestige/PhotonRealm.svelte';
	import RadiationRealm from '#components/prestige/RadiationRealm.svelte';
	import AutoSaveIndicator from '#components/system/AutoSaveIndicator.svelte';
	import { onMount, untrack, type Component } from 'svelte';

	const realmComponents: Record<string, Component> = {
		AtomRealm: AtomRealm,
		PhotonRealm: PhotonRealm,
		RadiationRealm: RadiationRealm,
	};

	// Equipped Quark themes only swap the background gradient; falls back to the realm's default.
	function getRealmBackground(realm: RealmConfig): string | undefined {
		const themeId = quarksManager.equippedThemes[realm.id];
		const theme = themeId ? getQuarkShopItem(themeId)?.theme : undefined;
		return theme?.background ?? realm.background;
	}

	const selectedIndex = $derived(realmManager.selectedIndex);

	autoBuyManager.init();
	autoUpgradeManager.init();

	const SAVE_INTERVAL = 1000;
	const CLOUD_PULL_WARNING_THRESHOLD_MS = 5_000;
	/**
	 * Gaps up to a second are paid in full at the online rate, covering stalled frames and background tabs, whose timers
	 * run at 1 Hz. Anything longer means the tab was frozen or throttled to one timer per minute, see `awayMs`.
	 */
	const MAX_ONLINE_GAP_MS = 1000;
	/**
	 * Production is committed on a timer at this rate, not from a rAF loop: a pending rAF makes Chrome run a full main
	 * frame at the display rate (179 per second on a 179 Hz screen), while the counters only change at 50 Hz.
	 */
	const COMMIT_INTERVAL_MS = 20;
	let hasCheckedCloudSaveOnLoad = false;
	let accountBootstrapped = $state(false);
	let lastUpdateTime = 0;
	let pendingAtoms = 0;
	/** Time past `MAX_ONLINE_GAP_MS`, piled up while hidden and paid at the offline rates once the player is back. */
	let awayMs = 0;
	let quarkUserId: string | null = null;

	function commitPendingAtoms() {
		if (pendingAtoms <= 0) return;
		gameManager.addAtoms(pendingAtoms);
		pendingAtoms = 0;
	}

	function update() {
		const now = performance.now();
		const elapsed = now - lastUpdateTime;
		const paidMs = Math.min(elapsed, MAX_ONLINE_GAP_MS);
		pendingAtoms += ((gameManager.atomsPerSecond + gameManager.clickPower * gameManager.autoClicksPerSecond) * paidMs) / 1000;
		lastUpdateTime = now;
		commitPendingAtoms();

		awayMs += elapsed - paidMs;
		if (document.hidden) return;
		if (awayMs > 0 && gameManager.catchUpOffline(awayMs) && !ui.activeModal) ui.openModal(OfflineProgress);
		awayMs = 0;
	}

	async function checkCloudSaveOnLoad() {
		if (hasCheckedCloudSaveOnLoad || !supabaseAuth.isAuthenticated) return;
		hasCheckedCloudSaveOnLoad = true;

		try {
			const cloudGameTime = await supabaseAuth.getCloudSaveTime();
			if (cloudGameTime === null) return;

			const localGameTime = gameManager.inGameTime || 0;
			if (cloudGameTime > localGameTime + CLOUD_PULL_WARNING_THRESHOLD_MS) {
				toastStore.warning({
					action: () => ui.openSettings('cloud'),
					actionLabel: 'Open Cloud Save',
					title: 'Cloud Save Available',
					message: 'A cloud save with more play time is available.',
					duration: 12_000,
				});
			}
		} catch (error) {
			console.warn('Cloud save check failed:', error);
		}
	}

	/** Account bootstrap is network-bound, so it runs beside the game loop instead of delaying it. */
	async function bootstrapAccount() {
		await supabaseAuth.init();

		quarkUserId = supabaseAuth.user?.id ?? null;
		await Promise.all([quarkUserId ? quarksManager.sync() : Promise.resolve(), checkCloudSaveOnLoad()]);
		accountBootstrapped = true;
	}

	$effect(() => {
		const userId = supabaseAuth.user?.id ?? null;
		const authenticated = supabaseAuth.isAuthenticated;
		if (!accountBootstrapped) return;

		untrack(() => {
			if (userId !== quarkUserId) {
				quarkUserId = userId;
				if (userId) quarksManager.sync();
				else quarksManager.clear();
			}
			if (authenticated) checkCloudSaveOnLoad();
		});
	});

	/** Late enough that the One Tap prompt offers to keep real progress instead of greeting a new player with a login. */
	const ONE_TAP_PLAY_TIME_MS = 10 * 60_000;
	const oneTapReady = $derived(accountBootstrapped && !supabaseAuth.isAuthenticated && gameManager.inGameTime >= ONE_TAP_PLAY_TIME_MS);

	$effect(() => {
		if (oneTapReady) supabaseAuth.promptGoogleOneTap();
	});

	/** Signing in or out swaps the player half of the Collider state, so it re-syncs on each change. */
	$effect(() => {
		if (!accountBootstrapped || !gameManager.features[FeatureTypes.COLLIDER]) return;

		const signedIn = supabaseAuth.isAuthenticated;
		untrack(() => colliderManager.sync(signedIn));
		const interval = setInterval(() => colliderManager.sync(), COLLIDER_REFRESH_MS);
		return () => clearInterval(interval);
	});

	onMount(() => {
		gameManager.initialize();

		if (isLocalStorageUnavailable()) {
			toastStore.warning({
				title: 'Progress Will Not Be Saved',
				message: 'Your browser is blocking storage for this page, so the game cannot save locally. Sign in to save to the cloud, or allow site data.',
				duration: 20_000,
			});
		}

		if (gameManager.offlineProgressSummary && !ui.activeModal) {
			ui.openModal(OfflineProgress);
		}

		reveals.arm();

		lastUpdateTime = performance.now();
		const commitLoop = setInterval(update, COMMIT_INTERVAL_MS);

		setGlobals();

		const saveLoop = setInterval(() => {
			try {
				commitPendingAtoms();
				gameManager.save();
			} catch (e) {
				console.error('Failed to save game:', e);
			}
		}, SAVE_INTERVAL);

		bootstrapAccount();

		return () => {
			clearInterval(saveLoop);
			clearInterval(commitLoop);
			commitPendingAtoms();
			gameManager.cleanup();
		};
	});
</script>

<div class="flex flex-col min-h-dvh">
	<RemoteBanner />
	<NavBar />
	<Toaster />
	<AutoSaveIndicator />
	<Canvas />
	<RealmSwitcher />

	<main
		class="relative flex-1 {mobile.current ? 'overflow-y-auto overflow-x-hidden' : (
			'overflow-hidden'
		)} lg:pb-4 transition-all duration-300"
		style="padding-top: calc(3rem + var(--banner-height));"
	>
		{#if gameManager.features[FeatureTypes.LEVELS]}
			<Levels />
		{/if}

		<!-- Realms sit side by side and swing in like the faces of a cube, the leaving one first, the arriving one after
		     a short delay adding up to REALM_SWITCH_MS. Layout containment makes the panel the containing block of its fixed
		     children, even with reduced motion where it has no transform. -->
		{#each realmManager.availableRealms as realm, i (realm.id)}
			{const RealmComponent = $derived(realmComponents[realm.componentId])}
			{const background = $derived(getRealmBackground(realm))}
			{const side = $derived(Math.sign(i - selectedIndex))}

			<!-- Off-screen realms stay mounted for their timers, `content-visibility` skips their style, layout, paint and CSS
			     animations. `transition-discrete` holds it visible until the swing out ends. Below opacity 1 the panel is
			     the backdrop root of its `backdrop-blur` children, so its opaque `bg-page` keeps them from lightening mid-fade. -->
			<div
				class="absolute inset-x-0 bottom-0 overflow-hidden bg-page contain-layout transition-[content-visibility,opacity,transform] transition-discrete motion-reduce:transform-none! {(
					side
				) ?
					'[content-visibility:hidden] duration-500 ease-[cubic-bezier(0.55,0,1,0.45)] opacity-0 pointer-events-none'
				:	'z-1 delay-100 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] opacity-100'}"
				style="top: {mobile.current ? 'var(--banner-height)' : '0'}; bottom: var(--mobile-nav-height, 0px); transform: {side ?
					`translateX(${side * 70}%) perspective(1200px) rotateY(${side * 35}deg) scale(0.8)`
				:	'translateX(0)'}; {background ? `background-image: ${background};` : ''}"
			>
				<!-- On phones the realm background runs behind the level bar while the content scrolls below it. -->
				<div
					class="absolute inset-0 overflow-y-auto custom-scrollbar"
					style:top={mobile.current && gameManager.features[FeatureTypes.LEVELS] ? '3rem' : undefined}
				>
					<div class="flex flex-col min-h-full">
						<div class="flex-1">
							<RealmComponent />
						</div>
						<RealmFooter />
					</div>
				</div>
			</div>
		{/each}

		{#if saveRecovery.hasError}
			<SaveRecovery onClose={() => saveRecovery.clearError()} />
		{/if}
	</main>
</div>
