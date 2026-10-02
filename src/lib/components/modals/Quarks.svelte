<script lang="ts">
	import AtomIcon from '#components/icons/Atom.svelte';
	import ElectronizeIcon from '#components/icons/Electronize.svelte';
	import HiggsBosonIcon from '#components/icons/HiggsBoson.svelte';
	import ProtoniseIcon from '#components/icons/Protonise.svelte';
	import Quark from '#components/icons/Quark.svelte';
	import Login from '#components/modals/Login.svelte';
	import HelpIcon from '#components/ui/HelpIcon.svelte';
	import IconStack from '#components/ui/IconStack.svelte';
	import LeaderboardRow from '#components/ui/LeaderboardRow.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import QuarkLabel from '#components/ui/QuarkLabel.svelte';
	import { CURRENCY_ICON_NAMES, type IconComponent } from '#data/icons.js';
	import { QUARK_CHARGE_COLORS } from '#data/quarks.js';
	import { QUARK_SHOP, type QuarkShopItem } from '#data/quarkShop.js';
	import { RealmTypes } from '#data/realms.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import { createCurrentPlayerPreview } from '#lib/utils/leaderboard-preview.js';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import {
		Check,
		CircleArrowUp,
		Clock,
		Factory,
		Flag,
		Lock,
		LogIn,
		MousePointerClick,
		Palette,
		ShoppingBag,
		Target,
		Undo2,
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { scale } from 'svelte/transition';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	type Tab = 'banners' | 'quests' | 'shop' | 'themes';

	const TABS: { icon: typeof Target; id: Tab; label: string }[] = [
		{ icon: Target, id: 'quests', label: 'Quests' },
		{ icon: ShoppingBag, id: 'shop', label: 'Shop' },
		{ icon: Palette, id: 'themes', label: 'Themes' },
		{ icon: Flag, id: 'banners', label: 'Banners' },
	];

	let activeTab = $state<Tab>('quests');
	let now = $state(Date.now());
	let showLogin = $state(false);

	const canAct = $derived(supabaseAuth.isAuthenticated || quarksManager.devOverride);
	const claimedCount = $derived(quarksManager.quests.filter(quest => quarksManager.claimedQuestIds.includes(quest.id)).length);
	const pop = $derived({ duration: prefersReducedMotion.current ? 0 : 250, start: 1.3 });

	const shopItems = Object.values(QUARK_SHOP);
	const boostItems = shopItems.filter(item => item.type === 'boost' || item.type === 'convenience');
	const bannerItems = shopItems.filter(item => item.type === 'banner');
	const realmSections = [RealmTypes.ATOMS, RealmTypes.PHOTONS, RealmTypes.RADIATION]
		.map(id => ({
			id,
			realm: realmManager.realms.find(r => r.id === id),
			themes: shopItems.filter(item => item.theme?.realmId === id),
		}))
		.filter(section => section.themes.length > 0);

	const QUEST_ICONS: Record<string, IconComponent> = {
		atoms_earned: AtomIcon,
		buildings_purchased: Factory,
		clicks_100: MousePointerClick,
		clicks_250: MousePointerClick,
		electronize_three_times: ElectronizeIcon,
		higgs_bosons_collected: HiggsBosonIcon,
		power_ups_collected: HiggsBosonIcon,
		protonise_once: ProtoniseIcon,
		upgrades_purchased: CircleArrowUp,
	};

	const resetIn = $derived.by(() => {
		const remainingMs = 86_400_000 - (now % 86_400_000);
		return `${Math.floor(remainingMs / 3_600_000)}h ${Math.floor((remainingMs % 3_600_000) / 60_000)}m`;
	});

	onMount(() => {
		const interval = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(interval);
	});
</script>

{#snippet quarkAmount(amount: number, prefix = '')}
	<span class="inline-flex items-center gap-1 font-mono">
		<Quark size={14} class="shrink-0" />
		{prefix}{formatNumber(amount)}
	</span>
{/snippet}

{#snippet action(label: string, pendingLabel: string, pending: boolean, disabled: boolean, onclick: () => void)}
	<button
		class="flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-accent-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-30"
		disabled={canAct && (disabled || pending)}
		onclick={canAct ? onclick : () => (showLogin = true)}
	>
		{#if canAct}
			{pending ? pendingLabel : label}
		{:else}
			<Lock size={14} class="shrink-0" /> Sign in
		{/if}
	</button>
{/snippet}

{#snippet buy(item: QuarkShopItem)}
	{@render action(
		'Buy',
		'Buying...',
		quarksManager.isActionPending(`purchase:${item.id}`),
		quarksManager.balance < item.cost,
		() => quarksManager.purchase(item.id),
	)}
{/snippet}

{#snippet price(item: QuarkShopItem, owned: boolean)}
	<span class={['text-sm', owned || quarksManager.balance < item.cost ? 'text-white/40' : 'text-white']}>
		{@render quarkAmount(item.cost)}
	</span>
{/snippet}

{#snippet badge(label: string, strong: boolean)}
	<span
		class={[
			'flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
			strong ? 'bg-(--c) text-black' : 'bg-(--c)/15 text-(--c)',
		]}
	>
		<Check size={12} />
		{label}
	</span>
{/snippet}

{#snippet cosmetic(item: QuarkShopItem)}
	{const realmId = $derived(item.theme?.realmId)}
	{const owned = $derived(quarksManager.entitlements.includes(item.id))}
	{const equipped = $derived(realmId ? quarksManager.equippedThemes[realmId] === item.id : quarksManager.equippedBanner === item.id)}
	{const equipPending = $derived(quarksManager.isActionPending(realmId ? `equip-theme:${realmId}` : 'equip-banner'))}
	<div
		class={[
			'flex flex-col gap-2 rounded-xl bg-accent-800/50 p-3',
			equipped ? 'bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--c)_18%,transparent),transparent_70%)] ring-2 ring-(--c)' : owned && 'ring-1 ring-(--c)/40',
		]}
		style:--c={item.theme?.accent ?? QUARK_CHARGE_COLORS.green}
	>
		{#if item.theme}
			<div
				class="h-12 rounded-lg ring-1 ring-white/15 ring-inset"
				style:background="linear-gradient(135deg, {item.theme.accent}, {item.theme.accentSecondary ?? item.theme.accent})"
			></div>
		{:else}
			<LeaderboardRow entry={createCurrentPlayerPreview(item.id)} />
		{/if}
		<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
			<span class="font-medium text-white">{item.name}</span>
			{#if owned}
				{@render badge(equipped ? 'Equipped' : 'Owned', equipped)}
			{/if}
		</div>
		<p class="text-sm text-white/60">{item.description}</p>
		<div class="mt-auto flex items-center justify-between">
			{@render price(item, owned)}
			{#if owned}
				<button
					class={[
						'cursor-pointer rounded-lg px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30',
						equipped ? 'bg-white/10 text-white/80 hover:bg-white/20' : 'bg-accent-600 text-white hover:bg-accent-500',
					]}
					disabled={equipPending}
					onclick={() =>
						realmId ?
							quarksManager.equipTheme(realmId, equipped ? null : item.id)
						:	quarksManager.equipBanner(equipped ? null : item.id)}
				>
					{equipPending ? 'Applying...' : equipped ? 'Unequip' : 'Equip'}
				</button>
			{:else}
				{@render buy(item)}
			{/if}
		</div>
	</div>
{/snippet}

<Modal {onClose} width="lg">
	{#snippet header()}
		<div class="flex flex-1 items-center gap-3">
			<Quark size={28} class="drop-shadow-[0_0_6px_rgb(74_158_255/0.6)]" />
			<h2 class="text-2xl font-bold text-white"><QuarkLabel size={20} /></h2>
			<span class="ml-auto flex items-center gap-1.5" title="Balance">
				<Quark size={18} class="shrink-0" />
				{#key quarksManager.balance}
					<span class="inline-block font-mono text-xl font-bold text-white [text-shadow:0_0_12px_rgb(74_158_255/0.5)]" in:scale={pop}>
						{formatNumber(quarksManager.balance)}
					</span>
				{/key}
			</span>
		</div>
	{/snippet}

	<div class="flex flex-col gap-4">
		{#if !canAct}
			<button class="flex cursor-pointer items-center gap-1.5 text-left text-xs text-accent-300 hover:text-accent-200" onclick={() => (showLogin = true)}>
				<LogIn size={14} class="shrink-0" />
				Sign in to claim quests and buy items. Quest progress is tracked while signed out.
			</button>
		{/if}

		<div class="grid grid-cols-4 gap-1 rounded-xl bg-black/20 p-1 sm:flex" role="tablist">
			{#each TABS as tab (tab.id)}
				<button
					class={[
						'flex cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:flex-1 sm:flex-row sm:justify-center sm:gap-2 sm:py-2 sm:text-sm',
						activeTab === tab.id ? 'bg-accent-700 text-white shadow-md' : 'text-white/60 hover:bg-white/5 hover:text-white',
					]}
					aria-selected={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
					role="tab"
				>
					<tab.icon class="shrink-0" size={16} />
					{tab.label}
				</button>
			{/each}
		</div>

		{#if activeTab === 'quests'}
			<section class="flex flex-col gap-3">
				<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
					<h3 class="flex items-center gap-1 text-lg font-bold text-white/80">
						Daily Quests
						<HelpIcon>
							{#snippet content()}
								Two quests are picked for you every UTC day, worth 1 <QuarkLabel /> each. The Third Daily Quest shop upgrade
								adds another. Targets scale with your best-ever production so they stay reasonable at any stage.
							{/snippet}
						</HelpIcon>
					</h3>
					<div class="flex items-center gap-2" style:--c={QUARK_CHARGE_COLORS.green}>
						{#each quarksManager.quests as quest (quest.id)}
							<span
								class={[
									'size-2.5 rounded-full',
									quarksManager.claimedQuestIds.includes(quest.id) ? 'bg-(--c) shadow-[0_0_6px_var(--c)]'
									: quarksManager.isQuestComplete(quest) ? 'ring-2 ring-(--c)'
									: 'bg-white/15',
								]}
							></span>
						{/each}
						<span class="font-mono text-xs text-white/60">{claimedCount}/{quarksManager.quests.length}</span>
						<span class="ml-1 flex items-center gap-1 text-xs text-white/40"><Clock size={12} /> {resetIn}</span>
					</div>
				</div>

				{#each quarksManager.quests as quest (quest.id)}
					{const target = $derived(quarksManager.getTarget(quest))}
					{const progress = $derived(quarksManager.getProgress(quest))}
					{const claimed = $derived(quarksManager.claimedQuestIds.includes(quest.id))}
					{const complete = $derived(progress >= target)}
					{const QuestIcon = $derived(QUEST_ICONS[quest.id] ?? Target)}
					<div
						class={[
							'flex flex-col gap-3 rounded-xl bg-accent-800/50 p-4',
							claimed && 'opacity-60',
							complete && !claimed && 'bg-[radial-gradient(circle_at_0%_0%,color-mix(in_srgb,var(--c)_14%,transparent),transparent_60%)] ring-1 ring-(--c)/50',
						]}
						style:--c={QUARK_CHARGE_COLORS.green}
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-start gap-3">
								<div class="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 text-white/70 ring-1 ring-white/10">
									<QuestIcon size={18} />
								</div>
								<span class="mt-1.5 text-white">{quest.description(target)}</span>
							</div>
							<span class="mt-1.5 flex shrink-0 items-center text-sm font-bold text-white/80">{@render quarkAmount(quest.reward, '+')}</span>
						</div>

						<div class="h-2 overflow-hidden rounded-full bg-black/30">
							<div
								class={['h-full origin-left will-change-transform', complete ? 'bg-(--c) shadow-[0_0_8px_var(--c)]' : 'bg-accent-400']}
								style:transform="scaleX({Math.min(1, progress / target)})"
							></div>
						</div>

						<div class="flex items-center justify-between">
							<span class="font-mono text-xs text-white/50">{formatNumber(Math.min(progress, target))} / {formatNumber(target)}</span>
							{#if claimed}
								<span class="flex items-center gap-1 px-3 py-1 text-sm text-(--c)">
									<Check size={14} /> Claimed
								</span>
							{:else}
								{@render action(
									'Claim',
									'Claiming...',
									quarksManager.isActionPending(`claim-quest:${quest.id}`),
									!complete,
									() => quarksManager.claimQuest(quest.id),
								)}
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
							Boosts and convenience unlocks refund at 100%, so your balance is really a limit on how many you can equip at
							once.
						{/snippet}
					</HelpIcon>
				</h3>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each boostItems as item (item.id)}
						{const owned = $derived(quarksManager.entitlements.includes(item.id))}
						{const refunding = $derived(quarksManager.isActionPending(`refund:${item.id}`))}
						<div class={['flex flex-col gap-3 rounded-xl bg-accent-800/50 p-3', owned && 'ring-1 ring-(--c)/40']} style:--c={QUARK_CHARGE_COLORS.green}>
							<div class="flex items-start gap-3">
								<div class="grid size-11 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
									{#if item.iconStack}
										<IconStack color={item.iconStack.color} count={item.iconStack.count} icon={item.iconStack.icon} label={item.iconStack.label} size={24} />
									{/if}
								</div>
								<div class="flex min-w-0 flex-1 flex-col gap-0.5">
									<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
										<span class="font-medium text-white">{item.name}</span>
										{#if owned}
											{@render badge('Active', false)}
										{/if}
									</div>
									<p class="text-sm text-white/60">{item.description}</p>
								</div>
							</div>
							<div class="mt-auto flex items-center justify-between">
								{@render price(item, owned)}
								{#if owned}
									<button
										class="flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-sm text-white/70 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
										disabled={refunding}
										onclick={() => quarksManager.refund(item.id)}
									>
										<Undo2 size={14} />
										{refunding ? 'Refunding...' : 'Refund'}
									</button>
								{:else}
									{@render buy(item)}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{:else if activeTab === 'themes'}
			<section class="flex flex-col gap-5">
				<h3 class="flex items-center gap-1 text-lg font-bold text-white/80">
					Realm Themes
					<HelpIcon>
						{#snippet content()}
							Cosmetic only, no gameplay effect. Each theme recolors its Realm's background and a couple of accents.
							Themes are permanent once bought and cannot be refunded.
						{/snippet}
					</HelpIcon>
				</h3>
				{#each realmSections as { id, realm, themes } (id)}
					{const unlocked = $derived(gameManager.realms[id]?.unlocked ?? false)}
					<div class="relative">
						{#if !unlocked}
							<div class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/30 p-4 text-center">
								<span class="flex items-center gap-2 text-sm font-medium text-white/80">
									<Lock size={14} class="shrink-0" /> Progress further in the game to reveal
								</span>
							</div>
						{/if}
						<div class={['flex flex-col gap-2', !unlocked && 'pointer-events-none blur-md select-none']} aria-hidden={!unlocked}>
							<h4 class="flex items-center gap-1.5 text-sm font-semibold" style:color={realm?.currency?.color}>
								{#if realm?.currency}
									<IconStack color={realm.currency.color} icon={CURRENCY_ICON_NAMES[realm.currency.name]} size={16} />
								{/if}
								{realm?.title ?? id}
							</h4>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
								{#each themes as item (item.id)}
									{@render cosmetic(item)}
								{/each}
							</div>
						</div>
					</div>
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
						{@render cosmetic(item)}
					{/each}
				</div>
				<p class="text-xs text-white/40">Banners are permanent and cannot be refunded.</p>
			</section>
		{/if}
	</div>
</Modal>

{#if showLogin}
	<Login onClose={() => (showLogin = false)} />
{/if}
