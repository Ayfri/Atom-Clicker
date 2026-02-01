<script lang="ts">
	import { CurrenciesTypes } from '$data/currencies';
	import { FeatureTypes } from '$data/features';
	import { getUpgradesWithEffects } from '$helpers/effects';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { PROTONS_ATOMS_REQUIRED } from '$lib/constants';
	import { formatDuration, formatNumber } from '$lib/utils';
	import Modal from '@components/ui/Modal.svelte';
	import Tooltip from '@components/ui/Tooltip.svelte';
	import Value from '@components/ui/Value.svelte';
	import { Info } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let canProtonise = $derived(gameManager.atoms >= PROTONS_ATOMS_REQUIRED || gameManager.protons > 0);

	function handleProtonise() {
		gameManager.protonise();
		onClose();
	}

	let isStabilityUnlocked = $derived(gameManager.features[FeatureTypes.STABILITY_FIELD] === true);
	let stabilityProgress = $state(0);
	let maxBoostDisplay = $state(0);
	let timeLeftDisplay = $state(0);

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

	const protonGainBreakdown = $derived.by(() => {
		const baseGain = gameManager.atoms < PROTONS_ATOMS_REQUIRED
			? 0
			: Math.floor(Math.sqrt(gameManager.atoms / PROTONS_ATOMS_REQUIRED));
		const options = { type: 'proton_gain' as const };
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

		return {
			base: baseGain,
			effects,
			final: currentValue,
			multiplier: baseGain > 0 ? currentValue / baseGain : 0,
		};
	});

	$effect(() => {
		const interval = setInterval(() => {
			if (!isStabilityUnlocked) {
				stabilityProgress = 0;
				maxBoostDisplay = 0;
				timeLeftDisplay = 0;
				return;
			}
			if (gameManager.activePowerUps.length > 0) {
				stabilityProgress = 0;
				timeLeftDisplay = 0;
				return;
			}

			const timeToMax = (600000 * gameManager.stabilityCapacity) / gameManager.stabilitySpeed;

			const elapsed = Date.now() - gameManager.lastInteractionTime;
			stabilityProgress = Math.min(Math.max(elapsed / timeToMax, 0), 1) * 100;
			timeLeftDisplay = Math.max(timeToMax - elapsed, 0);

			maxBoostDisplay = 1 + (gameManager.stabilityMaxBoost - 1) * gameManager.stabilityCapacity;

		}, 100);

		return () => clearInterval(interval);
	});
</script>

<Modal {onClose} title="Protonise" containerClass="relative">
	<div class="flex flex-col gap-8">
		<div class="text-center">
			<h2 class="text-2xl font-bold mb-2">Protonise your atoms</h2>
			<p class="text-gray-300">
				Convert your atoms into protons, a powerful new currency.
				<br />
				You'll start over, but with new upgrades!
			</p>
		</div>

		<div class="bg-black/20 rounded-lg p-4 space-y-2">
			<div class="flex justify-between items-center">
				<span class="text-gray-300">Current Atoms:</span>
				<Value value={gameManager.atoms} currency={CurrenciesTypes.ATOMS} class="font-bold" />
			</div>
			<div class="flex justify-between items-center">
				<div class="flex items-center gap-2 text-gray-300">
					<span>Protons to gain:</span>
					<Tooltip position="right" size="md">
						<span class="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/20">
							Gain details
							<Info size={12} class="opacity-70" />
						</span>
						{#snippet content()}
							<div class="flex flex-col gap-2">
								<span class="text-[11px] font-bold uppercase tracking-wider text-yellow-300">Proton Gain</span>
								<p class="text-[11px] text-white/70">
									Your reactor compresses vast atom clouds into dense proton cores — bigger stockpiles forge richer yields.
								</p>
								<div class="grid gap-1 text-xs">
									<div class="flex items-center justify-between gap-3">
										<span class="text-white/70">Core yield</span>
										<Value value={protonGainBreakdown.base} currency={CurrenciesTypes.PROTONS} class="font-semibold text-yellow-200" />
									</div>
									<div class="flex items-center justify-between gap-3">
										<span class="text-white/70">Reactor amplification</span>
										{#if protonGainBreakdown.base > 0}
											<span class="font-mono text-yellow-200">x{formatNumber(protonGainBreakdown.multiplier, 2)}</span>
										{:else}
											<span class="text-white/50">—</span>
										{/if}
									</div>
									<div class="flex items-center justify-between gap-3">
										<span class="text-white/70">Final yield</span>
										<Value value={protonGainBreakdown.final} currency={CurrenciesTypes.PROTONS} class="font-semibold text-yellow-300" />
									</div>
								</div>

								<div class="h-px bg-white/10"></div>
								<span class="text-[10px] uppercase tracking-wider text-white/40">Upgrade effects</span>
								{#if protonGainBreakdown.effects.length > 0}
									<div class="flex flex-col gap-1 text-xs">
										{#each protonGainBreakdown.effects as effect, effectIndex (effect.name + effect.description + effectIndex)}
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
				<Value value={gameManager.protoniseProtonsGain} currency={CurrenciesTypes.PROTONS} class="font-bold text-yellow-400" />
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-300">Current Protons:</span>
				<Value value={gameManager.protons ?? 0} currency={CurrenciesTypes.PROTONS} class="font-bold text-yellow-400" />
			</div>
		</div>

		<button
			class="
				protonise-button group relative flex items-center justify-center w-full py-4 px-6 rounded-lg text-white font-bold text-lg shadow-lg overflow-hidden transition-all duration-300 transform border-2 border-transparent bg-clip-padding hover:scale-[1.02]
				disabled:before:hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:border-red-900 disabled:bg-black/50 disabled:hover:scale-100
			"
			disabled={!canProtonise || gameManager.protoniseProtonsGain === 0}
			onclick={handleProtonise}
		>
			<div class="absolute inset-0.5 bg-gray-900 rounded transition-all duration-150 group-hover:inset-8 group-hover:rounded-3xl"></div>
			<span class="z-10 relative">Protonise</span>
		</button>

		{#if !canProtonise}
			<p class="text-sm text-gray-400 text-center">Reach 1 billion atoms to unlock Protonise</p>
		{/if}
	</div>

	{#if isStabilityUnlocked}
		<div class="bg-yellow-500/5 rounded-lg p-3 absolute bottom-0 left-0 right-0 m-8 border border-yellow-200/20">
			<div class="flex justify-between items-end mb-2">
				<div class="flex flex-col">
					<span class="text-yellow-100 font-bold text-sm uppercase tracking-wider">Stability Field</span>
					<span class="text-[10px] text-yellow-200/60 uppercase">Idle Bonus</span>
				</div>
				<div class="text-right">
					<div class="text-xs text-yellow-50">
						<span class="text-gray-400">Current: </span>
						<span class="font-mono font-bold text-white">x{gameManager.stabilityMultiplier.toFixed(2)}</span>
					</div>
					<div class="text-xs text-yellow-50">
						<span class="text-gray-400">Max: </span>
						<span class="font-mono font-bold text-white">x{maxBoostDisplay.toFixed(2)}</span>
					</div>
				</div>
			</div>

			<div class="w-full h-3 bg-yellow-500/10 rounded-full overflow-hidden border border-yellow-200/10 mb-2 relative">
				<div
					class="h-full bg-linear-to-r from-yellow-600 to-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-all duration-200 ease-linear w-full"
					style="clip-path: inset(0 {100 - stabilityProgress}% 0 0);"
				></div>
				<div class="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-white drop-shadow-md">
					{stabilityProgress.toFixed(1)}%
				</div>
			</div>

			<div class="flex justify-between items-center text-xs">
				{#if gameManager.activePowerUps.length > 0}
					<span class="text-red-400 animate-pulse font-medium">Paused (Active Boost)</span>
				{:else if stabilityProgress >= 100}
					<span class="text-yellow-200 font-medium">Maximum Stability Reached</span>
				{:else}
					<span class="text-yellow-100">Stabilizing...</span>
				{/if}

				<Tooltip position="left" size="sm">
					<Info size={14} class="text-white/70 hover:text-white transition-colors cursor-help" />
					{#snippet content()}
						<div class="flex flex-col gap-1">
							<span class="font-bold text-yellow-300">Stability Field</span>
							<p>Provides a production multiplier that grows over time while you are idle.</p>
							<p class="text-red-300">Interaction (clicking, buying) will reset the stabilization process.</p>
						</div>
					{/snippet}
				</Tooltip>
			</div>
		</div>
	{/if}
</Modal>

<style>
	.protonise-button::before {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: 0.5rem;
		animation: rotate 7s linear infinite;
		background: linear-gradient(
			90deg,
			var(--color-blue-900),
			var(--color-purple-800),
			var(--color-blue-800),
			var(--color-indigo-900),
			var(--color-blue-900)
		);
		background-size: 300% 100%;
	}

	.protonise-button:hover::before {
		animation: rotate 4s linear infinite;
	}

	@keyframes rotate {
		0% {
			background-position: 0% 50%;
		}
		100% {
			background-position: 300% 50%;
		}
	}
</style>
