<script lang="ts">
	import { FeatureTypes } from '$data/features';
	import { HINTS } from '$data/hints';
	import { RealmTypes } from '$data/realms';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { formatDuration, formatNumber } from '$lib/utils';
	import { btn, btnDanger, checkbox } from '../shared.svelte';
	import NumberInput from '../NumberInput.svelte';
	import Section from '../Section.svelte';

	const realms = Object.values(RealmTypes);
	const tutorial = gameManager.tutorialManager;

	const stabilityTime = $derived((600_000 * gameManager.stabilityCapacity) / gameManager.stabilitySpeed);
	const stabilityProgress = $derived.by(() => {
		gameManager.inGameTime;
		return Math.min(Math.max((Date.now() - gameManager.lastInteractionTime) / stabilityTime, 0), 1);
	});
</script>

<Section title="Realms">
	<div class="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5 text-xs text-white/70">
		{#each realms as realm (realm)}
			{@const hintCount = HINTS.filter(hint => hint.realm === realm).length}
			<label class="flex items-center gap-2 capitalize">
				<input bind:checked={gameManager.realms[realm].unlocked} class={checkbox} type="checkbox" />
				{realm}
			</label>
			<button class={btn} onclick={() => tutorial.forget(`${realm}:`)}>Replay {hintCount} hints</button>
		{/each}
		<label class="flex items-center gap-2">
			<input checked={tutorial.state.enabled} class={checkbox} onchange={e => tutorial.setEnabled(e.currentTarget.checked)} type="checkbox" />
			Tips enabled <span class="text-white/30">({tutorial.state.seen.length} seen)</span>
		</label>
		<button class={btn} onclick={() => tutorial.forget()}>Replay all</button>
	</div>
</Section>

<Section title="Stability field">
	<div class="flex flex-col gap-1.5 text-xs">
		<div class="flex justify-between font-mono text-white/60">
			<span class={gameManager.features[FeatureTypes.STABILITY_FIELD] ? 'text-white' : 'text-red-300'}>
				x{gameManager.stabilityMultiplier.toFixed(2)} / x{(1 + (gameManager.stabilityMaxBoost - 1) * gameManager.stabilityCapacity).toFixed(2)}
			</span>
			<span>{(stabilityProgress * 100).toFixed(1)}% of {formatDuration(stabilityTime)}</span>
		</div>
		<input
			class="w-full cursor-pointer accent-accent-500"
			max="1"
			min="0"
			oninput={e => (gameManager.lastInteractionTime = Date.now() - Number(e.currentTarget.value) * stabilityTime)}
			step="0.001"
			type="range"
			value={stabilityProgress}
		/>
		{#if !gameManager.features[FeatureTypes.STABILITY_FIELD]}
			<span class="text-[11px] text-white/35">Feature locked, the multiplier stays at x1.</span>
		{/if}
	</div>
</Section>

<Section title="Reactor">
	{#snippet actions()}
		<button class={btnDanger} onclick={() => radiationManager.reset()}>SCRAM</button>
	{/snippet}
	<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs text-white/70">
		<span>Unlocked</span>
		<input bind:checked={radiationManager.unlocked} class={checkbox} type="checkbox" />
		<span>Mass</span>
		<NumberInput onCommit={value => (radiationManager.mass = Math.max(0, value))} value={radiationManager.mass} />
		<span>Rods {(radiationManager.controlRodLevel * 100).toFixed(0)}%</span>
		<input
			class="w-full cursor-pointer accent-accent-500"
			max="1"
			min="0"
			oninput={e => radiationManager.setControlRodLevel(Number(e.currentTarget.value))}
			step="0.01"
			type="range"
			value={radiationManager.controlRodLevel}
		/>
		<span>Output</span>
		<span class="font-mono text-white/60">
			{formatNumber(radiationManager.currentCpm)} CPM, x{formatNumber(radiationManager.radiationMultiplier)}, {formatNumber(radiationManager.netMassChange)} mass/s
		</span>
	</div>
</Section>
