<script lang="ts">
	import Login from '@components/modals/Login.svelte';
	import Profile from '@components/settings/Profile.svelte';
	import LeaderboardRow from '@components/ui/LeaderboardRow.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import type { LeaderboardEntry } from '$lib/types/leaderboard';
	import {leaderboard, REFRESH_INTERVAL} from '$stores/leaderboard.svelte';
	import {supabaseAuth} from '$stores/supabaseAuth.svelte';
	import {Search, Users} from '@lucide/svelte';
	import {onDestroy, onMount} from 'svelte';
	import {VList} from 'virtua/svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let refreshInterval: ReturnType<typeof setInterval>;
	let searchQuery = $state('');
	let selectedFilter: 'all' | 'top10' | 'top50' | 'top100' = $state('all');
	let showLoginModal = $state(false);

	onMount(() => {
		leaderboard.fetchLeaderboard();
		refreshInterval = setInterval(() => leaderboard.fetchLeaderboard(), REFRESH_INTERVAL);
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
				{@const isHundredth = (index + 1) % 100 === 0 && (filteredLeaderboard.length !== index + 1)}
				<div class="px-3 py-1" class:pb-8={isHundredth}>
					<LeaderboardRow {entry} />
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
