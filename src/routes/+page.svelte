<script lang="ts">
	import { FeatureTypes } from '$data/features';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { setGlobals } from '$lib/globals';
	import { formatNumber } from '$lib/utils';
	import { autoBuyManager } from '$stores/autoBuy.svelte';
	import { autoUpgradeManager } from '$stores/autoUpgrade.svelte';
	import { app } from '$stores/pixi';
	import { remoteMessage } from '$stores/remoteMessage.svelte';
	import { saveRecovery } from '$stores/saveRecovery';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { warning } from '$stores/toasts';
	import { ui } from '$stores/ui.svelte';
	import { mobile } from '$stores/window.svelte';
	import Levels from '@components/game/Levels.svelte';
	import NavBar from '@components/layout/NavBar.svelte';
	import RealmFooter from '@components/layout/RealmFooter.svelte';
	import RemoteBanner from '@components/layout/RemoteBanner.svelte';
	import Toaster from '@components/layout/Toaster.svelte';
	import OfflineProgress from '@components/modals/OfflineProgress.svelte';
	import SaveRecovery from '@components/modals/SaveRecovery.svelte';
	import AutoSaveIndicator from '@components/system/AutoSaveIndicator.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { onDestroy, onMount } from 'svelte';

	autoBuyManager.init();
	autoUpgradeManager.init();

	const SAVE_INTERVAL = 1000;
	const CLOUD_PULL_WARNING_THRESHOLD_MS = 5_000;
	let saveLoop: ReturnType<typeof setInterval>;
	let gameUpdateInterval: ReturnType<typeof setInterval> | null = null;
	let hasCheckedCloudSaveOnLoad = false;
	let authUnsubscribe: (() => void) | null = null;

	function update(ticker: any) {
		gameManager.addAtoms((gameManager.atomsPerSecond * ticker.deltaMS) / 1000);
	}

	async function checkCloudSaveOnLoad() {
		if (hasCheckedCloudSaveOnLoad || !supabaseAuth.isAuthenticated) return;
		hasCheckedCloudSaveOnLoad = true;

		try {
			const cloudSaveInfo = await supabaseAuth.getCloudSaveInfo();
			if (typeof cloudSaveInfo?.inGameTime !== 'number') return;

			const localGameTime = gameManager.inGameTime || 0;
			if (cloudSaveInfo.inGameTime > localGameTime + CLOUD_PULL_WARNING_THRESHOLD_MS) {
				warning({
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

	onMount(async () => {
		gameManager.initialize();
		await supabaseAuth.init();
		await checkCloudSaveOnLoad();

		authUnsubscribe = supabaseAuth.subscribe(() => {
			if (supabaseAuth.isAuthenticated) {
				checkCloudSaveOnLoad();
			}
		});

		if (gameManager.offlineProgressSummary && !ui.activeModal) {
			ui.openModal(OfflineProgress);
		}

		while (!$app) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		if ($app.ticker?.add) {
			$app.ticker.add(update);
		} else {
			gameUpdateInterval = setInterval(() => {
				update({ deltaMS: 16.67 });
			}, 16.67);
		}

		setGlobals();

		saveLoop = setInterval(() => {
			try {
				gameManager.save();
			} catch (e) {
				console.error('Failed to save game:', e);
			}
		}, SAVE_INTERVAL);
	});

	onDestroy(() => {
		if (saveLoop) clearInterval(saveLoop);
		if (gameUpdateInterval) clearInterval(gameUpdateInterval);
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
		<div
			class="fixed right-4 z-30 bg-black/10 backdrop-blur-xs border border-white/10 rounded-lg p-1 transition-all duration-300"
			style="top: {remoteMessage.message && remoteMessage.isVisible ? 'calc(1.5rem + 5rem)' : '5rem'}"
		>
			<div class="flex flex-col gap-1">
				{#each realmManager.availableRealms as realm (realm.id)}
					<button
						class="flex items-center gap-2 px-2 py-1.5 rounded-sm transition-all duration-200 hover:scale-105 {(
							realmManager.selectedRealmId === realm.id
						) ?
							'bg-accent-500/60 border-accent-400/50'
						:	'bg-white/5 hover:bg-white/10'}"
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
		style="padding-top: {remoteMessage.message && remoteMessage.isVisible ? 'calc(3rem + 1.5rem)' : '3rem'};"
	>
		{#if gameManager.features[FeatureTypes.LEVELS]}
			<Levels />
		{/if}

		<!-- Use transform and opacity for virtual desktop swipe effect -->
		{#each realmManager.availableRealms as realm, i (realm.id)}
			<div
				class="absolute inset-0 transition-all duration-300 ease-in-out overflow-hidden"
				class:opacity-100={realmManager.selectedRealm.id === realm.id}
				class:translate-x-0={realmManager.selectedRealm.id === realm.id}
				class:opacity-0={realmManager.selectedRealm.id !== realm.id}
				class:pointer-events-none={realmManager.selectedRealm.id !== realm.id}
				style="transform: translateX({realmManager.selectedRealm.id === realm.id ? '0'
				: i > realmManager.availableRealms.findIndex(r => r.id === realmManager.selectedRealm.id) ? '100%'
				: '-100%'}); {realm.background ? `background-image: ${realm.background};` : ''}"
			>
				<div class="absolute inset-0 overflow-y-auto custom-scrollbar">
					<div class="flex flex-col min-h-full">
						<div class="flex-1">
							<realm.component />
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
