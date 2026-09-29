<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { IONIZE_CPM, IONIZE_HOLD_SECONDS, radiationManager } from '$helpers/RadiationManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { prestigeStore } from '$stores/prestige.svelte';
	import HoldButton from '@components/ui/HoldButton.svelte';
	import Modal from '@components/ui/Modal.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const holdProgress = $derived(Math.min(radiationManager.ionizeHold / IONIZE_HOLD_SECONDS, 1));
	const aboveThreshold = $derived(radiationManager.currentCpm >= IONIZE_CPM);

	const RESETS = ['Atoms, generators and upgrades', 'Protons', 'Photons and Excited Photons', 'Radiation upgrades and the reactor core'];
	const KEEPS = ['Electrons', 'Photon upgrades', 'Proton and electron upgrades', 'Skills and achievements'];

	function handleIonize() {
		prestigeStore.trigger('ionize');
		setTimeout(() => gameManager.ionize(), 2000); // Wait for the flash
		onClose();
	}
</script>

<Modal
	{onClose}
	title="Ionize"
>
	<div class="flex flex-col gap-6">
		<p class="text-center text-gray-300">
			Push the reactor past its limits and strip every atom of its electrons. Your first Ionize installs a Prism in the Photon Realm.
		</p>

		<div class="flex flex-col gap-2">
			<div class="flex items-baseline justify-between text-sm">
				<span class="text-white/70">Core above {formatNumber(IONIZE_CPM)} CPM</span>
				<span class="font-mono tabular-nums {aboveThreshold || radiationManager.ionizeReady ? 'text-radiation' : 'text-white/50'}">
					{Math.floor(Math.min(radiationManager.ionizeHold, IONIZE_HOLD_SECONDS))} / {IONIZE_HOLD_SECONDS} s
				</span>
			</div>
			<div class="h-1.5 overflow-hidden rounded-full bg-white/10">
				<div
					class="h-full origin-left bg-radiation transition-transform duration-1000 ease-linear"
					style:transform="scaleX({holdProgress})"
				></div>
			</div>
			<p class="text-xs text-white/50">
				{#if radiationManager.ionizeReady}
					The core reached ionization, it stays ready until you Ionize.
				{:else}
					Now at {formatNumber(radiationManager.currentCpm)} CPM. Hold the output above the line for a full minute, any dip restarts the count.
				{/if}
			</p>
		</div>

		<div class="grid grid-cols-2 gap-4 text-sm">
			<div>
				<h3 class="mb-1 text-xs font-semibold uppercase tracking-wider text-red-300/80">Resets</h3>
				<ul class="flex flex-col gap-0.5 text-white/70">
					{#each RESETS as item (item)}<li>{item}</li>{/each}
				</ul>
			</div>
			<div>
				<h3 class="mb-1 text-xs font-semibold uppercase tracking-wider text-radiation/80">Keeps</h3>
				<ul class="flex flex-col gap-0.5 text-white/70">
					{#each KEEPS as item (item)}<li>{item}</li>{/each}
				</ul>
			</div>
		</div>

		{#if gameManager.totalIonizesAllTime > 0}
			<p class="text-center text-xs text-white/50">Ionized {formatNumber(gameManager.totalIonizesAllTime)} times</p>
		{/if}

		<HoldButton
			class="w-full rounded-lg bg-radiation py-4 text-lg font-bold uppercase text-black transition-transform hover:enabled:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={!radiationManager.ionizeReady}
			onHoldComplete={handleIonize}
			style="--hold-color: #39ff14; --hold-color-2: #22c55e; --hold-glow: rgba(57, 255, 20, 0.7);"
		>
			<span class="relative z-10">Hold to Ionize</span>
		</HoldButton>
	</div>
</Modal>
