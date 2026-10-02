<script lang="ts">
	import Currency from '#components/ui/Currency.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import { CURRENCIES, CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
	import { FeatureTypes } from '#data/features.js';
	import { GENERATOR_LEVEL_UP_COST } from '#data/generators.js';
	import { BoostSparks } from '#helpers/BoostSparks.js';
	import { particlesEnabled } from '#helpers/CanvasLoop.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { MAX_BOOST_POINTS } from '#lib/constants.js';
	import { ChevronsRight, Minus, Plus, RotateCcw, Scale, ShieldCheck, TriangleAlert, Zap } from '@lucide/svelte';
	import { prefersReducedMotion, Tween } from 'svelte/motion';
	import { scale } from 'svelte/transition';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	/** Gauges fill one pip at a time, so Balance and Max visibly pour points in instead of jumping. */
	const stagger = { duration: (from: number, to: number) => (prefersReducedMotion.current ? 0 : Math.min(Math.abs(to - from) * 45, 900)) };

	const boostableCurrencies: CurrencyName[] = [
		CurrenciesTypes.ATOMS,
		CurrenciesTypes.PROTONS,
		CurrenciesTypes.ELECTRONS,
		CurrenciesTypes.PHOTONS,
		CurrenciesTypes.EXCITED_PHOTONS,
	];

	const rows = boostableCurrencies.map(name => ({
		color: CURRENCIES[name].color,
		name,
		shown: Tween.of(() => gameManager.currencyBoosts[name] ?? 0, stagger),
	}));

	const button = 'flex items-center justify-center gap-2 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30';

	const canAssignAll = $derived(gameManager.features[FeatureTypes.BOOST_ASSIGN_ALL]);
	const canSplitEvenly = $derived(gameManager.features[FeatureTypes.BOOST_EVEN_SPLIT]);
	const earnedCurrencies = $derived(boostableCurrencies.filter(currency => currenciesManager.getEarnedAllTime(currency) > 0));
	const freePoints = Tween.of(() => gameManager.boostPointsAvailable, stagger);
	const keepBoosts = $derived(gameManager.quarkEntitlements.includes('convenience_keep_currency_boosts'));
	const pop = $derived({ duration: prefersReducedMotion.current ? 0 : 250, start: 1.3 });

	const mountSparks = (color: string) => (canvas: HTMLCanvasElement) => {
		const sparks = new BoostSparks(canvas, color);
		return () => sparks.destroy();
	};
</script>

<Modal {onClose} title="Currency Boosts" width="sm">
	<div class="flex flex-col gap-4">
		<div class="rounded-lg bg-black/20 bg-[radial-gradient(circle_at_0%_0%,rgb(250_204_21/0.12),transparent_60%)] p-5">
			<div class="flex flex-wrap items-center gap-3">
				<div class="grid size-12 shrink-0 place-items-center rounded-xl bg-yellow-400/15 ring-1 ring-yellow-400/30">
					<Zap class="fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgb(250_204_21/0.8)]" size={24} />
				</div>
				<div class="flex flex-1 flex-col">
					<span class="text-sm font-medium text-white/60">Free boost points</span>
					<span class="font-mono">
						{#key Math.round(freePoints.current)}
							<span class="inline-block text-3xl font-bold text-yellow-400 [text-shadow:0_0_14px_rgb(250_204_21/0.5)]" in:scale={pop}>
								{Math.round(freePoints.current)}
							</span>
						{/key}
						<span class="text-white/40">/ {gameManager.boostPointsTotal}</span>
					</span>
				</div>
				<div class="flex w-full gap-2 sm:w-auto">
					<button
						class="{button} flex-1 bg-white/10 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/20 hover:text-white"
						disabled={gameManager.boostPointsUsed <= 0}
						onclick={() => gameManager.resetCurrencyBoosts()}
					>
						<RotateCcw size={16} />
						Reset
					</button>
					{#if canSplitEvenly}
						<button
							class="{button} flex-1 bg-yellow-400/15 px-3 py-2 text-sm font-medium text-yellow-300 hover:bg-yellow-400/25"
							disabled={gameManager.boostPointsTotal <= 0}
							onclick={() => gameManager.splitCurrencyBoostsEvenly(earnedCurrencies)}
						>
							<Scale size={16} />
							Balance
						</button>
					{/if}
				</div>
			</div>

			<p class="mt-3 text-sm text-white/60">
				Every generator level (each {GENERATOR_LEVEL_UP_COST} of the same generator) earns a boost point. Each point gives
				<span class="font-bold text-yellow-300">+10%</span> of that currency gained (max {MAX_BOOST_POINTS} points per currency).
			</p>
			{#if keepBoosts}
				<p class="mt-1 flex items-center gap-1.5 text-xs text-emerald-300/80">
					<ShieldCheck size={14} />
					Your boosts are kept through Protonize and Electronize.
				</p>
			{:else}
				<p class="mt-1 flex items-center gap-1.5 text-xs text-red-400/80">
					<TriangleAlert size={14} />
					Currency boost allocations reset on Protonize or Electronize.
				</p>
			{/if}
		</div>

		<div class="flex flex-col gap-2.5">
			{#each rows as { color, name, shown } (name)}
				{const points = $derived(gameManager.currencyBoosts[name] ?? 0)}
				{const shownPoints = $derived(Math.round(shown.current))}
				{const canAdd = $derived(gameManager.boostPointsAvailable > 0 && points < MAX_BOOST_POINTS)}
				<div
					class="flex flex-col gap-3 rounded-lg bg-accent-800/50 bg-[radial-gradient(circle_at_0%_50%,color-mix(in_srgb,var(--c)_calc(var(--p)*22%),transparent),transparent_70%)] p-4 sm:flex-row sm:items-center sm:gap-4"
					style:--c={color}
					style:--p={shown.current / MAX_BOOST_POINTS}
				>
					<div class="flex items-center gap-3 sm:w-44 sm:shrink-0">
						<div
							class="grid size-11 shrink-0 place-items-center rounded-full bg-(--c)/15 ring-1 ring-(--c)/30 shadow-[0_0_calc(16px*var(--p))_color-mix(in_srgb,var(--c)_calc(var(--p)*80%),transparent)]"
						>
							<Currency {name} class="size-7" />
						</div>
						<div class="flex min-w-0 flex-col">
							<span class="text-sm font-medium text-white">{name}</span>
							<span class="flex items-center gap-2">
								{#key shownPoints}
									<span
										class="inline-block origin-left font-mono text-lg font-bold text-(--c) [text-shadow:0_0_calc(12px*var(--p))_var(--c)]"
										in:scale={pop}
									>
										×{(1 + shownPoints * 0.1).toFixed(1)}
									</span>
								{/key}
								{#if shownPoints >= MAX_BOOST_POINTS}
									<span class="rounded bg-yellow-400 px-1.5 text-[10px] leading-4 font-bold text-black" in:scale={pop}>MAX</span>
								{:else}
									<span class="font-mono text-xs text-white/40">{shownPoints}/{MAX_BOOST_POINTS}</span>
								{/if}
							</span>
						</div>
					</div>

					<div class="flex flex-1 items-center gap-2">
						<button
							aria-label="Remove a boost point from {name}"
							class="{button} size-10 shrink-0 bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
							disabled={points <= 0}
							onclick={() => gameManager.removeCurrencyBoost(name)}
						>
							<Minus size={16} />
						</button>
						<div aria-label="{points} of {MAX_BOOST_POINTS} points" class="relative flex flex-1 gap-0.5" role="img">
							{#if shownPoints >= MAX_BOOST_POINTS && particlesEnabled}
								<canvas aria-hidden="true" class="-top-6 h-[calc(100%+1.5rem)] w-full" {@attach mountSparks(color)}></canvas>
							{/if}
							{#each { length: MAX_BOOST_POINTS }, i}
								<span
									class={[
										'h-3 flex-1 rounded-[2px] transition-colors duration-150',
										i < shownPoints ? 'bg-(--c) shadow-[0_0_calc(2px_+_8px*var(--p))_var(--c)]' : 'bg-white/10',
										i === 0 && 'rounded-l-full',
										i === MAX_BOOST_POINTS - 1 ? 'rounded-r-full' : i % 5 === 4 && 'mr-1',
									]}
								></span>
							{/each}
						</div>
						<button
							aria-label="Add a boost point to {name}"
							class="{button} size-10 shrink-0 bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
							disabled={!canAdd}
							onclick={() => gameManager.addCurrencyBoost(name)}
						>
							<Plus size={16} />
						</button>
						{#if canAssignAll}
							<button
								aria-label="Assign all free points to {name}"
								class="{button} size-10 shrink-0 bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/25"
								disabled={!canAdd}
								onclick={() => gameManager.assignAllCurrencyBoosts(name)}
								title="Assign all free points"
							>
								<ChevronsRight size={16} />
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</Modal>
