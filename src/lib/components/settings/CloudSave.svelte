<script lang="ts">
	import HardReset from '@components/modals/HardReset.svelte';
	import Login from '@components/modals/Login.svelte';
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import type { GameState } from '$lib/types';
	import { formatDuration } from '$lib/utils';
	import { autoSave } from '$stores/autoSave.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { toastStore } from '$stores/toasts.svelte';
	import { ArrowDown, ArrowUp, Cloud, HardDrive, RotateCcw, TriangleAlert } from '@lucide/svelte';
	import { onMount, type Component } from 'svelte';

	interface Props {
		onClose?: () => void;
	}

	interface Snapshot {
		amount: (type: CurrencyName) => number;
		date: number | null;
		level: number;
		time: number;
	}

	let { onClose = () => {} }: Props = $props();

	type CloudSaveInfo = {
		lastSaveDate: number | null;
	} & GameState;

	const AHEAD_THRESHOLD_MS = 5_000;
	const SAVE_COOLDOWN = 30_000;

	let cloudSaveInfo = $state<CloudSaveInfo | null>(null);
	let confirmLoad = $state(false);
	let lastManualSaveTime = $state(0);
	let loading = $state(false);
	let now = $state(Date.now());
	let showHardReset = $state(false);
	let showLoginModal = $state(false);

	/** Auto-saves share the manual upload cooldown so the two never hit Supabase back to back. */
	const cooldownProgress = $derived(Math.min(1, (now - Math.max(lastManualSaveTime, autoSave.lastSaveTime)) / SAVE_COOLDOWN));
	const autoSaveProgress = $derived(autoSave.shouldAutoSave && autoSave.lastSaveTime > 0 ? Math.min(1, (now - autoSave.lastSaveTime) / SAVE_COOLDOWN) : 0);

	async function refreshCloudSaveInfo() {
		if (!supabaseAuth.isAuthenticated) return;
		cloudSaveInfo = await supabaseAuth.getCloudSaveInfo();
	}

	const dateFormat = new Intl.DateTimeFormat('en-US', { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });

	onMount(() => {
		refreshCloudSaveInfo();

		const handleBeforeUnload = async () => {
			if (!autoSave.enabled || !supabaseAuth.isAuthenticated) return;
			try {
				await supabaseAuth.saveGameToCloud(gameManager.getCurrentState());
			} catch (e) {
				console.warn('Save on exit failed:', e);
			}
		};

		const clock = setInterval(() => (now = Date.now()), 100);
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			clearInterval(clock);
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	async function handleUpload() {
		loading = true;
		try {
			await supabaseAuth.saveGameToCloud(gameManager.getCurrentState());
			await refreshCloudSaveInfo();
			toastStore.info({ title: 'Success', message: 'Game saved to cloud' });
			lastManualSaveTime = Date.now();
		} catch (e) {
			toastStore.error({ title: 'Error', message: e instanceof Error ? e.message : 'Failed to save game to cloud' });
		} finally {
			loading = false;
		}
	}

	async function handleDownload() {
		if (localAhead && !confirmLoad) {
			confirmLoad = true;
			return;
		}
		confirmLoad = false;
		loading = true;
		try {
			const loadedState = await supabaseAuth.loadGameFromCloud();
			if (!loadedState) throw new Error('No saved game found in cloud');
			gameManager.loadSaveData(loadedState);
			toastStore.info({ title: 'Success', message: 'Game loaded from cloud' });
			onClose();
		} catch (e) {
			toastStore.error({ title: 'Error', message: e instanceof Error ? e.message : 'Failed to load game from cloud' });
		} finally {
			loading = false;
		}
	}

	const local: Snapshot = $derived({
		amount: type => currenciesManager.currencies[type]?.amount ?? 0,
		date: gameManager.lastSave,
		level: gameManager.playerLevel,
		time: gameManager.inGameTime,
	});
	const cloud: Snapshot | null = $derived(
		cloudSaveInfo && {
			amount: type => cloudSaveInfo?.currencies[type]?.amount ?? 0,
			date: cloudSaveInfo.lastSaveDate,
			level: gameManager.getLevelFromTotalXP(cloudSaveInfo.totalXP),
			time: cloudSaveInfo.inGameTime,
		},
	);
	const cloudAhead = $derived(!!cloud && cloud.time > local.time + AHEAD_THRESHOLD_MS);
	const localAhead = $derived(!!cloud && local.time > cloud.time + AHEAD_THRESHOLD_MS);
	const cooldownLeft = $derived(Math.ceil((SAVE_COOLDOWN * (1 - cooldownProgress)) / 1000));
</script>

{#snippet card(title: string, Icon: Component<{ class?: string; size?: number }>, snapshot: Snapshot | null, ahead: boolean)}
	<div class="flex flex-col gap-3 rounded-xl border p-4 {ahead ? 'border-accent/50 bg-accent/10' : 'border-white/10 bg-black/20'}">
		<div class="flex items-center gap-2">
			<Icon class="text-accent" size={18} />
			<span class="font-semibold text-white">{title}</span>
			{#if ahead}
				<span class="ml-auto rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">More progress</span>
			{/if}
		</div>
		{#if snapshot}
			<dl class="grid grid-cols-2 gap-2 text-sm">
				<dt class="text-white/50">Play time</dt>
				<dd class="text-right font-semibold text-white">{formatDuration(snapshot.time)}</dd>
				<dt class="text-white/50">Level</dt>
				<dd class="text-right font-semibold text-white">{snapshot.level}</dd>
				<dt class="text-white/50">Saved</dt>
				<dd class="text-right text-white/80">{snapshot.date ? dateFormat.format(snapshot.date) : 'Never'}</dd>
			</dl>
			<div class="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-sm">
				{#each Object.values(CurrenciesTypes) as type (type)}
					{@const amount = snapshot.amount(type)}
					{#if amount > 0 || type === CurrenciesTypes.ATOMS}
						<Value class="font-semibold text-white" currency={type} currencyClass="size-4" value={amount} />
					{/if}
				{/each}
			</div>
		{:else}
			<p class="text-sm text-white/50">No cloud save yet.</p>
		{/if}
	</div>
{/snippet}

<div class="mx-auto flex max-w-3xl flex-col gap-6">
	{#if supabaseAuth.isAuthenticated}
		<section class="flex flex-col gap-3">
			<div class="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
				{@render card('This device', HardDrive, local, localAhead)}
				<div class="flex items-center justify-center gap-2 md:flex-col">
					<button
						class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:not-disabled:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50 max-md:flex-1 max-md:justify-center"
						disabled={loading || cooldownProgress < 1}
						onclick={handleUpload}
						title="Replace the cloud save with this device's progress"
					>
						<ArrowUp class="md:rotate-90" size={18} />
						{cooldownProgress < 1 ? `Wait ${cooldownLeft}s` : 'Upload'}
					</button>
					<button
						class="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 max-md:flex-1 max-md:justify-center
						{confirmLoad ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white/10 text-white hover:not-disabled:bg-white/15'}"
						disabled={loading || !cloud}
						onblur={() => (confirmLoad = false)}
						onclick={handleDownload}
						title="Replace this device's progress with the cloud save"
					>
						<ArrowDown class="md:rotate-90" size={18} />
						{confirmLoad ? 'Overwrite?' : 'Download'}
					</button>
				</div>
				{@render card('Cloud', Cloud, cloud, cloudAhead)}
			</div>
			{#if confirmLoad}
				<p class="flex items-center gap-2 text-sm text-red-300">
					<TriangleAlert class="shrink-0" size={16} />
					This device has more progress than the cloud, click again to replace it anyway.
				</p>
			{/if}
		</section>

		<label class="relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-4">
			<div class="flex-1">
				<p class="font-semibold text-white">Auto-save to cloud</p>
				<p class="text-sm text-white/60">Uploads your progress every 30 seconds while you play.</p>
			</div>
			<input bind:checked={autoSave.enabled} class="peer sr-only" type="checkbox" />
			<span class="relative h-7 w-12 shrink-0 rounded-full bg-white/15 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent-300 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"></span>
			{#if autoSave.shouldAutoSave}
				<span class="absolute bottom-0 left-0 h-0.5 bg-accent-500 transition-[width] duration-100 ease-linear" style:width="{autoSaveProgress * 100}%"></span>
			{/if}
		</label>
	{:else}
		<div class="grid gap-3 md:grid-cols-2">
			{@render card('This device', HardDrive, local, false)}
			<div class="flex flex-col items-start justify-center gap-3 rounded-xl border border-dashed border-white/20 p-4">
				<div class="flex items-center gap-2 font-semibold text-white">
					<Cloud class="text-accent" size={18} />
					Cloud save
				</div>
				<p class="text-sm text-white/60">Your progress only lives in this browser. Sign in to back it up and play on any device.</p>
				<button class="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600" onclick={() => (showLoginModal = true)}>
					Sign in
				</button>
			</div>
		</div>
	{/if}

	<section class="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-4 sm:flex-row sm:items-center">
		<div class="flex-1">
			<p class="font-semibold text-red-200">Hard reset</p>
			<p class="text-sm text-white/60">Wipes all progress on this device and starts over from scratch.</p>
		</div>
		<button
			class="flex items-center justify-center gap-2 rounded-lg bg-red-900/50 px-5 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-900/70"
			onclick={() => (showHardReset = true)}
		>
			<RotateCcw size={18} />
			Reset
		</button>
	</section>
</div>

{#if showLoginModal}
	<Login onClose={() => (showLoginModal = false)} />
{/if}

{#if showHardReset}
	<HardReset onClose={() => (showHardReset = false)} />
{/if}
