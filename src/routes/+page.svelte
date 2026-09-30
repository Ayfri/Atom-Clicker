<script lang="ts">
	import { COLLIDER_REFRESH_MS } from '$data/collider';
	import { FeatureTypes } from '$data/features';
	import { getQuarkShopItem } from '$data/quarkShop';
	import type { RealmConfig } from '$helpers/RealmManager.svelte';
	import { colliderManager } from '$helpers/ColliderManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { reveal, reveals } from '$helpers/reveals.svelte';
	import { setGlobals } from '$lib/globals';
	import { formatNumber } from '$lib/utils';
	import { isLocalStorageUnavailable } from '$lib/utils/safeLocalStorage';
	import { autoBuyManager } from '$stores/autoBuy.svelte';
	import { autoUpgradeManager } from '$stores/autoUpgrade.svelte';
	import { saveRecovery } from '$stores/saveRecovery.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { toastStore } from '$stores/toasts.svelte';
	import { ui } from '$stores/ui.svelte';
	import { mobile } from '$stores/window.svelte';
	import Canvas from '@components/game/Canvas.svelte';
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
	import { onDestroy, onMount, untrack, type Component } from 'svelte';

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

	const WARP_STREAKS = [
		{ delay: 0, top: 14, width: 28 },
		{ delay: 60, top: 27, width: 18 },
		{ delay: 20, top: 39, width: 36 },
		{ delay: 110, top: 48, width: 22 },
		{ delay: 40, top: 57, width: 40 },
		{ delay: 140, top: 68, width: 16 },
		{ delay: 80, top: 79, width: 30 },
		{ delay: 30, top: 90, width: 24 },
	] as const;

	const selectedIndex = $derived(realmManager.availableRealms.findIndex(r => r.id === realmManager.selectedRealmId));

	/** One-shot overlay of a player-triggered switch, a new `id` remounts it so back-to-back switches restart it. */
	let warp = $state<{ color: string; direction: 1 | -1; id: number } | null>(null);

	/** Switches spammed mid-swing restart the transitions from wherever they are and pile up warps. */
	const SWITCH_COOLDOWN_MS = 500;
	let lastSwitchTime = -SWITCH_COOLDOWN_MS;

	function switchRealm(realm: RealmConfig, index: number) {
		const now = performance.now();
		if (index === selectedIndex || now - lastSwitchTime < SWITCH_COOLDOWN_MS) return;
		lastSwitchTime = now;
		warp = { color: realm.color, direction: index > selectedIndex ? 1 : -1, id: (warp?.id ?? 0) + 1 };
		realmManager.selectRealm(realm.id);
	}

	function endWarp(event: AnimationEvent) {
		if (event.target === event.currentTarget) warp = null;
	}

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
	let saveLoop: ReturnType<typeof setInterval>;
	let commitLoop: ReturnType<typeof setInterval>;
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
		gameManager.cleanup();
	});
</script>

<div class="flex flex-col min-h-screen">
	<RemoteBanner />
	<NavBar />
	<Toaster />
	<AutoSaveIndicator />
	<Canvas />

	{#if realmManager.availableRealms.length > 1}
		<!-- The panel itself is click-through, so its padding never swallows taps meant for the realm underneath. On a
		     portrait phone it sits below the realm headers, which span most of the width. -->
		<div
			class="fixed right-4 top-[calc(var(--banner-height)+5rem)] max-lg:top-[calc(var(--banner-height)+14rem)] max-lg:landscape:top-[calc(var(--banner-height)+3.75rem)] z-30 bg-black/10 backdrop-blur-xs border border-white/10 rounded-lg p-1 transition-all duration-300 pointer-events-none"
			in:reveal
		>
			<div class="flex flex-col gap-1">
				{#each realmManager.availableRealms as realm, i (realm.id)}
					<button
						class="flex items-center gap-2 px-2 py-1.5 rounded-sm transition-all duration-200 hover:scale-105 pointer-events-auto {(
							realmManager.selectedRealmId === realm.id
						) ?
							'bg-accent-500/60 border-accent-400/50'
						:	'bg-white/5 hover:bg-white/10'}"
						id="realm-{realm.id}"
						in:reveal
						onclick={() => switchRealm(realm, i)}
						title="{realm.title} - {formatNumber(realmManager.realmValues[realm.id] ?? 0)} {realm.currency.name.toLowerCase()}"
					>
						<Currency name={realm.currency.name} />
						<div class="text-xs text-white/80">{formatNumber(realmManager.realmValues[realm.id] ?? 0, 1)}</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if warp}
		{#key warp.id}
			<div
				aria-hidden="true"
				class="realm-warp"
				onanimationend={endWarp}
				style="--warp-color: {warp.color}; --warp-dir: {warp.direction};"
			>
				<div class="realm-warp-sweep"></div>
				{#each WARP_STREAKS as streak, i (i)}
					<div
						class="realm-warp-streak"
						style="animation-delay: {streak.delay}ms; top: {streak.top}%; width: {streak.width}vw;"
					></div>
				{/each}
			</div>
		{/key}
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

		<!-- Realms sit side by side and swing in like the faces of a cube, the leaving one first, the arriving one after
		     a short delay adding up to REALM_SWITCH_MS. Layout containment makes the panel the containing block of its fixed
		     children, even with reduced motion where it has no transform. -->
		{#each realmManager.availableRealms as realm, i (realm.id)}
			{@const RealmComponent = realmComponents[realm.componentId]}
			{@const background = getRealmBackground(realm)}
			{@const side = Math.sign(i - selectedIndex)}

			<!-- Off-screen realms stay mounted for their timers, `content-visibility` skips their style, layout, paint and CSS
			     animations. `transition-discrete` holds it visible until the swing out ends. Below opacity 1 the panel is
			     the backdrop root of its `backdrop-blur` children, so its opaque `bg-page` keeps them from lightening mid-fade. -->
			<div
				class="absolute inset-x-0 bottom-0 overflow-hidden bg-page contain-layout transition-[content-visibility,opacity,transform] transition-discrete motion-reduce:transform-none! {(
					side
				) ?
					'[content-visibility:hidden] duration-500 ease-[cubic-bezier(0.55,0,1,0.45)] opacity-0 pointer-events-none'
				:	'z-1 delay-100 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] opacity-100'}"
				style="top: {mobile.current ? 'calc(3rem + var(--banner-height))' : '0'}; bottom: var(--mobile-nav-height, 0px); transform: {side ?
					`translateX(${side * 70}%) perspective(1200px) rotateY(${side * 35}deg) scale(0.8)`
				:	'translateX(0)'}; {background ? `background-image: ${background};` : ''}"
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

		{#if saveRecovery.hasError}
			<SaveRecovery onClose={() => saveRecovery.clearError()} />
		{/if}
	</main>
</div>

<style>
	/* Only opacity and transform animate, so the whole overlay stays on the compositor even on small phones. */
	.realm-warp {
		animation: warp-flash 750ms ease-out both;
		background: radial-gradient(
			ellipse 70% 90% at calc(50% + var(--warp-dir) * 50%) 50%,
			color-mix(in srgb, var(--warp-color), transparent 65%),
			transparent 70%
		);
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		position: fixed;
		z-index: 20;
	}

	.realm-warp-sweep {
		animation: warp-sweep 650ms cubic-bezier(0.65, 0, 0.35, 1) both;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--warp-color), transparent 75%) 35%,
			color-mix(in srgb, var(--warp-color), white 45%) 50%,
			color-mix(in srgb, var(--warp-color), transparent 75%) 65%,
			transparent
		);
		inset-block: -10%;
		left: 32.5vw;
		position: absolute;
		width: 35vw;
	}

	.realm-warp-streak {
		animation: warp-streak 450ms cubic-bezier(0.5, 0, 0.75, 0) both;
		background: linear-gradient(90deg, transparent, var(--warp-color), transparent);
		border-radius: 9999px;
		height: 2px;
		left: 0;
		position: absolute;
	}

	@keyframes warp-flash {
		0% {
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	@keyframes warp-sweep {
		0% {
			opacity: 0;
			transform: translateX(calc(var(--warp-dir) * 90vw)) skewX(-14deg);
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateX(calc(var(--warp-dir) * -90vw)) skewX(-14deg);
		}
	}

	@keyframes warp-streak {
		0% {
			opacity: 0;
			transform: translateX(calc(var(--warp-dir) * 110vw));
		}
		30% {
			opacity: 0.8;
		}
		100% {
			opacity: 0;
			transform: translateX(calc(var(--warp-dir) * -110vw));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.realm-warp {
			display: none;
		}
	}
</style>
