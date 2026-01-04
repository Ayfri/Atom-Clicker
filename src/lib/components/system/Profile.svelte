<script lang="ts">
    import Avatar from '@components/ui/Avatar.svelte';
	import { AUTH_CONNECTIONS, getAuthConnection } from '@components/modals/Login.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { leaderboard } from '$stores/leaderboard.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { Edit2, Image as ImageIcon, LogOut, Save } from 'lucide-svelte';
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let debouncedPictureUrl = $state('');
	let editError = $state<string | null>(null);
	let isEditingPicture = $state(false);
	let isEditingUsername = $state(false);
	let isSaving = $state(false);
	let newPictureUrl = $state('');
	let newUsername = $state('');

	let usernameInput = $state<HTMLInputElement>();
	let pictureInput = $state<HTMLInputElement>();

	$effect(() => {
		const url = newPictureUrl;
		if (!isEditingPicture) {
			if (debounceTimer) clearTimeout(debounceTimer);
			return;
		}

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedPictureUrl = url;
		}, 500);
	});

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});

	let currentUserId = $derived(supabaseAuth.user?.id);
	let stats = $derived(leaderboard.stats);
	let username = $derived(supabaseAuth.profile?.username || supabaseAuth.user?.user_metadata?.full_name || supabaseAuth.user?.user_metadata?.username || supabaseAuth.user?.email?.split('@')[0] || 'Anonymous');
	let userRank = $derived(leaderboard.entries.findIndex(entry => entry.userId === currentUserId) + 1);

	let userPercentile = $derived.by(() => {
		if (userRank <= 0 || stats.totalUsers === 0) return null;
		const percentile = ((stats.totalUsers - userRank) / stats.totalUsers) * 100;
		return Math.round(percentile);
	});

	function setInputWithUndo(input: HTMLInputElement | undefined, value: string, stateSetter: (v: string) => void) {
		if (input) {
			input.focus();
			input.select();
			try {
				document.execCommand('insertText', false, value);
			} catch (e) {
				stateSetter(value);
			}
		} else {
			stateSetter(value);
		}
	}

	function formatStartDate(timestamp: number) {
		return new Intl.DateTimeFormat('en-us', {
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			month: 'long',
			year: 'numeric',
		}).format(timestamp);
	}

	function cancelEditing() {
		editError = null;
		isEditingUsername = false;
		isEditingPicture = false;
		isSaving = false;
		newUsername = '';
		newPictureUrl = '';
		debouncedPictureUrl = '';
		if (debounceTimer) clearTimeout(debounceTimer);
	}

	async function restoreProviderPicture(avatarUrl: string) {
		if (isEditingPicture) {
			setInputWithUndo(pictureInput, avatarUrl, (v) => {
				newPictureUrl = v;
				debouncedPictureUrl = v;
			});
			return;
		}

		if (isSaving || !supabaseAuth.supabase) return;

		isSaving = true;
		editError = null;

		try {
			await supabaseAuth.updateProfile({ picture: avatarUrl });
			isSaving = false;
		} catch (error) {
			editError = 'Failed to update picture. Please try again.';
			isSaving = false;
		}
	}

	async function handleUsernameUpdate(event: SubmitEvent) {
		event.preventDefault();

		if (isSaving || !supabaseAuth.supabase) return;

		const trimmedUsername = newUsername.trim();
		if (!trimmedUsername || trimmedUsername === username) {
			cancelEditing();
			return;
		}

		isSaving = true;
		editError = null;

		try {
			await supabaseAuth.updateProfile({ username: trimmedUsername });
			cancelEditing();
		} catch (error) {
			editError = 'Failed to update username. Please try again.';
			isSaving = false;
		}
	}

	async function handlePictureUpdate(event: SubmitEvent) {
		event.preventDefault();

		if (isSaving || !supabaseAuth.supabase) return;

		const url = newPictureUrl.trim();

		isSaving = true;
		editError = null;

		try {
			await supabaseAuth.updateProfile({ picture: url || null });
			cancelEditing();
		} catch (error) {
			editError = 'Failed to update picture. Please try again.';
			isSaving = false;
		}
	}

	function startEditing() {
		cancelEditing();
		isEditingUsername = true;
		newUsername = username;
	}

	function startEditingPicture() {
		cancelEditing();
		isEditingPicture = true;
		const current = supabaseAuth.profile?.picture || supabaseAuth.user?.user_metadata?.avatar_url || supabaseAuth.user?.user_metadata?.picture || '';
		newPictureUrl = current;
		debouncedPictureUrl = current;
	}
</script>

{#if supabaseAuth.isAuthenticated}
	{@const connectedProvider = supabaseAuth.user?.identities?.find((identity) => AUTH_CONNECTIONS.some((conn) => conn.provider === identity.provider))?.provider}
	{@const authConnection = getAuthConnection(connectedProvider)}
	{@const providerAvatar = supabaseAuth.user?.user_metadata?.avatar_url || supabaseAuth.user?.user_metadata?.picture}
	{@const providerUsername = supabaseAuth.user?.user_metadata?.full_name || supabaseAuth.user?.user_metadata?.username || supabaseAuth.user?.user_metadata?.name}
	{@const currentAvatar = isEditingPicture ? debouncedPictureUrl : supabaseAuth.profile?.picture || providerAvatar}

	<div class="mb-4 rounded-lg bg-black/20 p-4">
		<div class="flex items-center gap-4">
			<div class="group relative">
				<Avatar
					alt={username}
					class="ring-2 ring-accent-400 ring-offset-2 ring-offset-accent-900 size-16 text-2xl!"
					src={currentAvatar}
				/>

				<button
					onclick={startEditingPicture}
					class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-xs ring-2 ring-white/50"
					title="Change profile picture"
				>
					<ImageIcon class="size-6 text-white" />
				</button>

				{#if userRank > 0}
					<div
						class="absolute -bottom-2 -right-2 flex size-7 items-center justify-center rounded-full bg-accent-600 font-bold text-white ring-2 ring-accent-900 z-10 pointer-events-none"
					>
						#{userRank}
					</div>
					{#if userPercentile !== null}
						<div
							class="absolute left-1/2 top-full z-10 mt-2 hidden w-max -translate-x-1/2 rounded-lg bg-black/90 px-3 py-2 text-sm text-white shadow-xl group-hover:block"
						>
							Top {userPercentile}% of all players
						</div>
					{/if}
				{/if}
			</div>
			<div class="flex-1 overflow-hidden">
				<div class="mb-1 flex items-center justify-between gap-2">
					<div class="flex-1 min-w-0">
						{#if isEditingUsername}
							<form onsubmit={handleUsernameUpdate} class="flex items-center gap-2 w-full max-w-sm">
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									bind:this={usernameInput}
									bind:value={newUsername}
									disabled={isSaving}
									class="bg-black/20 rounded-sm px-2 py-1 text-white border border-accent/50 focus:border-accent outline-hidden disabled:opacity-50 disabled:cursor-not-allowed w-full min-w-0"
									placeholder="Enter new username"
									maxlength="30"
									minlength="3"
									autofocus
								/>
								<button
									type="submit"
									disabled={isSaving || !newUsername.trim()}
									class="text-accent hover:text-accent-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
									title="Save username"
								>
									<Save class="size-4" />
								</button>
								<button
									type="button"
									onclick={cancelEditing}
									disabled={isSaving}
									class="text-white/60 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
									title="Cancel"
								>
									Cancel
								</button>
							</form>
						{:else if isEditingPicture}
							<form onsubmit={handlePictureUpdate} class="flex items-center gap-2 w-full max-w-sm">
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="url"
									bind:this={pictureInput}
									bind:value={newPictureUrl}
									disabled={isSaving}
									class="bg-black/20 rounded-sm px-2 py-1 text-white border border-accent/50 focus:border-accent outline-hidden disabled:opacity-50 disabled:cursor-not-allowed w-full min-w-0"
									placeholder="Enter image URL..."
									autofocus
								/>
								<button
									type="submit"
									disabled={isSaving}
									class="text-accent hover:text-accent-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
									title="Save picture"
								>
									<Save class="size-4" />
								</button>
								<button
									type="button"
									onclick={cancelEditing}
									disabled={isSaving}
									class="text-white/60 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
									title="Cancel"
								>
									Cancel
								</button>
							</form>
						{:else}
							<div class="font-bold text-white text-lg capitalize truncate">
								{username}
								<button
									onclick={startEditing}
									class="ml-2 text-accent/60 hover:text-accent inline-flex items-center transition-colors align-middle"
									title="Edit username"
								>
									<Edit2 class="size-4" />
								</button>
							</div>
						{/if}
					</div>

					{#if authConnection}
						{@const canRestorePicture = isEditingPicture && newPictureUrl !== providerAvatar}
						{@const canRestoreUsername = isEditingUsername && providerUsername && newUsername !== providerUsername}
						{@const isEditing = isEditingUsername || isEditingPicture}
						{@const isDifferent = isEditing && (canRestorePicture || canRestoreUsername)}

						<div class="flex items-center justify-center mr-2 size-9 shrink-0">
							{#if isEditing}
								<button
									class="flex focus-visible:ring-2 focus-visible:ring-accent items-center justify-center outline-hidden p-1.5 rounded-lg shrink-0 transition-all
										{isDifferent ? 'active:scale-95 bg-black/20 border border-white/5 hover:bg-black/40 hover:scale-105' : 'border-transparent cursor-default'}"
									disabled={isSaving || !isDifferent}
									onclick={() => {
										if (isEditingUsername && providerUsername) {
											setInputWithUndo(usernameInput, providerUsername, (v) => (newUsername = v));
										} else if (isEditingPicture && providerAvatar) {
											restoreProviderPicture(providerAvatar);
										}
									}}
									title={isEditingUsername
										? `Use ${authConnection.name} username`
										: `Restore ${authConnection.name} profile picture`}
								>
									<img
										alt={authConnection.name}
										class="md:size-5 size-4 {isDifferent ? 'opacity-100' : 'opacity-40'}"
										src={authConnection.icon}
									/>
								</button>
							{:else}
								<div
									class="flex items-center justify-center p-1.5 rounded-lg shrink-0"
									title={`Logged in with ${authConnection.name}`}
								>
									<img
										alt={authConnection.name}
										class="md:size-5 opacity-75 size-4"
										src={authConnection.icon}
									/>
								</div>
							{/if}
						</div>
					{/if}
					<button
						onclick={() => supabaseAuth.signOut()}
						class="flex items-center gap-2 text-sm text-red-500 hover:text-red-400 transition-colors"
						title="Log out"
					>
						<LogOut class="size-5" />
					</button>
				</div>
				{#if editError}
					<div class="text-red-500 text-sm mt-1" transition:fade>
						{editError}
					</div>
				{/if}
				<div class="text-sm text-white/60 mt-1">
					Playing since {formatStartDate(gameManager.startDate)}
				</div>
			</div>
		</div>
	</div>
{/if}
