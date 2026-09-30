<script lang="ts">
	import Avatar from '@components/ui/Avatar.svelte';
	import LeaderboardBannerBackdrop from '@components/ui/LeaderboardBannerBackdrop.svelte';
	import LevelChip from '@components/ui/LevelChip.svelte';
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { podiumColor } from '$data/leaderboard';
	import { getQuarkShopItem, type BannerDefinition } from '$data/quarkShop';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import type { LeaderboardEntry } from '$lib/types/leaderboard';
	import { leaderboard } from '$stores/leaderboard.svelte';

	interface Props {
		entry: LeaderboardEntry;
		onclick?: () => void;
	}

	let { entry, onclick }: Props = $props();

	const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

	function getBanner(entry: LeaderboardEntry): BannerDefinition | null {
		const bannerId = entry.self ? quarksManager.equippedBanner : entry.equippedBanner;
		if (!bannerId) return null;
		const item = getQuarkShopItem(bannerId);
		return item?.type === 'banner' && item.banner ? item.banner : null;
	}

	let banner = $derived(getBanner(entry));
	let delta = $derived(leaderboard.rankDelta(entry));
	let isNew = $derived(delta === null && !!entry.userId && leaderboard.previousRanks !== null);
	let metal = $derived(podiumColor(entry.rank));
	let lastSeen = $derived(entry.lastSeen ? relativeTime.format(Math.round((entry.lastSeen - Date.now()) / 86_400_000), 'day') : null);
</script>

<svelte:element
	this={onclick ? 'button' : 'div'}
	class="relative isolate flex w-full items-center gap-3 overflow-hidden rounded-xl p-3 text-left transition-[filter] sm:px-4 {entry.self ? 'bg-accent-500/15 ring-2 ring-accent-400' : 'bg-black/25'} {onclick ? 'cursor-pointer hover:brightness-125' : ''}"
	{onclick}
	role={onclick ? 'button' : undefined}
	type={onclick ? 'button' : undefined}
>
	{#if banner}
		<LeaderboardBannerBackdrop {banner} />
	{/if}
	<span class="relative z-10 flex w-9 shrink-0 flex-col items-center gap-0.5 leading-none">
		<span class="text-lg font-black tabular-nums" style:color={metal ?? 'white'}>{entry.rank}</span>
		{#if delta}
			<span class="text-[10px] font-bold tabular-nums {delta > 0 ? 'text-green-400' : 'text-red-400'}" title="Since your last visit">{delta > 0 ? '▲' : '▼'}{Math.abs(delta)}</span>
		{:else if isNew}
			<span class="text-[9px] font-bold tracking-wide text-cyan-300" title="New since your last visit">NEW</span>
		{/if}
	</span>
	<span class="relative z-10 shrink-0 rounded-full" style:box-shadow={metal ? `0 0 0 2px ${metal}, 0 0 12px ${metal}80` : undefined}>
		<Avatar alt={entry.username} class="size-10 text-sm {metal ? '' : 'ring-2 ring-white/10'}" src={entry.picture} />
		{#if entry.is_online}
			<span class="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-green-500 ring-2 ring-black" title="Online"></span>
		{/if}
	</span>
	<span class="relative z-10 flex min-w-0 flex-1 flex-col gap-1">
		<span class="truncate font-bold text-white capitalize">{entry.username}</span>
		<span class="flex min-w-0 items-center gap-2 text-xs text-white/60">
			<LevelChip level={entry.level} />
			{#if lastSeen}
				<span class="truncate" title="Last seen">{entry.is_online ? 'playing now' : lastSeen}</span>
			{/if}
		</span>
	</span>
	<Value class="relative z-10 shrink-0 font-bold text-white tabular-nums" currency={CurrenciesTypes.ATOMS} value={entry.atoms} />
</svelte:element>
