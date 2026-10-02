<script lang="ts">
	import AutoButton from '#components/ui/AutoButton.svelte';
	import Currency from '#components/ui/Currency.svelte';
	import HelpIcon from '#components/ui/HelpIcon.svelte';
	import Tooltip from '#components/ui/Tooltip.svelte';
	import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
	import { FeatureTypes } from '#data/features.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { reveal, reveals } from '#helpers/reveals.svelte.js';
	import { formatDuration, formatNumber } from '#lib/utils.js';
	import { Info } from '@lucide/svelte';
	import type { Attachment } from 'svelte/attachments';
	import { prefersReducedMotion } from 'svelte/motion';

	/** Only computed while the tooltip is open, atoms per second is generators times each of these, in any order. */
	function productionBreakdown() {
		const multipliers = [
			{ label: 'Upgrades and skills', value: gameManager.effects.value('global', 1, gameManager) },
			{ label: 'Reactor', value: gameManager.radiationMultiplier },
			{ label: 'Power-ups', value: gameManager.bonusMultiplier },
			{ label: 'Stability Field', value: gameManager.stabilityMultiplier },
			{ label: 'Atoms boost', value: gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.ATOMS) },
		].filter(({ value }) => value !== 1);
		return { base: multipliers.reduce((base, { value }) => base / value, gameManager.atomsPerSecond), multipliers };
	}

	const hasAutoClick = $derived(gameManager.effects.has('auto_click'));
	const prestigeCurrencies = $derived([CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS].filter(type => gameManager.currencies[type].amount > 0));
	const stabilityPaused = $derived(gameManager.activePowerUps.length > 0);
	const stabilityFull = $derived(!stabilityPaused && gameManager.stabilityProgress >= 1);
	/** Unprotected auto-clicks empty the field on every tick, a countdown would only flicker around its full duration. */
	const stabilityHeld = $derived(gameManager.autoClicksPerSecond > 0 && !gameManager.features[FeatureTypes.STABLE_ATOM_AUTO_CLICK]);

	let lastStability = gameManager.stabilityProgress;

	/** Flashes when a click empties the field, ignoring the near-empty resets an unprotected auto-clicker fires every tick. */
	const flashOnReset: Attachment<HTMLElement> = node => {
		const progress = gameManager.stabilityProgress;
		if (lastStability - progress > 0.02 && !prefersReducedMotion.current) {
			node.animate([{ color: '#fca5a5', transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' });
		}
		lastStability = progress;
	};
</script>

<div class="relative z-1 flex w-full flex-col items-center text-center lg:mb-4 max-lg:landscape:mb-2">
	{#if prestigeCurrencies.length > 0}
		<div class="mb-1 flex items-center gap-4 text-lg font-bold tabular-nums">
			{#each prestigeCurrencies as type (type)}
				<span class="flex items-center gap-1.5" style:color={CURRENCIES[type].color} title={type}>
					<Currency name={type} size={20} />
					{formatNumber(gameManager.currencies[type].amount)}
				</span>
			{/each}
		</div>
	{/if}

	<div class="flex items-center gap-2.5">
		<Currency class="shrink-0 max-sm:size-7" name={CurrenciesTypes.ATOMS} size={38} />
		<span
			class="text-3xl font-black tabular-nums text-accent-300 transition-[text-shadow] duration-300 sm:text-4xl md:text-5xl {gameManager.hasBonus ?
				'[text-shadow:0_0_18px_#4a90e2,0_0_40px_#4a90e2]'
			:	'[text-shadow:0_0_24px_rgb(74_144_226/0.45)]'}"
		>
			{formatNumber(gameManager.atoms)}
		</span>
	</div>
	<span class="text-[11px] font-bold tracking-[0.3em] text-white/45 uppercase">Atoms</span>

	{#if reveals.production || hasAutoClick}
		<div class="mt-2 flex items-center gap-2" in:reveal>
			{#if reveals.production}
				<span class="font-mono text-lg font-bold tabular-nums {gameManager.hasBonus ? 'text-amber-300' : 'text-accent-200'}">
					+{formatNumber(gameManager.atomsPerSecond)}<span class="text-sm text-white/45">/s</span>
				</span>
				{#if gameManager.atomsPerSecond > 0}
					<Tooltip position="bottom" size="md">
						<Info class="cursor-help text-white/45 transition-colors hover:text-white/80" size={15} />
						{#snippet content()}
							{const { base, multipliers } = $derived(productionBreakdown())}
							<div class="flex flex-col gap-1 text-xs">
								<span class="mb-1 text-[11px] font-bold tracking-wider text-accent-300 uppercase">Production</span>
								<div class="flex justify-between gap-4">
									<span class="text-white/70">Generators</span>
									<span class="font-mono">{formatNumber(base)}/s</span>
								</div>
								{#each multipliers as { label, value } (label)}
									<div class="flex justify-between gap-4">
										<span class="text-white/70">{label}</span>
										<span class="font-mono">×{formatNumber(value)}</span>
									</div>
								{/each}
								<div class="mt-1 flex justify-between gap-4 border-t border-white/10 pt-1 font-semibold">
									<span>Total</span>
									<span class="font-mono text-accent-300">{formatNumber(gameManager.atomsPerSecond)}/s</span>
								</div>
								{#if gameManager.autoClicksPerSecond > 0}
									<div class="flex justify-between gap-4 text-white/60">
										<span>Auto-clicks, on top</span>
										<span class="font-mono">+{formatNumber(gameManager.clickPower * gameManager.autoClicksPerSecond)}/s</span>
									</div>
								{/if}
							</div>
						{/snippet}
					</Tooltip>
				{/if}
			{/if}
			{#if hasAutoClick}
				<AutoButton
					onClick={() => gameManager.toggleAutoClick()}
					toggled={gameManager.settings.automation.autoClick}
					tooltipContent={autoClickTooltip}
				/>
			{/if}
		</div>
	{/if}

	{#if gameManager.features[FeatureTypes.STABILITY_FIELD]}
		<div class="mt-3 w-full max-w-60 sm:mt-4 sm:max-w-72" in:reveal>
			<div class="mb-1 flex items-end justify-between gap-2 sm:mb-1.5">
				<span class="flex flex-col items-start leading-tight">
					<span class="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-yellow-100 uppercase sm:text-xs sm:tracking-[0.2em]">
						Stability Field
						<HelpIcon position="bottom">
							{#snippet content()}
								<div class="flex flex-col gap-1 text-left text-xs text-white/70">
									<p>An idle bonus: production grows while you leave the atom alone, until it reaches its max.</p>
									<p class="text-red-300">Clicking the atom, auto-clicks, catching a Higgs Boson and prestiges reset it. Steady skills protect some of them.</p>
									<p>Power-ups pause it.</p>
								</div>
							{/snippet}
						</HelpIcon>
					</span>
					<span class="text-[10px] tracking-wider text-yellow-200/60 uppercase max-sm:hidden">Idle bonus</span>
				</span>
				<span
					class="inline-block font-mono text-base font-bold tabular-nums sm:text-xl {stabilityPaused ? 'text-white/40' : 'text-yellow-300'}"
					{@attach flashOnReset}
				>
					×{formatNumber(gameManager.stabilityMultiplier)}
				</span>
			</div>
			<!-- A parent filter glows the segments after the mask cuts them, a shadow on the bar itself would be masked away. -->
			<div class="transition-[filter] duration-500 {stabilityFull ? 'drop-shadow-[0_0_6px_rgb(234_179_8/0.8)]' : ''}">
				<div class="h-2 overflow-hidden sm:h-2.5 rounded-xs bg-yellow-500/15 [mask-image:repeating-linear-gradient(90deg,#000_0_7px,transparent_7px_9px)]">
					<!-- Moves once per game tick, a sub-pixel step on this width, so no transition is needed to look smooth. -->
					<div
						class="h-full origin-left {stabilityPaused ? 'bg-white/30' : 'bg-linear-to-r from-yellow-600 to-yellow-300'}"
						style:transform="scaleX({gameManager.stabilityProgress})"
					></div>
				</div>
			</div>
			<div class="mt-1 flex justify-between gap-2 text-[11px] sm:text-xs">
				{#if stabilityPaused}
					<span class="text-red-300">Paused during power-up</span>
				{:else if stabilityFull}
					<span class="font-medium text-yellow-200">Maximum stability reached</span>
				{:else if stabilityHeld}
					<span class="text-red-300">Auto-clicks keep it empty</span>
				{:else}
					<span class="text-yellow-100/70">
						Full in <span class="font-mono tabular-nums">{formatDuration(gameManager.stabilityTimeRequired * (1 - gameManager.stabilityProgress))}</span>
					</span>
				{/if}
				{#if !stabilityFull}
					<span class="text-white/45">max <span class="font-mono text-white/70">×{formatNumber(gameManager.stabilityMax)}</span></span>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#snippet autoClickTooltip()}
	<div class="flex flex-col gap-1">
		<p class="text-xs text-white/80">Automatically clicks the atom for you, continuously.</p>
		{#if gameManager.settings.automation.autoClick && gameManager.autoClicksPerSecond > 0}
			<p class="text-xs text-white/60">Currently clicking {formatNumber(gameManager.autoClicksPerSecond, 1)} times per second.</p>
		{/if}
	</div>
{/snippet}
