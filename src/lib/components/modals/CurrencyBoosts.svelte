<script lang="ts">
	import Currency from '@components/ui/Currency.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { Minus, Plus, Zap } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const boostableCurrencies: CurrencyName[] = [
		CurrenciesTypes.ATOMS,
		CurrenciesTypes.PROTONS,
		CurrenciesTypes.ELECTRONS,
		CurrenciesTypes.PHOTONS,
		CurrenciesTypes.EXCITED_PHOTONS
	];
</script>

<Modal {onClose} title="Currency Boosts" width="sm">
	<div class="flex flex-col gap-4">
		<!-- Header info -->
		<div class="rounded-lg bg-black/20 p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Zap size={20} class="text-yellow-400" />
					<span class="font-bold text-white">Skill Points</span>
				</div>
				<span class="font-mono text-xl font-bold text-yellow-400">
					{gameManager.skillPointsAvailable} / {gameManager.skillPointsTotal}
				</span>
			</div>
			<p class="mt-2 text-sm text-white/60">
				Earn skill points by leveling up your buildings. Each point adds <span class="font-bold text-yellow-300">+10%</span> production to a currency (max 20 points per currency).
			</p>
			<p class="mt-1 text-xs text-red-400/80">
				Skill point allocations reset on Protonise or Electronize.
			</p>
		</div>

		<!-- Currency list -->
		<div class="flex flex-col gap-2">
			{#each boostableCurrencies as currencyName (currencyName)}
				{@const points = gameManager.skillPointBoosts[currencyName] ?? 0}
				{@const multiplier = gameManager.getCurrencyBoostMultiplier(currencyName)}
				<div class="flex items-center justify-between gap-3 rounded-lg bg-accent-800/50 p-3 transition hover:bg-accent-800/70">
					<div class="flex items-center gap-3">
						<Currency name={currencyName} class="h-8 w-8" />
						<div class="flex flex-col">
							<span class="font-medium text-white">{currencyName}</span>
							<span class="font-mono text-sm text-yellow-400">×{multiplier.toFixed(1)}</span>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<button
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
							disabled={points <= 0}
							onclick={() => gameManager.removeCurrencyBoost(currencyName)}
						>
							<Minus size={16} />
						</button>
						<span class="w-8 text-center font-mono text-lg font-bold text-white">{points}</span>
						<button
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
							disabled={gameManager.skillPointsAvailable <= 0 || points >= 20}
							onclick={() => gameManager.addCurrencyBoost(currencyName)}
						>
							<Plus size={16} />
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Progress bars showing distribution -->
		{#if gameManager.skillPointsTotal > 0}
			<div class="rounded-lg bg-black/20 p-3">
				<div class="mb-2 flex items-center justify-between text-xs text-white/50">
					<span>Points allocated</span>
					<span>{gameManager.skillPointsUsed} / {gameManager.skillPointsTotal}</span>
				</div>
				<div class="h-2 w-full overflow-hidden rounded-full bg-black/40">
					<div
						class="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-300"
						style="width: {(gameManager.skillPointsUsed / gameManager.skillPointsTotal) * 100}%"
					></div>
				</div>
			</div>
		{/if}
	</div>
</Modal>
