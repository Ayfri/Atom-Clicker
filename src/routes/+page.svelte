<script lang="ts">
	import { autoBuyManager } from '$stores/autoBuy.svelte';
	import { autoUpgradeManager } from '$stores/autoUpgrade.svelte';
	import {onDestroy, onMount} from 'svelte';
	import AutoSaveIndicator from '@components/system/AutoSaveIndicator.svelte';
	import Levels from '@components/game/Levels.svelte';
	import NavBar from '@components/layout/NavBar.svelte';
	import RealmFooter from '@components/layout/RealmFooter.svelte';
	import RemoteBanner from '@components/layout/RemoteBanner.svelte';
	import SaveRecovery from '@components/modals/SaveRecovery.svelte';
	import Toaster from '@components/layout/Toaster.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import {gameManager} from '$helpers/GameManager.svelte';
	import {realmManager} from '$helpers/RealmManager.svelte';
	import {setGlobals} from '$lib/globals';
	import {formatNumber} from '$lib/utils';
	import {remoteMessage} from '$stores/remoteMessage.svelte';
	import {app} from '$stores/pixi';
	import {saveRecovery} from '$stores/saveRecovery';
	import {supabaseAuth} from '$stores/supabaseAuth.svelte';
	import {mobile} from '$stores/window.svelte';

	autoBuyManager.init();
	autoUpgradeManager.init();

	const SAVE_INTERVAL = 1000;
	let saveLoop: ReturnType<typeof setInterval>;
	let gameUpdateInterval: ReturnType<typeof setInterval> | null = null;

	function update(ticker: any) {
		gameManager.addAtoms((gameManager.atomsPerSecond * ticker.deltaMS) / 1000);
	}

	onMount(async () => {
		gameManager.initialize();
		await supabaseAuth.init();

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
		gameManager.cleanup();
	});
</script>

<div class="flex flex-col min-h-screen">
	<RemoteBanner/>
	<NavBar/>
	<Toaster/>
	<AutoSaveIndicator/>

	{#if realmManager.availableRealms.length > 1}
		<div
			class="fixed right-4 z-30 bg-black/10 backdrop-blur-xs border border-white/10 rounded-lg p-1 transition-all duration-300"
			style="top: {remoteMessage.message && remoteMessage.isVisible ? 'calc(1.5rem + 5rem)' : '5rem'}"
		>
			<div class="flex flex-col gap-1">
				{#each realmManager.availableRealms as realm (realm.id)}
					<button
						class="flex items-center gap-2 px-2 py-1.5 rounded-sm transition-all duration-200 hover:scale-105 {realmManager.selectedRealmId === realm.id ? 'bg-accent-500/60 border-accent-400/50' : 'bg-white/5 hover:bg-white/10'}"
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
		class="relative flex-1 {mobile.current ? 'overflow-y-auto' : 'overflow-hidden'} lg:pb-4 transition-all duration-300"
		style="padding-top: {remoteMessage.message && remoteMessage.isVisible ? 'calc(3rem + 1.5rem)' : '3rem'}; padding-bottom: 3rem;"
	>
		{#if gameManager.upgrades.includes('feature_levels')}
			<Levels/>
		{/if}

		<!-- Use transform and opacity for virtual desktop swipe effect -->
		{#each realmManager.availableRealms as realm, i (realm.id)}
			<div
				class="absolute inset-0 overflow-y-auto transition-all duration-300 ease-in-out"
				class:opacity-100={realmManager.selectedRealm.id === realm.id}
				class:translate-x-0={realmManager.selectedRealm.id === realm.id}
				class:opacity-0={realmManager.selectedRealm.id !== realm.id}
				class:pointer-events-none={realmManager.selectedRealm.id !== realm.id}
				style="transform: translateX({realmManager.selectedRealm.id === realm.id ? '0' : (i > realmManager.availableRealms.findIndex(r => r.id === realmManager.selectedRealm.id) ? '100%' : '-100%')});"
			>
				<div class="relative min-h-full">
					<realm.component />
					<!-- Footer at the end of each realm for scrolling -->
					<div class="absolute bottom-0 left-0 right-0 pointer-events-auto">
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
