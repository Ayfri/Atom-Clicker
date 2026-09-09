<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { ACHIEVEMENTS } from '$data/achievements';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { FeatureTypes } from '$data/features';
	import { SKILL_UPGRADES } from '$data/skillTree';
	import { formatDuration, formatNumber, formatNumberFull } from '$lib/utils';
	import StatItem from '@components/ui/StatItem.svelte';
	import {
		Activity,
		Atom,
		Award,
		Building2,
		CalendarClock,
		CalendarDays,
		ChartLine,
		ClockPlus,
		Diamond,
		Factory,
		Flame,
		Gauge,
		Gem,
		Hourglass,
		Layers,
		Medal,
		Mouse,
		MousePointerClick,
		Network,
		Package,
		PackageCheck,
		Radiation,
		Repeat,
		RotateCcw,
		RotateCw,
		ShieldCheck,
		ShoppingBag,
		SlidersVertical,
		Sparkles,
		Sun,
		Target,
		Timer,
		TrendingDown,
		TrendingUp,
		Trophy,
		Weight,
		Zap,
	} from '@lucide/svelte';

	const totalAchievements = Object.keys(ACHIEVEMENTS).length;
	const totalSkillUpgrades = Object.keys(SKILL_UPGRADES).length;

	let totalBuildings = $derived(Object.values(gameManager.buildings).reduce((acc, b) => acc + (b?.count || 0), 0));
	let radiationUnlocked = $derived(gameManager.features[FeatureTypes.RADIATION_REALM] || radiationManager.unlocked);
	let dailyQuestsClaimed = $derived(gameManager.dailyStats.questIds.filter(id => quarksManager.claimedQuestIds.includes(id)).length);

	// Update time since start every second
	let timeSinceStart = $state(formatDuration(Date.now() - gameManager.startDate));
	$effect(() => {
		const interval = setInterval(() => {
			timeSinceStart = formatDuration(Date.now() - gameManager.startDate);
		}, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="flex flex-col gap-4 overflow-y-auto pr-1 h-full custom-scrollbar">
    <!-- General & Production -->
    <section>
        <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
            <Activity size={18} />
            General
        </h3>
        <div class="grid gap-1.5 sm:grid-cols-2">
            <StatItem
                fullValue={timeSinceStart}
                icon={CalendarClock}
                label="Time Since Start"
                value={timeSinceStart}
            />
            <StatItem
                fullValue={formatDuration(gameManager.inGameTime)}
                icon={Hourglass}
                label="In-Game Time"
                value={formatDuration(gameManager.inGameTime)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.playerLevel)}
                icon={Award}
                label="Player Level"
                value={formatNumber(gameManager.playerLevel)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.totalXP)}
                icon={ChartLine}
                label="Total XP"
                value={formatNumber(gameManager.totalXP)}
            />
            <StatItem
                fullValue={`${gameManager.achievements.length} / ${totalAchievements}`}
                icon={Trophy}
                label="Achievements"
                suffix={` / ${totalAchievements}`}
                value={gameManager.achievements.length}
            />
        </div>
    </section>

    <!-- Production -->
    <section>
        <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
            <TrendingUp size={18} />
            Production
        </h3>
        <div class="grid gap-1.5 sm:grid-cols-2">
            <StatItem
                fullValue={formatNumberFull(gameManager.atomsPerSecond)}
                icon={Atom}
                label="Atoms/sec"
                value={formatNumber(gameManager.atomsPerSecond)}
            />
            <StatItem
                description="Best achieved"
                fullValue={formatNumberFull(gameManager.highestAPS)}
                icon={Flame}
                label="Highest APS"
                value={formatNumber(gameManager.highestAPS)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.clickPower)}
                icon={MousePointerClick}
                label="Click Power"
                value={formatNumber(gameManager.clickPower)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.autoClicksPerSecond)}
                icon={Repeat}
                label="Auto Clicks/sec"
                value={formatNumber(gameManager.autoClicksPerSecond, 0)}
            />
            <StatItem
                fullValue={`${gameManager.globalMultiplier.toFixed(2)}×`}
                icon={TrendingUp}
                label="Global Multiplier"
                prefix="×"
                value={formatNumber(gameManager.globalMultiplier)}
            />
            {#if gameManager.bonusMultiplier > 1}
                <StatItem
                    fullValue={`${gameManager.bonusMultiplier.toFixed(2)}×`}
                    icon={Zap}
                    label="Active Bonus"
                    prefix="×"
                    value={formatNumber(gameManager.bonusMultiplier)}
                />
            {/if}
            <StatItem
                fullValue={`${gameManager.xpGainMultiplier.toFixed(2)}×`}
                icon={Sparkles}
                label="XP Multiplier"
                prefix="×"
                value={formatNumber(gameManager.xpGainMultiplier)}
            />
            {#if gameManager.features[FeatureTypes.STABILITY_FIELD]}
                <StatItem
                    description="Idle bonus, up to ×{formatNumber(1 + (gameManager.stabilityMaxBoost - 1) * gameManager.stabilityCapacity)}"
                    fullValue={`${gameManager.stabilityMultiplier.toFixed(2)}×`}
                    icon={ShieldCheck}
                    label="Stability Field"
                    prefix="×"
                    value={formatNumber(gameManager.stabilityMultiplier)}
                />
            {/if}
            {#each [CurrenciesTypes.ATOMS, CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS, CurrenciesTypes.PHOTONS] as currencyType}
                {@const boost = gameManager.getCurrencyBoostMultiplier(currencyType)}
                {#if boost > 1}
                    <StatItem
                        currency={currencyType}
                        fullValue={`${boost.toFixed(2)}×`}
                        label={`${currencyType} Boost`}
                        prefix="×"
                        value={formatNumber(boost)}
                    />
                {/if}
            {/each}
        </div>
    </section>

    <!-- Clicks & Resources -->
    <section>
        <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
            <MousePointerClick size={18} />
            Clicks & Resources
        </h3>
        <div class="grid gap-1.5 sm:grid-cols-2">
            <StatItem
                description="This run"
                fullValue={formatNumberFull(gameManager.totalClicksRun)}
                icon={MousePointerClick}
                label="Clicks"
                value={formatNumber(gameManager.totalClicksRun, 0)}
            />
            <StatItem
                description="All time"
                fullValue={formatNumberFull(gameManager.totalClicksAllTime)}
                icon={Mouse}
                label="Clicks (Total)"
                value={formatNumber(gameManager.totalClicksAllTime, 0)}
            />
            {#each [CurrenciesTypes.ATOMS] as currencyType}
                {@const currency = gameManager.currencies[currencyType]}
                <StatItem
                    currency={currencyType}
                    description="This run"
                    fullValue={formatNumberFull(currency.earnedRun)}
                    label="Atoms Earned"
                    value={formatNumber(currency.earnedRun)}
                />
                <StatItem
                    currency={currencyType}
                    description="All time"
                    fullValue={formatNumberFull(currency.earnedAllTime)}
                    label="Atoms (Total)"
                    value={formatNumber(currency.earnedAllTime)}
                />
                <StatItem
                    currency={currencyType}
                    fullValue={formatNumberFull(currency.amount)}
                    label="Current Atoms"
                    value={formatNumber(currency.amount)}
                />
            {/each}
        </div>
    </section>

    <!-- Buildings & Upgrades -->
    <section>
        <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
            <Building2 size={18} />
            Buildings & Upgrades
        </h3>
        <div class="grid gap-1.5 sm:grid-cols-2">
            <StatItem
                description="Currently owned"
                fullValue={formatNumberFull(totalBuildings)}
                icon={Building2}
                label="Buildings Owned"
                value={formatNumber(totalBuildings, 0)}
            />
            <StatItem
                description="All time"
                fullValue={formatNumberFull(gameManager.totalBuildingsPurchasedAllTime)}
                icon={Factory}
                label="Buildings Purchased"
                value={formatNumber(gameManager.totalBuildingsPurchasedAllTime, 0)}
            />
            <StatItem
                description="Currently owned"
                fullValue={gameManager.upgrades.length.toString()}
                icon={Package}
                label="Upgrades Owned"
                value={gameManager.upgrades.length}
            />
            <StatItem
                description="All time"
                fullValue={formatNumberFull(gameManager.totalUpgradesPurchasedAllTime)}
                icon={PackageCheck}
                label="Upgrades Purchased"
                value={formatNumber(gameManager.totalUpgradesPurchasedAllTime, 0)}
            />
            <StatItem
                description="Across every building"
                fullValue={formatNumberFull(gameManager.skillPointsTotal)}
                icon={Layers}
                label="Building Levels"
                value={formatNumber(gameManager.skillPointsTotal, 0)}
            />
            <StatItem
                description="Available / earned"
                fullValue={`${gameManager.skillPointsAvailable} / ${gameManager.skillPointsTotal}`}
                icon={Diamond}
                label="Skill Points"
                suffix={` / ${gameManager.skillPointsTotal}`}
                value={gameManager.skillPointsAvailable}
            />
            <StatItem
                fullValue={`${gameManager.skillUpgrades.length} / ${totalSkillUpgrades}`}
                icon={Network}
                label="Skill Tree Nodes"
                suffix={` / ${totalSkillUpgrades}`}
                value={gameManager.skillUpgrades.length}
            />
        </div>
    </section>

    <!-- Power-ups -->
    <section>
        <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
            <Zap size={18} />
            Power-ups
        </h3>
        <div class="grid gap-1.5 sm:grid-cols-2">
            <StatItem
                fullValue={formatNumberFull(gameManager.powerUpsCollected)}
                icon={Zap}
                label="Power-ups Collected"
                value={formatNumber(gameManager.powerUpsCollected, 0)}
            />
            <StatItem
                currency={CurrenciesTypes.HIGGS_BOSON}
                description="This run"
                fullValue={formatNumberFull(gameManager.currencies[CurrenciesTypes.HIGGS_BOSON].earnedRun)}
                label="Bonus Higgs Clicked"
                value={formatNumber(gameManager.currencies[CurrenciesTypes.HIGGS_BOSON].earnedRun, 0)}
            />
            <StatItem
                currency={CurrenciesTypes.HIGGS_BOSON}
                description="All time"
                fullValue={formatNumberFull(gameManager.currencies[CurrenciesTypes.HIGGS_BOSON].earnedAllTime)}
                label="Bonus Higgs Clicked (Total)"
                value={formatNumber(gameManager.currencies[CurrenciesTypes.HIGGS_BOSON].earnedAllTime, 0)}
            />
            <StatItem
                fullValue={`${gameManager.powerUpDurationMultiplier.toFixed(2)}×`}
                icon={ClockPlus}
                label="Duration Multiplier"
                prefix="×"
                value={formatNumber(gameManager.powerUpDurationMultiplier)}
            />
            <StatItem
                fullValue={`${gameManager.powerUpEffectMultiplier.toFixed(2)}×`}
                icon={TrendingUp}
                label="Effect Multiplier"
                prefix="×"
                value={formatNumber(gameManager.powerUpEffectMultiplier)}
            />
        </div>
    </section>

    <!-- Prestige Stats -->
    {#if Object.values(CurrenciesTypes).some(t => (([CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS] as unknown) as CurrencyName[]).includes(t as CurrencyName) && gameManager.currencies[t as CurrencyName].earnedAllTime > 0)}
        <section>
            <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
                <RotateCcw size={18} />
                Prestige
            </h3>
            <div class="grid gap-1.5 lg:grid-cols-2">
                {#each [CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS] as currencyType}
                    {@const currency = gameManager.currencies[currencyType]}
                    {#if currency.earnedAllTime > 0 || currency.amount > 0 || (currencyType === CurrenciesTypes.PROTONS && gameManager.totalProtonisesRun > 0) || (currencyType === CurrenciesTypes.ELECTRONS && gameManager.totalElectronizesAllTime > 0)}
                        <div class="flex flex-col gap-1.5">
                            <StatItem
                                currency={currencyType}
                                fullValue={formatNumberFull(currency.amount)}
                                label={`Current ${currencyType}`}
                                value={formatNumber(currency.amount)}
                            />
                            <StatItem
                                currency={currencyType}
                                description="This run"
                                fullValue={formatNumberFull(currency.earnedRun)}
                                label={`${currencyType} Earned`}
                                value={formatNumber(currency.earnedRun)}
                            />
                            <StatItem
                                currency={currencyType}
                                description="All time"
                                fullValue={formatNumberFull(currency.earnedAllTime)}
                                label={`${currencyType} Earned (Total)`}
                                value={formatNumber(currency.earnedAllTime)}
                            />
                            {#if currencyType === CurrenciesTypes.PROTONS}
                                <StatItem
                                    fullValue={formatNumberFull(gameManager.totalProtonisesRun)}
                                    icon={RotateCcw}
                                    label="Times Protonised"
                                    value={gameManager.totalProtonisesRun}
                                />
                                <StatItem
                                    fullValue={formatNumberFull(gameManager.totalProtonisesAllTime)}
                                    icon={RotateCcw}
                                    label="Times Protonised (Total)"
                                    value={gameManager.totalProtonisesAllTime}
                                />
                            {:else if currencyType === CurrenciesTypes.ELECTRONS}
                                <StatItem
                                    fullValue={formatNumberFull(gameManager.totalElectronizesRun)}
                                    icon={RotateCw}
                                    label="Times Electronized"
                                    value={gameManager.totalElectronizesRun}
                                />
                                <StatItem
                                    fullValue={formatNumberFull(gameManager.totalElectronizesAllTime)}
                                    icon={RotateCw}
                                    label="Times Electronized (Total)"
                                    value={gameManager.totalElectronizesAllTime}
                                />
                            {/if}
                        </div>
                    {/if}
                {/each}
            </div>
        </section>
    {/if}

    <!-- Photon Realm Stats -->
    {#if Object.values(CurrenciesTypes).some(t => (([CurrenciesTypes.PHOTONS, CurrenciesTypes.EXCITED_PHOTONS] as unknown) as CurrencyName[]).includes(t as CurrencyName) && gameManager.currencies[t as CurrencyName].earnedAllTime > 0)}
        <section>
            <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
                <Sparkles size={18} />
                Photon Realm
            </h3>
            <div class="grid gap-1.5 sm:grid-cols-2">
                {#each [CurrenciesTypes.PHOTONS, CurrenciesTypes.EXCITED_PHOTONS] as currencyType}
                    {@const currency = gameManager.currencies[currencyType]}
                    {#if currency.earnedAllTime > 0 || currency.amount > 0}
                        <StatItem
                            currency={currencyType}
                            fullValue={formatNumberFull(currency.amount)}
                            label={`Current ${currencyType}`}
                            value={formatNumber(currency.amount)}
                        />
                        <StatItem
                            currency={currencyType}
                            description="This run"
                            fullValue={formatNumberFull(currency.earnedRun)}
                            label={`${currencyType} Earned`}
                            value={formatNumber(currency.earnedRun)}
                        />
                        <StatItem
                            currency={currencyType}
                            description="All time"
                            fullValue={formatNumberFull(currency.earnedAllTime)}
                            label={`${currencyType} Earned (Total)`}
                            value={formatNumber(currency.earnedAllTime)}
                        />
                    {/if}
                {/each}
                <StatItem
                    fullValue={formatNumberFull(gameManager.photonAutoClicksPer5Seconds / 5)}
                    icon={Repeat}
                    label="Photon Auto Clicks/s"
                    value={formatNumber(gameManager.photonAutoClicksPer5Seconds / 5)}
                />
                <StatItem
                    fullValue={`${(gameManager.excitedPhotonChance * 100).toFixed(3)}%`}
                    icon={Sun}
                    label="Excited Photon Chance"
                    suffix="%"
                    value={(gameManager.excitedPhotonChance * 100).toFixed(2)}
                />
                <StatItem
                    fullValue={`${(gameManager.photonSpawnInterval / 1000).toFixed(3)}s`}
                    icon={Timer}
                    label="Photon Spawn Interval"
                    suffix="s"
                    value={(gameManager.photonSpawnInterval / 1000).toFixed(2)}
                />
                <StatItem
                    description="All upgrades combined"
                    fullValue={formatNumberFull(gameManager.photonUpgradeLevels)}
                    icon={Layers}
                    label="Photon Upgrade Levels"
                    value={formatNumber(gameManager.photonUpgradeLevels, 0)}
                />
            </div>
        </section>
    {/if}

    <!-- Radiation Realm Stats -->
    {#if radiationUnlocked}
        <section>
            <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
                <Radiation size={18} />
                Radiation Realm
            </h3>
            <div class="grid gap-1.5 sm:grid-cols-2">
                <StatItem
                    fullValue={formatNumberFull(radiationManager.mass)}
                    icon={Weight}
                    label="Core Mass"
                    value={formatNumber(radiationManager.mass)}
                />
                <StatItem
                    fullValue={`${(radiationManager.controlRodLevel * 100).toFixed(2)}%`}
                    icon={SlidersVertical}
                    label="Control Rods"
                    suffix="%"
                    value={(radiationManager.controlRodLevel * 100).toFixed(0)}
                />
                <StatItem
                    description="Max {formatNumber(radiationManager.maxCpm)}"
                    fullValue={formatNumberFull(radiationManager.currentCpm)}
                    icon={Gauge}
                    label="Current CPM"
                    value={formatNumber(radiationManager.currentCpm)}
                />
                <StatItem
                    fullValue={`${radiationManager.radiationMultiplier.toFixed(2)}×`}
                    icon={Radiation}
                    label="Radiation Multiplier"
                    prefix="×"
                    value={formatNumber(radiationManager.radiationMultiplier)}
                />
                <StatItem
                    description="Mass per second"
                    fullValue={formatNumberFull(radiationManager.netMassChange)}
                    icon={radiationManager.netMassChange >= 0 ? TrendingUp : TrendingDown}
                    label="Net Mass Change"
                    prefix={radiationManager.netMassChange > 0 ? '+' : ''}
                    value={formatNumber(radiationManager.netMassChange)}
                />
                <StatItem
                    description="At the current rate"
                    fullValue={Number.isFinite(radiationManager.timeToEmpty) ? formatDuration(radiationManager.timeToEmpty * 1000) : 'Never'}
                    icon={Hourglass}
                    label="Time To Empty"
                    value={Number.isFinite(radiationManager.timeToEmpty) ? formatDuration(radiationManager.timeToEmpty * 1000) : '∞'}
                />
            </div>
        </section>
    {/if}

    <!-- Quarks -->
    {#if quarksManager.hasSynced}
        <section>
            <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
                <Gem size={18} />
                Quarks
            </h3>
            <div class="grid gap-1.5 sm:grid-cols-2">
                <StatItem
                    fullValue={formatNumberFull(quarksManager.balance)}
                    icon={Gem}
                    label="Quarks"
                    value={formatNumber(quarksManager.balance, 0)}
                />
                <StatItem
                    description="Shop items"
                    fullValue={formatNumberFull(quarksManager.entitlements.length)}
                    icon={ShoppingBag}
                    label="Items Owned"
                    value={quarksManager.entitlements.length}
                />
                <StatItem
                    description="Today"
                    fullValue={`${dailyQuestsClaimed} / ${quarksManager.quests.length}`}
                    icon={Target}
                    label="Daily Quests Claimed"
                    suffix={` / ${quarksManager.quests.length}`}
                    value={dailyQuestsClaimed}
                />
                <StatItem
                    description="All time"
                    fullValue={formatNumberFull(quarksManager.claimedAchievementIds.length)}
                    icon={Medal}
                    label="Achievements Claimed"
                    value={quarksManager.claimedAchievementIds.length}
                />
            </div>
        </section>
    {/if}

    <!-- Today -->
    <section>
        <h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
            <CalendarDays size={18} />
            Today
        </h3>
        <div class="grid gap-1.5 sm:grid-cols-2">
            <StatItem
                currency={CurrenciesTypes.ATOMS}
                fullValue={formatNumberFull(gameManager.dailyStats.atomsEarned)}
                label="Atoms Earned"
                value={formatNumber(gameManager.dailyStats.atomsEarned)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.dailyStats.clicks)}
                icon={MousePointerClick}
                label="Clicks"
                value={formatNumber(gameManager.dailyStats.clicks, 0)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.dailyStats.buildingsPurchased)}
                icon={Factory}
                label="Buildings Purchased"
                value={formatNumber(gameManager.dailyStats.buildingsPurchased, 0)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.dailyStats.upgradesPurchased)}
                icon={PackageCheck}
                label="Upgrades Purchased"
                value={formatNumber(gameManager.dailyStats.upgradesPurchased, 0)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.dailyStats.powerUpsCollected)}
                icon={Zap}
                label="Power-ups Collected"
                value={formatNumber(gameManager.dailyStats.powerUpsCollected, 0)}
            />
            <StatItem
                currency={CurrenciesTypes.HIGGS_BOSON}
                fullValue={formatNumberFull(gameManager.dailyStats.higgsBosonsCollected)}
                label="Higgs Bosons"
                value={formatNumber(gameManager.dailyStats.higgsBosonsCollected, 0)}
            />
            <StatItem
                fullValue={formatNumberFull(gameManager.dailyStats.achievementsUnlocked)}
                icon={Trophy}
                label="Achievements Unlocked"
                value={gameManager.dailyStats.achievementsUnlocked}
            />
            <StatItem
                fullValue={`${gameManager.dailyStats.protonises} / ${gameManager.dailyStats.electronizes}`}
                icon={RotateCcw}
                label="Protonises / Electronizes"
                value={`${gameManager.dailyStats.protonises} / ${gameManager.dailyStats.electronizes}`}
            />
        </div>
    </section>
</div>
