<script lang="ts">
	import LeaderboardRow from '@components/ui/LeaderboardRow.svelte';
	import { getQuestTarget, pickDailyQuests } from '$data/dailyQuests';
	import { QUARK_SHOP, type QuarkShopItem } from '$data/quarkShop';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { createCurrentPlayerPreview } from '$lib/utils/leaderboard-preview';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { Calendar, Gem, ShoppingBag, Sparkles, Target, Wifi, WifiOff, Zap } from '@lucide/svelte';

	const shopItems = Object.values(QUARK_SHOP);

	let inspectorDate = $state(new Date().toISOString().slice(0, 10));
	const inspectorQuests = $derived(pickDailyQuests(inspectorDate, quarksManager.dailyQuestCount, quarksManager.dailyQuestContext));

	function getItemTypeLabel(item: QuarkShopItem): string {
		switch (item.type) {
			case 'banner':
				return 'Banner';
			case 'boost':
				return 'Boost';
			case 'convenience':
				return 'Convenience';
			case 'theme':
				return 'Realms Themes';
		}
	}

	function getThemeRealmLabel(item: QuarkShopItem): string {
		return item.theme?.realmId === 'photons' ? 'Photon Realm' : item.theme?.realmId === 'radiation' ? 'Radiation Realm' : 'Atom Realm';
	}

	function completeQuest(questId: string) {
		const quest = quarksManager.quests.find(q => q.id === questId);
		if (!quest) return;
		const target = quarksManager.getTarget(quest);
		gameManager.dailyStats = { ...gameManager.dailyStats, [quest.metric]: target };
	}

	function resetDailyStats() {
		gameManager.dailyStats = {
			achievementsUnlocked: 0,
			atomsEarned: 0,
			generatorsPurchased: 0,
			clicks: 0,
			dayKey: gameManager.dailyStats.dayKey,
			electronizes: 0,
			higgsBosonsCollected: 0,
			otherDailyQuestsCompleted: 0,
			powerUpsCollected: 0,
			protonises: 0,
			questIds: gameManager.dailyStats.questIds,
			questTargets: gameManager.dailyStats.questTargets,
			upgradesPurchased: 0,
		};
	}

	function simulateDayRollover() {
		const [year, month, day] = quarksManager.dayKey.split('-').map(Number);
		const nextDate = new Date(Date.UTC(year || new Date().getUTCFullYear(), (month || 1) - 1, (day || 1) + 1));
		quarksManager.dayKey = nextDate.toISOString().slice(0, 10);
		quarksManager.quests = pickDailyQuests(quarksManager.dayKey, quarksManager.dailyQuestCount, quarksManager.dailyQuestContext);
		quarksManager.claimedQuestIds = [];
		resetDailyStats();
	}
</script>

<div class="space-y-6">
	<!-- Summary Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1.5">
			<div class="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-1.5">
				{#if supabaseAuth.isAuthenticated}<Wifi size={12} />{:else}<WifiOff size={12} />{/if}
				Status
			</div>
			<div class="text-xl font-bold {supabaseAuth.isAuthenticated ? 'text-green-400' : 'text-red-400'}">
				{supabaseAuth.isAuthenticated ? 'Signed in' : 'Signed out'}
			</div>
			<label class="flex items-center gap-1.5 text-[10px] font-bold text-white/60 cursor-pointer">
				<input type="checkbox" checked={quarksManager.devOverride} onchange={e => quarksManager.setDevOverride(e.currentTarget.checked)} />
				Local override mode
			</label>
			{#if quarksManager.lastSyncError}
				<div class="text-[10px] text-red-400">{quarksManager.lastSyncError}</div>
			{/if}
			<button class="text-[10px] font-bold text-accent-400 hover:underline cursor-pointer" onclick={() => quarksManager.sync()}>
				Sync now
			</button>
		</div>

		<div class="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1.5">
			<div class="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-1.5">
				<Gem size={12} />
				Balance
			</div>
			<div class="text-xl font-bold text-white font-mono">{formatNumber(quarksManager.balance)}</div>
			{#if quarksManager.devOverride}
				<div class="flex flex-wrap gap-1">
					<button
						class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
						onclick={() => (quarksManager.balance += 1)}
					>
						+1
					</button>
					<button
						class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
						onclick={() => (quarksManager.balance += 5)}
					>
						+5
					</button>
					<button
						class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
						onclick={() => (quarksManager.balance += 25)}
					>
						+25
					</button>
					<button
						class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
						onclick={() => (quarksManager.balance = 0)}
					>
						Reset
					</button>
				</div>
			{/if}
		</div>

		<div class="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1.5">
			<div class="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-1.5">
				<Calendar size={12} />
				Day Key
			</div>
			<div class="text-xl font-bold text-blue-400 font-mono">{quarksManager.dayKey || '-'}</div>
			<button class="text-[10px] font-bold text-accent-400 hover:underline cursor-pointer" onclick={simulateDayRollover}>
				Simulate day rollover
			</button>
		</div>

		<div class="bg-white/5 p-4 rounded-xl border border-white/5 space-y-1.5">
			<div class="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-1.5">
				<Sparkles size={12} />
				Entitlements
			</div>
			<div class="text-xl font-bold text-white font-mono">{quarksManager.entitlements.length}</div>
			<button class="text-[10px] font-bold text-accent-400 hover:underline cursor-pointer" onclick={resetDailyStats}>
				Reset daily stats
			</button>
		</div>
	</div>

	<!-- Quests -->
	<section class="space-y-2">
		<h3 class="text-sm font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
			<Target size={14} /> Today's Quests
		</h3>
		<div class="space-y-1.5">
			{#each quarksManager.quests as quest (quest.id)}
				{@const target = quarksManager.getTarget(quest)}
					{@const progress = quarksManager.getProgress(quest)}
				{@const pct = Math.min(100, (progress / target) * 100)}
				{@const claimed = quarksManager.claimedQuestIds.includes(quest.id)}
				<div class="flex flex-col gap-1.5 bg-white/5 rounded-lg px-3 py-2 text-xs">
					<div class="flex items-center justify-between gap-2">
						<span class="text-white/70">{quest.description(target)}</span>
						<div class="flex shrink-0 items-center gap-2">
							<span class="font-mono text-white/40">{formatNumber(Math.min(progress, target))} / {formatNumber(target)}</span>
							{#if claimed}
								<span class="text-[10px] text-green-400">Claimed</span>
							{:else}
								<button
									class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
									onclick={() => completeQuest(quest.id)}
								>
									Complete
								</button>
							{/if}
						</div>
					</div>
					<div class="h-1.5 overflow-hidden rounded-full bg-black/30">
						<div
							class="h-full rounded-full bg-linear-to-r from-[#4a9eff] via-[#3ddc84] to-[#ff4d4d]"
							style:clip-path="inset(0 {100 - pct}% 0 0)"
						></div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Shop -->
	<section class="space-y-2">
		<h3 class="text-sm font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
			<ShoppingBag size={14} /> Shop
		</h3>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
			{#each shopItems as item (item.id)}
				{@const owned = quarksManager.entitlements.includes(item.id)}
				<div class="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 text-xs">
					<div class="h-10 w-40 shrink-0 overflow-hidden rounded-md border border-white/10">
						{#if item.type === 'banner' && item.banner}
							<div class="w-[250%] origin-top-left scale-[0.4]">
								<LeaderboardRow entry={createCurrentPlayerPreview(item.id)} />
							</div>
						{:else if item.type === 'theme' && item.theme}
							<div class="relative h-12 overflow-hidden p-2" style="background-image: {item.theme.background}">
								<div class="absolute inset-x-0 top-0 h-0.5" style:background-color={item.theme.accent}></div>
								<div class="relative flex h-full flex-col justify-end">
									<span class="text-[9px] font-bold text-white">{getThemeRealmLabel(item)}</span>
									<span class="text-[8px] text-white/60">{item.name}</span>
								</div>
							</div>
						{:else}
							<div class="flex h-12 items-center gap-2 bg-black/20 px-3">
								<Zap size={15} class={item.type === 'boost' ? 'text-yellow-300' : 'text-accent-300'} />
								<span class="text-[9px] font-semibold text-white/70">{item.type === 'boost' ? 'Permanent bonus' : 'Quality of life'}</span>
							</div>
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="font-medium text-white/70">{item.name}</span>
							<span class="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50">{getItemTypeLabel(item)}</span>
						</div>
						<div class="mt-1 text-white/30">{item.cost} quarks</div>
					</div>
					<div class="flex gap-1 shrink-0">
						{#if item.type === 'theme' && item.theme}
							{@const realmId = item.theme.realmId}
							{@const previewing = quarksManager.equippedThemes[realmId] === item.id}
							<button
								class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
								onclick={() => quarksManager.previewTheme(realmId, previewing ? null : item.id)}
							>
								{previewing ? 'Stop preview' : 'Preview'}
							</button>
						{/if}
						{#if item.type === 'banner'}
							<button
								class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
								onclick={() => quarksManager.previewBanner(quarksManager.equippedBanner === item.id ? null : item.id)}
							>
								{quarksManager.equippedBanner === item.id ? 'Stop preview' : 'Preview'}
							</button>
						{/if}
						{#if owned}
							<button
								class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
								onclick={() => (quarksManager.entitlements = quarksManager.entitlements.filter(id => id !== item.id))}
							>
								Revoke
							</button>
						{:else}
							<button
								class="text-[10px] bg-white/5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
								onclick={() => (quarksManager.entitlements = [...quarksManager.entitlements, item.id])}
							>
								Grant
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Quest pool inspector -->
	<section class="space-y-2">
		<h3 class="text-sm font-black uppercase tracking-widest text-white/40">Quest Pool Inspector</h3>
		<input type="date" bind:value={inspectorDate} class="bg-white/5 rounded-lg px-3 py-1 text-xs text-white" />
		<div class="space-y-1">
			{#each inspectorQuests as quest (quest.id)}
				{@const anchors = { achievementsUnlocked: 0, atomsEarned: gameManager.highestAPS, generatorsPurchased: 0, clicks: 0, electronizes: 0, higgsBosonsCollected: 0, otherDailyQuestsCompleted: 0, powerUpsCollected: 0, protonises: 0, upgradesPurchased: 0 }}
				<div class="bg-white/5 rounded-lg px-3 py-2 text-xs text-white/70">
					{quest.id} - target {formatNumber(getQuestTarget(quest, anchors))}
				</div>
			{/each}
		</div>
	</section>
</div>
