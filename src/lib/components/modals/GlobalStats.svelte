<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { ACHIEVEMENTS } from '$data/achievements';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { formatDuration, formatNumber, formatNumberFull } from '$lib/utils';
	import StatItem from '@components/ui/StatItem.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import {
		Activity,
		Atom,
		Award,
		Building2,
		Clock,
		Flame,
		MousePointerClick,
		Package,
		RotateCcw,
		Sparkles,
		Timer,
		TrendingUp,
		Zap,
	} from 'lucide-svelte';

	const totalAchievements = Object.keys(ACHIEVEMENTS).length;

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let totalBuildings = $derived(Object.values(gameManager.buildings).reduce((acc, b) => acc + (b?.count || 0), 0));

	// Update time since start every second
	let timeSinceStart = $state(formatDuration(Date.now() - gameManager.startDate));
	$effect(() => {
		const interval = setInterval(() => {
			timeSinceStart = formatDuration(Date.now() - gameManager.startDate);
		}, 1000);
		return () => clearInterval(interval);
	});
</script>

<Modal title="Statistics" {onClose}>
	<div class="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
		<!-- General & Production -->
		<section>
			<h3 class="mb-2 flex items-center gap-2 border-b border-white/20 pb-1.5 text-base font-semibold text-white/90">
				<Activity size={18} />
				General
			</h3>
			<div class="grid gap-1.5 sm:grid-cols-2">
				<StatItem
					fullValue={timeSinceStart}
					icon={Clock}
					label="Time Since Start"
					value={timeSinceStart}
				/>
				<StatItem
					fullValue={formatDuration(gameManager.inGameTime)}
					icon={Timer}
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
					icon={TrendingUp}
					label="Total XP"
					value={formatNumber(gameManager.totalXP)}
				/>
				<StatItem
					fullValue={`${gameManager.achievements.length} / ${totalAchievements}`}
					icon={Award}
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
					icon={Zap}
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
					icon={Timer}
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
					icon={MousePointerClick}
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
					icon={Building2}
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
					icon={Package}
					label="Upgrades Purchased"
					value={formatNumber(gameManager.totalUpgradesPurchasedAllTime, 0)}
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
					icon={Timer}
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
										icon={RotateCcw}
										label="Times Electronized"
										value={gameManager.totalElectronizesRun}
									/>
									<StatItem
										fullValue={formatNumberFull(gameManager.totalElectronizesAllTime)}
										icon={RotateCcw}
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
						icon={Timer}
						label="Photon Auto Clicks/s"
						value={formatNumber(gameManager.photonAutoClicksPer5Seconds / 5)}
					/>
					<StatItem
						fullValue={`${(gameManager.excitedPhotonChance * 100).toFixed(3)}%`}
						icon={Sparkles}
						label="Excited Photon Chance"
						suffix="%"
						value={(gameManager.excitedPhotonChance * 100).toFixed(2)}
					/>
				</div>
			</section>
		{/if}
	</div>
</Modal>
