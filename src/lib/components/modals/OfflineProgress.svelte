<script lang="ts">
	import { CURRENCIES, type CurrencyName } from '$data/currencies';
	import { GENERATOR_TYPES, GENERATORS } from '$data/generators';
	import { GENERATOR_ICON_NAMES, ICONS } from '$data/icons';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatDuration, formatNumber } from '$lib/utils';
	import PhotonIcon from '@components/icons/Photon.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { ArrowBigUp, CircleArrowUp, Factory, Hourglass, MousePointerClick, Radiation, Sparkles } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion, Tween } from 'svelte/motion';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const XP_COLOR = '#facc15';

	const summary = $derived(gameManager.offlineProgressSummary);
	const loot = $derived(
		summary ?
			Object.entries(summary.currencyGains)
				.filter(([, amount]) => (amount ?? 0) > 0)
				.map(([currency, amount]) => ({ amount: amount ?? 0, currency: currency as CurrencyName }))
				.sort((a, b) => a.currency.localeCompare(b.currency))
		:	[],
	);
	const autoBuys = $derived(
		summary ? GENERATOR_TYPES.flatMap(type => ((summary.autoBuyCounts[type] ?? 0) > 0 ? [{ count: summary.autoBuyCounts[type] ?? 0, type }] : [])) : [],
	);
	const autoBuyTotal = $derived(autoBuys.reduce((total, { count }) => total + count, 0));
	const hasActivity = $derived(
		!!summary &&
			(autoBuyTotal > 0 || summary.autoUpgradePurchases > 0 || summary.atomAutoClicks >= 1 || summary.photonAutoClicks >= 1 || summary.radiationActive),
	);

	/** Drives every count-up and the storage bar at once, one rAF loop that stops when it lands. */
	const reveal = new Tween(0, { duration: 1600, easing: cubicOut });
	onMount(() => {
		reveal.set(1, prefersReducedMotion.current ? { duration: 0 } : { delay: 350 });
	});

	function close() {
		gameManager.clearOfflineProgressSummary();
		onClose();
	}
</script>

<svelte:window onkeydown={e => e.key === 'Escape' && close()} />

{#if summary}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		aria-modal="true"
		class="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-xs"
		onclick={close}
		role="dialog"
		tabindex="-1"
		transition:fade={{ duration: 200 }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="custom-scrollbar relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col items-center gap-4 overflow-x-hidden overflow-y-auto rounded-3xl border border-white/10 bg-accent-900 bg-[radial-gradient(circle_at_50%_0%,rgb(74_144_226/0.3),transparent_55%)] px-5 pt-5 pb-5 text-center shadow-2xl shadow-accent-500/20 sm:px-8"
			onclick={e => e.stopPropagation()}
			transition:scale={{ duration: 350, easing: cubicOut, start: 0.85 }}
		>
			<div class="relative grid size-16 shrink-0 place-items-center">
				<span
					class="absolute -inset-12bg-[repeating-conic-gradient(rgb(129_173_223/0.14)_0deg_10deg,transparent_10deg_30deg)] [mask-image:radial-gradient(circle,black_20%,transparent_70%)] motion-safe:animate-[offline-rays_24s_linear_infinite]"
				></span>
				<span class="absolute inset-2 rounded-full bg-accent-400/30 blur-2xl"></span>
				<Currency class="relative motion-safe:animate-[offline-float_4s_ease-in-out_infinite]" name="Atoms" size={56} />
			</div>

			<div class="flex flex-col gap-0.5">
				<h2 class="text-2xl font-black tracking-wide text-white uppercase [text-shadow:0_0_24px_rgb(74_144_226/0.8)] sm:text-3xl">
					Welcome back!
				</h2>
				<p class="text-white/60">
					Your atoms kept working for <span class="font-bold text-white">{formatDuration(summary.awayMs)}</span>
				</p>
			</div>

			<div class="flex w-full flex-col gap-1.5">
				<div class="flex items-center justify-between text-xs font-bold tracking-widest text-white/50 uppercase">
					<span class="flex items-center gap-1.5"><Hourglass size={13} /> Offline time</span>
					<span class="tabular-nums">{formatDuration(summary.appliedMs * reveal.current)} / {formatDuration(summary.capMs)}</span>
				</div>
				<div class="h-2.5 w-full overflow-hidden rounded-full bg-black/40">
					<div
						class="h-full origin-left rounded-full bg-linear-to-r from-accent-500 to-accent-300 shadow-[0_0_12px_rgb(129_173_223/0.8)]"
						style:transform="scaleX({(summary.appliedMs / summary.capMs) * reveal.current})"
					></div>
				</div>
				{#if summary.awayMs > summary.capMs}
					<p class="text-left text-xs text-amber-300/80">Offline cap reached, the last {formatDuration(summary.awayMs - summary.capMs)} were not counted.</p>
				{/if}
			</div>

			{#if summary.levelsGained > 0}
				<div
					class="flex items-center gap-2 text-xl font-black tracking-wider text-yellow-300 uppercase [text-shadow:0_0_20px_rgb(250_204_21/0.6)] motion-safe:animate-[offline-pop_600ms_cubic-bezier(.34,1.56,.64,1)_1.6s_backwards]"
				>
					<ArrowBigUp size={24} />
					Level up! +{summary.levelsGained}
				</div>
			{/if}

			<div class="flex w-full flex-col gap-3">
				<div class="flex items-center gap-3 text-[11px] font-bold tracking-[0.25em] text-white/40 uppercase">
					<span class="h-px flex-1 bg-white/10"></span>
					Loot
					<span class="h-px flex-1 bg-white/10"></span>
				</div>
				{#if loot.length > 0 || summary.xpGained > 0}
					<div class="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-x-2 gap-y-3">
						{#each loot as { amount, currency }, i (currency)}
							{@const color = CURRENCIES[currency].color}
							<div
								class="flex flex-col items-center gap-0.5 motion-safe:animate-[offline-pop_500ms_cubic-bezier(.34,1.56,.64,1)_backwards]"
								style:animation-delay="{250 + i * 120}ms"
							>
								<div class="relative grid size-10 place-items-center">
									<span class="absolute inset-1 rounded-full opacity-40 blur-lg" style:background={color}></span>
									<Currency class="relative" name={currency} size={30} />
								</div>
								<span class="text-xl font-black text-white tabular-nums" style:text-shadow="0 0 16px {color}">
									+{formatNumber(amount * reveal.current)}
								</span>
								<span class="text-[11px] font-semibold tracking-widest text-white/45 uppercase">{currency}</span>
							</div>
						{/each}
						{#if summary.xpGained > 0}
							<div
								class="flex flex-col items-center gap-0.5 motion-safe:animate-[offline-pop_500ms_cubic-bezier(.34,1.56,.64,1)_backwards]"
								style:animation-delay="{250 + loot.length * 120}ms"
							>
								<div class="relative grid size-10 place-items-center">
									<span class="absolute inset-1 rounded-full opacity-40 blur-lg" style:background={XP_COLOR}></span>
									<ArrowBigUp class="relative" color={XP_COLOR} size={30} strokeWidth={2.5} />
								</div>
								<span class="text-xl font-black text-white tabular-nums" style:text-shadow="0 0 16px {XP_COLOR}">
									+{formatNumber(summary.xpGained * reveal.current)}
								</span>
								<span class="text-[11px] font-semibold tracking-widest text-white/45 uppercase">XP</span>
							</div>
						{/if}
					</div>
				{:else}
					<p class="text-sm text-white/50">Nothing was produced this time.</p>
				{/if}
			</div>

			{#if hasActivity}
				<div class="flex w-full flex-col gap-2">
					<div class="flex items-center gap-3 text-[11px] font-bold tracking-[0.25em] text-white/40 uppercase">
						<span class="h-px flex-1 bg-white/10"></span>
						While you were away
						<span class="h-px flex-1 bg-white/10"></span>
					</div>
					<ul class="flex flex-col gap-1.5 text-left text-sm text-white/75">
						{#if autoBuyTotal > 0}
							<li class="flex flex-col gap-1">
								<span class="flex items-center gap-2">
									<Factory class="shrink-0 text-accent-300" size={16} />
									<span><b class="text-white">{formatNumber(autoBuyTotal)}</b> generators built</span>
								</span>
								<span class="flex flex-wrap gap-x-3 gap-y-1 pl-6 text-xs text-white/55">
									{#each autoBuys as { count, type } (type)}
										{@const Icon = ICONS[GENERATOR_ICON_NAMES[type]]}
										<span class="flex items-center gap-1" title={GENERATORS[type].name}>
											<Icon color="currentColor" size={14} />
											{formatNumber(count)}
										</span>
									{/each}
								</span>
							</li>
						{/if}
						{#if summary.autoUpgradePurchases > 0}
							<li class="flex items-center gap-2">
								<CircleArrowUp class="shrink-0 text-accent-300" size={16} />
								<span><b class="text-white">{formatNumber(summary.autoUpgradePurchases)}</b> upgrades bought</span>
							</li>
						{/if}
						{#if summary.atomAutoClicks >= 1}
							<li class="flex items-center gap-2">
								<MousePointerClick class="shrink-0 text-accent-300" size={16} />
								<span><b class="text-white">{formatNumber(Math.floor(summary.atomAutoClicks))}</b> auto-clicks on the atom</span>
							</li>
						{/if}
						{#if summary.photonAutoClicks >= 1}
							<li class="flex items-center gap-2">
								<PhotonIcon class="shrink-0" size={16} />
								<span>
									<b class="text-white">{formatNumber(Math.floor(summary.photonAutoClicks))}</b> photons caught,
									{formatNumber(summary.photonClickExpectedTotal, 1)} each
								</span>
							</li>
						{/if}
						{#if summary.radiationActive}
							<li class="flex items-center gap-2">
								<Radiation class="shrink-0 text-radiation" size={16} />
								<span>
									Reactor ran at <b class="text-white">x{formatNumber(summary.radiationAvgMultiplier, 2)}</b>,
									{#if summary.radiationTimeToEmpty === Infinity}
										fuel is sustainable
									{:else}
										mass <span class="text-red-400">-{formatNumber(summary.radiationMassLost, 2)}</span>
										<span class="text-green-400">+{formatNumber(summary.radiationMassGained, 2)}</span>
									{/if}
								</span>
							</li>
						{/if}
					</ul>
				</div>
			{/if}

			<div class="flex w-full flex-col items-center gap-2">
				<button
					class="relative flex w-full max-w-64 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-linear-to-b from-accent-400 to-accent-600 py-2.5 text-lg font-black tracking-wider text-white uppercase shadow-[0_4px_0_var(--color-accent-700),0_0_24px_rgb(74_144_226/0.4)] transition-transform hover:scale-105 active:translate-y-1 active:shadow-[0_0_0_var(--color-accent-700)]"
					onclick={close}
				>
					<span
						class="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/30 blur-sm motion-safe:animate-[offline-shine_3s_ease-in-out_2s_infinite_backwards] motion-reduce:hidden"
					></span>
					<Sparkles size={20} />
					Collect
				</button>
				<p class="text-[11px] text-white/35">
					Offline production runs at {(summary.incomeMultiplier * 100).toFixed(0)}% speed, automation at 1/{summary.autoBuyFactor}.
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Global so the Tailwind `animate-[offline-*]` classes can use them. */

	@keyframes -global-offline-float {
		50% {
			transform: translateY(-6px) rotate(8deg);
		}
	}

	@keyframes -global-offline-pop {
		from {
			opacity: 0;
			transform: scale(0.4) translateY(12px);
		}
	}

	@keyframes -global-offline-rays {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes -global-offline-shine {
		from {
			transform: translateX(-100%) skewX(-20deg);
		}
		40%,
		to {
			transform: translateX(400%) skewX(-20deg);
		}
	}
</style>
