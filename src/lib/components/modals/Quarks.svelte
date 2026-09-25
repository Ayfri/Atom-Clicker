<script lang="ts">
	import Quark from '@components/icons/Quark.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import IconStack from '@components/ui/IconStack.svelte';
	import LeaderboardRow from '@components/ui/LeaderboardRow.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import QuarkLabel from '@components/ui/QuarkLabel.svelte';
	import { getQuestTarget } from '$data/dailyQuests';
	import { CURRENCY_ICON_NAMES } from '$data/icons';
	import { QUARK_SHOP } from '$data/quarkShop';
	import { RealmTypes, type RealmType } from '$data/realms';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { createCurrentPlayerPreview } from '$lib/utils/leaderboard-preview';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import {
		ArrowUpCircle,
		Check,
		Clock,
		Factory,
		Flag,
		Lock,
		MousePointerClick,
		Orbit,
		Palette,
		RotateCcw,
		ShoppingBag,
		Sparkles,
		Target,
		Zap,
	} from '@lucide/svelte';
	import { onMount } from 'svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let activeTab = $state<'banners' | 'quests' | 'shop' | 'themes'>('quests');
	let now = $state(Date.now());

	const shopItems = Object.values(QUARK_SHOP);
	const boostItems = shopItems.filter(item => item.type === 'boost' || item.type === 'convenience');
	const themeItems = shopItems.filter(item => item.type === 'theme');
	const bannerItems = shopItems.filter(item => item.type === 'banner');

	const REALM_ORDER: RealmType[] = [RealmTypes.ATOMS, RealmTypes.PHOTONS, RealmTypes.RADIATION];

	function themesForRealm(realmId: RealmType) {
		return themeItems.filter(item => item.theme?.realmId === realmId);
	}

	function realmTitle(realmId: RealmType) {
		return realmManager.realms.find(r => r.id === realmId)?.title ?? realmId;
	}

	function realmCurrency(realmId: RealmType) {
		return realmManager.realms.find(r => r.id === realmId)?.currency;
	}

	function isRealmUnlocked(realmId: RealmType) {
		return gameManager.realms[realmId]?.unlocked ?? false;
	}

	const QUEST_ICONS: Record<string, typeof Target> = {
		atoms_earned: Zap,
		buildings_purchased: Factory,
		clicks_100: MousePointerClick,
		clicks_250: MousePointerClick,
		electronize_three_times: Orbit,
		higgs_bosons_collected: Sparkles,
		power_ups_collected: Sparkles,
		protonise_once: Orbit,
		upgrades_purchased: ArrowUpCircle,
	};

	const resetIn = $derived.by(() => {
		const nextUtcMidnight = Date.UTC(
			new Date(now).getUTCFullYear(),
			new Date(now).getUTCMonth(),
			new Date(now).getUTCDate() + 1,
		);
		const remainingMs = Math.max(0, nextUtcMidnight - now);
		const hours = Math.floor(remainingMs / 3_600_000);
		const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
		return `${hours}h ${minutes}m`;
	});

	onMount(() => {
		const interval = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(interval);
	});

	function questTarget(quest: (typeof quarksManager.quests)[number]) {
		const frozen = gameManager.dailyStats.questTargets[quest.id];
		return typeof frozen === 'number' ?
			frozen
		:	getQuestTarget(quest, {
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
	}
</script>

{#snippet quarkAmount(amount: number)}
	<span class="inline-flex items-center gap-1 font-mono">
		<Quark size={14} class="shrink-0" />
		{formatNumber(amount)}
	</span>
{/snippet}

<Modal {onClose} width="lg">
	{#snippet header()}
		<div class="flex flex-1 items-center gap-3">
			<Quark size={28} color="white" mono />
			<div class="flex flex-col">
				<h2 class="text-2xl font-bold text-white"><QuarkLabel icon={false} size={20} /></h2>
				<span class="text-sm text-white/60">Balance: {@render quarkAmount(quarksManager.balance)}</span>
			</div>
		</div>
	{/snippet}

	<div class="flex flex-col gap-6">
		{#if !supabaseAuth.isAuthenticated}
			<div class="rounded-lg bg-black/20 p-3 text-sm text-white/60">
				Sign in to claim quests, buy items and equip skins. Progress is still tracked while signed out.
			</div>
		{/if}

		<div class="flex gap-2 border-b border-white/10 pb-2">
			<button
				class="cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors {activeTab === 'quests' ? 'bg-accent-700 text-white' : 'text-white/60 hover:text-white'}"
				onclick={() => (activeTab = 'quests')}
			>
				<Target size={16} /> Quests
			</button>
			<button
				class="cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors {activeTab === 'shop' ? 'bg-accent-700 text-white' : 'text-white/60 hover:text-white'}"
				onclick={() => (activeTab = 'shop')}
			>
				<ShoppingBag size={16} /> Shop
			</button>
			<button
				class="cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors {activeTab === 'themes' ? 'bg-accent-700 text-white' : 'text-white/60 hover:text-white'}"
				onclick={() => (activeTab = 'themes')}
			>
				<Palette size={16} /> Realms Themes
			</button>
			<button
				class="cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors {activeTab === 'banners' ? 'bg-accent-700 text-white' : 'text-white/60 hover:text-white'}"
				onclick={() => (activeTab = 'banners')}
			>
				<Flag size={16} /> Banners
			</button>
		</div>

		{#if activeTab === 'quests'}
			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between gap-3">
					<h3 class="flex items-center gap-1 text-lg font-bold text-white/80">
						Daily Quests
						<HelpIcon>
							{#snippet content()}
								Two quests are picked for you every UTC day, worth 1 <QuarkLabel /> each. The Third Daily Quest shop upgrade
								adds another. Targets scale with your best-ever production so they stay reasonable at any stage.
							{/snippet}
						</HelpIcon>
					</h3>
					<span class="flex items-center gap-1 text-xs text-white/40">
						<Clock size={12} /> Resets in {resetIn}
					</span>
				</div>

				{#each quarksManager.quests as quest (quest.id)}
					{@const target = questTarget(quest)}
					{@const progress = quarksManager.getProgress(quest)}
					{@const claimed = quarksManager.claimedQuestIds.includes(quest.id)}
					{@const complete = progress >= target}
					{@const pending = quarksManager.isActionPending(`claim-quest:${quest.id}`)}
					{@const pct = Math.min(100, (progress / target) * 100)}
					{@const QuestIcon = QUEST_ICONS[quest.id] ?? Target}
					<div
						class="flex flex-col gap-3 rounded-xl border p-4 transition-colors {claimed
							? 'border-white/5 bg-accent-800/30'
							: complete
								? 'border-accent-400/40 bg-accent-800/60'
								: 'border-white/5 bg-accent-800/50'}"
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-start gap-3">
								<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/70">
									<QuestIcon size={16} />
								</div>
								<span class="text-white">{quest.description(target)}</span>
							</div>
							<span class="flex shrink-0 items-center gap-1 text-sm text-white/60">
								+{@render quarkAmount(quest.reward)}
							</span>
						</div>

						<div class="h-2 overflow-hidden rounded-full bg-black/30">
							<div
								class="h-full rounded-full bg-linear-to-r from-[#4a9eff] via-[#3ddc84] to-[#ff4d4d] transition-[clip-path]"
								style:clip-path="inset(0 {100 - pct}% 0 0)"
							></div>
						</div>

						<div class="flex items-center justify-between">
							<span class="text-xs text-white/50">{formatNumber(Math.min(progress, target))} / {formatNumber(target)}</span>
							{#if claimed}
								<span class="flex cursor-default items-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-sm text-white/50">
									<Check size={14} /> Claimed
								</span>
							{:else}
								<button
									class="cursor-pointer rounded-lg bg-accent-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-30"
									disabled={!complete || !supabaseAuth.isAuthenticated || pending}
									onclick={() => quarksManager.claimQuest(quest.id)}
								>
									{pending ? 'Claiming...' : supabaseAuth.isAuthenticated ? 'Claim' : 'Sign in to claim'}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</section>
		{:else if activeTab === 'shop'}
			<section class="flex flex-col gap-3">
				<h3 class="flex items-center gap-1 text-lg font-bold text-white/80">
					Boosts & Convenience
					<HelpIcon>
						{#snippet content()}
							Permanent boosts and convenience unlocks refund at 100%, so your balance is really a limit on how many you can
							equip at once.
						{/snippet}
					</HelpIcon>
				</h3>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each boostItems as item (item.id)}
						{@const owned = quarksManager.entitlements.includes(item.id)}
						<div class="flex flex-col gap-2 rounded-lg bg-accent-800/50 p-3">
							<div class="flex items-center justify-between">
								<span class="flex items-center gap-2 font-medium text-white">
									{#if item.iconStack}
										<IconStack color={item.iconStack.color} count={item.iconStack.count} icon={item.iconStack.icon} label={item.iconStack.label} size={22} />
									{/if}
									{item.name}
								</span>
								<span class="flex items-center gap-1 text-sm text-white/60">{@render quarkAmount(item.cost)}</span>
							</div>
							<p class="text-sm text-white/60">{item.description}</p>
							{#if owned}
								<button
									class="cursor-pointer flex items-center justify-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-sm text-white/70 transition-colors hover:bg-white/20"
									onclick={() => quarksManager.refund(item.id)}
								>
									<RotateCcw size={14} /> Refund
								</button>
							{:else}
								<button
									class="cursor-pointer rounded-lg bg-accent-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-30"
									disabled={quarksManager.balance < item.cost || !supabaseAuth.isAuthenticated}
									onclick={() => quarksManager.purchase(item.id)}
								>
									Buy
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{:else if activeTab === 'themes'}
			<section class="flex flex-col gap-5">
				<h3 class="flex items-center gap-1 text-lg font-bold text-white/80">
					Realms Themes
					<HelpIcon>
						{#snippet content()}
							Cosmetic only, no gameplay effect. Each theme recolors its Realm's background and a couple of accents.
							Themes are permanent once bought and cannot be refunded.
						{/snippet}
					</HelpIcon>
				</h3>
				{#each REALM_ORDER as realmId (realmId)}
					{@const realmThemes = themesForRealm(realmId)}
					{#if realmThemes.length > 0}
						{@const unlocked = isRealmUnlocked(realmId)}
						{@const currency = realmCurrency(realmId)}
						<div class="relative">
							{#if !unlocked}
								<div class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/30 p-4 text-center">
									<span class="flex items-center gap-2 text-sm font-medium text-white/80">
										<Lock size={14} class="shrink-0" /> Progress further in the game to reveal
									</span>
								</div>
							{/if}
							<div
								class="flex flex-col gap-2"
								class:blur-md={!unlocked}
								class:pointer-events-none={!unlocked}
								class:select-none={!unlocked}
								aria-hidden={!unlocked}
							>
								<h4 class="flex items-center gap-1.5 text-sm font-semibold text-white/60">
									{#if currency}
										<IconStack color={currency.color} icon={CURRENCY_ICON_NAMES[currency.name]} size={16} />
									{/if}
									{realmTitle(realmId)}
									{#if !unlocked}<Lock size={12} />{/if}
								</h4>
								<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
									{#each realmThemes as item (item.id)}
										{@const owned = quarksManager.entitlements.includes(item.id)}
										{@const equipped = quarksManager.equippedThemes[realmId] === item.id}
										{@const purchasePending = quarksManager.isActionPending(`purchase:${item.id}`)}
										{@const equipPending = quarksManager.isActionPending(`equip-theme:${realmId}`)}
										<div
											class="flex flex-col gap-2 rounded-lg border p-3 transition-colors {equipped
												? 'border-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-300/30'
												: owned
													? 'border-emerald-400/60 bg-emerald-500/8'
													: 'border-white/10 bg-accent-800/50'}"
										>
											<div
												class="h-12 rounded-lg"
												style="background: linear-gradient(135deg, {item.theme?.accent}, {item.theme?.accentSecondary ?? item.theme?.accent})"
											></div>
											<div class="flex items-center justify-between gap-2">
												<span class="font-medium text-white">{item.name}</span>
												<span class="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold {equipped ? 'bg-emerald-300 text-emerald-950' : owned ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/8 text-white/45'}">
													{#if owned}<Check size={12} />{/if}
													{equipped ? 'Equipped' : owned ? 'Owned' : 'Not owned'}
												</span>
											</div>
											<p class="text-sm text-white/60">{item.description}</p>
											<div class="flex items-center justify-between">
												<span class="flex items-center gap-1 text-sm text-white/60">{@render quarkAmount(item.cost)}</span>
												{#if owned}
													<button
														class="cursor-pointer rounded-lg px-3 py-1 text-sm font-medium transition-colors {equipped ? 'bg-white/10 text-white/50' : 'bg-accent-600 text-white hover:bg-accent-500'}"
														disabled={equipPending}
														onclick={() => quarksManager.equipTheme(realmId, equipped ? null : item.id)}
													>
														{equipPending ? 'Applying...' : equipped ? 'Equipped' : 'Equip'}
													</button>
												{:else}
													<button
														class="cursor-pointer flex items-center gap-1 rounded-lg bg-accent-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-30"
														disabled={quarksManager.balance < item.cost || !supabaseAuth.isAuthenticated || purchasePending}
														onclick={() => quarksManager.purchase(item.id)}
													>
														{supabaseAuth.isAuthenticated ? purchasePending ? 'Buying...' : 'Buy' : ''}
														{#if !supabaseAuth.isAuthenticated}<Lock size={14} />{/if}
													</button>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				{/each}
				<p class="text-xs text-white/40">Themes are permanent and cannot be refunded.</p>
			</section>
		{:else if activeTab === 'banners'}
			<section class="flex flex-col gap-3">
				<h3 class="flex items-center gap-1 text-lg font-bold text-white/80">
					Banners
					<HelpIcon>
						{#snippet content()}
							Cosmetic only, no gameplay effect. Banners are permanent once bought and show behind your row on the
							leaderboard.
						{/snippet}
					</HelpIcon>
				</h3>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each bannerItems as item (item.id)}
						{@const owned = quarksManager.entitlements.includes(item.id)}
						{@const equipped = quarksManager.equippedBanner === item.id}
							{@const purchasePending = quarksManager.isActionPending(`purchase:${item.id}`)}
							{@const equipPending = quarksManager.isActionPending('equip-banner')}
							<div
								class="flex flex-col gap-2 rounded-lg border p-3 transition-colors {equipped
									? 'border-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-300/30'
									: owned
										? 'border-emerald-400/60 bg-emerald-500/8'
										: 'border-white/10 bg-accent-800/50'}"
							>
							<LeaderboardRow entry={createCurrentPlayerPreview(item.id)} />
								<div class="flex items-center justify-between gap-2">
									<span class="font-medium text-white">{item.name}</span>
									<span class="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold {equipped ? 'bg-emerald-300 text-emerald-950' : owned ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/8 text-white/45'}">
										{#if owned}<Check size={12} />{/if}
										{equipped ? 'Equipped' : owned ? 'Owned' : 'Not owned'}
									</span>
								</div>
							<p class="text-sm text-white/60">{item.description}</p>
							<div class="flex items-center justify-between">
								<span class="flex items-center gap-1 text-sm text-white/60">{@render quarkAmount(item.cost)}</span>
								{#if owned}
									<button
										class="cursor-pointer rounded-lg px-3 py-1 text-sm font-medium transition-colors {equipped ? 'bg-white/10 text-white/50' : 'bg-accent-600 text-white hover:bg-accent-500'}"
										disabled={equipPending}
										onclick={() => quarksManager.equipBanner(equipped ? null : item.id)}
									>
										{equipPending ? 'Applying...' : equipped ? 'Equipped' : 'Equip'}
									</button>
								{:else}
									<button
										class="cursor-pointer flex items-center gap-1 rounded-lg bg-accent-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-30"
										disabled={quarksManager.balance < item.cost || !supabaseAuth.isAuthenticated || purchasePending}
										onclick={() => quarksManager.purchase(item.id)}
									>
										{supabaseAuth.isAuthenticated ? purchasePending ? 'Buying...' : 'Buy' : ''}
										{#if !supabaseAuth.isAuthenticated}<Lock size={14} />{/if}
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				<p class="text-xs text-white/40">Banners are permanent and cannot be refunded.</p>
			</section>
		{/if}
	</div>
</Modal>
