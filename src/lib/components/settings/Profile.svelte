<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { leaderboard } from '$stores/leaderboard.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { ui } from '$stores/ui.svelte';
	import { formatDuration, formatNumber } from '$lib/utils';
	import Login, { AUTH_CONNECTIONS, getAuthConnection } from '@components/modals/Login.svelte';
	import Avatar from '@components/ui/Avatar.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import Value from '@components/ui/Value.svelte';
	import {
		Activity,
		Building2,
		Calendar,
		CircleUser,
		Clock,
		ExternalLink,
		Flame,
		Link as LinkIcon,
		LogOut,
		Mail,
		MousePointerClick,
		Package,
		Save,
		Settings2,
		Shield,
		Sparkles,
		Star,
		TrendingUp,
		Trophy,
		User,
		X,
		Zap,
	} from 'lucide-svelte';
	import { onDestroy } from 'svelte';
	import { fade, scale, slide } from 'svelte/transition';

	interface Props {
		small?: boolean;
	}

	let { small = false }: Props = $props();

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let debouncedPictureUrl = $state('');
	let editError = $state<string | null>(null);
	let isEditMode = $state(false);
	let isSaving = $state(false);
	let newPictureUrl = $state('');
	let newUsername = $state('');
	let showLoginModal = $state(false);

	let pictureInput = $state<HTMLInputElement>();
	let usernameInput = $state<HTMLInputElement>();

	$effect(() => {
		const url = newPictureUrl;
		if (!isEditMode) {
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
	let username = $derived(
		supabaseAuth.profile?.username ||
			supabaseAuth.user?.user_metadata?.full_name ||
			supabaseAuth.user?.user_metadata?.username ||
			supabaseAuth.user?.email?.split('@')[0] ||
			'Anonymous'
	);
	let userRank = $derived(leaderboard.entries.findIndex((entry) => entry.userId === currentUserId) + 1);

	let userPercentile = $derived.by(() => {
		if (userRank <= 0 || stats.totalUsers === 0) return null;
		const percentile = ((stats.totalUsers - userRank) / stats.totalUsers) * 100;
		return Math.round(percentile);
	});

	let totalBuildings = $derived(Object.values(gameManager.buildings).reduce((acc, b) => acc + (b?.count || 0), 0));

	function cancelEditing() {
		debouncedPictureUrl = '';
		editError = null;
		isEditMode = false;
		isSaving = false;
		newPictureUrl = '';
		newUsername = '';
		if (debounceTimer) clearTimeout(debounceTimer);
	}

	function formatStartDate(timestamp: number) {
		return new Intl.DateTimeFormat('en-US', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(timestamp);
	}

	async function handleSaveProfile(event: SubmitEvent) {
		event.preventDefault();
		if (isSaving || !supabaseAuth.supabase) return;

		const trimmedUsername = newUsername.trim();
		const trimmedPicture = newPictureUrl.trim();

		if (!trimmedUsername) {
			editError = 'Username cannot be empty.';
			return;
		}

		isSaving = true;
		editError = null;

		try {
			const updates: { username?: string; picture?: string | null } = {};
			if (trimmedUsername !== username) updates.username = trimmedUsername;
			if (trimmedPicture !== (supabaseAuth.profile?.picture || '')) updates.picture = trimmedPicture || null;

			if (Object.keys(updates).length > 0) {
				await supabaseAuth.updateProfile(updates);
			}
			cancelEditing();
		} catch (error: any) {
			editError = error.message || 'Failed to update profile. Please try again.';
			isSaving = false;
		}
	}

	function restoreProviderData() {
		const metadata = supabaseAuth.user?.user_metadata;
		if (!metadata) return;

		newUsername = metadata.full_name || metadata.username || metadata.name || username;
		newPictureUrl = metadata.avatar_url || metadata.picture || '';
		debouncedPictureUrl = newPictureUrl;
	}

	function startEditing() {
		isEditMode = true;
		newUsername = username;
		newPictureUrl =
			supabaseAuth.profile?.picture ||
			supabaseAuth.user?.user_metadata?.avatar_url ||
			supabaseAuth.user?.user_metadata?.picture ||
			'';
		debouncedPictureUrl = newPictureUrl;
	}

	function toggleEditMode() {
		if (isEditMode) {
			cancelEditing();
		} else {
			startEditing();
		}
	}
</script>

<div class="custom-scrollbar h-full overflow-y-auto pr-1">
	{#if small}
		{#if supabaseAuth.isAuthenticated}
			{@const providerAvatar = supabaseAuth.user?.user_metadata?.avatar_url || supabaseAuth.user?.user_metadata?.picture}
			{@const currentAvatar = supabaseAuth.profile?.picture || providerAvatar}

			<div class="relative rounded-xl bg-black/20 px-4 pb-2 pt-3" in:fade>
				<button
					class="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-lg border border-accent-400/20 bg-accent-400/10 px-2.5 py-1.5 text-accent-400 shadow-sm transition-all active:scale-95 hover:bg-accent-400/20"
					onclick={() => ui.openSettings('profile')}
					title="View Full Profile"
				>
					<ExternalLink size={14} />
					<span class="text-[10px] font-bold uppercase">View Profile</span>
				</button>

				<div class="flex items-center gap-5">
					<div class="flex shrink-0 flex-col items-center gap-1">
						<div class="group relative">
							<Avatar
								alt={username}
								class="size-14 text-xl transition-all shadow-xl ring-2 ring-accent-500 ring-offset-2 ring-offset-black md:size-16"
								src={currentAvatar}
							/>
							{#if userRank > 0}
								<div
									class="pointer-events-none absolute -bottom-1 -right-1 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-600 px-1.5 font-bold text-white shadow-lg ring-2 ring-black"
								>
									<span class="text-[10px]">#{userRank}</span>
								</div>
							{/if}
						</div>
						<div class="flex flex-col items-center gap-0">
							<h2 class="max-w-[100px] text-center font-bold leading-tight text-white wrap-break-word md:max-w-[140px] text-sm md:text-base">
								{username}
							</h2>
						</div>
					</div>

					<div class="flex-1 min-w-0 w-full flex flex-col items-start">
						<div class="mt-0 flex w-full flex-col gap-2.5">
							<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
								<div class="flex items-center gap-1.5">
									<span class="text-[11px] text-white/40">Level</span>
									<span class="text-sm font-bold text-white">{formatNumber(gameManager.playerLevel)}</span>
								</div>
								<Value
									class="text-[13px] font-bold text-accent-400"
									currency="Atoms"
									value={gameManager.atoms}
								/>
							</div>

							<div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2">
								<div class="flex items-center gap-1.5 text-white/50">
									<Calendar class="text-white/20" size={14} />
									<span class="text-[10px] font-semibold text-white/70">
										{formatStartDate(gameManager.startDate)}
									</span>
								</div>
								{#if userPercentile !== null}
									<div class="flex items-center gap-1.5 text-white/70">
										<Trophy class="text-accent-400/30" size={14} />
										<span class="text-[10px] font-bold opacity-90">Top {userPercentile}%</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div
				class="flex h-auto flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-center"
				in:fade
			>
				<Avatar
					alt="Guest"
					class="size-12 text-lg ring-offset-black ring-offset-2 ring-2 ring-white/10"
					src=""
				/>
				<div class="flex flex-col gap-0.5">
					<h3 class="text-base font-bold text-white">Guest Player</h3>
					<p class="text-xs text-white/60">
						Login to sync your progress.
					</p>
				</div>
				<button
					class="rounded-lg bg-accent-600 px-5 py-1.5 text-xs font-bold text-white transition-all hover:bg-accent-500 active:scale-95"
					onclick={() => {
						showLoginModal = true;
					}}
				>
					Login or Sign Up
				</button>
			</div>
			{#if showLoginModal}
				<Login onClose={() => (showLoginModal = false)} />
			{/if}
		{/if}
	{:else}
		{#if supabaseAuth.isAuthenticated}
			{@const connectedProvider = supabaseAuth.user?.identities?.find((identity) => AUTH_CONNECTIONS.some((conn) => conn.provider === identity.provider))?.provider}
			{@const authConnection = getAuthConnection(connectedProvider)}
			{@const providerAvatar = supabaseAuth.user?.user_metadata?.avatar_url || supabaseAuth.user?.user_metadata?.picture}
			{@const currentAvatar = isEditMode ? debouncedPictureUrl : supabaseAuth.profile?.picture || providerAvatar}

			<div class="flex flex-col gap-4" in:fade>
				<!-- Profile Info Panel -->
				<div class="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 p-5 shadow-lg backdrop-blur-md">
					<!-- Blurry color dots -->
					<div class="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-accent-600/5 blur-3xl"></div>
					<div class="pointer-events-none absolute -left-10 -bottom-10 size-40 rounded-full bg-primary-600/5 blur-3xl"></div>

					<div class="relative flex flex-col gap-8 md:flex-row md:items-center">
						<!-- Avatar Section -->
						<div class="relative flex justify-center shrink-0">
							<div class="absolute -inset-1 rounded-full bg-linear-to-tr from-accent-600 to-primary-600 opacity-10 blur-lg"></div>
							<Avatar
								alt={username}
								class="size-20 text-2xl shadow-xl ring-2 ring-white/10 ring-offset-2 ring-offset-black md:size-24"
								src={currentAvatar}
							/>
							{#if userRank > 0}
								<div class="absolute -bottom-1 -right-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-accent-600 px-1.5 font-bold text-white shadow-lg ring-2 ring-black" in:scale>
									<span class="text-[12px]">#{userRank}</span>
								</div>
							{/if}
						</div>

						<!-- Details -->
						<div class="flex flex-1 flex-col items-center gap-1.5 md:items-start md:text-left">
							<h1 class="text-xl font-bold tracking-tight text-white drop-shadow-sm md:text-2xl">
								{username}
							</h1>

							<div class="flex items-center gap-2 text-white/40">
								<Clock class="text-white/20" size={13} />
								<span class="text-[12px] font-medium">Joined {formatStartDate(gameManager.startDate)}</span>
							</div>

							<div class="mt-4 flex flex-wrap justify-center gap-2.5 md:justify-start">
								<button
									class="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-white transition-all active:scale-95 hover:bg-white/10"
									onclick={toggleEditMode}
								>
									{#if isEditMode}
										<X size={14} />
										Cancel
									{:else}
										<Settings2 size={14} />
										Edit Profile
									{/if}
								</button>
								<button
									class="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-1.5 text-[11px] font-semibold text-red-400 transition-all active:scale-95 hover:bg-red-500/20"
									onclick={() => supabaseAuth.signOut()}
								>
									<LogOut size={14} />
									Sign Out
								</button>
							</div>
						</div>

						<!-- Desktop Hub Overview -->
						<div class="hidden border-l border-white/10 pl-6 lg:grid grid-cols-2 gap-x-10 gap-y-4">
							<div class="flex flex-col gap-0.5">
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Level</span>
								<span class="text-xl font-bold text-white">{formatNumber(gameManager.playerLevel)}</span>
							</div>
							<div class="flex flex-col gap-0.5">
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Atoms</span>
								<Value value={gameManager.atoms} currency="Atoms" class="text-xl font-bold text-accent-400" />
							</div>
							<div class="flex flex-col gap-0.5">
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Achievements</span>
								<span class="text-xl font-bold text-white">{formatNumber(gameManager.achievements.length)}</span>
							</div>
							<div class="flex flex-col gap-0.5">
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Rank</span>
								<span class="text-xl font-bold text-primary-400">Top {userPercentile}%</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Edit Profile Panel -->
				{#if isEditMode}
					<div class="rounded-xl border border-accent-600/20 bg-accent-600/5 p-5 shadow-xl backdrop-blur-md" in:slide>
						<form class="flex flex-col gap-2" onsubmit={handleSaveProfile}>
							<div class="flex items-center justify-between pb-1">
								<div class="flex items-center gap-2 text-accent-400">
									<Settings2 size={15} />
									<h2 class="text-xs font-bold uppercase tracking-wider">Profile Settings</h2>
								</div>
								{#if authConnection}
									<button
										type="button"
										onclick={restoreProviderData}
										class="flex items-center gap-2 text-[11px] font-bold text-white/40 hover:text-accent-400 transition-colors bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hover:bg-white/10"
										title="Restore name and picture from {authConnection.name}"
									>
										<img src={authConnection.icon} alt="" class="size-3 opacity-60" />
										Sync from {authConnection.name}
									</button>
								{/if}
							</div>

							<div class="grid grid-cols-1 gap-3.5 md:grid-cols-2">
								<div class="flex flex-col gap-1">
									<label class="text-[10px] font-bold uppercase tracking-wider text-white/30" for="username">Username</label>
									<div class="relative">
										<div class="absolute left-3 top-1/2 -translate-y-1/2 text-white/20"><User size={13} /></div>
										<input
											id="username"
											bind:this={usernameInput}
											bind:value={newUsername}
											class="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs text-white outline-hidden transition-all focus:border-accent-600 focus:ring-4 focus:ring-accent-600/5"
											maxlength="30"
											minlength="3"
											placeholder="Your username..."
										/>
									</div>
								</div>

								<div class="flex flex-col gap-1">
									<label class="text-[10px] font-bold uppercase tracking-wider text-white/30" for="picture">Avatar URL</label>
									<div class="relative">
										<div class="absolute left-3 top-1/2 -translate-y-1/2 text-white/20"><LinkIcon size={13} /></div>
										<input
											id="picture"
											bind:this={pictureInput}
											bind:value={newPictureUrl}
											class="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs text-white outline-hidden transition-all focus:border-accent-600 focus:ring-4 focus:ring-accent-600/5"
											placeholder="https://..."
											type="url"
										/>
									</div>
								</div>
							</div>

							{#if editError}
								<div class="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400" transition:fade>
									{editError}
								</div>
							{/if}

							<div class="flex justify-end gap-2.5 pt-3">
								<button
									class="rounded-lg px-4 py-1.5 text-xs font-semibold text-white/40 transition-colors hover:text-white"
									onclick={cancelEditing}
									type="button"
								>
									Cancel
								</button>
								<button
									class="flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-accent-600/20 transition-all disabled:opacity-50 active:scale-95 hover:bg-accent-500"
									disabled={isSaving}
									type="submit"
								>
									{#if isSaving}
										<div class="size-3 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
									{:else}
										<Save size={14} />
									{/if}
									Save
								</button>
							</div>
						</form>
					</div>
				{/if}

				<!-- Stats & Data clusters -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<!-- Progress Cluster -->
					<div class="col-span-1 rounded-xl border border-white/5 bg-black/20 p-5 flex flex-col gap-5 md:col-span-2">
						<h3 class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/30">
							<Activity size={14} />
							Game Progress
						</h3>

						<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
							<div class="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 p-3.5 text-center transition-all hover:bg-white/10">
								<MousePointerClick size={16} class="text-white/20" />
								<span class="text-lg font-bold text-white truncate max-w-full">{formatNumber(gameManager.clickPower)}</span>
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Click Power</span>
							</div>
							<div class="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 p-3.5 text-center transition-all hover:bg-white/10">
								<Currency name={CurrenciesTypes.ATOMS} size={16} />
								<span class="text-lg font-bold text-accent-400">{formatNumber(gameManager.atomsPerSecond)}</span>
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Atoms/s</span>
							</div>
							<div class="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 p-3.5 text-center transition-all hover:bg-white/10">
								<Activity size={16} class="text-white/20" />
								<span class="text-lg font-bold text-white truncate max-w-full">{formatNumber(gameManager.totalClicksAllTime)}</span>
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Clicks</span>
							</div>
							<div class="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 p-3.5 text-center transition-all hover:bg-white/10">
								<Building2 size={16} class="text-white/20" />
								<span class="text-lg font-bold text-white">{formatNumber(totalBuildings)}</span>
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Buildings</span>
							</div>
							<div class="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 p-3.5 text-center transition-all hover:bg-white/10">
								<Package size={16} class="text-white/20" />
								<span class="text-lg font-bold text-white">{formatNumber(gameManager.upgrades.length)}</span>
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Upgrades</span>
							</div>
							<div class="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 p-3.5 text-center transition-all hover:bg-white/10">
								<Clock size={16} class="text-white/20" />
								<span class="text-lg font-bold text-white truncate max-w-full">{formatDuration(gameManager.inGameTime)}</span>
								<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Playtime</span>
							</div>
						</div>
					</div>

					<!-- Account Info -->
					<div class="rounded-xl border border-white/5 bg-black/20 p-5 flex flex-col gap-5">
						<h3 class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/30">
							<Shield size={14} />
							Security
						</h3>

						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-1.5">
								<span class="text-[10px] font-bold uppercase tracking-widest text-white/20">Provider</span>
								{#if authConnection}
									<div class="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-2">
										<img alt="" class="size-4" src={authConnection.icon} />
										<span class="text-[11px] font-semibold text-white">{authConnection.name}</span>
									</div>
								{:else}
									<div class="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-2 opacity-40">
										<Mail size={14} />
										<span class="text-[11px] font-semibold text-white">Direct</span>
									</div>
								{/if}
							</div>

							<div class="flex flex-col gap-1.5">
								<span class="text-[10px] font-bold uppercase tracking-widest text-white/20">Email</span>
								<div class="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-2">
									<Mail size={14} />
									<span class="text-[11px] font-semibold text-white truncate">{supabaseAuth.user?.email}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Quantum Mastery Cluster -->
					<div class="col-span-1 md:col-span-3 rounded-xl border border-white/5 bg-black/20 p-5 flex flex-col gap-5">
						<h3 class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/30">
							<Zap size={14} />
							Quantum Mastery
						</h3>

						<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
							{#each [CurrenciesTypes.ATOMS, CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS, CurrenciesTypes.PHOTONS, CurrenciesTypes.EXCITED_PHOTONS, CurrenciesTypes.HIGGS_BOSON] as currencyType}
								{@const currency = gameManager.currencies[currencyType]}
								{#if (currency?.earnedAllTime ?? 0) > 0}
									<div class="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 p-3.5 text-center transition-all hover:bg-white/10" in:scale>
										<Currency name={currencyType} size={16} />
										<span class="text-lg font-bold text-white truncate max-w-full">
											{formatNumber(currency.earnedAllTime)}
										</span>
										<span class="text-[9px] font-bold uppercase tracking-widest text-white/20">Total {currencyType}</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="relative flex h-[460px] flex-col items-center justify-center gap-8 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-10 text-center" in:fade>
				<!-- Blurry color dots -->
				<div class="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-accent-600/5 blur-[80px]"></div>
				<div class="pointer-events-none absolute -left-20 -bottom-20 size-64 rounded-full bg-primary-600/5 blur-[80px]"></div>

				<div class="relative">
					<div class="absolute inset-0 animate-pulse rounded-full bg-accent-600/10 blur-[60px]"></div>
					<Avatar alt="Guest" class="size-24 text-4xl shadow-2xl ring-4 ring-black" src="" />
				</div>

				<div class="relative flex max-w-sm flex-col gap-2">
					<h2 class="text-2xl font-bold tracking-tight text-white uppercase">Guest</h2>
					<p class="text-[13px] font-medium leading-relaxed text-white/40 px-6">
						Login to preserve your progress across devices and climb the rankings.
					</p>
				</div>

				<button
					class="group relative overflow-hidden rounded-xl bg-accent-600 px-10 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 hover:scale-105"
					onclick={() => { showLoginModal = true; }}
				>
					<div class="absolute inset-0 translate-x-full bg-white/10 transition-transform duration-500 group-hover:translate-x-0"></div>
					<span class="relative flex items-center gap-2.5">
						<CircleUser size={18} />
						Login
					</span>
				</button>
			</div>
			{#if showLoginModal}
				<Login onClose={() => (showLoginModal = false)} />
			{/if}
		{/if}
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		display: none;
	}

	.custom-scrollbar {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}

	.wrap-break-word {
		overflow-wrap: break-word;
		word-break: break-word;
		word-wrap: break-word;
	}
</style>
