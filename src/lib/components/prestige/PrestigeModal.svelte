<script lang="ts">
	import { CURRENCIES, CurrenciesTypes, type CurrencyName } from '#data/currencies.js';
	import { FeatureTypes } from '#data/features.js';
	import { RealmTypes } from '#data/realms.js';
	import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
	import { effectBreakdown } from '#helpers/effects.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { radiationManager } from '#helpers/RadiationManager.svelte.js';
	import { LAYERS } from '#helpers/statConstants.js';
	import type { EffectStat, PrestigeListItem } from '#lib/types.js';
	import { formatNumber } from '#lib/utils.js';
	import { prestigeStore } from '#stores/prestige.svelte.js';
	import Currency from '#components/ui/Currency.svelte';
	import HoldButton from '#components/ui/HoldButton.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import Tooltip from '#components/ui/Tooltip.svelte';
	import { Check, Info, RotateCcw, Sparkles, Vault, X } from '@lucide/svelte';

	interface Props {
		animation: 'electronize' | 'protonise';
		/** Gain before upgrades and boosts. */
		base: number;
		count: number;
		currency: CurrencyName;
		/** How the base gain grows, shown in the gain details. */
		formula: string;
		gain: number;
		layer: typeof LAYERS.ELECTRONIZE | typeof LAYERS.PROTONIZER;
		/** The next step of the base gain once the prestige is available, `progress` runs from 0 to 1 toward it. */
		next: { at: number; gain: number; progress: number } | undefined;
		onClose: () => void;
		onPrestige: () => void;
		perks: PrestigeListItem[];
		required: number;
		source: CurrencyName;
		stat: EffectStat;
		tagline: string;
	}

	let { animation, base, count, currency, formula, gain, layer, next, onClose, onPrestige, perks, required, source, stat, tagline }: Props = $props();

	const title = $derived(animation === 'protonise' ? 'Protonize' : 'Electronize');
	const color = $derived(CURRENCIES[currency].color);
	const shade = (percent: number) => `color-mix(in oklab, ${color} ${percent}%, black)`;
	const buttonStyle = $derived(
		`background-image: linear-gradient(100deg, ${shade(38)}, ${shade(68)}, ${shade(38)}); --hold-color: ${color}; --hold-color-2: color-mix(in oklab, ${color}, white 45%); --hold-glow: color-mix(in srgb, ${color} 65%, transparent);`,
	);

	const ready = $derived(gain > 0);
	const bank = $derived(currenciesManager.getAmount(currency));
	const sourceAmount = $derived(currenciesManager.getAmount(source));
	/** Whole percents, so the ring transition only restarts when a step changes rather than on every 50 Hz atom commit. */
	const ringProgress = $derived(Math.floor(Math.min(Math.max(ready ? (next?.progress ?? 1) : sourceAmount / required, 0), 1) * 100) / 100);

	const breakdown = $derived({
		boost: gameManager.getCurrencyBoostMultiplier(currency),
		effects: effectBreakdown(gameManager.allEffectSources, stat, gameManager),
	});

	const keepBoosts = $derived(gameManager.quarkEntitlements.includes('convenience_keep_currency_boosts'));
	const resets: PrestigeListItem[] = $derived([
		{ currencies: [CurrenciesTypes.ATOMS], label: 'Atoms, generators and Atom upgrades' },
		...(layer >= LAYERS.ELECTRONIZE ? [{ currencies: [CurrenciesTypes.PROTONS], label: 'Protons' }] : []),
		...(gameManager.features[FeatureTypes.LEVELS] ? [{ label: 'Levels and XP' }] : []),
		...(gameManager.boostPointsUsed > 0 && !keepBoosts ? [{ label: 'Currency boosts' }] : []),
		...(layer >= LAYERS.ELECTRONIZE && gameManager.totalProtonisesRun > 0
			? [{ label: `Protonize count (${formatNumber(gameManager.totalProtonisesRun, 0)}), which powers per-Protonize upgrades` }]
			: []),
		...(gameManager.features[FeatureTypes.STABILITY_FIELD] ? [{ label: `Stability Field, now x${formatNumber(gameManager.stabilityMultiplier)}` }] : []),
		...(gameManager.activePowerUps.length > 0 ? [{ label: 'Active power-ups' }] : []),
	]);
	const keeps: PrestigeListItem[] = $derived([
		{ currencies: [currency], label: CURRENCIES[currency].name },
		...(layer < LAYERS.ELECTRONIZE && currenciesManager.getEarnedAllTime(CurrenciesTypes.ELECTRONS) > 0
			? [{ currencies: [CurrenciesTypes.ELECTRONS], label: 'Electrons' }]
			: []),
		{ label: gameManager.totalElectronizesAllTime > 0 ? 'Proton and Electron upgrades' : 'Proton upgrades' },
		...(gameManager.realms[RealmTypes.PHOTONS]?.unlocked
			? [{ currencies: [CurrenciesTypes.PHOTONS, CurrenciesTypes.EXCITED_PHOTONS], label: 'Photons and Photon upgrades' }]
			: []),
		...(radiationManager.unlocked ? [{ label: 'The reactor and its upgrades' }] : []),
		...(gameManager.totalIonizesAllTime > 0
			? [{ currencies: [CurrenciesTypes.RED_LIGHT, CurrenciesTypes.GREEN_LIGHT, CurrenciesTypes.BLUE_LIGHT], label: 'Light and Prism upgrades' }]
			: []),
		...(keepBoosts && gameManager.boostPointsUsed > 0 ? [{ label: 'Currency boosts' }] : []),
		{ label: 'Skills and achievements' },
	]);

	function handlePrestige() {
		prestigeStore.trigger(animation);
		setTimeout(onPrestige, 2000); // Wait for the flash
		onClose();
	}
</script>

{#snippet entry({ currencies = [], label }: PrestigeListItem)}
	<span>
		{#each currencies as icon (icon)}
			<Currency
				class="mr-0.5 -mt-0.5 align-middle"
				name={icon}
				size={15}
			/>
		{/each}
		{label}
	</span>
{/snippet}

{#snippet row(label: string, value: string, strong = false)}
	<div class="flex items-center justify-between gap-3">
		<span class="text-white/70">{label}</span>
		<span
			class="font-mono {strong ? 'font-semibold' : ''}"
			style:color={strong ? color : undefined}>{value}</span
		>
	</div>
{/snippet}

<Modal
	{onClose}
	width="sm"
>
	{#snippet header()}
		<h2 class="flex flex-1 items-baseline gap-3 text-2xl font-bold text-white">
			{title}
			{#if count > 0}
				<span class="text-sm font-normal text-white/50">{formatNumber(count, 0)} so far</span>
			{/if}
		</h2>
	{/snippet}

	<div class="flex flex-col gap-7">
		<p class="text-center text-gray-300">{tagline}</p>

		<div class="flex items-center gap-5">
			<div class="relative grid size-22 shrink-0 place-items-center">
				{#if ready}
					<div
						class="absolute inset-3 rounded-full opacity-30 blur-xl"
						style:background={color}
					></div>
				{/if}
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
						class="transition-[stroke-dashoffset] duration-500"
						cx="44"
						cy="44"
						fill="none"
						pathLength="1"
						r="40"
						stroke={color}
						stroke-dasharray="1"
						stroke-dashoffset={1 - ringProgress}
						stroke-width="4"
					/>
				</svg>
				<Currency
					class="relative transition-opacity {ready ? '' : 'opacity-40'}"
					name={currency}
					size={38}
				/>
			</div>

			<div class="flex min-w-0 flex-col gap-0.5">
				<span class="flex items-center gap-1.5 text-sm text-white/70">
					You gain
					<Tooltip
						position="bottom"
						size="md"
					>
						<Info
							class="cursor-help text-white/50 transition-colors hover:text-white"
							size={14}
						/>
						{#snippet content()}
							<div class="flex flex-col gap-2 text-xs">
								<span
									class="text-[11px] font-bold uppercase tracking-wider"
									style:color>{CURRENCIES[currency].name} gain</span
								>
								<p class="text-[11px] text-white/70">{formula}</p>
								<div class="grid gap-1">
									{@render row('Base', formatNumber(base))}
									{@render row('Upgrades and boosts', base > 0 ? `x${formatNumber(gain / base)}` : '-')}
									{@render row('Total', formatNumber(gain), true)}
								</div>
								{#if breakdown.effects.length > 0 || breakdown.boost > 1}
									<div class="h-px bg-white/10"></div>
									{#each breakdown.effects as effect, i (effect.name + i)}
										{@render row(effect.name, effect.value)}
									{/each}
									{#if breakdown.boost > 1}
										{@render row(`${CURRENCIES[currency].name} boost`, `x${formatNumber(breakdown.boost)}`)}
									{/if}
								{/if}
							</div>
						{/snippet}
					</Tooltip>
				</span>
				<span
					class="flex items-center gap-1.5 font-mono text-3xl font-bold tabular-nums {ready ? '' : 'opacity-40'}"
					style:color
				>
					+{formatNumber(gain)}
				</span>
				<p class="text-xs text-white/50">
					{#if !ready}
						Reach <span class="text-white/80">{formatNumber(required, 0)} {CURRENCIES[source].name}</span> to {title}, {formatNumber(
							Math.min(sourceAmount / required, 1) * 100,
							0,
						)}% there.
					{:else if bank > 0}
						<span class="font-mono tabular-nums">{formatNumber(bank)}</span>
						<span class="text-white/30">→</span>
						<span class="font-mono font-semibold tabular-nums text-white">{formatNumber(bank + gain)}</span>
						{CURRENCIES[currency].name}
					{:else}
						Your first {CURRENCIES[currency].name}.
					{/if}
				</p>
				{#if ready && next}
					<p class="text-xs text-white/50">
						<span class="font-semibold text-white/85">+{formatNumber(next.gain)}</span> at {formatNumber(next.at)}
						{CURRENCIES[source].name}
					</p>
				{/if}
			</div>
		</div>

		{#if perks.length > 0}
			<section class="flex flex-col gap-2">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-white/40">Next run</h3>
				<ul class="flex flex-col gap-1.5 text-sm text-white/85">
					{#each perks as perk (perk.label)}
						<li class="flex gap-2">
							<Sparkles
								class="mt-0.5 shrink-0"
								size={14}
								{color}
							/>
							{@render entry(perk)}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="grid grid-cols-2 text-sm">
			<div class="flex flex-col gap-2 pr-4">
				<h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-300/80">
					<RotateCcw size={13} />
					Resets
				</h3>
				<ul class="flex flex-col gap-1.5 text-white/55">
					{#each resets as item (item.label)}
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
				<h3
					class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
					style:color
				>
					<Vault size={13} />
					Keeps
				</h3>
				<ul class="flex flex-col gap-1.5 text-white/85">
					{#each keeps as item (item.label)}
						<li class="flex gap-2">
							<Check
								class="mt-0.5 shrink-0"
								size={14}
								{color}
							/>
							{@render entry(item)}
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<HoldButton
			class="prestige-button w-full rounded-lg py-4 text-lg font-bold uppercase tracking-wide text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)] hover:enabled:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={!ready}
			onHoldComplete={handlePrestige}
			style={buttonStyle}
		>
			<span class="relative z-10">Hold to {title}</span>
		</HoldButton>
	</div>
</Modal>

<style>
	:global(.prestige-button) {
		background-size: 200% 100%;
	}

	:global(.prestige-button:enabled) {
		animation: prestige-drift 5s ease-in-out infinite alternate;
	}

	@keyframes prestige-drift {
		to {
			background-position: 100% 0;
		}
	}
</style>
