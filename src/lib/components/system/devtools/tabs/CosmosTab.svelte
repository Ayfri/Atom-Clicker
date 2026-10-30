<script lang="ts">
	import { COSMOS_INSTRUMENTS, COSMOS_OBJECTS, formatMagnitude, studyCost } from '#data/cosmos.js';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { ELEMENTS, FAMILIES } from '#data/elements.js';
	import { CHAINS, FORGED_BY, SITES } from '#data/sites.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { radiationManager } from '#helpers/RadiationManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import type { CosmosScene } from '#lib/cosmos/CosmosScene.svelte.js';
	import { bakeCosmos, cosmosDev, startCosmosStartupBench } from '#lib/cosmos/devTools.svelte.js';
	import { formatDuration, formatNumber } from '#lib/utils.js';
	import { toastStore } from '#stores/toasts.svelte.js';
	import LevelList from '../LevelList.svelte';
	import NumberInput from '../NumberInput.svelte';
	import Section from '../Section.svelte';
	import { btn, btnAccent, setCurrency } from '../shared.svelte';
	import ToggleGrid from '../ToggleGrid.svelte';

	/** Studies have no cap in the game, the list needs one for its max button. */
	const STUDY_MAX = 100;
	const LIGHTS = [CurrenciesTypes.RED_LIGHT, CurrenciesTypes.GREEN_LIGHT, CurrenciesTypes.BLUE_LIGHT];

	const instruments = COSMOS_INSTRUMENTS.slice(1);
	const discoverable = COSMOS_OBJECTS.filter(object => !object.given).map(object => ({
		description: `${object.era.replaceAll('_', ' ')} · mag ${formatMagnitude(object.magnitude)} · ${object.boost.label} · ${formatNumber(object.starlight)} Starlight/s`,
		id: object.id,
		name: object.name,
	}));
	const studyItems = COSMOS_OBJECTS.map(object => ({
		description: (level: number) =>
			`${object.boost.label} ×${(1 + object.boost.amount * (level + 1)).toFixed(2)}, next level ${formatNumber(studyCost(object, level))} Starlight`,
		id: object.id,
		maxLevel: STUDY_MAX,
		name: object.name,
	}));

	const elementItems = ELEMENTS.map(element => ({
		description: `Z ${element.z} · ${FAMILIES[element.family].name} · forged by ${SITES[FORGED_BY[element.z]].short}`,
		group: FAMILIES[element.family].name,
		id: String(element.z),
		label: element.symbol,
		name: element.name,
	}));

	let benchRuns = $state(10);
	let benching = $state(false);

	const next = $derived(cosmosManager.nextDiscovery);
	const timersLeft = $derived(Math.max(cosmosManager.wideningMs, cosmosManager.research?.leftMs ?? 0));
	const readouts = $derived([
		['Starlight/s', formatNumber(cosmosManager.starlightPerSecond)],
		['Ionize ×', `x${cosmosManager.starlightMultiplier.toFixed(2)}`],
		['Instrument', cosmosManager.instrument.name],
		['Limit', `${formatMagnitude(cosmosManager.limit)} / ${formatMagnitude(cosmosManager.instrument.reach)}`],
		['Next', next ? `${next.name} (${formatMagnitude(next.magnitude)})${cosmosManager.canObserve ? ', observable' : ''}` : 'needs an instrument'],
		['Next Aperture', cosmosManager.apertureMaxed ? 'maxed' : formatNumber(cosmosManager.nextApertureCost)],
	]);

	/** Keeps the data order, `nextDiscovery` walks the objects in it. */
	const setDiscovered = (ids: string[]) => (cosmosManager.discovered = COSMOS_OBJECTS.filter(object => ids.includes(object.id)).map(object => object.id));

	/** An identified element must be forged, so its site's chain moves past it, which forges the steps before it too. */
	function setIdentified(ids: string[]) {
		const zs = ids.map(Number);
		let sites = periodicManager.sites;
		for (const z of zs) {
			if (periodicManager.forged.has(z)) continue;
			const site = FORGED_BY[z];
			const forge = sites[site] ?? periodicManager.forge(site);
			sites = { ...sites, [site]: { ...forge, index: Math.max(forge.index, CHAINS[site].steps.indexOf(z) + 1), progress: 0 } };
		}
		periodicManager.sites = sites;
		periodicManager.identified = ELEMENTS.filter(element => zs.includes(element.z)).map(element => element.z);
	}

	/** Owning an instrument means owning every one before it, the game buys them in order. */
	function setInstrument(index: number) {
		const owned = cosmosManager.instruments.length === index + 1 ? index : index + 1;
		cosmosManager.instruments = instruments.slice(0, owned).map(instrument => instrument.id);
		cosmosManager.research = null;
	}

	async function renderBench() {
		const scene = cosmosDev.scene;
		if (!scene) return;
		benching = true;
		try {
			console.log('Cosmos render bench', await scene.bench());
			toastStore.success({ duration: 2500, message: 'Results logged to the console.', title: 'Render bench' });
		} catch (error) {
			toastStore.error({ message: error instanceof Error ? error.message : String(error), title: 'Render bench' });
		} finally {
			benching = false;
		}
	}
</script>

<Section title="Cosmos">
	{#snippet actions()}
		<button class={btnAccent} disabled={!cosmosManager.unlocked} onclick={() => (realmManager.cosmosOpen = true)}>Open</button>
	{/snippet}
	<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs text-white/70">
		<span>Ionizes</span>
		<NumberInput label="Ionizes" onCommit={value => (radiationManager.ionizes = Math.max(0, Math.round(value)))} value={radiationManager.ionizes} />
		<span>Starlight</span>
		<NumberInput label="Starlight" onCommit={value => setCurrency(CurrenciesTypes.STARLIGHT, Math.max(0, value))} value={currenciesManager.getAmount(CurrenciesTypes.STARLIGHT)} />
		<span>Aperture</span>
		<NumberInput
			label="Aperture"
			onCommit={value => {
				cosmosManager.aperture = Math.max(0, Math.round(value));
				cosmosManager.wideningMs = 0;
			}}
			value={cosmosManager.aperture}
		/>
		{#each readouts as [label, value] (label)}
			<span class="text-white/45">{label}</span>
			<span class="truncate font-mono text-white/70">{value}</span>
		{/each}
	</div>
	<div class="mt-3 flex flex-wrap gap-1.5">
		<button class={btn} disabled={!next} onclick={() => next && setDiscovered([...cosmosManager.discovered, next.id])}>Discover next</button>
		<button class={btn} disabled={timersLeft === 0} onclick={() => cosmosManager.advance(timersLeft)}>
			Finish timers{timersLeft > 0 ? ` (${formatDuration(timersLeft)})` : ''}
		</button>
	</div>
	{#if !cosmosManager.unlocked}
		<p class="mt-2 text-[12px] text-white/35">Locked until the first Ionize, set Ionizes to 1 to open it.</p>
	{/if}
</Section>

<Section title="Instruments">
	<div class="flex flex-col gap-1">
		{#each instruments as instrument, index (instrument.id)}
			{const owned = $derived(cosmosManager.instruments.includes(instrument.id))}
			{const building = $derived(cosmosManager.research?.id === instrument.id)}
			<button
				class="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-white/5 {owned ? 'text-white' : 'text-white/45'}"
				onclick={() => setInstrument(index)}
				title="{instrument.description} Click to own every instrument up to this one, click the last owned one to drop it."
			>
				<span class="truncate">
					<span class={owned ? 'text-accent-300' : 'text-white/40'}>{owned ? '●' : '○'}</span>
					{instrument.name} <span class="text-white/45">{instrument.year}</span>
				</span>
				<span class="font-mono text-[12px] text-white/40">
					{building ? `building, ${formatDuration(cosmosManager.research?.leftMs ?? 0)}` : `${formatNumber(instrument.cost)} · ${formatMagnitude(instrument.reach)}`}
				</span>
			</button>
		{/each}
	</div>
</Section>

<Section title="Discoveries">
	<ToggleGrid items={discoverable} onChange={setDiscovered} owned={cosmosManager.discovered} />
</Section>

<Section collapsed title="Studies">
	<LevelList
		items={studyItems}
		levels={cosmosManager.studies}
		onChange={levels => (cosmosManager.studies = Object.fromEntries(Object.entries(levels).filter(([, level]) => level > 0)))}
	/>
</Section>

<Section title="Periodic Table">
	{#snippet actions()}
		<button class={btnAccent} disabled={!periodicManager.unlocked} onclick={() => (realmManager.cosmosOpen = realmManager.tableOpen = true)}>Open</button>
	{/snippet}
	<div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs text-white/70">
		<span class="text-white/45">Identified</span>
		<span class="font-mono">{periodicManager.identified.length} / {periodicManager.forged.size} forged, {periodicManager.ready.length} ready</span>
		<span class="text-white/45">Decay events</span>
		<span class="font-mono">{formatNumber(periodicManager.decayEventsPerSecond)}/s</span>
		{#each [...periodicManager.open] as id (id)}
			<span class="text-white/45">{SITES[id].short}</span>
			<span class="truncate font-mono">level {periodicManager.forge(id).level} · {periodicManager.statuses[id].kind} · {formatDuration(Math.min(periodicManager.etaOf(id), 1e9) * 1000)}</span>
		{/each}
	</div>
	<div class="mt-3 flex flex-wrap gap-1.5">
		{#each [1, 24] as hours (hours)}
			<button class={btn} disabled={!periodicManager.unlocked} onclick={() => periodicManager.tick(hours * 3_600_000)}>Forge {hours}h</button>
		{/each}
		<button class={btn} onclick={() => LIGHTS.forEach(light => currenciesManager.add(light, 1e7))}>+10M Light</button>
	</div>
	{#if !periodicManager.unlocked}
		<p class="mt-2 text-[12px] text-white/35">Opens with the Spectroscope instrument.</p>
	{/if}
</Section>

<Section collapsed title="Elements">
	<ToggleGrid items={elementItems} onChange={setIdentified} owned={periodicManager.identified.map(String)} />
</Section>

{#snippet sceneTools(scene: CosmosScene)}
	<div class="flex flex-col gap-2 text-xs">
		<span class="font-mono text-white/50">{scene.backend} · {scene.fps} fps · {scene.mode}</span>
		<div class="flex flex-wrap items-center gap-1.5">
			<button class={btn} disabled={benching || scene.mode !== 'overview'} onclick={renderBench} title="Times every rendering variant, from the overview">
				{benching ? 'Benching…' : 'Render bench'}
			</button>
			<button class={btn} onclick={() => bakeCosmos(scene)} title="Writes every surface map to static/cosmos/, then reloads">Bake maps</button>
		</div>
		<div class="flex items-center gap-1.5">
			<NumberInput class="w-16" label="Startup bench runs" onCommit={value => (benchRuns = Math.max(2, Math.round(value)))} value={benchRuns} />
			<button class={btn} onclick={() => startCosmosStartupBench(benchRuns)} title="Reloads that many times, the table lands in the console">
				Startup bench
			</button>
		</div>
	</div>
{/snippet}

<Section title="Scene">
	{#if cosmosDev.scene}
		{@render sceneTools(cosmosDev.scene)}
	{:else}
		<p class="text-xs text-white/35">Open the Cosmos to bench or bake the scene.</p>
	{/if}
</Section>
