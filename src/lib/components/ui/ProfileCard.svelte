<script lang="ts">
	import Login from '@components/modals/Login.svelte';
	import Avatar from '@components/ui/Avatar.svelte';
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { leaderboard } from '$stores/leaderboard.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { ui } from '$stores/ui.svelte';
	import { ChevronRight } from '@lucide/svelte';

	/** Snapshot at mount: a per-frame live counter changes width and reflows the card. */
	const atoms = gameManager.atoms;

	let showLoginModal = $state(false);
</script>

{#if supabaseAuth.isAuthenticated}
	<button
		class="group flex w-full items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition-colors hover:bg-black/30"
		onclick={() => ui.openSettings('profile')}
		title="Open your profile"
	>
		<div class="relative shrink-0">
			<Avatar alt={supabaseAuth.displayName ?? 'Anonymous'} class="size-12 text-lg ring-2 ring-accent-500 ring-offset-2 ring-offset-black" src={supabaseAuth.avatarUrl} />
			{#if leaderboard.playerRank}
				<span class="absolute -right-1.5 -bottom-1 rounded-full bg-accent-600 px-1.5 text-[10px] font-bold text-white ring-2 ring-black">#{leaderboard.playerRank}</span>
			{/if}
		</div>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="truncate font-bold text-white">{supabaseAuth.displayName ?? 'Anonymous'}</span>
			<span class="flex flex-wrap items-center gap-x-3 text-xs text-white/60">
				<span>Level <b class="text-white">{formatNumber(gameManager.playerLevel)}</b></span>
				<Value class="font-bold text-accent-400" currency={CurrenciesTypes.ATOMS} value={atoms} />
				{#if leaderboard.playerPercentile}
					<span>Top <b class="text-white">{leaderboard.playerPercentile}%</b></span>
				{/if}
			</span>
		</div>
		<ChevronRight class="shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" size={20} />
	</button>
{:else}
	<div class="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3">
		<Avatar alt="Guest" class="size-12 text-lg ring-2 ring-white/10 ring-offset-2 ring-offset-black" src="" />
		<div class="min-w-0 flex-1">
			<p class="font-bold text-white">Guest</p>
			<p class="text-xs text-white/60">Sign in to appear on the leaderboard.</p>
		</div>
		<button class="shrink-0 rounded-lg bg-accent-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-500" onclick={() => (showLoginModal = true)}>
			Sign in
		</button>
	</div>
	{#if showLoginModal}
		<Login onClose={() => (showLoginModal = false)} />
	{/if}
{/if}
