<script lang="ts">
	import { RealmTypes } from '$data/realms';
	import { AmbientField } from '$helpers/AmbientField';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { ReactorRenderer, type ReactorScene } from '$helpers/ReactorRenderer';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { untrack } from 'svelte';

	interface Props {
		accent: string;
	}

	let { accent }: Props = $props();

	const cpm = $derived(radiationManager.currentCpm);
	const maxCpm = $derived(radiationManager.maxCpm);
	const mass = $derived(radiationManager.mass);
	const scene: ReactorScene = $derived({
		accent,
		instability: radiationManager.instability,
		mass,
		output: Math.min(1, cpm / maxCpm),
		power: radiationManager.controlRodLevel,
	});

	let renderer = $state.raw<ReactorRenderer>();

	/** Two stacked canvases: the static vessel behind, everything that moves in front. */
	function mountRenderer(container: HTMLDivElement) {
		const [vessel, canvas] = container.querySelectorAll('canvas');
		const instance = new ReactorRenderer(vessel, canvas, untrack(() => scene));
		renderer = instance;
		return () => {
			instance.destroy();
			renderer = undefined;
		};
	}

	$effect(() => {
		if (!renderer) return;
		renderer.scene = scene;
		renderer.setActive(realmManager.selectedRealmId === RealmTypes.RADIATION);
	});

	/** A running reactor sheds a slow mote from its rim, more often the closer its output is to the cap. */
	const DRIFT_MAX_MS = 2200;
	const DRIFT_MIN_MS = 700;

	let core = $state<HTMLDivElement>();
	const running = $derived(cpm > 0 && realmManager.selectedRealmId === RealmTypes.RADIATION);

	$effect(() => {
		if (!running || !core) return;
		const element = core;
		let timeout: ReturnType<typeof setTimeout>;
		const shed = () => {
			const rect = element.getBoundingClientRect();
			const angle = Math.random() * Math.PI * 2;
			const radius = rect.width * 0.42;
			AmbientField.emit(
				RealmTypes.RADIATION,
				'drift',
				{ x: rect.left + rect.width / 2 + Math.cos(angle) * radius, y: rect.top + rect.height / 2 + Math.sin(angle) * radius },
				{ angle },
			);
			timeout = setTimeout(shed, DRIFT_MAX_MS - (DRIFT_MAX_MS - DRIFT_MIN_MS) * scene.output);
		};
		timeout = setTimeout(shed, DRIFT_MAX_MS);
		return () => clearTimeout(timeout);
	});

	let seenInjection = untrack(() => radiationManager.lastBombard.seq);
	$effect(() => {
		const { mass: added, seq } = radiationManager.lastBombard;
		if (seq <= seenInjection) return;
		seenInjection = seq;
		renderer?.inject(added);
	});
</script>

<div class="relative aspect-square w-full" bind:this={core} {@attach mountRenderer}>
	<canvas class="absolute inset-0 size-full"></canvas>
	<canvas class="absolute inset-0 size-full"></canvas>

	<div class="pointer-events-none absolute inset-x-0 bottom-[1.5%] flex items-baseline justify-center gap-1.5 leading-none">
		{#if mass <= 0}
			<span class="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Core empty</span>
		{:else}
			<span class="font-mono text-sm font-bold tabular-nums {cpm >= maxCpm ? 'text-orange-400' : 'text-white'}">
				{formatNumber(cpm, 0)}<span class="text-white/35">/{formatNumber(maxCpm, 0)}</span>
			</span>
			<span class="text-[10px] font-semibold uppercase tracking-[0.2em] {cpm >= maxCpm ? 'text-orange-400/80' : 'text-white/40'}">
				{cpm >= maxCpm ? 'capped' : 'CPM'}
			</span>
		{/if}
	</div>
</div>
