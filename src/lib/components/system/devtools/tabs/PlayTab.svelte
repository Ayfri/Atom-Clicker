<script lang="ts">
	import { CURRENCIES, type CurrencyName } from '$data/currencies';
	import { POWER_UPS } from '$data/powerUp';
	import OfflineProgress from '@components/modals/OfflineProgress.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { applyOfflineProgress } from '$helpers/offlineProgress';
	import { formatDuration, formatNumber } from '$lib/utils';
	import { toastStore } from '$stores/toasts.svelte';
	import { ui } from '$stores/ui.svelte';
	import { btn, btnAccent, setCurrency } from '../shared.svelte';
	import NumberInput from '../NumberInput.svelte';
	import Section from '../Section.svelte';

	const currencies = Object.keys(CURRENCIES) as CurrencyName[];
	const SKIPS = [
		['1m', 60_000],
		['10m', 600_000],
		['1h', 3_600_000],
		['1d', 86_400_000],
	] as const;

	const readouts = $derived([
		['Atoms/s', formatNumber(gameManager.atomsPerSecond)],
		['Click', formatNumber(gameManager.clickPower)],
		['Global', `x${formatNumber(gameManager.globalMultiplier)}`],
		['Power-ups', `x${formatNumber(gameManager.bonusMultiplier)}`],
		['Stability', `x${gameManager.stabilityMultiplier.toFixed(2)}`],
		['Radiation', `x${formatNumber(gameManager.radiationMultiplier)}`],
		['Level', `${gameManager.playerLevel} (${gameManager.xpProgress.toFixed(0)}%)`],
		['Played', formatDuration(gameManager.inGameTime)],
	]);

	/**
	 * Runs the real tick in at most 1000 steps so achievements and reactor decay behave like played time.
	 * `inGameTime` is put back afterwards, the save plausibility check flags play time longer than the wall clock.
	 */
	function skip(ms: number) {
		const inGameTime = gameManager.inGameTime;
		const steps = Math.min(1000, ms / 1000);
		for (let i = 0; i < steps; i++) gameManager.tick(ms / steps);
		gameManager.inGameTime = inGameTime;
	}

	function simulateOffline() {
		const summary = applyOfflineProgress(gameManager, 12 * 3_600_000);
		if (!summary) return toastStore.info({ message: 'Offline progress is locked or disabled in settings.', title: 'Offline progress' });
		gameManager.offlineProgressSummary = summary;
		ui.openModal(OfflineProgress);
	}

	function addPowerUp({ duration, multiplier, name }: (typeof POWER_UPS)[number]) {
		gameManager.addPowerUp({
			description: name,
			duration: duration * gameManager.powerUpDurationMultiplier,
			id: crypto.randomUUID(),
			multiplier: multiplier * gameManager.powerUpEffectMultiplier,
			name,
			startTime: Date.now(),
		});
	}
</script>

<div class="grid grid-cols-4 gap-px overflow-hidden rounded-lg bg-white/5 text-center">
	{#each readouts as [label, value] (label)}
		<div class="bg-accent-950/60 px-1 py-2">
			<div class="text-[10px] tracking-wider text-white/40 uppercase">{label}</div>
			<div class="truncate font-mono text-sm text-white">{value}</div>
		</div>
	{/each}
</div>

<Section title="Currencies">
	{#snippet actions()}
		<button class={btn} onclick={() => currencies.forEach(currency => setCurrency(currency, 1e100))}>All 1e100</button>
	{/snippet}
	<div class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 gap-y-1.5">
		{#each currencies as currency (currency)}
			{@const amount = gameManager.currencies[currency].amount}
			<span class="flex items-center gap-1.5 text-xs text-white/70"><Currency name={currency} size={14} />{currency}</span>
			<NumberInput onCommit={value => setCurrency(currency, value)} value={amount} />
			<button class={btn} onclick={() => setCurrency(currency, Math.max(amount, 1) * 10)}>x10</button>
			<button class={btn} onclick={() => setCurrency(currency, 0)}>0</button>
		{/each}
	</div>
</Section>

<Section title="Time">
	<div class="flex flex-wrap items-center gap-1">
		<span class="mr-1 text-xs text-white/50">Skip</span>
		{#each SKIPS as [label, ms] (label)}
			<button class={btnAccent} onclick={() => skip(ms)}>{label}</button>
		{/each}
		<button class="{btn} ml-auto" onclick={simulateOffline}>Offline 12h</button>
	</div>
</Section>

<Section title="Power-ups ({gameManager.activePowerUps.length} active)">
	{#snippet actions()}
		<button class={btn} onclick={() => window.dispatchEvent(new CustomEvent('force-bonus'))}>Spawn Higgs</button>
		<button class={btn} disabled={!gameManager.hasBonus} onclick={() => (gameManager.activePowerUps = [])}>Clear</button>
	{/snippet}
	<div class="flex flex-wrap gap-1">
		{#each POWER_UPS as powerUp (powerUp.name)}
			<button class={btn} onclick={() => addPowerUp(powerUp)}>
				{powerUp.name} <span class="font-mono text-white/40">x{powerUp.multiplier} {powerUp.duration / 1000}s</span>
			</button>
		{/each}
	</div>
</Section>

<Section title="Prestige">
	<div class="grid grid-cols-2 gap-1">
		<button class={btnAccent} disabled={!gameManager.canProtonise} onclick={() => gameManager.protonise()}>
			Protonise +{formatNumber(gameManager.protoniseProtonsGain)}
		</button>
		<button class={btnAccent} disabled={gameManager.electronizeElectronsGain <= 0} onclick={() => gameManager.electronize()}>
			Electronize +{formatNumber(gameManager.electronizeElectronsGain)}
		</button>
	</div>
</Section>
