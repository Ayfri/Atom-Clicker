<script lang="ts">
	import Avatar from '#components/ui/Avatar.svelte';
	import LeaderboardBannerBackdrop from '#components/ui/LeaderboardBannerBackdrop.svelte';
	import LevelChip from '#components/ui/LevelChip.svelte';
	import Value from '#components/ui/Value.svelte';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { podiumColor } from '#data/leaderboard.js';
	import { getQuarkShopItem } from '#data/quarkShop.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import type { LeaderboardEntry } from '#lib/types/leaderboard.js';
	import { Crown } from '@lucide/svelte';

	interface Props {
		entries: LeaderboardEntry[];
		onselect: (entry: LeaderboardEntry) => void;
	}

	let { entries, onselect }: Props = $props();

	/** Second, first, third from left to right, the classic podium order. */
	const STEPS = [
		{ avatar: 'size-12 sm:size-16', delay: 120, index: 1, pedestal: 'h-14 sm:h-16' },
		{ avatar: 'size-16 sm:size-20', delay: 0, index: 0, pedestal: 'h-20 sm:h-24' },
		{ avatar: 'size-12 sm:size-16', delay: 240, index: 2, pedestal: 'h-10 sm:h-12' },
	] as const;

	function bannerOf(entry: LeaderboardEntry) {
		const item = getQuarkShopItem((entry.self ? quarksManager.equippedBanner : entry.equippedBanner) ?? '');
		return item?.type === 'banner' ? item.banner : undefined;
	}
</script>

<div class="podium grid grid-cols-3 items-end gap-2 px-1 pt-4 pb-2 sm:gap-4">
	{#each STEPS as step (step.index)}
		{const entry = $derived(entries[step.index])}
		{#if entry}
			{const metal = $derived(podiumColor(entry.rank) ?? 'white')}
			{const banner = $derived(bannerOf(entry))}
			<button class="group flex min-w-0 flex-col items-center gap-1.5 text-center" onclick={() => onselect(entry)} type="button">
				<span class="relative">
					{#if entry.rank === 1}
						<Crown class="crown absolute -top-6 left-1/2 -translate-x-1/2 drop-shadow-[0_0_8px_#facc15aa]" color={metal} fill={metal} size={22} />
					{/if}
					<span class="block rounded-full transition-transform group-hover:scale-105" style:box-shadow="0 0 0 3px {metal}, 0 0 22px {metal}66">
						<Avatar alt={entry.username} class="{step.avatar} text-lg" src={entry.picture} />
					</span>
					{#if entry.is_online}
						<span class="absolute right-0.5 bottom-0.5 size-3.5 rounded-full bg-green-500 ring-2 ring-black" aria-label="Online" role="img" title="Online"></span>
					{/if}
				</span>
				<span class={['w-full truncate text-sm font-bold capitalize sm:text-base', entry.self ? 'text-accent-200' : 'text-white']}>{entry.username}</span>
				<LevelChip level={entry.level} />
				<Value class="text-xs font-bold text-white/80 tabular-nums sm:text-sm" currency={CurrenciesTypes.ATOMS} value={entry.atoms} />
				<span class="pedestal relative isolate mt-1 flex w-full items-start justify-center overflow-hidden rounded-t-xl bg-white/5 pt-1 {step.pedestal}" style:--delay="{step.delay}ms">
					{#if banner}
						<LeaderboardBannerBackdrop {banner} class="opacity-70" />
					{/if}
					<span class="absolute inset-x-0 top-0 h-0.5" style:background={metal}></span>
					<span class="relative text-2xl font-black tabular-nums sm:text-3xl" style:color={metal} style:text-shadow="0 2px 10px {metal}80">{entry.rank}</span>
				</span>
			</button>
		{/if}
	{/each}
</div>

<style>
	.pedestal {
		animation: pedestal-rise 500ms cubic-bezier(0.2, 0.9, 0.3, 1.2) var(--delay) backwards;
		transform-origin: bottom;
	}

	/* Animates transform, Tailwind's centering lives on the separate translate property. */
	.podium :global(.crown) {
		animation: crown-drop 600ms cubic-bezier(0.3, 1.4, 0.5, 1) 300ms backwards;
	}

	@keyframes pedestal-rise {
		from {
			transform: scaleY(0);
		}
	}

	@keyframes crown-drop {
		from {
			opacity: 0;
			transform: translateY(-12px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pedestal,
		.podium :global(.crown) {
			animation: none;
		}
	}
</style>
