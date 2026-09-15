<script lang="ts">
	import ControlRods from '@components/radiation/ControlRods.svelte';
	import MassSpectrometer from '@components/radiation/MassSpectrometer.svelte';
	import RadiationUpgrades from '@components/radiation/RadiationUpgrades.svelte';
	import ReactorFlow from '@components/radiation/ReactorFlow.svelte';
	import UnstableNucleus from '@components/radiation/UnstableNucleus.svelte';
	import CurrencyLabel from '@components/ui/CurrencyLabel.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { getQuarkShopItem } from '$data/quarkShop';
	import { RealmTypes } from '$data/realms';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { Lock, Zap } from '@lucide/svelte';

	let bombardAmount = $state(10);

	const themeAccent = $derived.by(() => {
		const themeId = quarksManager.equippedThemes[RealmTypes.RADIATION];
		return themeId ? getQuarkShopItem(themeId)?.theme?.accent : undefined;
	});
	const electronBalance = $derived(currenciesManager.getAmount(CurrenciesTypes.ELECTRONS));
	const mass = $derived(radiationManager.mass);
	const cpm = $derived(radiationManager.currentCpm);
	const controlLevel = $derived(radiationManager.controlRodLevel);

	// Mass that will be added (for preview)
	const massToAdd = $derived(bombardAmount * 0.1);
	const cpmToAdd = $derived(radiationManager.cpmFor(mass + massToAdd, controlLevel) - cpm);

	// Progressive unlock stages
	const hasBombarded = $derived(radiationManager.unlocked);
	const hasMass = $derived(mass > 0);
	const hasRaisedPower = $derived(controlLevel > 0 || Object.keys(radiationManager.upgradeLevels).length > 0);
	const hasCpm = $derived(cpm > 0);
	const hasGoodCpm = $derived(cpm >= 10 || Object.keys(radiationManager.upgradeLevels).length > 0);

	function handleBombard() {
		if (!radiationManager.unlocked) {
			radiationManager.unlock();
		}
		radiationManager.bombardCore(bombardAmount);
	}
</script>

<div class="relative pt-20 lg:pt-12 min-h-screen" style={themeAccent ? `--color-radiation: ${themeAccent};` : ''}>
	<!-- Ambient glow -->
	{#if mass > 0}
		<div class="fixed inset-0 -z-50 pointer-events-none overflow-hidden">
			<div
				class="absolute h-100 -left-20 rounded-full top-[20%] w-100"
				style="background: radial-gradient(circle, color-mix(in srgb, var(--color-radiation) {5 + controlLevel * 10}%, transparent) 0%, transparent 60%);"
			></div>
		</div>
	{/if}

	<div class="flex flex-col lg:flex-row px-3 lg:px-6 pt-4 pb-6 max-w-375 mx-auto gap-5">
		<!-- Left: Nucleus + Add Fuel -->
		<div class="lg:w-[42%] flex flex-col items-center gap-4">
			<!-- Nucleus container with fixed size -->
			<div class="w-full max-w-105 lg:max-w-120 aspect-square shrink-0">
				<UnstableNucleus />
			</div>

			<!-- Add Fuel Panel -->
			<div class="w-full max-w-sm bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-radiation/20">
				<h3 class="text-sm font-semibold text-radiation mb-3 flex items-center gap-2">
					<Zap class="w-4 h-4" />
					Add Fuel
					<HelpIcon position="top">
						{#snippet content()}
							<div class="text-left text-xs">
								<p class="font-semibold text-radiation mb-1">How it works:</p>
								<p class="text-white/70">
									1. Turn <CurrencyLabel name={CurrenciesTypes.ELECTRONS} size={12} /> into fuel (10 = 1 u)
								</p>
								<p class="text-white/70">2. Raise the power level</p>
								<p class="text-white/70">3. Everything produces more!</p>
								<p class="text-white/50 mt-2">More power means more bonus but fuel burns much faster.</p>
							</div>
						{/snippet}
					</HelpIcon>
				</h3>

				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between text-xs">
						<span class="text-white/50">Available:</span>
						<Value
							class="text-radiation"
							value={electronBalance}
							currency={CurrenciesTypes.ELECTRONS}
						/>
					</div>
					<input
						type="range"
						min="1"
						max={Math.max(1, Math.floor(electronBalance))}
						bind:value={bombardAmount}
						class="w-full accent-radiation"
					/>
					<div class="flex items-center justify-between text-xs">
						<span class="text-white/50">Amount:</span>
						<span class="text-radiation font-mono">
							{bombardAmount}
							<span class="text-white/30">(+{massToAdd.toFixed(1)}u{cpmToAdd > 0 ? `, +${formatNumber(cpmToAdd, 0)} CPM` : ''})</span>
						</span>
					</div>
					<button
						onclick={handleBombard}
						disabled={electronBalance < bombardAmount}
						class="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
							{electronBalance >= bombardAmount ?
							'bg-radiation text-black cursor-pointer hover:brightness-110'
						:	'bg-white/10 text-white/40 cursor-not-allowed'}"
					>
						Add Fuel
					</button>
				</div>
			</div>
		</div>

		<!-- Right: Controls & Stats -->
		<div class="lg:w-[58%] flex flex-col gap-3">
			{#if hasMass}
				<ReactorFlow />
			{/if}

			<!-- Step 1: Fuel display with preview -->
			{#if hasMass || hasBombarded}
				<MassSpectrometer previewMass={massToAdd} />
			{/if}

			<!-- Step 2: Power control -->
			{#if hasMass}
				<ControlRods />
				{#if !hasRaisedPower}
					<div class="bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/30 text-center">
						<p class="text-yellow-400 text-xs">Raise the power level above 0% to start generating CPM</p>
					</div>
				{/if}
			{:else if hasBombarded}
				<div class="flex items-center justify-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
					<Lock class="w-4 h-4 text-white/30" />
					<span class="text-white/40 text-sm">Add fuel to unlock Power Level</span>
				</div>
			{/if}

			<!-- Step 3: Upgrades -->
			{#if hasGoodCpm}
				<RadiationUpgrades />
			{:else if hasCpm}
				<div class="flex items-center justify-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
					<Lock class="w-4 h-4 text-white/30" />
					<span class="text-white/40 text-sm">Reach 10 CPM to unlock upgrades ({cpm.toFixed(0)}/10)</span>
				</div>
			{/if}
		</div>
	</div>
</div>
