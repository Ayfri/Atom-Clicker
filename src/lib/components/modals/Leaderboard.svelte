<script lang="ts">
	import PlayerProfile from '@components/leaderboard/PlayerProfile.svelte';
	import Podium from '@components/leaderboard/Podium.svelte';
	import Login from '@components/modals/Login.svelte';
	import Avatar from '@components/ui/Avatar.svelte';
	import LeaderboardRow from '@components/ui/LeaderboardRow.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import type { LeaderboardEntry } from '$lib/types/leaderboard';
	import { formatNumber, formatNumberFull } from '$lib/utils';
	import { leaderboard, REFRESH_INTERVAL } from '$stores/leaderboard.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { ArrowLeft, Crosshair, Crown, Search, Trophy, Users } from '@lucide/svelte';
	import { onDestroy, onMount, tick } from 'svelte';
	import { VList, type VListHandle } from 'virtua/svelte';

	interface Props {
		onClose: () => void;
	}

	type Row = LeaderboardEntry | LeaderboardEntry[];
	type Tab = 'global' | 'near' | 'online';

	/** Rivals shown on each side of the player in the Near me tab. */
	const NEAR_RANGE = 5;

	let { onClose }: Props = $props();

	let intro = $state(true);
	let introTimer: ReturnType<typeof setTimeout>;
	let list = $state<VListHandle>();
	let listOffset = 0;
	let refreshInterval: ReturnType<typeof setInterval>;
	let searchQuery = $state('');
	let selectedId = $state<string | null>(null);
	let showLoginModal = $state(false);
	let tab = $state<Tab>('global');

	onMount(() => {
		leaderboard.startVisit();
		leaderboard.fetchLeaderboard();
		refreshInterval = setInterval(() => leaderboard.fetchLeaderboard(), REFRESH_INTERVAL);
		introTimer = setTimeout(() => (intro = false), 800);
	});

	onDestroy(() => {
		clearInterval(refreshInterval);
		clearTimeout(introTimer);
		leaderboard.endVisit();
	});

	const me = $derived(leaderboard.playerIndex >= 0 ? leaderboard.entries[leaderboard.playerIndex] : null);
	const rival = $derived(leaderboard.playerIndex > 0 ? leaderboard.entries[leaderboard.playerIndex - 1] : null);
	const activeTab = $derived(tab === 'near' && !me ? 'global' : tab);
	const selected = $derived(selectedId ? (leaderboard.entries.find(entry => entry.userId === selectedId) ?? null) : null);
	const tabs = $derived<{ id: Tab; label: string }[]>([
		{ id: 'global', label: 'Global' },
		...(me ? [{ id: 'near' as const, label: 'Near me' }] : []),
		{ id: 'online', label: `Online${leaderboard.onlineCount ? ` · ${leaderboard.onlineCount}` : ''}` },
	]);

	/** The top 3 fold into one podium row, which only makes sense on the unfiltered board. */
	const rows = $derived.by((): Row[] => {
		const entries = leaderboard.entries;
		const query = searchQuery.trim().toLowerCase();
		let visible =
			activeTab === 'online'
				? entries.filter(entry => entry.is_online)
				: activeTab === 'near'
					? entries.slice(Math.max(0, leaderboard.playerIndex - NEAR_RANGE), leaderboard.playerIndex + NEAR_RANGE + 1)
					: entries;
		if (query) visible = visible.filter(entry => entry.username.toLowerCase().includes(query));
		return activeTab === 'global' && !query && visible.length >= 3 ? [visible.slice(0, 3), ...visible.slice(3)] : visible;
	});

	function rowIndex(entry: LeaderboardEntry): number {
		return rows.findIndex(row => (Array.isArray(row) ? row.includes(entry) : row === entry));
	}

	/** Falls back to the full board when a filter hides the player. */
	async function jumpTo(entry: LeaderboardEntry) {
		if (rowIndex(entry) < 0) {
			searchQuery = '';
			tab = 'global';
			await tick();
		}
		list?.scrollToIndex(rowIndex(entry), { align: 'center', smooth: true });
	}

	function openProfile(entry: LeaderboardEntry) {
		if (!entry.userId) return;
		listOffset = list?.getScrollOffset() ?? 0;
		selectedId = entry.userId;
	}

	async function back() {
		selectedId = null;
		await tick();
		list?.scrollTo(listOffset);
	}
</script>

<Modal containerClass="px-3 py-3 sm:px-6 sm:py-5" onClose={() => (selectedId ? back() : onClose())}>
	{#snippet header()}
		{#if selected}
			<button class="flex flex-1 items-center gap-2 text-left text-lg font-bold text-white/70 transition-colors hover:text-white" onclick={back}>
				<ArrowLeft size={20} />
				Leaderboard
			</button>
		{:else}
			<div class="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
				<h2 class="flex items-center gap-2 text-2xl font-black tracking-wide text-white uppercase">
					<Trophy class="text-yellow-400" size={24} />
					Leaderboard
				</h2>
				<div class="flex items-center gap-3 text-sm text-white/60">
					{#if leaderboard.onlineCount > 0}
						<span class="flex items-center gap-1.5 font-semibold text-green-400">
							<span class="size-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></span>
							{leaderboard.onlineCount} online
						</span>
					{/if}
					<span class="flex items-center gap-1.5">
						<Users size={15} />
						<span><b class="text-white">{formatNumberFull(leaderboard.stats.rankedPlayers)}</b> ranked · {formatNumberFull(leaderboard.stats.totalUsers)} players</span>
					</span>
					{#key leaderboard.fetchedAt}
						<svg class="size-4 -rotate-90" viewBox="0 0 20 20" aria-label="Refreshes every minute" role="img">
							<title>Refreshes every minute</title>
							<circle class="stroke-white/15" cx="10" cy="10" fill="none" r="8" stroke-width="2.5" />
							<circle class="refresh-ring stroke-accent-400" cx="10" cy="10" fill="none" pathLength="100" r="8" stroke-dasharray="100" stroke-width="2.5" style:animation-duration="{REFRESH_INTERVAL}ms" />
						</svg>
					{/key}
				</div>
			</div>
		{/if}
	{/snippet}

	{#if selected}
		<PlayerProfile entry={selected} />
	{:else}
		<div class="flex h-full min-h-0 flex-col gap-3">
			<div class="flex flex-wrap items-center gap-2">
				<div class="flex rounded-lg bg-black/30 p-1" role="tablist">
					{#each tabs as { id, label } (id)}
						<button
							aria-selected={activeTab === id}
							class="rounded-md px-3 py-1.5 text-sm font-semibold transition-colors {activeTab === id ? 'bg-accent-500 text-white shadow' : 'text-white/60 hover:text-white'}"
							onclick={() => (tab = id)}
							role="tab"
						>
							{label}
						</button>
					{/each}
				</div>
				<label class="relative min-w-40 flex-1">
					<Search class="absolute top-1/2 left-3 -translate-y-1/2 text-white/40" size={16} />
					<input
						bind:value={searchQuery}
						class="w-full rounded-lg border border-white/10 bg-black/20 py-2 pr-4 pl-10 text-white placeholder-white/40 outline-hidden transition-colors focus:border-accent/50"
						placeholder="Search players..."
						type="search"
					/>
				</label>
			</div>

			{#if rows.length > 0}
				<VList bind:this={list} class="min-h-0 flex-1" data={rows}>
					{#snippet children(row: Row, index: number)}
						<div class="px-1 py-1" class:row-intro={intro} style:--i={Math.min(index, 10)}>
							{#if Array.isArray(row)}
								<Podium entries={row} onselect={openProfile} />
							{:else}
								<LeaderboardRow entry={row} onclick={() => openProfile(row)} />
							{/if}
						</div>
					{/snippet}
				</VList>
			{:else}
				<div class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-white/60">
					{#if searchQuery.trim()}
						<Search class="text-white/40" size={32} />
						<p>No players found matching "{searchQuery}"</p>
					{:else if activeTab === 'online'}
						<Users class="text-white/40" size={32} />
						<p>Nobody is online right now.</p>
					{:else}
						<Trophy class="text-white/40" size={32} />
						<p>No entries yet. Be the first to join the leaderboard!</p>
					{/if}
				</div>
			{/if}

			<div class="flex shrink-0 items-center gap-3 rounded-xl border border-accent-400/30 bg-black/40 p-2 sm:p-3">
				{#if !supabaseAuth.isAuthenticated}
					<Avatar alt="Guest" class="size-10 ring-2 ring-white/10" src="" />
					<p class="min-w-0 flex-1 text-sm text-white/70">Sign in to join the leaderboard and get your own profile.</p>
					<button class="shrink-0 rounded-lg bg-accent-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-500" onclick={() => (showLoginModal = true)}>
						Sign in
					</button>
				{:else if me}
					<button class="flex shrink-0 items-center gap-2.5 text-left" onclick={() => openProfile(me)} title="Open your profile">
						<Avatar alt={me.username} class="size-10 ring-2 ring-accent-400" src={me.picture} />
						<span class="flex flex-col leading-tight">
							<span class="text-xl font-black text-white tabular-nums">#{me.rank}</span>
							{#if leaderboard.playerPercentile}
								<span class="text-[11px] font-semibold text-white/50">Top {leaderboard.playerPercentile}%</span>
							{/if}
						</span>
					</button>
					<div class="min-w-0 flex-1 border-l border-white/10 pl-3 text-xs text-white/60 sm:text-sm">
						{#if rival}
							<button class="block max-w-full truncate text-left transition-colors hover:text-white" onclick={() => jumpTo(rival)}>
								{#if rival.atoms > me.atoms}
									<b class="text-accent-300">{formatNumber(rival.atoms - me.atoms)}</b> atoms to pass
								{:else}
									Tied with
								{/if}
								<b class="text-white capitalize">{rival.username}</b>
							</button>
						{:else}
							<span class="flex items-center gap-1.5 font-semibold text-yellow-400"><Crown size={16} /> You hold the crown</span>
						{/if}
					</div>
					<button
						aria-label="Jump to my rank"
						class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
						onclick={() => jumpTo(me)}
						title="Jump to my rank"
					>
						<Crosshair size={18} />
					</button>
				{:else}
					<Avatar alt={supabaseAuth.displayName ?? 'Anonymous'} class="size-10 ring-2 ring-white/10" src={supabaseAuth.avatarUrl} />
					<p class="min-w-0 flex-1 text-sm text-white/70">
						{leaderboard.stats.rankedPlayers > leaderboard.entries.length
							? `You're outside the top ${formatNumberFull(leaderboard.entries.length)}, keep climbing!`
							: 'Not ranked yet, your score shows up after a minute of play.'}
					</p>
				{/if}
			</div>
		</div>
	{/if}
</Modal>

{#if showLoginModal}
	<Login onClose={() => (showLoginModal = false)} />
{/if}

<style>
	.refresh-ring {
		animation: refresh-drain linear forwards;
	}

	.row-intro {
		animation: row-in 400ms cubic-bezier(0.2, 0.8, 0.3, 1) calc(var(--i) * 40ms) backwards;
	}

	@keyframes refresh-drain {
		to {
			stroke-dashoffset: 100;
		}
	}

	@keyframes row-in {
		from {
			opacity: 0;
			transform: translateX(-16px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.refresh-ring,
		.row-intro {
			animation: none;
		}
	}
</style>
