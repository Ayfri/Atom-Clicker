<script lang="ts">
	import AtomIcon from '@components/icons/Atom.svelte';
	import HiggsBosonIcon from '@components/icons/HiggsBoson.svelte';
	import PhotonIcon from '@components/icons/Photon.svelte';
	import ProtonIcon from '@components/icons/Proton.svelte';
	import QuarkIcon from '@components/icons/Quark.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { ACHIEVEMENTS } from '$data/achievements';
	import { CURRENCIES, CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { FeatureTypes } from '$data/features';
	import { REALMS } from '$data/realms';
	import { SKILL_UPGRADES } from '$data/skillTree';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { formatDuration, formatNumber, formatNumberFull } from '$lib/utils';
	import { CalendarDays, Factory, Flame, Hourglass, MousePointerClick, Package, Radiation, Repeat, RotateCcw, TrendingUp, Trophy, Zap } from '@lucide/svelte';
	import { onMount, type Component } from 'svelte';

	type TitleIcon = Component<{ class?: string; color?: string; size?: number }>;

	const totalAchievements = Object.keys(ACHIEVEMENTS).length;
	const totalSkillUpgrades = Object.keys(SKILL_UPGRADES).length;
	const hasEarned = (...types: CurrencyName[]) => types.some(type => gameManager.currencies[type].earnedAllTime > 0);

	let now = $state(Date.now());
	onMount(() => {
		const clock = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(clock);
	});

	const radiationUnlocked = $derived(gameManager.features[FeatureTypes.RADIATION_REALM] || radiationManager.unlocked);
	const dailyQuestsClaimed = $derived(gameManager.dailyStats.questIds.filter(id => quarksManager.claimedQuestIds.includes(id)).length);

	const highlights = $derived([
		{ icon: AtomIcon, label: 'Atoms / s', value: gameManager.atomsPerSecond },
		{ icon: Flame, label: 'Best atoms / s', value: gameManager.highestAPS },
		{ icon: MousePointerClick, label: 'Click power', value: gameManager.clickPower },
		{ icon: Repeat, label: 'Auto clicks / s', value: gameManager.autoClicksPerSecond },
	]);

	/** The stability field drops back to ×1 on every click, so it stays pinned once unlocked instead of blinking with auto-clicks. */
	const multipliers = $derived(
		[
			{ label: 'Global', value: gameManager.globalMultiplier },
			{ label: 'Active bonus', value: gameManager.bonusMultiplier },
			{ label: 'XP', value: gameManager.xpGainMultiplier },
			{ label: 'Stability field', pinned: gameManager.features[FeatureTypes.STABILITY_FIELD], value: gameManager.stabilityMultiplier },
			{ label: 'Power-up duration', value: gameManager.powerUpDurationMultiplier },
			{ label: 'Power-up effect', value: gameManager.powerUpEffectMultiplier },
			...[CurrenciesTypes.ATOMS, CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS, CurrenciesTypes.PHOTONS].map(type => ({
				label: `${type} boost`,
				value: gameManager.getCurrencyBoostMultiplier(type),
			})),
		].filter(multiplier => ('pinned' in multiplier && multiplier.pinned) || multiplier.value > 1),
	);

	const today = $derived([
		{ icon: AtomIcon, label: 'Atoms earned', value: formatNumber(gameManager.dailyStats.atomsEarned) },
		{ icon: MousePointerClick, label: 'Clicks', value: formatNumber(gameManager.dailyStats.clicks, 0) },
		{ icon: Factory, label: 'Generators bought', value: formatNumber(gameManager.dailyStats.generatorsPurchased, 0) },
		{ icon: Package, label: 'Upgrades bought', value: formatNumber(gameManager.dailyStats.upgradesPurchased, 0) },
		{ icon: Zap, label: 'Power-ups', value: formatNumber(gameManager.dailyStats.powerUpsCollected, 0) },
		{ icon: HiggsBosonIcon, label: 'Higgs bosons', value: formatNumber(gameManager.dailyStats.higgsBosonsCollected, 0) },
		{ icon: Trophy, label: 'Achievements', value: gameManager.dailyStats.achievementsUnlocked.toString() },
		{ icon: RotateCcw, label: 'Prestiges', value: (gameManager.dailyStats.protonises + gameManager.dailyStats.electronizes).toString() },
	]);
</script>

{#snippet title(Icon: TitleIcon, text: string, color?: string)}
	<h3 class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-white/40 uppercase">
		<Icon class="text-accent-300" {color} size={16} />
		{text}
	</h3>
{/snippet}

{#snippet ring(value: number, max: number, label: string, color = 'var(--color-accent)')}
	{@const ratio = max > 0 ? Math.min(1, value / max) : 0}
	<div class="flex flex-col items-center gap-1.5 text-center">
		<div class="relative size-20">
			<svg class="size-full -rotate-90" viewBox="0 0 36 36">
				<circle class="stroke-white/10" cx="18" cy="18" fill="none" r="15.9" stroke-width="3" />
				<circle cx="18" cy="18" fill="none" pathLength="100" r="15.9" stroke={color} stroke-dasharray="{ratio * 100} 100" stroke-linecap="round" stroke-width="3" />
			</svg>
			<span class="absolute inset-0 flex items-center justify-center text-sm font-bold text-white tabular-nums">{value}<span class="text-white/40">/{max}</span></span>
		</div>
		<span class="text-xs text-white/60">{label}</span>
	</div>
{/snippet}

{#snippet bar(label: string, value: number, max: number, color = 'var(--color-accent)', text = `${formatNumber(value)} / ${formatNumber(max)}`)}
	<div class="flex flex-col gap-1.5" title="{formatNumberFull(value)} / {formatNumberFull(max)}">
		<div class="flex items-baseline justify-between gap-2 text-sm">
			<span class="text-white/60">{label}</span>
			<span class="text-white tabular-nums">{text}</span>
		</div>
		<div class="h-1.5 overflow-hidden rounded-full bg-white/10">
			<div class="h-full origin-left rounded-full" style:background-color={color} style:transform="scaleX({max > 0 ? Math.min(1, value / max) : 0})"></div>
		</div>
	</div>
{/snippet}

{#snippet row(label: string, value: string, full = value)}
	<div class="flex items-center justify-between gap-2 py-1.5 text-sm" title={full}>
		<span class="text-white/60">{label}</span>
		<span class="font-semibold text-white tabular-nums">{value}</span>
	</div>
{/snippet}

{#snippet currency(type: CurrencyName, extra: [string, number][])}
	{@const data = gameManager.currencies[type]}
	<div class="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
		<div class="flex items-center gap-3">
			<Currency name={type} size={28} />
			<span class="flex flex-col leading-tight">
				<span class="text-xl font-bold tabular-nums" style:color={CURRENCIES[type].color} title={formatNumberFull(data.amount)}>{formatNumber(data.amount)}</span>
				<span class="text-xs text-white/50">{type}</span>
			</span>
		</div>
		{@render bar('Earned this run', data.earnedRun, data.earnedAllTime, CURRENCIES[type].color)}
		{#each extra as [label, value] (label)}
			{@render row(label, formatNumber(value, 0))}
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-8">
	<section class="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
		{#each highlights as highlight (highlight.label)}
			<div class="flex flex-col" title={formatNumberFull(highlight.value)}>
				<span class="flex items-center gap-1.5 text-xs text-white/50"><highlight.icon size={14} />{highlight.label}</span>
				<span class="truncate text-3xl font-bold text-white tabular-nums">{formatNumber(highlight.value)}</span>
			</div>
		{/each}
	</section>

	<section>
		{@render title(Hourglass, 'Progress')}
		<div class="grid items-center gap-6 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto]">
			<div class="grid gap-x-6 sm:grid-cols-2">
				{@render row('Since you started', formatDuration(now - gameManager.startDate))}
				{@render row('Played', formatDuration(gameManager.inGameTime))}
				{@render row('Level', formatNumber(gameManager.playerLevel), formatNumberFull(gameManager.playerLevel))}
				{@render row('Total XP', formatNumber(gameManager.totalXP), formatNumberFull(gameManager.totalXP))}
				{@render row('Generator levels', formatNumber(gameManager.generatorTotals.levels, 0))}
				{@render row('Power-ups collected', formatNumber(gameManager.powerUpsCollected, 0))}
			</div>
			<div class="flex justify-around gap-4">
				{@render ring(gameManager.achievements.length, totalAchievements, 'Achievements', CURRENCIES['Higgs Boson'].color)}
				{@render ring(gameManager.skillUpgrades.length, totalSkillUpgrades, 'Skill tree')}
			</div>
		</div>
	</section>

	{#if multipliers.length > 0}
		<section>
			{@render title(TrendingUp, 'Multipliers')}
			<div class="flex flex-wrap gap-2">
				{#each multipliers as multiplier (multiplier.label)}
					<span class="rounded-full bg-white/5 px-3 py-1.5 text-sm text-white/60" title="×{multiplier.value.toFixed(3)}">
						{multiplier.label} <b class="text-white">×{formatNumber(multiplier.value)}</b>
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<section class="grid gap-x-8 gap-y-4 md:grid-cols-2">
		<div class="flex flex-col gap-3">
			{@render title(MousePointerClick, 'This run out of all time')}
			{@render bar('Clicks', gameManager.totalClicksRun, gameManager.totalClicksAllTime)}
			{@render bar('Atoms earned', gameManager.currencies[CurrenciesTypes.ATOMS].earnedRun, gameManager.currencies[CurrenciesTypes.ATOMS].earnedAllTime, CURRENCIES.Atoms.color)}
			{@render bar('Higgs bosons', gameManager.currencies[CurrenciesTypes.HIGGS_BOSON].earnedRun, gameManager.currencies[CurrenciesTypes.HIGGS_BOSON].earnedAllTime, CURRENCIES['Higgs Boson'].color)}
		</div>
		<div class="flex flex-col gap-3">
			{@render title(Factory, 'Owned out of ever bought')}
			{@render bar('Generators', gameManager.generatorTotals.count, gameManager.totalGeneratorsPurchasedAllTime)}
			{@render bar('Upgrades', gameManager.upgrades.length, gameManager.totalUpgradesPurchasedAllTime)}
			{@render bar('Boost points left', gameManager.boostPointsAvailable, gameManager.boostPointsTotal)}
		</div>
	</section>

	{#if hasEarned(CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS)}
		<section>
			{@render title(ProtonIcon, 'Prestige')}
			<div class="grid gap-3 md:grid-cols-2">
				{#if hasEarned(CurrenciesTypes.PROTONS)}
					{@render currency(CurrenciesTypes.PROTONS, [['Protonised this run', gameManager.totalProtonisesRun], ['Protonised all time', gameManager.totalProtonisesAllTime]])}
				{/if}
				{#if hasEarned(CurrenciesTypes.ELECTRONS)}
					{@render currency(CurrenciesTypes.ELECTRONS, [['Electronized this run', gameManager.totalElectronizesRun], ['Electronized all time', gameManager.totalElectronizesAllTime]])}
				{/if}
			</div>
		</section>
	{/if}

	{#if hasEarned(CurrenciesTypes.PHOTONS, CurrenciesTypes.EXCITED_PHOTONS)}
		<section>
			{@render title(PhotonIcon, 'Photon Realm')}
			<div class="grid gap-3 md:grid-cols-3">
				{@render currency(CurrenciesTypes.PHOTONS, [])}
				{#if hasEarned(CurrenciesTypes.EXCITED_PHOTONS)}
					{@render currency(CurrenciesTypes.EXCITED_PHOTONS, [])}
				{/if}
				<div class="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5">
					{@render row('Auto clicks / s', formatNumber(gameManager.photonAutoClicksPer5Seconds / 5))}
					{@render row('Excited chance', `${(gameManager.excitedPhotonChance * 100).toFixed(2)}%`)}
					{@render row('Spawn every', `${(gameManager.photonSpawnInterval / 1000).toFixed(2)}s`)}
					{@render row('Upgrade levels', formatNumber(gameManager.photonUpgradeLevels, 0))}
				</div>
			</div>
		</section>
	{/if}

	{#if radiationUnlocked}
		<section>
			{@render title(Radiation, 'Radiation Realm', REALMS.radiation.color)}
			<div class="grid gap-x-8 gap-y-3 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-2">
				<div class="flex flex-col gap-3">
					{@render bar('Reactor output', radiationManager.currentCpm, radiationManager.maxCpm, REALMS.radiation.color, `${formatNumber(radiationManager.currentCpm)} / ${formatNumber(radiationManager.maxCpm)} CPM`)}
					{@render bar('Control rods', radiationManager.controlRodLevel * 100, 100, REALMS.radiation.color, `${(radiationManager.controlRodLevel * 100).toFixed(0)}%`)}
				</div>
				<div>
					{@render row('Core mass', formatNumber(radiationManager.mass), formatNumberFull(radiationManager.mass))}
					{@render row('Mass / s', `${radiationManager.netMassChange > 0 ? '+' : ''}${formatNumber(radiationManager.netMassChange)}`)}
					{@render row('Empty in', Number.isFinite(radiationManager.timeToEmpty) ? formatDuration(radiationManager.timeToEmpty * 1000) : 'Never')}
					{@render row('Multiplier', `×${formatNumber(radiationManager.radiationMultiplier)}`)}
				</div>
			</div>
		</section>
	{/if}

	{#if quarksManager.hasSynced}
		<section>
			{@render title(QuarkIcon, 'Quarks')}
			<div class="grid gap-x-8 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 md:grid-cols-2">
				{@render row('Balance', formatNumber(quarksManager.balance, 0))}
				{@render row('Shop items owned', quarksManager.entitlements.length.toString())}
				{@render row('Daily quests claimed', `${dailyQuestsClaimed} / ${quarksManager.quests.length}`)}
				{@render row('Achievement rewards claimed', quarksManager.claimedAchievementIds.length.toString())}
			</div>
		</section>
	{/if}

	<section>
		{@render title(CalendarDays, 'Today')}
		<div class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
			{#each today as stat (stat.label)}
				<div class="flex flex-col">
					<span class="flex items-center gap-1.5 text-xs text-white/50"><stat.icon size={13} />{stat.label}</span>
					<span class="text-lg font-semibold text-white tabular-nums">{stat.value}</span>
				</div>
			{/each}
		</div>
	</section>
</div>
