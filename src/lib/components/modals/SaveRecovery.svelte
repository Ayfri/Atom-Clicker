<script lang="ts">
	import Login from '@components/modals/Login.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { saveRecovery } from '$stores/saveRecovery';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { error as errorToast, info, success } from '$stores/toasts';
	import { AlertTriangle, CloudDownload, Database, RefreshCw, Trash2, Trophy, X } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let loading = $state(false);
	let showLoginModal = $state(false);
	let isAlreadyUnlocked = $state(false); // Is achievement unlocked

	const errorMessages: Record<string, string> = {
		corrupted: 'Your save file appears to be corrupted.',
		invalid_json: 'Your save file contains invalid data and cannot be parsed.',
		migration_failed: 'Failed to upgrade your save file to the latest version.',
		unknown: 'An unexpected error occurred while loading your save.',
		validation_failed: 'Your save file is missing required data or contains invalid values.',
	};

	async function handleLoadFromCloud() {
		if (!supabaseAuth.isAuthenticated) {
			showLoginModal = true;
			return;
		}

		loading = true;
		try {
			const loaded = await supabaseAuth.loadGameFromCloud();
			if (loaded) {
				success({ title: 'Recovery Successful', message: 'Your game has been loaded from the cloud save.' });
				saveRecovery.clearError();
				onClose();
			} else {
				errorToast({ title: 'No Cloud Save', message: 'No cloud save was found for your account.' });
			}
		} catch (e) {
			errorToast({ title: 'Error', message: e instanceof Error ? e.message : 'Failed to load from cloud' });
		} finally {
			loading = false;
		}
	}

	function handleStartFresh() {
		// Clean up old backups
		saveRecovery.cleanOldBackups();
		// Reset game state
		gameManager.reset();
		info({
			title: 'New Game',
			message: 'A new game has been started. Your corrupted save has been backed up.',
			duration: 5000,
			icon: RefreshCw
		});
		saveRecovery.clearError();
		onClose();
	}

	function handleDismiss() {
		// User wants to try their luck with the current state
		saveRecovery.clearError();
		onClose();
	}

	// Unlock achievement when modal opens
	$effect(() => {
		if (showLoginModal && !isAlreadyUnlocked) {
			gameManager.unlockAchievement('reset_modal_opener');
			isAlreadyUnlocked = true; // Mark as unlocked to prevent repeated notifications
		}
	});
</script>

<Modal onClose={handleDismiss} title="Save Recovery" width="sm">
	<div class="flex flex-col gap-6">
		<!-- Error Banner -->
		<div class="flex items-start gap-4 rounded-xl bg-red-500/20 p-4 border border-red-500/30">
			<AlertTriangle size={32} class="shrink-0 text-red-400 mt-0.5" />
			<div class="flex-1">
				<h3 class="text-lg font-bold text-red-300">Save Load Error</h3>
				<p class="mt-1 text-red-200/80">
					{errorMessages[$saveRecovery.errorType ?? 'unknown']}
				</p>
			</div>
		</div>

		<!-- Technical Details (collapsible) -->
		{#if $saveRecovery.errorDetails}
			<details class="rounded-lg bg-black/30 border border-white/10">
				<summary class="cursor-pointer px-4 py-3 text-sm text-white/60 hover:text-white/80">
					Technical Details
				</summary>
				<div class="px-4 pb-4">
					<code class="block whitespace-pre-wrap break-all text-xs text-white/50 font-mono bg-black/20 p-2 rounded">
						{$saveRecovery.errorDetails}
					</code>
				</div>
			</details>
		{/if}

		<!-- Backup Info -->
		{#if $saveRecovery.backupKey}
			<div class="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3">
				<Database size={20} class="text-green-400" />
				<div class="flex-1">
					<p class="text-sm text-green-300">A backup of your save has been created.</p>
					<p class="text-xs text-green-400/60 mt-0.5">Key: {$saveRecovery.backupKey}</p>
				</div>
			</div>
		{/if}

		<!-- Recovery Options -->
		<div class="flex flex-col gap-3">
			<h4 class="text-sm font-semibold text-white/80 uppercase tracking-wide">Recovery Options</h4>

			<!-- Load from Cloud (Primary Option) -->
			<button
				class="flex items-center gap-4 rounded-xl bg-accent/20 border border-accent/30 p-4 text-left transition-all hover:bg-accent/30 hover:border-accent/50 disabled:opacity-50"
				disabled={loading}
				onclick={handleLoadFromCloud}
			>
				<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/30">
					<CloudDownload size={24} class="text-accent-300" />
				</div>
				<div class="flex-1">
					<div class="font-semibold text-white">Load from Cloud</div>
					<div class="text-sm text-white/60">
						{#if supabaseAuth.isAuthenticated}
							Restore your progress from your cloud backup.
						{:else}
							Log in to access your cloud saves.
						{/if}
					</div>
				</div>
				{#if loading}
					<RefreshCw size={20} class="animate-spin text-accent-300" />
				{/if}
			</button>

			<!-- Start Fresh -->
			<button
				class="flex items-center gap-4 rounded-xl bg-white/5 border border-white/10 p-4 text-left transition-all hover:bg-white/10 hover:border-white/20"
				onclick={handleStartFresh}
			>
				<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
					<RefreshCw size={24} class="text-white/70" />
				</div>
				<div class="flex-1">
					<div class="font-semibold text-white">Start Fresh</div>
					<div class="text-sm text-white/60">
						Begin a new game. Your old save is backed up.
					</div>
				</div>
			</button>

			<!-- Dismiss (risky) -->
			<button
				class="flex items-center gap-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-left transition-all hover:bg-red-500/20 hover:border-red-500/30"
				onclick={handleDismiss}
			>
				<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/20">
					<Trash2 size={24} class="text-red-400" />
				</div>
				<div class="flex-1">
					<div class="font-semibold text-red-300">Continue Anyway</div>
					<div class="text-sm text-red-200/60">
						Try to play with the current state. Not recommended.
					</div>
				</div>
			</button>
		</div>

		<!-- Warning -->
		<p class="text-center text-xs text-white/40">
			We recommend loading from cloud or starting fresh to avoid further issues.
		</p>
	</div>
</Modal>

{#if showLoginModal}
	<Login onClose={() => {
		showLoginModal = false;
		// Re-check authentication after login
		if (supabaseAuth.isAuthenticated) {
			handleLoadFromCloud();
		}
	}} />
{/if}
