<script lang="ts">
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { GENERATOR_TYPES, GENERATORS, getGeneratorColor, type GeneratorType } from '$data/generators';
	import { GENERATOR_ICON_NAMES, ICONS } from '$data/icons';
	import Currency from '@components/ui/Currency.svelte';
	import { getUpgradesWithEffects } from '$helpers/effects';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { MAX_BOOST_POINTS } from '$lib/constants';
	import { formatNumber } from '$lib/utils';
	import { autoBuyManager } from '$stores/autoBuy.svelte';
	import { autoUpgradeManager } from '$stores/autoUpgrade.svelte';
	import { btn, checkbox, setGeneratorCount } from '../shared.svelte';
	import NumberInput from '../NumberInput.svelte';
	import Section from '../Section.svelte';

	const BOOSTABLE: CurrencyName[] = [CurrenciesTypes.ATOMS, CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS, CurrenciesTypes.PHOTONS, CurrenciesTypes.EXCITED_PHOTONS];

	const autoBuyUnlocked = $derived(
		new Set(
			getUpgradesWithEffects(gameManager.currentUpgradesBought, { type: 'auto_buy' }).flatMap(upgrade =>
				upgrade.effects.filter(effect => effect.type === 'auto_buy' && effect.target).map(effect => effect.target as GeneratorType),
			),
		),
	);
	const autoUpgradeUnlocked = $derived(getUpgradesWithEffects(gameManager.currentUpgradesBought, { type: 'auto_upgrade' }).length > 0);
	const automation = $derived(gameManager.settings.automation);
	const intervals = $derived(autoBuyManager.autoBuyIntervals);

	const setAutoBuy = (generators: GeneratorType[]) => (gameManager.settings.automation.generators = generators);
</script>

<Section title="Generators">
	{#snippet actions()}
		<button class={btn} onclick={() => GENERATOR_TYPES.forEach(type => setGeneratorCount(type, (gameManager.generators[type]?.count ?? 0) + 100))}>
			+100 all
		</button>
		<button class={btn} onclick={() => (gameManager.generators = {})}>Clear</button>
	{/snippet}
	<div class="grid grid-cols-[1fr_5.5rem_2.5rem_4.5rem_auto] items-center gap-x-2 gap-y-1.5 text-xs">
		<span class="text-[10px] text-white/30">Name</span>
		<span class="text-[10px] text-white/30">Count</span>
		<span class="text-[10px] text-white/30">Lvl</span>
		<span class="text-right text-[10px] text-white/30">Atoms/s</span>
		<span class="text-[10px] text-white/30" title="Auto-buy">Auto</span>
		{#each GENERATOR_TYPES as type (type)}
			{@const generator = gameManager.generators[type]}
			{@const Icon = ICONS[GENERATOR_ICON_NAMES[type]]}
			{@const interval = intervals[type]}
			<span class="flex min-w-0 items-center gap-1.5 {generator?.count ? 'text-white' : 'text-white/40'}">
				<Icon color={getGeneratorColor(generator?.level ?? 0)} size={16} />
				<span class="truncate">{GENERATORS[type].name}</span>
			</span>
			<NumberInput onCommit={value => setGeneratorCount(type, value)} value={generator?.count ?? 0} />
			<span class="font-mono text-white/50">{generator?.level ?? 0}</span>
			<span class="text-right font-mono text-white/60">{formatNumber(gameManager.generatorProductions[type])}</span>
			<label class="flex items-center gap-1" title={autoBuyUnlocked.has(type) ? 'Auto-buy' : 'Auto-buy upgrade not owned'}>
				<input
					checked={automation.generators.includes(type)}
					class={checkbox}
					onchange={() => gameManager.toggleAutomation(type)}
					type="checkbox"
				/>
				<span class="font-mono text-[10px] {autoBuyManager.recentlyAutoPurchasedGenerators.has(type) ? 'text-accent-300' : 'text-white/25'}">
					{autoBuyUnlocked.has(type) ? (interval ? `${(interval / 1000).toFixed(1)}s` : 'off') : 'lock'}
				</span>
			</label>
		{/each}
	</div>
</Section>

<Section title="Automation">
	{#snippet actions()}
		<button class={btn} onclick={() => setAutoBuy(GENERATOR_TYPES.filter(type => autoBuyUnlocked.has(type)))}>Auto-buy owned</button>
		<button class={btn} onclick={() => setAutoBuy([])}>None</button>
	{/snippet}
	<div class="flex flex-col gap-2 text-xs text-white/70">
		<label class="flex items-center gap-2">
			<input checked={automation.autoClick} class={checkbox} onchange={() => gameManager.toggleAutoClick()} type="checkbox" />
			Auto-click atoms <span class="ml-auto font-mono text-white/40">{formatNumber(gameManager.autoClicksPerSecond, 1)}/s</span>
		</label>
		<label class="flex items-center gap-2">
			<input checked={automation.autoClickPhotons} class={checkbox} onchange={() => gameManager.toggleAutoClickPhotons()} type="checkbox" />
			Auto-click photons <span class="ml-auto font-mono text-white/40">{formatNumber(gameManager.photonAutoClicksPer5Seconds, 1)}/5s</span>
		</label>
		<div class="flex items-center gap-2">
			<label class="flex items-center gap-2">
				<input checked={automation.upgrades} class={checkbox} onchange={() => gameManager.toggleUpgradeAutomation()} type="checkbox" />
				Auto-upgrade {autoUpgradeUnlocked ? '' : '(not owned)'}
			</label>
			<span class="ml-auto font-mono text-white/40">
				{autoUpgradeManager.autoUpgradeInterval ? `${autoUpgradeManager.autoUpgradeInterval / 1000}s` : 'off'}
			</span>
			<button class={btn} disabled={!automation.upgrades} onclick={() => autoUpgradeManager.purchaseAvailableUpgrades()}>Run</button>
		</div>
	</div>
</Section>

<Section title="Currency boosts {gameManager.boostPointsUsed}/{gameManager.boostPointsTotal}">
	{#snippet actions()}
		<button class={btn} onclick={() => gameManager.splitCurrencyBoostsEvenly(BOOSTABLE)}>Split</button>
		<button class={btn} disabled={gameManager.boostPointsUsed === 0} onclick={() => gameManager.resetCurrencyBoosts()}>Reset</button>
	{/snippet}
	<div class="grid grid-cols-[1fr_auto_1.5rem_auto_3rem] items-center gap-x-2 gap-y-1.5 text-xs">
		{#each BOOSTABLE as currency (currency)}
			{@const points = gameManager.currencyBoosts[currency] ?? 0}
			<span class="flex items-center gap-1.5 text-white/70"><Currency name={currency} size={14} />{currency}</span>
			<button class={btn} disabled={points <= 0} onclick={() => gameManager.removeCurrencyBoost(currency)}>-</button>
			<span class="text-center font-mono text-white">{points}</span>
			<button
				class={btn}
				disabled={gameManager.boostPointsAvailable <= 0 || points >= MAX_BOOST_POINTS}
				onclick={() => gameManager.addCurrencyBoost(currency)}
			>
				+
			</button>
			<span class="text-right font-mono text-yellow-300/80">x{gameManager.getCurrencyBoostMultiplier(currency).toFixed(1)}</span>
		{/each}
	</div>
</Section>
