<script lang="ts">
	import AtomIcon from '#components/icons/Atom.svelte';
	import HiggsBosonIcon from '#components/icons/HiggsBoson.svelte';
	import Journey from '#components/profile/Journey.svelte';
	import Lifetime from '#components/profile/Lifetime.svelte';
	import StatTiles, { type StatTile } from '#components/profile/StatTiles.svelte';
	import Avatar from '#components/ui/Avatar.svelte';
	import LeaderboardBannerBackdrop from '#components/ui/LeaderboardBannerBackdrop.svelte';
	import LevelChip from '#components/ui/LevelChip.svelte';
	import Value from '#components/ui/Value.svelte';
	import { ACHIEVEMENTS } from '#data/achievements.js';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { GENERATOR_COLORS, GENERATOR_TYPES, GENERATORS } from '#data/generators.js';
	import { podiumColor } from '#data/leaderboard.js';
	import { getQuarkShopItem } from '#data/quarkShop.js';
	import { RealmTypes } from '#data/realms.js';
	import { SKILL_UPGRADES } from '#data/skillTree.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import type { LeaderboardEntry, PublicProfile, PublicProfileStats } from '#lib/types/leaderboard.js';
	import { formatDuration, formatNumber } from '#lib/utils.js';
	import { leaderboard } from '#stores/leaderboard.svelte.js';
	import { ui } from '#stores/ui.svelte.js';
	import { Clock, MousePointerClick, Network, Pencil, Trophy } from '@lucide/svelte';

	interface Props {
		entry: LeaderboardEntry;
	}

	let { entry }: Props = $props();

	const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
	const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	const totalAchievements = Object.keys(ACHIEVEMENTS).length;
	const totalSkills = Object.keys(SKILL_UPGRADES).length;

	async function loadProfile(userId: string | undefined): Promise<PublicProfile | null> {
		if (!userId) return null;
		const response = await fetch(`/api/profile/${userId}`);
		if (!response.ok) throw new Error('Failed to load profile');
		return response.json();
	}

	function tilesOf(stats: PublicProfileStats): StatTile[] {
		return [
			{ icon: Clock, label: 'Play time', value: formatDuration(stats.playTime) },
			{ icon: MousePointerClick, label: 'Clicks', value: formatNumber(stats.clicks) },
			{ icon: Trophy, label: 'Achievements', value: `${stats.achievements.filter(id => id in ACHIEVEMENTS).length} / ${totalAchievements}` },
			{ icon: Network, label: 'Skills', value: `${stats.skills.filter(id => id in SKILL_UPGRADES).length} / ${totalSkills}` },
			{ icon: AtomIcon, label: 'Best atoms / s', value: formatNumber(stats.highestAPS) },
			{ icon: HiggsBosonIcon, label: 'Higgs Boson caught', value: formatNumber(stats.lifetime[CurrenciesTypes.HIGGS_BOSON] ?? 0) },
		];
	}

	/** A primitive, so a leaderboard refresh handing over a fresh entry object never refetches the same player. */
	const userId = $derived(entry.userId);
	const request = $derived(loadProfile(userId));
	const banner = $derived.by(() => {
		const item = getQuarkShopItem((entry.self ? quarksManager.equippedBanner : entry.equippedBanner) ?? '');
		return item?.type === 'banner' ? item.banner : undefined;
	});
	const metal = $derived(podiumColor(entry.rank));
	const percentile = $derived(leaderboard.percentile(entry.rank));
	const lastSeen = $derived(relativeTime.format(Math.round((entry.lastSeen - Date.now()) / 86_400_000), 'day'));
</script>

<div class="flex flex-col gap-4">
	<section class="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
		<div class="relative isolate h-24 overflow-hidden bg-linear-to-br from-accent-600/40 to-black/40 sm:h-28">
			{#if banner}
				<LeaderboardBannerBackdrop {banner} />
			{/if}
		</div>
		<div class="relative -mt-10 flex flex-col items-center gap-3 px-4 pb-4 text-center sm:-mt-12 sm:flex-row sm:items-end sm:text-left">
			<span class="relative shrink-0 rounded-full ring-4 ring-accent-900" style:box-shadow={metal ? `0 0 0 7px ${metal}, 0 0 28px ${metal}80` : undefined}>
				<Avatar alt={entry.username} class="size-20 text-2xl sm:size-24" src={entry.picture} />
				{#if entry.is_online}
					<span class="absolute right-1 bottom-1 size-4 rounded-full bg-green-500 ring-3 ring-accent-900" title="Online"></span>
				{/if}
			</span>
			<div class="flex min-w-0 flex-1 flex-col items-center gap-1 sm:items-start">
				<h3 class="max-w-full truncate text-2xl font-bold text-white capitalize">{entry.username}</h3>
				<p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/50 sm:justify-start">
					<LevelChip level={entry.level} />
					{#if entry.is_online}
						<span class="font-semibold text-green-400">Online now</span>
					{:else}
						<span>Seen {lastSeen}</span>
					{/if}
					{#await request then profile}
						{#if profile?.joinedAt}
							<span>· Joined {dateFormat.format(profile.joinedAt)}</span>
						{/if}
					{/await}
				</p>
			</div>
			<div class="flex shrink-0 flex-col items-center leading-none sm:items-end">
				<span class="text-4xl font-black tabular-nums" style:color={metal ?? 'white'}>#{entry.rank}</span>
				{#if percentile}
					<span class="mt-1 text-xs font-semibold text-white/50">Top {percentile}%</span>
				{/if}
			</div>
		</div>
		<div class="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-4 py-3">
			<span class="text-xs font-semibold tracking-wider text-white/40 uppercase">Leaderboard score</span>
			<Value class="text-lg font-bold text-accent-300 tabular-nums" currency={CurrenciesTypes.ATOMS} value={entry.atoms} />
		</div>
	</section>

	{#if entry.self}
		<button
			class="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
			onclick={() => ui.openSettings('profile')}
		>
			<Pencil size={16} />
			Edit your profile
		</button>
	{/if}

	{#await request}
		<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
			{#each { length: 6 }, index (index)}
				<div class="h-15 animate-pulse rounded-xl bg-white/5"></div>
			{/each}
		</div>
	{:then profile}
		{#if profile?.stats}
			{const stats = $derived(profile.stats)}
			{const owned = $derived(GENERATOR_TYPES.filter(type => (stats.generators[type] ?? 0) > 0))}
			{const totalGenerators = $derived(owned.reduce((sum, type) => sum + (stats.generators[type] ?? 0), 0))}
			<StatTiles tiles={tilesOf(stats)} />

			<Journey
				electronizes={stats.electronizes}
				photonRealm={stats.realms.includes(RealmTypes.PHOTONS)}
				protonizes={stats.protonizes}
				radiationRealm={stats.realms.includes(RealmTypes.RADIATION)}
			/>

			{#if totalGenerators > 0}
				<section class="rounded-2xl border border-white/10 bg-black/20 p-4">
					<h3 class="mb-3 flex items-baseline justify-between text-xs font-semibold tracking-wider text-white/40 uppercase">
						Generators
						<span class="text-sm font-bold text-white tabular-nums">{formatNumber(totalGenerators)}</span>
					</h3>
					<div class="flex h-3 gap-px overflow-hidden rounded-full bg-white/10">
						{#each owned as type (type)}
							<span class="h-full" style:background={GENERATOR_COLORS[GENERATOR_TYPES.indexOf(type)]} style:flex-grow={stats.generators[type]}></span>
						{/each}
					</div>
					<ul class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
						{#each owned as type (type)}
							<li class="flex items-center gap-2 text-white/60">
								<span class="size-2 shrink-0 rounded-full" style:background={GENERATOR_COLORS[GENERATOR_TYPES.indexOf(type)]}></span>
								<span class="truncate">{GENERATORS[type].name}</span>
								<b class="ml-auto text-white tabular-nums">{formatNumber(stats.generators[type] ?? 0)}</b>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<Lifetime earned={stats.lifetime} />
		{:else if profile}
			<p class="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/50">This player has no cloud save yet, so their stats stay private until they upload one.</p>
		{/if}
	{:catch}
		<p class="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/50">Couldn't load this profile, try again in a moment.</p>
	{/await}
</div>
