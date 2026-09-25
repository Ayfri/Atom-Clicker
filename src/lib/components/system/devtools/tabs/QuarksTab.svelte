<script lang="ts">
	import { type DailyQuestAnchors, getQuestTarget, pickDailyQuests } from '$data/dailyQuests';
	import { QUARK_SHOP } from '$data/quarkShop';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { statsConfig } from '$helpers/statConstants';
	import { formatNumber } from '$lib/utils';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { btn, checkbox, field, toggled } from '../shared.svelte';
	import NumberInput from '../NumberInput.svelte';
	import Section from '../Section.svelte';

	const shopItems = Object.values(QUARK_SHOP);

	let inspectorDate = $state(new Date().toISOString().slice(0, 10));
	const inspectorQuests = $derived(pickDailyQuests(inspectorDate, quarksManager.dailyQuestCount, quarksManager.dailyQuestContext));
	const inspectorAnchors = $derived<DailyQuestAnchors>({
		achievementsUnlocked: 0,
		atomsEarned: gameManager.highestAPS,
		clicks: 0,
		electronizes: 0,
		generatorsPurchased: 0,
		higgsBosonsCollected: 0,
		otherDailyQuestsCompleted: 0,
		powerUpsCollected: 0,
		protonises: 0,
		upgradesPurchased: 0,
	});

	function resetDailyStats() {
		const { dayKey, questIds, questTargets } = gameManager.dailyStats;
		gameManager.dailyStats = { ...statsConfig.dailyStats.defaultValue, dayKey, questIds, questTargets };
	}

	function simulateDayRollover() {
		const next = new Date(`${quarksManager.dayKey || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
		next.setUTCDate(next.getUTCDate() + 1);
		quarksManager.dayKey = next.toISOString().slice(0, 10);
		quarksManager.quests = pickDailyQuests(quarksManager.dayKey, quarksManager.dailyQuestCount, quarksManager.dailyQuestContext);
		quarksManager.claimedQuestIds = [];
		resetDailyStats();
	}
</script>

<Section title="Account">
	{#snippet actions()}
		<button class={btn} onclick={() => quarksManager.sync()}>Sync</button>
	{/snippet}
	<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs text-white/70">
		<span>Status</span>
		<span class={supabaseAuth.isAuthenticated ? 'text-green-400' : 'text-red-300'}>
			{supabaseAuth.isAuthenticated ? 'Signed in' : 'Signed out'}
			{#if quarksManager.lastSyncError}<span class="text-red-400"> - {quarksManager.lastSyncError}</span>{/if}
		</span>
		<span>Local override</span>
		<label class="flex items-center gap-2 text-white/40">
			<input checked={quarksManager.devOverride} class={checkbox} onchange={e => quarksManager.setDevOverride(e.currentTarget.checked)} type="checkbox" />
			in-memory only, needed to edit the balance
		</label>
		<span>Balance</span>
		{#if quarksManager.devOverride}
			<NumberInput onCommit={value => (quarksManager.balance = Math.max(0, Math.round(value)))} value={quarksManager.balance} />
		{:else}
			<span class="font-mono text-white">{formatNumber(quarksManager.balance)}</span>
		{/if}
		<span>Day</span>
		<span class="flex items-center gap-1">
			<span class="font-mono text-white">{quarksManager.dayKey || '-'}</span>
			<button class="{btn} ml-auto" onclick={simulateDayRollover}>Next day</button>
			<button class={btn} onclick={resetDailyStats}>Reset daily stats</button>
		</span>
	</div>
</Section>

<Section title="Today's quests">
	<div class="flex flex-col gap-1">
		{#each quarksManager.quests as quest (quest.id)}
			{@const target = quarksManager.getTarget(quest)}
			{@const progress = Math.min(quarksManager.getProgress(quest), target)}
			<div class="flex items-center gap-2 text-xs">
				<div class="min-w-0 flex-1">
					<p class="truncate text-white/70">{quest.description(target)}</p>
					<div class="h-1 overflow-hidden rounded-full bg-black/40">
						<div class="h-full bg-accent-400" style:width="{(progress / target) * 100}%"></div>
					</div>
				</div>
				<span class="font-mono text-[10px] text-white/40">{formatNumber(progress)}/{formatNumber(target)}</span>
				{#if quarksManager.claimedQuestIds.includes(quest.id)}
					<span class="w-16 text-center text-[10px] text-green-400">Claimed</span>
				{:else}
					<button
						class="{btn} w-16"
						onclick={() => (gameManager.dailyStats = { ...gameManager.dailyStats, [quest.metric]: target })}
					>
						Complete
					</button>
				{/if}
			</div>
		{/each}
	</div>
</Section>

<Section title="Shop ({quarksManager.entitlements.length}/{shopItems.length} owned)">
	<div class="flex flex-col gap-1">
		{#each shopItems as item (item.id)}
			{@const owned = quarksManager.entitlements.includes(item.id)}
			<div class="flex items-center gap-2 text-xs">
				{#if item.theme}
					<span class="size-4 shrink-0 rounded border border-white/20" style:background-image={item.theme.background}></span>
				{:else}
					<span class="size-4 shrink-0 rounded border border-white/10 bg-white/5"></span>
				{/if}
				<span class="min-w-0 flex-1 truncate {owned ? 'text-white' : 'text-white/50'}">
					{item.name} <span class="text-[10px] text-white/30 uppercase">{item.type} {item.cost}q</span>
				</span>
				{#if item.theme}
					{@const realmId = item.theme.realmId}
					{@const previewing = quarksManager.equippedThemes[realmId] === item.id}
					<button class={btn} onclick={() => quarksManager.previewTheme(realmId, previewing ? null : item.id)}>{previewing ? 'Unpreview' : 'Preview'}</button>
				{:else if item.type === 'banner'}
					{@const previewing = quarksManager.equippedBanner === item.id}
					<button class={btn} onclick={() => quarksManager.previewBanner(previewing ? null : item.id)}>{previewing ? 'Unpreview' : 'Preview'}</button>
				{/if}
				<button class="{btn} w-14" onclick={() => (quarksManager.entitlements = toggled(quarksManager.entitlements, item.id))}>
					{owned ? 'Revoke' : 'Grant'}
				</button>
			</div>
		{/each}
	</div>
</Section>

<Section collapsed title="Quest pool inspector">
	<input bind:value={inspectorDate} class="{field} mb-1.5 w-auto" type="date" />
	<div class="flex flex-col gap-0.5 font-mono text-[11px] text-white/60">
		{#each inspectorQuests as quest (quest.id)}
			<span>{quest.id} <span class="text-white/30">target {formatNumber(getQuestTarget(quest, inspectorAnchors))}</span></span>
		{/each}
	</div>
</Section>
