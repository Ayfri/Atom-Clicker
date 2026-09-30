<script lang="ts">
	import { CHROMATIC, ChromaticColors, IONIZE_LIGHT_MILESTONES, ionizeLightMultiplier, ionizeMilestoneBonus } from '$data/chromatic';
	import { CURRENCIES, CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { RADIATION_UPGRADES } from '$data/radiationUpgrades';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { IONIZE_CPM_STEP, IONIZE_HOLD_SECONDS, radiationManager } from '$helpers/RadiationManager.svelte';
	import { formatNumber } from '$lib/utils';
	import { prestigeStore } from '$stores/prestige.svelte';
	import IonizeIcon from '@components/icons/Ionize.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import HoldButton from '@components/ui/HoldButton.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import { Check, Rainbow, RotateCcw, Vault, X } from '@lucide/svelte';

	interface ListItem {
		currencies: CurrencyName[];
		label: string;
	}

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const [RED, GREEN, BLUE] = [ChromaticColors.RED, ChromaticColors.GREEN, ChromaticColors.BLUE].map(color => CURRENCIES[CHROMATIC[color].currency].color);
	/** Red at 0, Green at 0.5, Blue at 1, the order the Light milestones read in. */
	const spectrumAt = (t: number) => (t < 0.5 ? `color-mix(in oklab, ${RED}, ${GREEN} ${t * 200}%)` : `color-mix(in oklab, ${GREEN}, ${BLUE} ${(t - 0.5) * 200}%)`);

	/** The first Ionizes each unlock a reactor upgrade (the first one the Prism too), the later ones raise colored Light. */
	const MILESTONES = [
		...Object.values(RADIATION_UPGRADES)
			.flatMap(({ ionizes, name }) =>
				ionizes ? [{ color: 'var(--color-radiation)', count: ionizes, reward: `Unlocks ${ionizes === 1 ? `the Prism and ${name}` : name}` }] : [],
			)
			.sort((a, b) => a.count - b.count),
		...IONIZE_LIGHT_MILESTONES.map((count, i) => ({
			color: spectrumAt(i / (IONIZE_LIGHT_MILESTONES.length - 1)),
			count,
			reward: `+${Math.round(ionizeMilestoneBonus(count) * 100)}% colored Light`,
		})),
	];
	const TRACK_GRADIENT = `linear-gradient(90deg, ${MILESTONES.map(({ color }, i) => `${color} ${(i / (MILESTONES.length - 1)) * 100}%`).join(', ')})`;
	/** The three Lights darkened enough for white text, holding the button fills it with white as they recombine. */
	const BUTTON_GRADIENT = `linear-gradient(100deg, ${[RED, GREEN, BLUE, GREEN, RED].map(color => `color-mix(in oklab, ${color} 72%, black)`).join(', ')})`;
	const LIGHTS = [CurrenciesTypes.RED_LIGHT, CurrenciesTypes.GREEN_LIGHT, CurrenciesTypes.BLUE_LIGHT];
	const RESETS: ListItem[] = [
		{ currencies: [CurrenciesTypes.ATOMS], label: 'Atoms, generators and upgrades' },
		{ currencies: [CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS], label: 'Protons and Electrons' },
		{ currencies: [CurrenciesTypes.PHOTONS, CurrenciesTypes.EXCITED_PHOTONS], label: 'Photons and Excited Photons' },
		{ currencies: [], label: 'Reactor Upgrades and the reactor core' },
	];

	const ionizes = $derived(gameManager.totalIonizesAllTime);
	const holdProgress = $derived(Math.min(radiationManager.ionizeHold / IONIZE_HOLD_SECONDS, 1));
	const aboveThreshold = $derived(radiationManager.currentCpm >= radiationManager.ionizeCpm);
	const reached = $derived(MILESTONES.findLastIndex(({ count }) => ionizes >= count));
	const next = $derived(MILESTONES[reached + 1]);
	/** Node index the track fills up to, partway between the last reached milestone and the next one. */
	const trackFill = $derived.by(() => {
		if (!next) return 1;
		const previous = MILESTONES[reached]?.count ?? 0;
		return Math.max(reached + (ionizes - previous) / (next.count - previous), 0) / (MILESTONES.length - 1);
	});
	const lightBonus = $derived(ionizeMilestoneBonus(ionizes));
	const keeps: ListItem[] = $derived([
		{ currencies: [], label: 'Photon upgrades' },
		{ currencies: [], label: 'Proton and electron upgrades' },
		{ currencies: [], label: 'Skills and achievements' },
		...(ionizes > 0 ? [{ currencies: LIGHTS, label: 'Light and Prism upgrades' }] : []),
	]);

	function handleIonize() {
		prestigeStore.trigger('ionize');
		setTimeout(() => gameManager.ionize(), 2000); // Wait for the flash
		onClose();
	}
</script>

{#snippet entry({ currencies, label }: ListItem)}
	<span>
		{#each currencies as currency (currency)}
			<Currency
				class="mr-0.5 -mt-0.5 align-middle"
				name={currency}
				size={15}
			/>
		{/each}
		{label}
	</span>
{/snippet}

<Modal
	{onClose}
	width="sm"
>
	{#snippet header()}
		<h2 class="flex flex-1 items-baseline gap-3 text-2xl font-bold text-white">
			Ionize
			{#if ionizes > 0}
				<span class="text-sm font-normal text-white/50">{formatNumber(ionizes)} so far</span>
			{/if}
		</h2>
	{/snippet}

	<div class="flex flex-col gap-7">
		<p class="text-center text-gray-300">Push the reactor past its limits and strip every atom of its electrons.</p>

		<div class="flex items-center gap-5">
			<div class="relative grid size-22 shrink-0 place-items-center">
				<svg
					class="absolute inset-0 -rotate-90"
					viewBox="0 0 88 88"
				>
					<circle
						class="stroke-white/10"
						cx="44"
						cy="44"
						fill="none"
						r="40"
						stroke-width="4"
					/>
					<circle
						class="stroke-radiation transition-[stroke-dashoffset] duration-1000 ease-linear"
						cx="44"
						cy="44"
						fill="none"
						pathLength="1"
						r="40"
						stroke-dasharray="1"
						stroke-dashoffset={1 - holdProgress}
						stroke-width="4"
					/>
				</svg>
				<IonizeIcon
					class="text-radiation transition-opacity {radiationManager.ionizeReady
						? 'animate-[spin_8s_linear_infinite] drop-shadow-[0_0_10px_var(--color-radiation)]'
						: aboveThreshold
							? ''
							: 'opacity-40'}"
					size={36}
				/>
			</div>
			<div class="flex min-w-0 flex-col gap-0.5">
				<span class="text-sm text-white/70" title="The line rises by {formatNumber(IONIZE_CPM_STEP, 0)} CPM with every Ionize">
					Core above {formatNumber(radiationManager.ionizeCpm, 0)} CPM
				</span>
				<span class="font-mono text-2xl font-bold tabular-nums {aboveThreshold || radiationManager.ionizeReady ? 'text-radiation' : 'text-white/60'}">
					{Math.floor(Math.min(radiationManager.ionizeHold, IONIZE_HOLD_SECONDS))} / {IONIZE_HOLD_SECONDS} s
				</span>
				<p class="text-xs text-white/50">
					{#if radiationManager.ionizeReady}
						The core reached ionization, it stays ready until you Ionize.
					{:else}
						Now at <span class={aboveThreshold ? 'text-radiation' : 'text-white/80'}>{formatNumber(radiationManager.currentCpm, 1)} CPM</span>, any dip below the line
						restarts the count.
					{/if}
				</p>
			</div>
		</div>

		<section class="flex flex-col gap-3">
			<div class="flex items-baseline justify-between gap-2">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-white/40">Milestones</h3>
				{#if lightBonus > 0}
					<span class="text-sm text-white/60"><span class="font-semibold text-white">+{Math.round(lightBonus * 100)}%</span> colored Light</span>
				{/if}
			</div>
			<div class="relative">
				<div
					class="absolute top-2.5 h-0.5 rounded-full bg-white/10"
					style:inset-inline="{50 / MILESTONES.length}%"
				></div>
				<div
					class="absolute top-2.5 h-0.5 rounded-full transition-[clip-path] duration-700"
					style:background={TRACK_GRADIENT}
					style:clip-path="inset(0 {100 - trackFill * 100}% 0 0)"
					style:inset-inline="{50 / MILESTONES.length}%"
				></div>
				<ol
					class="relative grid"
					style:grid-template-columns="repeat({MILESTONES.length}, minmax(0, 1fr))"
				>
					{#each MILESTONES as milestone, i (milestone.count)}
						{const done = $derived(i <= reached)}
						{const upcoming = $derived(i === reached + 1)}
						<li
							class="flex flex-col items-center gap-1"
							title="{milestone.count} Ionizes: {milestone.reward}"
						>
							<span
								class="size-5 rounded-full border-2 bg-accent-900 {upcoming ? 'animate-pulse' : ''}"
								style:background={done ? milestone.color : undefined}
								style:border-color={done ? 'transparent' : `color-mix(in srgb, ${milestone.color} ${upcoming ? 90 : 35}%, transparent)`}
								style:box-shadow={done ? `0 0 10px ${milestone.color}` : undefined}
							></span>
							<span class="text-[10px] tabular-nums {done ? 'text-white/80' : upcoming ? 'text-white/60' : 'text-white/30'}">{milestone.count}</span>
						</li>
					{/each}
				</ol>
			</div>
			<p class="text-xs text-white/50">
				{#if next}
					{next.count - ionizes === 1 ? 'Next Ionize' : `In ${next.count - ionizes} Ionizes`}:
					<span class="font-semibold text-white/85">{next.reward}</span>
				{:else}
					Every milestone is reached.
				{/if}
			</p>
			{#if ionizes > 0}
				<p class="flex items-center gap-2 text-sm text-white/80">
					<Rainbow
						class="shrink-0 text-white/50"
						size={16}
					/>
					<span class="flex-1">Light multiplier, +0.5 per Ionize</span>
					<span class="font-mono tabular-nums text-white/50">x{formatNumber(ionizeLightMultiplier(ionizes))}</span>
					<span class="text-white/30">→</span>
					<span class="font-mono font-semibold tabular-nums text-white">x{formatNumber(ionizeLightMultiplier(ionizes + 1))}</span>
				</p>
			{/if}
		</section>

		<div class="grid grid-cols-2 text-sm">
			<div class="flex flex-col gap-2 pr-4">
				<h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-300/80">
					<RotateCcw size={13} />
					Resets
				</h3>
				<ul class="flex flex-col gap-1.5 text-white/55">
					{#each RESETS as item (item.label)}
						<li class="flex gap-2">
							<X
								class="mt-0.5 shrink-0 text-red-300/50"
								size={14}
							/>
							{@render entry(item)}
						</li>
					{/each}
				</ul>
			</div>
			<div class="flex flex-col gap-2 border-l border-white/10 pl-4">
				<h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-radiation/80">
					<Vault size={13} />
					Keeps
				</h3>
				<ul class="flex flex-col gap-1.5 text-white/85">
					{#each keeps as item (item.label)}
						<li class="flex gap-2">
							<Check
								class="mt-0.5 shrink-0 text-radiation/70"
								size={14}
							/>
							{@render entry(item)}
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<HoldButton
			class="ionize-button w-full rounded-lg py-4 text-lg font-bold uppercase tracking-wide text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)] hover:enabled:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={!radiationManager.ionizeReady}
			onHoldComplete={handleIonize}
			style="background-image: {BUTTON_GRADIENT}; --hold-color: #ffffff; --hold-color-2: #f5f7ff; --hold-glow: rgba(245, 247, 255, 0.6);"
		>
			<span class="relative z-10">Hold to Ionize</span>
		</HoldButton>
	</div>
</Modal>

<style>
	:global(.ionize-button) {
		background-size: 200% 100%;
	}

	:global(.ionize-button:enabled) {
		animation: spectrum-drift 6s ease-in-out infinite alternate;
	}

	@keyframes spectrum-drift {
		to {
			background-position: 100% 0;
		}
	}
</style>
