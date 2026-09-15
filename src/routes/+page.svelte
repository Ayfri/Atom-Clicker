<script lang="ts">
	import { FeatureTypes } from '$data/features';
	import { getQuarkShopItem } from '$data/quarkShop';
	import type { RealmConfig } from '$helpers/RealmManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { setGlobals } from '$lib/globals';
	import { formatNumber } from '$lib/utils';
	import { isLocalStorageUnavailable } from '$lib/utils/safeLocalStorage';
	import { autoBuyManager } from '$stores/autoBuy.svelte';
	import { autoUpgradeManager } from '$stores/autoUpgrade.svelte';
	import { saveRecovery } from '$stores/saveRecovery';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { toastStore } from '$stores/toasts.svelte';
	import { ui } from '$stores/ui.svelte';
	import { mobile } from '$stores/window.svelte';
	import Levels from '@components/game/Levels.svelte';
	import NavBar from '@components/layout/NavBar.svelte';
	import RealmFooter from '@components/layout/RealmFooter.svelte';
	import RemoteBanner from '@components/layout/RemoteBanner.svelte';
	import Toaster from '@components/layout/Toaster.svelte';
	import OfflineProgress from '@components/modals/OfflineProgress.svelte';
	import SaveRecovery from '@components/modals/SaveRecovery.svelte';
	import AtomRealm from '@components/prestige/AtomRealm.svelte';
	import PhotonRealm from '@components/prestige/PhotonRealm.svelte';
	import RadiationRealm from '@components/prestige/RadiationRealm.svelte';
	import AutoSaveIndicator from '@components/system/AutoSaveIndicator.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { onDestroy, onMount, type Component } from 'svelte';

	// Realm component mapping
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

	autoBuyManager.init();
	autoUpgradeManager.init();

	const SAVE_INTERVAL = 1000;
	const CLOUD_PULL_WARNING_THRESHOLD_MS = 5_000;
	// Long gaps (background tab, stalled frame) are clamped so production never jumps, offline progress handles those.
	const MAX_FRAME_MS = 100;
	/**
	 * Production is committed on a timer at this rate, not from a rAF loop: a pending rAF makes Chrome run a full main
	 * frame at the display rate (179 per second on a 179 Hz screen), while the counters only change at 50 Hz.
	 */
	const COMMIT_INTERVAL_MS = 20;
	let saveLoop: ReturnType<typeof setInterval>;
	let commitLoop: ReturnType<typeof setInterval>;
	let hasCheckedCloudSaveOnLoad = false;
	let authUnsubscribe: (() => void) | null = null;
	let lastUpdateTime = 0;
	let pendingAtoms = 0;
	let quarkUserId: string | null = null;

	function commitPendingAtoms() {
		if (pendingAtoms <= 0) return;
		gameManager.addAtoms(pendingAtoms);
		pendingAtoms = 0;
	}

	function update() {
		const now = performance.now();
		pendingAtoms += (gameManager.atomsPerSecond * Math.min(now - lastUpdateTime, MAX_FRAME_MS)) / 1000;
		lastUpdateTime = now;
		commitPendingAtoms();
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

		authUnsubscribe = supabaseAuth.subscribe(() => {
			const userId = supabaseAuth.user?.id ?? null;
			if (userId !== quarkUserId) {
				quarkUserId = userId;
				if (userId) quarksManager.sync();
				else quarksManager.clear();
			}

			if (supabaseAuth.isAuthenticated) {
				checkCloudSaveOnLoad();
			}
		});
	}

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

		const tutorial = gameManager.tutorialManager.state;
		if (!tutorial.completed && !tutorial.active) {
			gameManager.tutorialManager.start();
		}

		lastUpdateTime = performance.now();
		commitLoop = setInterval(update, COMMIT_INTERVAL_MS);

		setGlobals();

		saveLoop = setInterval(() => {
			try {
				commitPendingAtoms();
				gameManager.save();
			} catch (e) {
				console.error('Failed to save game:', e);
			}
		}, SAVE_INTERVAL);

		bootstrapAccount();
	});

	onDestroy(() => {
		if (saveLoop) clearInterval(saveLoop);
		clearInterval(commitLoop);
		commitPendingAtoms();
		if (authUnsubscribe) authUnsubscribe();
		gameManager.cleanup();
	});
</script>

<div class="flex flex-col min-h-screen">
	<RemoteBanner />
	<NavBar />
	<Toaster />
	<AutoSaveIndicator />

	{#if realmManager.availableRealms.length > 1}
		<!-- The panel itself is click-through: at phone widths it sits over the top of the nav grid, and its
		     own padding would otherwise swallow taps meant for the button underneath. -->
		<div
			class="fixed right-4 z-30 bg-black/10 backdrop-blur-xs border border-white/10 rounded-lg p-1 transition-all duration-300 pointer-events-none"
			style="top: {mobile.current ? 'calc(var(--mobile-nav-bottom, 33vh) + 1rem)' : 'calc(var(--banner-height) + 5rem)'}"
		>
			<div class="flex flex-col gap-1">
				{#each realmManager.availableRealms as realm (realm.id)}
					<button
						class="flex items-center gap-2 px-2 py-1.5 rounded-sm transition-all duration-200 hover:scale-105 pointer-events-auto {(
							realmManager.selectedRealmId === realm.id
						) ?
							'bg-accent-500/60 border-accent-400/50'
						:	'bg-white/5 hover:bg-white/10'}"
						id="realm-{realm.id}"
						onclick={() => realmManager.selectRealm(realm.id)}
						title="{realm.title} - {formatNumber(realmManager.realmValues[realm.id] ?? 0)} {realm.currency.name.toLowerCase()}"
					>
						<Currency name={realm.currency.name} />
						<div class="text-xs text-white/80">{formatNumber(realmManager.realmValues[realm.id] ?? 0, 1)}</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<main
		class="relative flex-1 {mobile.current ? 'overflow-y-auto overflow-x-hidden' : (
			'overflow-hidden'
		)} lg:pb-4 transition-all duration-300"
		style="padding-top: calc(3rem + var(--banner-height));"
	>
		{#if gameManager.features[FeatureTypes.LEVELS]}
			<Levels />
		{/if}

		<!-- Use transform and opacity for virtual desktop swipe effect -->
		{#each realmManager.availableRealms as realm, i (realm.id)}
			{@const RealmComponent = realmComponents[realm.componentId]}
			{@const background = getRealmBackground(realm)}

			<div
				class="absolute inset-x-0 bottom-0 transition-all duration-300 ease-in-out overflow-hidden"
				class:opacity-100={realmManager.selectedRealm.id === realm.id}
				class:translate-x-0={realmManager.selectedRealm.id === realm.id}
				class:opacity-0={realmManager.selectedRealm.id !== realm.id}
				class:pointer-events-none={realmManager.selectedRealm.id !== realm.id}
				style="top: {mobile.current ? 'calc(3rem + var(--banner-height))' : '0'}; transform: translateX({(
					realmManager.selectedRealm.id === realm.id
				) ?
					'0'
				: i > realmManager.availableRealms.findIndex(r => r.id === realmManager.selectedRealm.id) ? '100%'
				: '-100%'}); {background ? `background-image: ${background};` : ''}"
			>
				<div class="absolute inset-0 overflow-y-auto custom-scrollbar">
					<div class="flex flex-col min-h-full">
						<div class="flex-1">
							<RealmComponent />
						</div>
						<RealmFooter />
					</div>
				</div>
			</div>
		{/each}

		{#if $saveRecovery.hasError}
			<SaveRecovery onClose={() => saveRecovery.clearError()} />
		{/if}
	</main>
</div>
