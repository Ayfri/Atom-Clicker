<script lang="ts">
	import HardReset from '@components/modals/HardReset.svelte';
	import Login from '@components/modals/Login.svelte';
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { gameManager } from '$helpers/GameManager.svelte';
	import type { GameState } from '$lib/types';
	import { formatDuration } from '$lib/utils';
	import { autoSave } from '$stores/autoSave.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { error as errorToast, info } from '$stores/toasts';
	import { AlertCircle, AlertTriangle, Clock, CloudDownload, CloudUpload, RotateCcw } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		onClose?: () => void;
	}

	let { onClose = () => {} }: Props = $props();

	type CloudSaveInfo = {
		lastSaveDate: number | null;
	} & GameState;

	const CLOUD_NEWER_WARNING_THRESHOLD_MS = 5_000;
	const SAVE_COOLDOWN = 30_000;

	let autoSaveProgress = $state(0);
	let cloudSaveInfo = $state<CloudSaveInfo | null>(null);
	let cooldownProgress = $state(0);
	let error: string | null = $state(null);
	let lastAutoSaveTime = $state(0);
	let lastManualSaveTime = $state(0);
	let loading = $state(false);
	let progressInterval: ReturnType<typeof setInterval> | null = null;
	let showHardReset = $state(false);
	let showLoginModal = $state(false);

	function updateProgress() {
		const now = Date.now();
		cooldownProgress = Math.min(1, (now - lastManualSaveTime) / SAVE_COOLDOWN);

		if (autoSave.shouldAutoSave && lastAutoSaveTime > 0) {
			autoSaveProgress = Math.min(1, (now - lastAutoSaveTime) / SAVE_COOLDOWN);
		} else {
			autoSaveProgress = 0;
		}
	}

	function startProgressTimer() {
		if (progressInterval) clearInterval(progressInterval);
		updateProgress();
		progressInterval = setInterval(updateProgress, 100);
	}

	function stopProgressTimer() {
		if (progressInterval) {
			clearInterval(progressInterval);
			progressInterval = null;
		}
		autoSaveProgress = 0;
	}

	function startCooldown() {
		lastManualSaveTime = Date.now();
		cooldownProgress = 0;
		startProgressTimer();
	}

	// Sync local state with store state
	$effect(() => {
		if (autoSave.lastSaveTime > 0) lastAutoSaveTime = autoSave.lastSaveTime;
	});

	// Trigger cooldown when auto-save starts
	$effect(() => {
		if (autoSave.isSaving && cooldownProgress >= 1) startCooldown();
	});

	// React to shouldAutoSave changes
	$effect(() => {
		autoSave.shouldAutoSave ? startProgressTimer() : stopProgressTimer();
	});

	async function refreshCloudSaveInfo() {
		if (!supabaseAuth.isAuthenticated) return;
		cloudSaveInfo = await supabaseAuth.getCloudSaveInfo();
	}

	function formatDate(timestamp: number) {
		return new Intl.DateTimeFormat('en-US', {
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			month: 'short',
			year: 'numeric',
		}).format(new Date(timestamp));
	}

	onMount(() => {
		refreshCloudSaveInfo();

		const now = Date.now();
		if (lastManualSaveTime && now - lastManualSaveTime < SAVE_COOLDOWN) {
			cooldownProgress = (now - lastManualSaveTime) / SAVE_COOLDOWN;
		} else {
			cooldownProgress = 1;
		}

		if (autoSave.shouldAutoSave) startProgressTimer();

		const handleBeforeUnload = async () => {
			if (autoSave.enabled && supabaseAuth.isAuthenticated) {
				try {
					await supabaseAuth.saveGameToCloud(gameManager.getCurrentState());
				} catch (e) {
					console.warn('Save on exit failed:', e);
				}
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			stopProgressTimer();
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	async function handleSaveToCloud() {
		if (!supabaseAuth.isAuthenticated) {
			error = 'Please log in to use cloud saves';
			return;
		}

		if (cooldownProgress < 1) {
			const remainingTime = Math.ceil((SAVE_COOLDOWN * (1 - cooldownProgress)) / 1000);
			info({ title: 'Wait', message: `Please wait ${remainingTime} seconds before saving again` });
			return;
		}

		loading = true;
		error = null;

		try {
			await supabaseAuth.saveGameToCloud(gameManager.getCurrentState());
			await refreshCloudSaveInfo();
			info({ title: 'Success', message: 'Game saved to cloud' });
			startCooldown();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save game to cloud';
			errorToast({ title: 'Error', message: error });
		} finally {
			loading = false;
		}
	}

	async function handleLoadFromCloud() {
		if (!supabaseAuth.isAuthenticated) {
			error = 'Please log in to use cloud saves';
			return;
		}

		loading = true;
		error = null;

		try {
			const loadedState = await supabaseAuth.loadGameFromCloud();
			if (loadedState) {
				gameManager.loadSaveData(loadedState);
				info({ title: 'Success', message: 'Game loaded from cloud' });
				onClose();
			} else {
				error = 'No saved game found in cloud';
				errorToast({ title: 'Error', message: error });
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load game from cloud';
			errorToast({ title: 'Error', message: error });
		} finally {
			loading = false;
		}
	}

	let canSave = $derived(cooldownProgress >= 1 && !loading);
	let isCloudNewerThanLocal = $derived(
		typeof cloudSaveInfo?.inGameTime === 'number' &&
			cloudSaveInfo.inGameTime > gameManager.inGameTime + CLOUD_NEWER_WARNING_THRESHOLD_MS,
	);
</script>

<div class="flex flex-col gap-6 max-w-2xl mx-auto">
	{#if !supabaseAuth.isAuthenticated}
		<div class="flex flex-col gap-4 text-center">
			<h3 class="text-lg font-bold text-accent">Login Required</h3>
			<p class="text-white/60">Please log in to use cloud saves.</p>
			<button
				onclick={() => (showLoginModal = true)}
				class="mx-auto rounded-lg bg-accent px-6 py-2 font-semibold text-white transition-colors hover:bg-accent-600"
			>
				Login
			</button>
		</div>
	{:else}
		{#if error}
			<div class="rounded-lg bg-red-500/20 p-4 text-red-200">
				{error}
			</div>
		{/if}

		{#if cloudSaveInfo}
			{#if isCloudNewerThanLocal}
				<div class="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-100 mb-4">
					<div class="flex items-start gap-2">
						<AlertTriangle
							size={16}
							class="mt-0.5 shrink-0 text-yellow-300"
						/>
						<div class="flex-1 text-sm">
							<div class="font-semibold">Cloud save has more play time than your local save.</div>
							<div class="text-yellow-200/80">
								Local: {formatDuration(gameManager.inGameTime)} · Cloud: {formatDuration(cloudSaveInfo.inGameTime)}
							</div>
						</div>
					</div>
				</div>
			{/if}
			<div class="rounded-lg bg-black/20 p-4">
				<div class="flex items-center gap-2 text-accent mb-2">
					<Clock size={16} />
					<span class="text-sm">Last saved: {cloudSaveInfo.lastSaveDate ? formatDate(cloudSaveInfo.lastSaveDate) : 'Never'}</span>
				</div>
				<div class="flex flex-wrap gap-3 text-sm">
					<div class="flex items-center gap-2">
						<span class="text-white/60">Level</span>
						<span class="text-white font-semibold">{gameManager.getLevelFromTotalXP(cloudSaveInfo.totalXP)}</span>
					</div>
					{#each Object.values(CurrenciesTypes) as currencyType}
						{@const amount = cloudSaveInfo.currencies[currencyType]?.amount ?? 0}
						{#if amount > 0 || currencyType === CurrenciesTypes.ATOMS}
							<div class="flex items-center gap-2">
								<Value
									value={amount}
									currency={currencyType}
									currencyClass="size-4"
									class="text-white font-semibold"
								/>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Auto-save toggle -->
		<div class="relative rounded-lg bg-black/20 overflow-hidden">
			<div class="p-4 pb-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Clock
							size={16}
							class="text-accent"
						/>
						<div>
							<div class="text-sm font-semibold text-white">Auto-save</div>
							<div class="text-xs text-white/60">Save automatically every 30 seconds</div>
						</div>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							bind:checked={autoSave.enabled}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"
						></div>
					</label>
				</div>
			</div>
			{#if autoSave.shouldAutoSave}
				<div
					class="h-0.5 bg-accent-500 transition-all duration-100 ease-linear"
					style:width="{autoSaveProgress * 100}%"
				></div>
			{/if}
		</div>

		<div class="flex flex-col gap-4">
			<div class="relative">
				<button
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-all duration-300 hover:not-disabled:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleSaveToCloud}
					disabled={!canSave}
					style:transform="scale({0.9 + cooldownProgress * 0.1})"
				>
					<CloudUpload size={20} />
					Save to Cloud
				</button>
				<div
					class="absolute inset-0 rounded-lg bg-black/20 transition-transform origin-left"
					style:transform="scaleX({1 - cooldownProgress})"
				></div>
			</div>

			<button
				class="flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={handleLoadFromCloud}
				disabled={loading}
			>
				<CloudDownload size={20} />
				Load from Cloud
			</button>
		</div>
	{/if}

	<div class="h-px bg-white/10 my-2"></div>

	<button
		class="flex items-center justify-center gap-2 rounded-lg bg-red-900/40 px-6 py-3 font-semibold text-red-200 transition-colors hover:bg-red-900/60"
		onclick={() => (showHardReset = true)}
	>
		<RotateCcw size={20} />
		Hard Reset
	</button>

	<div class="rounded-lg bg-black/20 p-4 text-sm text-white/80">
		<div class="flex items-start gap-2">
			<AlertCircle
				size={16}
				class="mt-0.5 shrink-0 text-accent"
			/>
			<p>
				Cloud saves allow you to backup your game progress and sync it across devices. Your local save will be overwritten when
				loading from the cloud.
			</p>
		</div>
	</div>
</div>

{#if showLoginModal}
	<Login onClose={() => (showLoginModal = false)} />
{/if}

{#if showHardReset}
	<HardReset onClose={() => (showHardReset = false)} />
{/if}
