<script lang="ts">
	import Ambient from '#components/game/Ambient.svelte';
	import FuelInjector from '#components/radiation/FuelInjector.svelte';
	import PowerLever from '#components/radiation/PowerLever.svelte';
	import RadiationUpgrades from '#components/radiation/RadiationUpgrades.svelte';
	import ReactorCore from '#components/radiation/ReactorCore.svelte';
	import HelpIcon from '#components/ui/HelpIcon.svelte';
	import { getQuarkShopItem } from '#data/quarkShop.js';
	import { RealmTypes } from '#data/realms.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import { radiationManager } from '#helpers/RadiationManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { reveal, unfold } from '#helpers/reveals.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import { mobile } from '#stores/window.svelte.js';

	const DEFAULT_ACCENT = '#39ff14';

	const accent = $derived.by(() => {
		const themeId = quarksManager.equippedThemes[RealmTypes.RADIATION];
		return (themeId ? getQuarkShopItem(themeId)?.theme?.accent : undefined) ?? DEFAULT_ACCENT;
	});
	const mass = $derived(radiationManager.mass);
	const power = $derived(radiationManager.controlRodLevel);
	const cpm = $derived(radiationManager.currentCpm);
	const netChange = $derived(radiationManager.netMassChange);
	const timeToEmpty = $derived(radiationManager.timeToEmpty);

	const hasMass = $derived(mass > 0);

	/** Fallout thickens with the reactor output and every Reactor Upgrade owned, an empty core leaves a single mote. */
	const ambience = $derived({
		colors: [accent],
		density:
			hasMass ?
				2 + Math.round(8 * Math.min(1, cpm / radiationManager.maxCpm)) + Math.min(6, Object.keys(radiationManager.upgradeLevels).length)
			:	1,
	});
	/** Latched so lowering the power under 10 CPM does not hide the upgrades again, once true the derived has no dependency left. */
	let upgradesReached = false;
	const showUpgrades = $derived((upgradesReached ||= cpm >= 10 || Object.keys(radiationManager.upgradeLevels).length > 0));

	const status = $derived(
		!hasMass ? { color: 'text-white/50', detail: 'inject fuel to start', label: 'Core empty' }
		: power <= 0 ? { color: 'text-sky-400', detail: 'pull the power lever up', label: 'Idle' }
		: netChange >= 0 ? { color: 'text-radiation', detail: 'runs forever', label: 'Stable' }
		: timeToEmpty < 60 ? { color: 'text-red-400 animate-pulse', detail: `empty in ${formatTime(timeToEmpty)}`, label: 'Critical' }
		: { color: 'text-yellow-300', detail: `empty in ${formatTime(timeToEmpty)}`, label: 'Draining' },
	);

	function formatTime(seconds: number): string {
		if (seconds < 60) return `${seconds.toFixed(0)}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
		return `${(seconds / 3600).toFixed(1)}h`;
	}
</script>

<div class="relative lg:pt-4" style:--color-radiation={accent}>
	<div
		class="pointer-events-none fixed inset-0 -z-50 transition-opacity duration-700"
		style:background="radial-gradient(circle at 35% 45%, color-mix(in srgb, var(--color-radiation) 14%, transparent), transparent 55%)"
		style:opacity={hasMass ? 0.3 + power * 0.7 : 0.15}
	></div>
	{#if realmManager.selectedRealmId === RealmTypes.RADIATION}
		<Ambient {accent} {ambience} realm={RealmTypes.RADIATION} />
	{/if}

	<div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-10 pt-1 lg:flex-row lg:pt-12 lg:items-start lg:pl-24 lg:pr-38 2xl:px-4 max-lg:landscape:pt-2">
		<!-- On a phone in landscape the header spans the top, the reactor and its controls sit side by side under it. -->
		<section class="flex flex-1 flex-col items-center gap-4 max-lg:landscape:flex-row max-lg:landscape:flex-wrap max-lg:landscape:items-start max-lg:landscape:justify-center">
			<div class="flex flex-col items-center gap-1 text-center max-lg:landscape:w-full">
				<div class="flex items-baseline gap-2">
					<span
						class="font-mono text-4xl font-bold tabular-nums text-radiation sm:text-[2.75rem] [text-shadow:0_0_24px_color-mix(in_srgb,var(--color-radiation)_45%,transparent)]"
					>
						x{formatNumber(radiationManager.radiationMultiplier, 2)}
					</span>
					<span class="text-2xl font-bold text-radiation/70">production</span>
					<HelpIcon class="self-center" position="bottom">
						{#snippet content()}
							<div class="flex flex-col gap-1 text-left text-xs text-white/70">
								<p><span class="text-radiation">Fuel</span> x <span class="text-radiation">Power</span> makes the output, the output multiplies all your production.</p>
								<p>Output is counted in CPM, counts per minute, like a Geiger counter.</p>
								<p>Double the power: double the output, four times the fuel burn.</p>
								<p>The ∞ mark on the lever is the highest power your fuel regen keeps up with forever.</p>
								<p class="text-white/50">The ring around the reactor is the output, it has a cap that Coolant Pumps raise.</p>
							</div>
						{/snippet}
					</HelpIcon>
				</div>
				<div class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] {status.color}">
					<span class="size-1.5 rounded-full bg-current"></span>
					{status.label}
					<span class="font-medium normal-case tracking-normal text-white/50">{status.detail}</span>
				</div>
			</div>

			<div class="flex w-full max-w-lg items-stretch gap-2 max-lg:landscape:max-w-[max(10rem,100dvh-13rem)]">
				<div class="min-w-0 flex-1">
					<ReactorCore {accent} />
				</div>
				{#if (hasMass || power > 0) && !mobile.current}
					<div in:reveal={{ y: 0 }}>
						<PowerLever vertical />
					</div>
				{/if}
			</div>

			<div class="flex w-full max-w-sm flex-col gap-3 max-lg:landscape:w-auto max-lg:landscape:flex-1">
				{#if (hasMass || power > 0) && mobile.current}
					<div in:reveal>
						<PowerLever vertical={false} />
					</div>
				{/if}
				{#if hasMass}
					<div class="flex items-baseline justify-between gap-2" data-hint="radiation-mass" in:reveal>
						<span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Fuel</span>
						<span class="font-mono text-xl font-bold tabular-nums text-white">{formatNumber(mass, 1)} u</span>
						<span
							class="ml-auto font-mono text-xs tabular-nums {netChange >= 0 ? 'text-radiation' : timeToEmpty < 60 ? 'text-red-400' : 'text-yellow-300'}"
						>
							{netChange >= 0 ? '+' : ''}{formatNumber(netChange, 2)} u/s
						</span>
					</div>
				{/if}
				<FuelInjector />
				{#if !showUpgrades && cpm > 0}
					<p class="border-t border-white/10 pt-2 text-center text-xs text-white/40">
						Reach 10 CPM to open Reactor Upgrades <span class="font-mono text-white/60">{formatNumber(cpm, 0)}/10</span>
					</p>
				{/if}
			</div>
		</section>

		{#if showUpgrades}
			<aside class="w-full lg:w-2/5 lg:max-w-md" in:unfold>
				<RadiationUpgrades />
			</aside>
		{/if}
	</div>
</div>
