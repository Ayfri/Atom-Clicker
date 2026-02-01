<script lang="ts">
	import { CurrenciesTypes } from '$data/currencies';
	import { getUpgradesWithEffects } from '$helpers/effects';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { ELECTRONS_PROTONS_REQUIRED } from '$lib/constants';
	import { formatNumber } from '$lib/utils';
	import Modal from '@components/ui/Modal.svelte';
	import Tooltip from '@components/ui/Tooltip.svelte';
	import Value from '@components/ui/Value.svelte';
	import { Info } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let canElectronize = $derived(gameManager.protons >= ELECTRONS_PROTONS_REQUIRED || gameManager.electronizeElectronsGain > 0);

	interface GainBreakdownItem {
		after: number;
		before: number;
		description: string;
		name: string;
	}

	const formatUpgradeName = (value: string) => value
		.replace(/[_-]+/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, char => char.toUpperCase());

	const getUpgradeLabel = (upgrade: { id?: string; name?: string }) => {
		const rawName = typeof upgrade.name === 'string' && upgrade.name.trim().length > 0
			? upgrade.name
			: upgrade.id ?? 'Unknown Upgrade';
		return formatUpgradeName(rawName);
	};

	const electronGainBreakdown = $derived.by(() => {
		const baseGain = gameManager.protons < ELECTRONS_PROTONS_REQUIRED ? 0 : 1;
		const options = { type: 'electron_gain' as const };
		const upgrades = getUpgradesWithEffects(gameManager.allEffectSources, options);
		let currentValue = baseGain;
		const effects: GainBreakdownItem[] = [];

		for (const upgrade of upgrades) {
			if (!('effects' in upgrade) || !Array.isArray(upgrade.effects)) continue;
			const upgradeName = getUpgradeLabel(upgrade);
			for (const effect of upgrade.effects) {
				if (effect.type !== options.type) continue;
				const before = currentValue;
				const after = effect.apply(currentValue, gameManager);
				effects.push({
					after,
					before,
					description: effect.description,
					name: upgradeName,
				});
				currentValue = after;
			}
		}

		const boostMultiplier = gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.ELECTRONS);
		const finalValue = currentValue * boostMultiplier;

		return {
			base: baseGain,
			boostMultiplier,
			effects,
			final: finalValue,
			multiplier: baseGain > 0 ? finalValue / baseGain : 0,
		};
	});

	function handleElectronize() {
		gameManager.electronize();
		onClose();
	}
</script>

<Modal {onClose} title="Electronize">
	<div class="flex flex-col gap-8">
		<div class="text-center">
			<h2 class="text-2xl font-bold mb-2">Electronize your protons</h2>
			<p class="text-gray-300">
				Transform your protons into electrons, a powerful new currency.
				<br />
				You'll start over, but with new upgrades!
			</p>
		</div>

		<div class="bg-black/20 rounded-lg p-4">
			<div class="flex justify-between items-center mb-2">
				<span>Current Protons:</span>
				<Value class="font-bold text-yellow-400" currency={CurrenciesTypes.PROTONS} value={gameManager.protons} />
			</div>
			<div class="flex justify-between items-center mb-4">
				<div class="flex items-center gap-2">
					<span>Electrons to gain:</span>
					<Tooltip position="right" size="md">
						<span class="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/20">
							Gain details
							<Info size={12} class="opacity-70" />
						</span>
						{#snippet content()}
							<div class="flex flex-col gap-2">
								<span class="text-[11px] font-bold uppercase tracking-wider text-green-300">Electron Gain</span>
								<p class="text-[11px] text-white/70">
									Electrons are skittish sparks — the forge teases out only a small charge unless your upgrades stabilize the flow.
								</p>
								<div class="grid gap-1 text-xs">
									<div class="flex items-center justify-between gap-3">
										<span class="text-white/70">Core yield</span>
										<Value value={electronGainBreakdown.base} currency={CurrenciesTypes.ELECTRONS} class="font-semibold text-green-200" />
									</div>
									<div class="flex items-center justify-between gap-3">
										<span class="text-white/70">Charge amplification</span>
										{#if electronGainBreakdown.base > 0}
											<span class="font-mono text-green-200">x{formatNumber(electronGainBreakdown.multiplier, 2)}</span>
										{:else}
											<span class="text-white/50">—</span>
										{/if}
									</div>
									<div class="flex items-center justify-between gap-3">
										<span class="text-white/70">Final yield</span>
										<Value value={electronGainBreakdown.final} currency={CurrenciesTypes.ELECTRONS} class="font-semibold text-green-300" />
									</div>
								</div>

								<div class="h-px bg-white/10"></div>
								<span class="text-[10px] uppercase tracking-wider text-white/40">Upgrade effects</span>
								{#if electronGainBreakdown.effects.length > 0}
									<div class="flex flex-col gap-1 text-xs">
										{#each electronGainBreakdown.effects as effect, effectIndex (effect.name + effect.description + effectIndex)}
											<div class="flex items-start justify-between gap-3">
												<div class="flex flex-col">
													<span class="text-white/80">{effect.name}</span>
													<span class="text-[11px] text-white/50">{effect.description}</span>
												</div>
												<span class="font-mono text-[11px] text-white/70 whitespace-nowrap">
													{formatNumber(effect.before)} → {formatNumber(effect.after)}
												</span>
											</div>
										{/each}
									</div>
								{:else}
									<span class="text-[11px] text-white/50">No upgrades affecting gain.</span>
								{/if}

								<div class="h-px bg-white/10"></div>
								<span class="text-[10px] uppercase tracking-wider text-white/40">Currency Boost</span>
								{#if electronGainBreakdown.boostMultiplier > 1}
									<div class="flex items-center justify-between gap-3 text-xs">
										<span class="text-white/80">Electron Boost</span>
										<span class="font-mono text-white/70">x{formatNumber(electronGainBreakdown.boostMultiplier, 2)}</span>
									</div>
								{:else}
									<span class="text-[11px] text-white/50">No active electron boosts.</span>
								{/if}

								<div class="h-px bg-white/10"></div>
								<span class="text-[10px] uppercase tracking-wider text-white/40">Temporary boosts</span>
								{#if gameManager.activePowerUps.length > 0}
									<div class="flex flex-col gap-1 text-xs">
										{#each gameManager.activePowerUps as powerUp (powerUp.id)}
											<div class="flex items-center justify-between gap-3">
												<span class="text-white/80">{powerUp.name}</span>
												<span class="font-mono text-white/70">x{formatNumber(powerUp.multiplier, 2)}</span>
											</div>
										{/each}
									</div>
								{:else}
									<span class="text-[11px] text-white/50">No active boosts.</span>
								{/if}
							</div>
						{/snippet}
					</Tooltip>
				</div>
				<Value
					class="font-bold text-green-400"
					currency={CurrenciesTypes.ELECTRONS}
					value={gameManager.electronizeElectronsGain}
				/>
			</div>
			<div class="flex justify-between items-center">
				<span>Current Electrons:</span>
				<Value class="font-bold text-green-400" currency={CurrenciesTypes.ELECTRONS} value={gameManager.electrons ?? 0} />
			</div>
		</div>

		<button
			class="electronize-button"
			onclick={handleElectronize}
			disabled={!canElectronize || gameManager.electronizeElectronsGain === 0}
		>
			<div class="pulse-overlay"></div>
			<span class="z-10 relative">Electronize</span>
		</button>

		{#if !canElectronize}
			<p class="text-sm text-gray-400 text-center">Reach 1 billion protons to unlock Electronize</p>
		{/if}
	</div>
</Modal>

<style>
	.electronize-button {
		background: linear-gradient(45deg, #45d945 0%, #2a862a 100%);
		border: none;
		border-radius: 8px;
		color: white;
		cursor: pointer;
		font-size: 1.2rem;
		font-weight: bold;
		overflow: hidden;
		padding: 1rem;
		position: relative;
		text-transform: uppercase;
		transition: all 0.3s;
	}

	.electronize-button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.electronize-button:not(:disabled):hover {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(69, 217, 69, 0.4);
	}

	.pulse-overlay {
		background: radial-gradient(circle, rgba(69, 217, 69, 0.2) 0%, transparent 70%);
		height: 100%;
		left: 0;
		position: absolute;
		top: 0;
		width: 100%;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 0.6;
		}
		50% {
			transform: scale(1.5);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 0.6;
		}
	}
</style>
