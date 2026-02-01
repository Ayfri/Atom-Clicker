<script lang="ts">
	import Currency from '@components/ui/Currency.svelte';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { Minus, Plus, RefreshCcw, Zap } from 'lucide-svelte';

	const boostableCurrencies: CurrencyName[] = [
		CurrenciesTypes.ATOMS,
		CurrenciesTypes.PROTONS,
		CurrenciesTypes.ELECTRONS,
		CurrenciesTypes.PHOTONS,
		CurrenciesTypes.EXCITED_PHOTONS
	];
</script>

<div class="flex flex-col gap-4">
	<!-- Header info -->
	<div class="rounded-lg bg-black/20 p-4 border border-white/5">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2 text-accent-300">
				<Zap size={20} class="text-yellow-400" />
				<span class="font-bold">Currency Boost</span>
			</div>
			<span class="font-mono text-xl font-bold text-yellow-400">
				{gameManager.skillPointsAvailable} / {gameManager.skillPointsTotal}
			</span>
		</div>
		<p class="mt-2 text-sm text-white/60">
			Manage currency boosts from building levels. Each point adds <span class="font-bold text-yellow-300">+10%</span> production.
		</p>
		<div class="mt-4 flex justify-end">
			<button
				class="flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/30 border border-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
				disabled={gameManager.skillPointsUsed <= 0}
				onclick={() => {
					Object.keys(gameManager.skillPointBoosts).forEach(key => {
						gameManager.skillPointBoosts[key as CurrencyName] = 0;
					});
				}}
			>
				<RefreshCcw size={14} />
				<span>Reset All</span>
			</button>
		</div>
	</div>

	<!-- Currency list -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
		{#each boostableCurrencies as currencyName (currencyName)}
			{@const points = gameManager.skillPointBoosts[currencyName] ?? 0}
			{@const multiplier = gameManager.getCurrencyBoostMultiplier(currencyName)}
			<div class="flex items-center justify-between gap-3 rounded-lg bg-white/5 p-3 border border-white/5 transition hover:bg-white/10">
				<div class="flex items-center gap-3">
					<Currency name={currencyName} class="h-8 w-8" />
					<div class="flex flex-col">
						<span class="font-medium text-white text-sm">{currencyName}</span>
						<span class="font-mono text-xs text-yellow-400">×{multiplier.toFixed(1)}</span>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						class="flex h-7 w-7 items-center justify-center rounded bg-red-500/10 text-red-400/60 transition hover:bg-red-500/20 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
						disabled={points <= 0}
						onclick={() => {
							gameManager.skillPointBoosts[currencyName] = 0;
						}}
						title="Reset {currencyName}"
					>
						<RefreshCcw size={14} />
					</button>
					<div class="h-4 w-px bg-white/10 mx-1"></div>
					<button
						class="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
						disabled={points <= 0}
						onclick={() => gameManager.removeCurrencyBoost(currencyName)}
					>
						<Minus size={14} />
					</button>
					<span class="w-6 text-center font-mono text-sm font-bold text-white">{points}</span>
					<button
						class="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
						disabled={gameManager.skillPointsAvailable <= 0 || points >= 20}
						onclick={() => gameManager.addCurrencyBoost(currencyName)}
					>
						<Plus size={14} />
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
