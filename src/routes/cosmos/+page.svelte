<script lang="ts">
	import type { CosmosScene } from '#lib/cosmos/CosmosScene.svelte.js';
	import { ChevronRight, RotateCcw, Sparkles, Telescope } from '@lucide/svelte';

	let arrow = $state<HTMLElement>();
	let canvas = $state<HTMLCanvasElement>();
	let failure = $state('');
	let progress = $state<HTMLElement>();
	let scene = $state.raw<CosmosScene | null>(null);

	$effect(() => {
		if (!arrow || !canvas || !progress) return;
		const hud = { arrow, progress };
		const target = canvas;
		let created: CosmosScene | null = null;
		let disposed = false;
		// Three.js is a ~280 KB gzip chunk, only fetched once this view mounts.
		import('#lib/cosmos/CosmosScene.svelte.js')
			.then(({ CosmosScene }) => CosmosScene.create(target, hud))
			.then(instance => {
				if (disposed) return instance.dispose();
				created = instance;
				scene = instance;
			})
			.catch((error: unknown) => (failure = error instanceof Error ? error.message : String(error)));
		return () => {
			disposed = true;
			created?.dispose();
			scene = null;
		};
	});

	const mode = $derived(scene?.mode);
</script>

<svelte:head>
	<title>Cosmos prototype</title>
</svelte:head>

<div class="relative h-dvh w-full select-none overflow-hidden bg-[#05070f] text-slate-100">
	<canvas
		bind:this={canvas}
		class="pointer-events-auto h-full w-full touch-none"
	></canvas>

	<header class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
		<div>
			<h1 class="flex items-center gap-2 text-lg font-semibold tracking-wide text-[#cfe8ff]">
				<Sparkles size={18} class="text-[#6f8cff]" />
				Cosmos
			</h1>
			{#if scene}
				<p class="text-xs text-slate-400">{scene.backend} · {scene.fps} fps · {scene.quality} quality</p>
			{/if}
		</div>
		{#if scene}
			<div class="pointer-events-auto flex gap-2">
				<button
					class="rounded-lg bg-slate-900/80 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
					onclick={() => scene?.setQuality(scene.quality === 'high' ? 'low' : 'high')}
				>
					{scene.quality === 'high' ? 'Low' : 'High'} quality
				</button>
				<button
					class="rounded-lg bg-slate-900/80 p-2 text-slate-200 hover:bg-slate-800"
					aria-label="Replay the intro"
					disabled={mode !== 'overview'}
					onclick={() => scene?.replayIntro()}
				>
					<RotateCcw size={16} />
				</button>
			</div>
		{/if}
	</header>

	<div class={['pointer-events-none absolute inset-0', mode !== 'observe' && 'hidden']}>
		<div class="absolute left-1/2 top-1/2 size-28 -translate-1/2 rounded-full border border-[#8ff5ff]/40">
			<span class="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-[#8ff5ff]/60"></span>
			<span class="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-[#8ff5ff]/60"></span>
			<span class="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-[#8ff5ff]/60"></span>
			<span class="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-[#8ff5ff]/60"></span>
		</div>
		<div
			bind:this={arrow}
			class="absolute left-1/2 top-1/2 -ml-4 -mt-4 text-[#8ff5ff] opacity-0 transition-opacity"
		>
			<ChevronRight size={32} />
		</div>
		<div class="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
			<div class="h-1 w-48 overflow-hidden rounded-full bg-white/10">
				<div
					bind:this={progress}
					class="h-full origin-left scale-x-0 bg-[#8ff5ff]"
				></div>
			</div>
			<p class="text-center text-xs text-slate-300">Keep the signal inside the reticle. Pinch or scroll to zoom, the sky drifts faster up close.</p>
		</div>
	</div>

	{#if failure}
		<p class="absolute inset-x-0 top-1/2 px-6 text-center text-sm text-red-300">The 3D view failed to start: {failure}</p>
	{:else if !scene}
		<p class="absolute inset-x-0 top-1/2 text-center text-sm text-slate-400">Loading the cosmos…</p>
	{:else if mode === 'overview'}
		<div class="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
			{#if scene.discovered}
				<p class="text-sm text-slate-300">Mars joined your sky. Drag to orbit, scroll or pinch to zoom.</p>
			{:else}
				<button
					class="flex items-center gap-2 rounded-xl bg-[#6f8cff] px-5 py-3 font-semibold text-[#05070f] shadow-lg shadow-[#6f8cff]/30 hover:bg-[#8aa0ff]"
					onclick={() => scene?.observe()}
				>
					<Telescope size={18} />
					Observe the sky
				</button>
				<p class="text-xs text-slate-400">A faint signal waits somewhere in the night sky.</p>
			{/if}
		</div>
	{:else if mode === 'discovery'}
		<div class="absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
			<article class="discovery-card w-full max-w-sm rounded-2xl bg-[#0b1230]/90 p-5 backdrop-blur">
				<p class="text-xs uppercase tracking-widest text-[#8ff5ff]">Discovered · Antiquity</p>
				<h2 class="mt-1 text-2xl font-bold text-[#ffb08a]">Mars</h2>
				<p class="mt-2 text-sm text-slate-300">
					Babylonian astronomers were already recording its path across the sky over 3,000 years ago. Its red comes from iron oxide dust
					covering the whole surface.
				</p>
				<button
					class="mt-4 w-full rounded-lg bg-slate-800 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
					onclick={() => scene?.continue()}
				>
					Continue
				</button>
			</article>
		</div>
	{/if}
</div>

<style>
	.discovery-card {
		animation: card-in 0.7s 1.8s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
	}

	@keyframes card-in {
		from {
			opacity: 0;
			transform: translateY(24px) scale(0.96);
		}
	}
</style>
