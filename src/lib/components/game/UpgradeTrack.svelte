<script lang="ts">
	import UpgradeTierBar from '#components/game/UpgradeTierBar.svelte';
	import Value from '#components/ui/Value.svelte';
	import { CURRENCIES } from '#data/currencies.js';
	import { ICONS } from '#data/icons.js';
	import { RealmTypes } from '#data/realms.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import type { FamilyView } from '#helpers/UpgradeFamilies.svelte.js';
	import { buyFamily } from '#helpers/upgradeFx.js';
	import { Check } from '@lucide/svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly, scale } from 'svelte/transition';

	interface Props {
		/** Levels the auto-upgrade bought a moment ago. */
		auto: number;
		view: FamilyView;
	}

	let { auto, view }: Props = $props();

	const color = $derived(CURRENCIES[view.family.currency].color);
	const Icon = $derived(ICONS[view.family.icon]);
	const affordable = $derived(realmManager.live(RealmTypes.ATOMS, () => view.affordable));
	const affordableTiers = $derived(realmManager.live(RealmTypes.ATOMS, () => view.affordableTiers));

	let chip = $state<HTMLSpanElement>();
	let pop: Animation | undefined;
	let seen = -1;

	/** A level gained pops the chip once: a pop still running swallows the next ones, so spam clicks never stack them. */
	$effect(() => {
		const level = view.level;
		const before = seen;
		seen = level;
		if (before < 0 || level <= before || !chip || prefersReducedMotion.current || pop?.playState === 'running') return;
		pop = chip.animate([{ scale: '1.3' }, { scale: '1' }], { duration: 250 });
	});
</script>

{#snippet done(label: string)}
	<span class="flex items-center gap-0.5 rounded-sm bg-(--c)/15 px-1 text-[10px] font-bold text-(--c) uppercase">
		<Check size={10} strokeWidth={3.5} />{label}
	</span>
{/snippet}

<!-- Three states read apart at a glance: buyable rows take their currency tint, maxed ones go quiet with a check, unaffordable ones dim. -->
<div
	class="relative rounded-lg border p-2 transition-[background-color] duration-200 {view.maxed
		? 'border-transparent bg-white/3 text-white/60'
		: affordable
			? 'border-(--c)/40 bg-(--c)/10 hover:bg-(--c)/15'
			: 'border-transparent bg-white/5 opacity-45'}"
	data-family={view.family.id}
	style:--c={color}
>
	<button
		aria-label="Buy {view.family.name}"
		class="absolute inset-0 rounded-lg {affordable ? 'cursor-pointer' : view.next ? 'cursor-not-allowed' : ''}"
		data-hint="upgrade"
		disabled={!view.next}
		onclick={event => buyFamily(view, event, event.shiftKey)}
		type="button"
	></button>
	<div class="pointer-events-none relative">
		<h3 class="flex items-center gap-2 text-sm text-blue-400">
			<Icon color="currentColor" size={14} />
			<span class="truncate">{view.family.name}</span>
			{#if view.maxed}
				{@render done(view.max > 1 ? 'Max' : 'Bought')}
			{:else if view.max > 1}
				<span bind:this={chip} class="rounded-sm bg-accent-800/30 px-1 py-0.5 text-xs whitespace-nowrap text-accent-400 tabular-nums">
					{view.level}/{view.shown}
				</span>
			{/if}
		</h3>
		<p class="my-0.5 text-xs">{view.preview.description}</p>
		{#if view.max > 1}
			<UpgradeTierBar {affordable} {color} hasNext={view.next !== null} level={view.level} segments={view.shown} />
		{/if}
		{#if view.next}
			<div class="mt-1 flex h-4 items-center gap-1 text-xs" style:color>Cost: <Value currency={view.family.currency} value={view.nextCost} /></div>
		{:else if view.lockReason}
			<div class="mt-1 flex h-4 items-center text-xs text-white/50">{view.lockReason}</div>
		{/if}
	</div>
	{#if affordableTiers > 1}
		<button
			aria-label="Buy {affordableTiers} levels"
			class="absolute right-0 bottom-0 z-10 flex h-10 min-w-10 cursor-pointer items-end justify-end p-2"
			onclick={event => buyFamily(view, event, true)}
			title="Buy {affordableTiers} levels"
			type="button"
		>
			<span class="rounded-sm border border-accent-500/30 bg-accent-500/15 px-1 text-xs font-semibold text-accent-400 tabular-nums">×{affordableTiers}</span>
		</button>
	{/if}
	{#if auto > 0}
		<span
			class="pointer-events-none absolute top-1.5 right-2 z-10 text-sm font-bold text-(--c) tabular-nums"
			in:scale={{ duration: 200, start: 0.3 }}
			out:fly={{ duration: 500, opacity: 0, y: -20 }}
		>
			+{auto}
		</span>
	{/if}
</div>
