<script lang="ts">
	import Login from '@components/modals/Login.svelte';
	import Profile from '@components/settings/Profile.svelte';
	import Avatar from '@components/ui/Avatar.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import type { LeaderboardEntry } from '$lib/types/leaderboard';
	import {formatNumber} from '$lib/utils';
	import {leaderboard} from '$stores/leaderboard.svelte';
	import {supabaseAuth} from '$stores/supabaseAuth.svelte';
	import {Search, Users, Trophy, Medal, Crown} from 'lucide-svelte';
	import {onDestroy, onMount} from 'svelte';
	import {VList} from 'virtua/svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	function getDisplayUsername(user: LeaderboardEntry | undefined): string {
		return user?.username || 'Anonymous';
	}

	let refreshInterval: ReturnType<typeof setInterval>;
	let searchQuery = $state('');
	let selectedFilter: 'all' | 'top10' | 'top50' | 'top100' = $state('all');
	let showLoginModal = $state(false);

	onMount(() => {
		leaderboard.fetchLeaderboard();
		refreshInterval = setInterval(() => leaderboard.fetchLeaderboard(), 60_000);
	});

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
	});

	let stats = $derived(leaderboard.stats);

	// Filter and search leaderboard
	let filteredLeaderboard = $derived.by(() => {
		let filtered = [...leaderboard.entries];

		// Apply search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(entry =>
				entry.username.toLowerCase().includes(query)
			);
		}

		// Apply filter
		switch (selectedFilter) {
			case 'top10':
				return filtered.slice(0, 10);
			case 'top50':
				return filtered.slice(0, 50);
			case 'top100':
				return filtered.slice(0, 100);
			default:
				return filtered;
		}
	});

	function getRankIcon(rank: number) {
		switch (rank) {
			case 1:
				return Crown;
			case 2:
				return Trophy;
			case 3:
				return Medal;
			default:
				return null;
		}
	}

	function getRankColor(rank: number) {
		switch (rank) {
			case 1:
				return 'text-yellow-400';
			case 2:
				return 'text-gray-300';
			case 3:
				return 'text-amber-600';
			default:
				return 'text-accent';
		}
	}
</script>

<Modal {onClose} containerClass="px-6">
	{#snippet header()}
		<div class="flex items-center gap-2">
			<h2 class="flex-1 text-2xl font-bold text-white">Global Leaderboard</h2>
			<div class="flex items-center gap-2 text-sm text-white/60">
				<Users size={16} />
				<span>{stats.totalUsers} players</span>
				{#if leaderboard.entries.some(e => e.is_online)}
					<span class="text-white/40">•</span>
					<span class="text-green-400">{leaderboard.entries.filter(e => e.is_online).length} online</span>
				{/if}
			</div>
		</div>
	{/snippet}

	<div class="mb-4">
		<Profile small={true} />
	</div>

	<!-- Search and Filters -->
	<div class="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
		<div class="relative flex-1 w-full">
			<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search players..."
				class="w-full rounded-lg bg-black/20 border border-white/10 py-2 pl-10 pr-4 text-white placeholder-white/40 outline-hidden focus:border-accent/50 transition-colors"
			/>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => selectedFilter = 'all'}
				class={selectedFilter === 'all'
					? 'rounded-lg px-4 py-2 text-sm font-medium transition-all bg-accent text-white'
					: 'rounded-lg px-4 py-2 text-sm font-medium transition-all bg-black/20 text-white/60 hover:bg-black/30'}
			>
				All
			</button>
			<button
				onclick={() => selectedFilter = 'top10'}
				class={selectedFilter === 'top10'
					? 'rounded-lg px-4 py-2 text-sm font-medium transition-all bg-accent text-white'
					: 'rounded-lg px-4 py-2 text-sm font-medium transition-all bg-black/20 text-white/60 hover:bg-black/30'}
			>
				Top 10
			</button>
			<button
				onclick={() => selectedFilter = 'top50'}
				class={selectedFilter === 'top50'
					? 'rounded-lg px-4 py-2 text-sm font-medium transition-all bg-accent text-white'
					: 'rounded-lg px-4 py-2 text-sm font-medium transition-all bg-black/20 text-white/60 hover:bg-black/30'}
			>
				Top 50
			</button>
			<button
				onclick={() => selectedFilter = 'top100'}
				class={selectedFilter === 'top100'
					? 'rounded-lg px-4 py-2 text-sm font-medium transition-all bg-accent text-white'
					: 'rounded-lg px-4 py-2 text-sm font-medium transition-all bg-black/20 text-white/60 hover:bg-black/30'}
			>
				Top 100
			</button>
		</div>
	</div>

	{#if searchQuery.trim() && filteredLeaderboard.length > 0 && filteredLeaderboard.length < leaderboard.entries.length}
		<div class="mb-4 text-center text-sm text-white/60">
			Found {filteredLeaderboard.length} of {leaderboard.entries.length} players
		</div>
	{/if}

	{#if filteredLeaderboard.length > 0}
		<VList
			data={filteredLeaderboard}
			style="height: 72.5%;"
		>
			{#snippet children(entry: LeaderboardEntry, index: number)}
				{@const isCurrentUser = entry.self === true}
				{@const RankIcon = getRankIcon(entry.rank)}
				{@const rankColor = getRankColor(entry.rank)}
				{@const userClass = isCurrentUser
					? 'flex items-center gap-3 rounded-lg p-4 transition-all hover:scale-[1.02] bg-linear-to-r from-accent/20 via-accent/10 to-transparent ring-2 ring-accent-400'
					: 'flex items-center gap-3 rounded-lg p-4 transition-all hover:scale-[1.02] bg-black/20'}
				{@const borderClass = entry.rank === 1
					? 'border border-yellow-400/30'
					: entry.rank === 2
						? 'border border-gray-300/30'
						: entry.rank === 3
							? 'border border-amber-600/30'
							: ''}

				{@const isHundredth = (index + 1) % 100 === 0 && (filteredLeaderboard.length !== index + 1)}
				<div class="px-3 py-1" class:pb-8={isHundredth}>
					<div class="{userClass} {borderClass}">
						<div class="flex items-center gap-2">
							{#if RankIcon}
								{@const Icon = RankIcon}
								<Icon size={24} class={rankColor} />
							{:else}
								<div class="flex size-7 items-center justify-center rounded-full bg-accent/30 font-bold text-white text-sm">
									{entry.rank}
								</div>
							{/if}
						</div>
						<div class="flex items-center gap-3 flex-1">
							<Avatar
								alt={getDisplayUsername(entry)}
								class="size-10 text-sm"
								src={entry.picture}
							/>
							<div>
								<div class="font-bold capitalize text-white flex items-center gap-2">
									{getDisplayUsername(entry)}
									{#if entry.is_online}
										<div class="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" title="Online"></div>
									{/if}
								</div>
								<div class="text-sm text-white/60">
									Level {entry.level}
									{#if entry.lastUpdated}
										{@const daysAgo = Math.round((entry.lastUpdated - Date.now()) / (1000 * 60 * 60 * 24))}
										{@const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(daysAgo, 'day')}
										<span title="Last time played">
											· {relativeTime}
										</span>
									{/if}
								</div>
							</div>
						</div>
						<div class="text-right">
							<div class="font-bold text-white">
								{formatNumber(entry.atoms)}
							</div>
							<div class="text-sm text-white/60">Atoms</div>
						</div>
					</div>
				</div>
			{/snippet}
		</VList>
	{:else}
		<div class="text-center py-8 text-white/60">
			{#if searchQuery.trim()}
				<Search size={32} class="mx-auto mb-2 text-white/40" />
				<p>No players found matching "{searchQuery}"</p>
			{:else}
				<Users size={32} class="mx-auto mb-2 text-white/40" />
				<p>No entries yet. Be the first to join the leaderboard!</p>
			{/if}
		</div>
	{/if}
</Modal>

{#if showLoginModal}
	<Login onClose={() => showLoginModal = false}/>
{/if}
