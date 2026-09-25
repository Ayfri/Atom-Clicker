<script lang="ts">
	import { ACHIEVEMENTS } from '$data/achievements';
	import { ICONS, type IconName } from '$data/icons';
	import IconStack from '@components/ui/IconStack.svelte';
	import { tierIconStack } from '$helpers/iconStacks';
	import { prestigeStore } from '$stores/prestige.svelte';
	import { toastStore } from '$stores/toasts.svelte';
	import { btn, field } from '../shared.svelte';
	import Section from '../Section.svelte';

	const ICON_NAMES = Object.keys(ICONS) as IconName[];
	const TIERS = [1, 10, 50, 100, 200, 300, 500, 1000, 2000];
	/** A few hundred stacked SVGs at once visibly lag the panel, so the achievement gallery is paged. */
	const PAGE = 30;
	const achievementStacks = Object.values(ACHIEVEMENTS).flatMap(({ iconStack, name }) => (iconStack ? [{ name, stack: iconStack }] : []));

	let color = $state('#ffffff');
	let icon = $state<IconName>('molecule');
	let label = $state('');
	let overrideColor = $state(false);
	let shown = $state(PAGE);
	let size = $state(40);

	const toast = (type: 'error' | 'info' | 'success' | 'warning', infinite = false) =>
		toastStore[type]({ is_infinite: infinite, message: `A ${infinite ? 'sticky ' : ''}${type} toast.`, title: `Test ${type}` });
</script>

<Section title="Toasts and animations">
	<div class="flex flex-wrap gap-1">
		{#each ['success', 'info', 'warning', 'error'] as const as type (type)}
			<button class="{btn} capitalize" onclick={() => toast(type)}>{type}</button>
		{/each}
		<button class={btn} onclick={() => toast('warning', true)}>Sticky</button>
		<button class={btn} onclick={() => toastStore.clearAll()}>Clear</button>
		<button class="{btn} ml-auto" onclick={() => prestigeStore.trigger('protonise')}>Protonise anim</button>
		<button class={btn} onclick={() => prestigeStore.trigger('electronize')}>Electronize anim</button>
	</div>
</Section>

<Section title="Icon stacks">
	<div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
		<select bind:value={icon} class="{field} w-auto">
			{#each ICON_NAMES as name (name)}
				<option class="bg-accent-950" value={name}>{name}</option>
			{/each}
		</select>
		<input bind:value={color} class="h-6 w-8 cursor-pointer rounded bg-transparent" type="color" />
		<input bind:value={label} class="{field} w-20" placeholder="Label" />
		<input bind:value={size} class="w-24 accent-accent-500" max="96" min="16" type="range" />
		<span class="font-mono">{size}px</span>
	</div>
	<div class="flex flex-wrap items-end gap-3 rounded-lg bg-black/20 p-2">
		{#each [1, 2, 3] as count (count)}
			<IconStack {color} {count} {icon} label={label || undefined} {size} />
		{/each}
		<span class="mx-1 h-8 w-px bg-white/10"></span>
		{#each TIERS as tier, index (tier)}
			{@const stack = tierIconStack(icon, index, tier, color)}
			<div class="flex flex-col items-center gap-0.5">
				<IconStack color={stack.color} count={stack.count} icon={stack.icon} label={stack.label} {size} />
				<span class="font-mono text-[9px] text-white/30">{tier}</span>
			</div>
		{/each}
	</div>
</Section>

<Section collapsed title="Achievement stacks ({Math.min(shown, achievementStacks.length)}/{achievementStacks.length})">
	{#snippet actions()}
		<label class="flex items-center gap-1 text-[11px] text-white/50">
			<input bind:checked={overrideColor} class="accent-accent-500" type="checkbox" />
			Use picked color
		</label>
	{/snippet}
	<div class="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1">
		{#each achievementStacks.slice(0, shown) as { name, stack } (name)}
			<div class="flex flex-col items-center gap-1 rounded bg-white/5 p-1.5" title={name}>
				<IconStack color={overrideColor ? color : stack.color} count={stack.count} icon={stack.icon} label={stack.label} {size} />
				<span class="w-full truncate text-center text-[9px] text-white/40">{name}</span>
			</div>
		{/each}
	</div>
	{#if shown < achievementStacks.length}
		<button class="{btn} mt-2" onclick={() => (shown += PAGE)}>Show more</button>
	{/if}
</Section>

<Section collapsed title="Icon registry ({ICON_NAMES.length})">
	<div class="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1">
		{#each ICON_NAMES as name (name)}
			{@const Icon = ICONS[name]}
			<button class="flex cursor-pointer flex-col items-center gap-1 rounded bg-white/5 p-1.5 hover:bg-white/10" onclick={() => (icon = name)} title="Use in icon stacks">
				<Icon {color} size={size * 0.6} />
				<span class="w-full truncate text-center font-mono text-[9px] text-white/40">{name}</span>
			</button>
		{/each}
	</div>
</Section>
