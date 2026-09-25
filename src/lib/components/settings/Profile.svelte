<script lang="ts">
	import Login, { AUTH_CONNECTIONS, getAuthConnection } from '@components/modals/Login.svelte';
	import AtomIcon from '@components/icons/Atom.svelte';
	import ElectronIcon from '@components/icons/Electron.svelte';
	import PhotonIcon from '@components/icons/Photon.svelte';
	import ProtonIcon from '@components/icons/Proton.svelte';
	import QuarkIcon from '@components/icons/Quark.svelte';
	import Avatar from '@components/ui/Avatar.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { ACHIEVEMENTS } from '$data/achievements';
	import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
	import { REALMS } from '$data/realms';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { formatDuration, formatNumber } from '$lib/utils';
	import { leaderboard } from '$stores/leaderboard.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { ui } from '$stores/ui.svelte';
	import { ChartLine, Clock, Cloud, Link as LinkIcon, Lock, LogOut, Medal, MousePointerClick, Pencil, Radiation, Trophy, User } from '@lucide/svelte';
	import { onDestroy, onMount, type Component } from 'svelte';
	import { slide } from 'svelte/transition';

	interface Milestone {
		color: string;
		count: number | null;
		icon: Component<{ color?: string; size?: number }>;
		label: string;
		reached: boolean;
	}

	const totalAchievements = Object.keys(ACHIEVEMENTS).length;
	const joined = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(gameManager.startDate);

	let editError = $state<string | null>(null);
	let isEditing = $state(false);
	let isSaving = $state(false);
	let newPictureUrl = $state('');
	let newUsername = $state('');
	let previewPicture = $state('');
	let previewTimer: ReturnType<typeof setTimeout> | undefined;
	let showLoginModal = $state(false);

	const connection = $derived(getAuthConnection(supabaseAuth.user?.identities?.find(identity => AUTH_CONNECTIONS.some(c => c.provider === identity.provider))?.provider));
	const name = $derived(supabaseAuth.displayName ?? 'Anonymous');
	const tiles = $derived([
		{ icon: Trophy, label: 'Achievements', value: `${gameManager.achievements.length} / ${totalAchievements}` },
		{ icon: Clock, label: 'Play time', value: formatDuration(gameManager.inGameTime) },
		{ icon: AtomIcon, label: 'Atoms / s', value: formatNumber(gameManager.atomsPerSecond) },
		{ icon: MousePointerClick, label: 'Click power', value: formatNumber(gameManager.clickPower) },
		...(supabaseAuth.isAuthenticated
			? [
					{ icon: Medal, label: 'Leaderboard', value: leaderboard.playerRank ? `#${leaderboard.playerRank} · Top ${leaderboard.playerPercentile}%` : 'Unranked' },
					{ icon: QuarkIcon, label: 'Quarks', value: formatNumber(quarksManager.balance, 0) },
				]
			: []),
	]);
	/** Locked milestones stay hidden behind `???` so the profile never spoils what comes next. */
	const milestones: Milestone[] = $derived([
		{ color: CURRENCIES.Protons.color, count: gameManager.totalProtonisesAllTime, icon: ProtonIcon, label: 'Protonised', reached: gameManager.totalProtonisesAllTime > 0 },
		{ color: CURRENCIES.Electrons.color, count: gameManager.totalElectronizesAllTime, icon: ElectronIcon, label: 'Electronized', reached: gameManager.totalElectronizesAllTime > 0 },
		{ color: REALMS.photons.color, count: null, icon: PhotonIcon, label: 'Photon Realm', reached: REALMS.photons.condition(gameManager.features) },
		{ color: REALMS.radiation.color, count: null, icon: Radiation, label: 'Radiation Realm', reached: REALMS.radiation.condition(gameManager.features) },
	]);
	const lifetime = $derived(Object.values(CurrenciesTypes).filter(type => gameManager.currencies[type]?.earnedAllTime > 0));

	onMount(() => leaderboard.ensureLoaded());
	onDestroy(() => clearTimeout(previewTimer));

	function startEditing() {
		editError = null;
		newUsername = name;
		newPictureUrl = supabaseAuth.avatarUrl ?? '';
		previewPicture = newPictureUrl;
		isEditing = true;
	}

	/** Debounced so the avatar preview does not request an image for every keystroke of the URL. */
	function onPictureInput() {
		clearTimeout(previewTimer);
		previewTimer = setTimeout(() => (previewPicture = newPictureUrl), 500);
	}

	function restoreProviderData() {
		const metadata = supabaseAuth.user?.user_metadata;
		if (!metadata) return;
		newUsername = metadata.full_name || metadata.username || metadata.name || name;
		newPictureUrl = metadata.avatar_url || metadata.picture || '';
		previewPicture = newPictureUrl;
	}

	async function handleSave(event: SubmitEvent) {
		event.preventDefault();
		if (isSaving) return;

		const username = newUsername.trim();
		const picture = newPictureUrl.trim();
		if (!username) {
			editError = 'Username cannot be empty.';
			return;
		}

		isSaving = true;
		editError = null;
		try {
			const updates: { picture?: string | null; username?: string } = {};
			if (username !== name) updates.username = username;
			if (picture !== (supabaseAuth.profile?.picture ?? '')) updates.picture = picture || null;
			if (Object.keys(updates).length > 0) await supabaseAuth.updateProfile(updates);
			isEditing = false;
		} catch (error) {
			editError = error instanceof Error && error.message ? error.message : 'Failed to update profile. Please try again.';
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-4">
	<section class="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-accent-600/20 via-black/30 to-black/40 p-5">
		<div class="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-accent-500/20 blur-3xl"></div>

		<div class="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
			<div class="relative shrink-0">
				<Avatar
					alt={supabaseAuth.isAuthenticated ? name : 'Guest'}
					class="size-20 text-2xl shadow-xl ring-2 ring-accent-500/60 ring-offset-2 ring-offset-black sm:size-24"
					src={isEditing ? previewPicture : supabaseAuth.avatarUrl}
				/>
				{#if leaderboard.playerRank && supabaseAuth.isAuthenticated}
					<span class="absolute -right-1 -bottom-1 rounded-full bg-accent-600 px-2 py-0.5 text-xs font-bold text-white ring-2 ring-black">#{leaderboard.playerRank}</span>
				{/if}
			</div>

			<div class="flex min-w-0 flex-1 flex-col gap-1">
				{#if supabaseAuth.isAuthenticated}
					<h2 class="truncate text-2xl font-bold text-white">{name}</h2>
					<p class="flex flex-wrap items-center justify-center gap-x-2 text-sm text-white/50 sm:justify-start">
						{#if connection}
							<img alt="" class="size-3.5" src={connection.icon} />
						{/if}
						<span class="truncate">{supabaseAuth.user?.email}</span>
						<span>·</span>
						<span>Joined {joined}</span>
					</p>
				{:else}
					<h2 class="text-2xl font-bold text-white">Guest</h2>
					<p class="text-sm text-white/60">Your progress only lives in this browser, sign in to keep it safe.</p>
				{/if}
			</div>

			{#if supabaseAuth.isAuthenticated}
				<div class="flex shrink-0 gap-2">
					<button
						class="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
						disabled={isEditing}
						onclick={startEditing}
					>
						<Pencil size={16} />
						Edit
					</button>
					<button
						aria-label="Sign out"
						class="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
						onclick={() => supabaseAuth.signOut()}
						title="Sign out"
					>
						<LogOut size={16} />
					</button>
				</div>
			{:else}
				<button class="shrink-0 rounded-lg bg-accent-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-accent-500" onclick={() => (showLoginModal = true)}>
					Sign in
				</button>
			{/if}
		</div>

		{#if isEditing}
			<form class="relative mt-5 flex flex-col gap-3 border-t border-white/10 pt-5" onsubmit={handleSave} transition:slide>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="flex flex-col gap-1 text-xs font-semibold text-white/50">
						Username
						<span class="relative">
							<User class="absolute top-1/2 left-3 -translate-y-1/2 text-white/30" size={14} />
							<input
								bind:value={newUsername}
								class="w-full rounded-lg border border-white/10 bg-black/40 py-2 pr-3 pl-9 text-sm text-white outline-hidden focus:border-accent-500"
								maxlength="30"
								minlength="3"
								placeholder="Your username"
							/>
						</span>
					</label>
					<label class="flex flex-col gap-1 text-xs font-semibold text-white/50">
						Avatar URL
						<span class="relative">
							<LinkIcon class="absolute top-1/2 left-3 -translate-y-1/2 text-white/30" size={14} />
							<input
								bind:value={newPictureUrl}
								class="w-full rounded-lg border border-white/10 bg-black/40 py-2 pr-3 pl-9 text-sm text-white outline-hidden focus:border-accent-500"
								oninput={onPictureInput}
								placeholder="https://..."
								type="url"
							/>
						</span>
					</label>
				</div>

				{#if editError}
					<p class="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-300">{editError}</p>
				{/if}

				<div class="flex flex-wrap items-center gap-2">
					{#if connection}
						<button class="mr-auto flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white" onclick={restoreProviderData} type="button">
							<img alt="" class="size-3.5" src={connection.icon} />
							Use my {connection.name} name and picture
						</button>
					{/if}
					<button class="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white/60 transition-colors hover:text-white" onclick={() => (isEditing = false)} type="button">
						Cancel
					</button>
					<button class="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-50" disabled={isSaving} type="submit">
						{isSaving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</form>
		{/if}
	</section>

	<section class="rounded-2xl border border-white/10 bg-black/20 p-4">
		<div class="mb-2 flex items-baseline justify-between gap-2">
			<span class="text-sm font-semibold text-white/60">Level <b class="text-2xl text-white">{formatNumber(gameManager.playerLevel)}</b></span>
			<span class="text-xs text-white/40">{formatNumber(gameManager.currentLevelXP)} / {formatNumber(gameManager.nextLevelXP)} XP</span>
		</div>
		<div class="h-2.5 overflow-hidden rounded-full bg-white/10">
			<div class="h-full origin-left rounded-full bg-linear-to-r from-accent-400 to-accent-600" style:transform="scaleX({gameManager.xpProgress / 100})"></div>
		</div>
	</section>

	<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
		{#each tiles as tile (tile.label)}
			<div class="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
				<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
					<tile.icon size={18} />
				</span>
				<span class="flex min-w-0 flex-col">
					<span class="truncate font-bold text-white">{tile.value}</span>
					<span class="text-xs text-white/50">{tile.label}</span>
				</span>
			</div>
		{/each}
	</div>

	<section class="rounded-2xl border border-white/10 bg-black/20 p-4">
		<h3 class="mb-3 text-xs font-semibold tracking-wider text-white/40 uppercase">Journey</h3>
		<ol class="grid grid-cols-2 gap-3 md:grid-cols-4">
			{#each milestones as milestone (milestone.label)}
				<li class="flex flex-col items-center gap-2 rounded-xl p-3 text-center {milestone.reached ? 'bg-white/5' : 'border border-dashed border-white/10 opacity-50'}">
					<span class="flex size-11 items-center justify-center rounded-full bg-black/40">
						{#if milestone.reached}
							<milestone.icon color={milestone.color} size={24} />
						{:else}
							<Lock class="text-white/50" size={16} />
						{/if}
					</span>
					<span class="text-sm font-semibold text-white">{milestone.reached ? milestone.label : '???'}</span>
					{#if milestone.reached && milestone.count}
						<span class="text-xs text-white/50">{formatNumber(milestone.count, 0)} times</span>
					{/if}
				</li>
			{/each}
		</ol>
	</section>

	<section class="rounded-2xl border border-white/10 bg-black/20 p-4">
		<h3 class="mb-3 text-xs font-semibold tracking-wider text-white/40 uppercase">Earned all time</h3>
		<div class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
			{#each lifetime as type (type)}
				<div class="flex items-center gap-2.5">
					<Currency name={type} size={26} />
					<span class="flex flex-col leading-tight">
						<span class="text-lg font-bold tabular-nums" style:color={CURRENCIES[type].color}>{formatNumber(gameManager.currencies[type].earnedAllTime)}</span>
						<span class="text-xs text-white/50">{type}</span>
					</span>
				</div>
			{/each}
		</div>
	</section>

	{#if !supabaseAuth.isAuthenticated}
		<div class="grid gap-3 sm:grid-cols-3">
			{#each [{ icon: Cloud, text: 'Back up your save and play on any device' }, { icon: Trophy, text: 'Climb the global leaderboard' }, { icon: QuarkIcon, text: 'Earn Quarks for themes and banners' }] as perk (perk.text)}
				<div class="flex items-center gap-3 rounded-xl border border-dashed border-accent/30 bg-accent/5 p-4 text-sm text-white/70">
					<perk.icon class="shrink-0 text-accent" size={20} />
					{perk.text}
				</div>
			{/each}
		</div>
	{/if}

	<button
		class="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
		onclick={() => ui.openSettings('stats')}
	>
		<ChartLine size={16} />
		See all your stats
	</button>
</div>

{#if showLoginModal}
	<Login onClose={() => (showLoginModal = false)} />
{/if}
