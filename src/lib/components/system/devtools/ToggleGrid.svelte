<script lang="ts">
	import { btn, field } from './shared.svelte';

	interface Item {
		description: string;
		id: string;
		name: string;
	}

	interface Props {
		items: Item[];
		onChange: (owned: string[]) => void;
		owned: string[];
	}

	let { items, onChange, owned }: Props = $props();

	interface Chip {
		item: Item;
		label: string;
	}

	const TIER = /^[\d.]+[a-z]*$/i;

	/** Ids like `aps_1.00k` or `100_molecule` group on their non-numeric parts, singletons fall into "misc" and show their name. */
	const groups = $derived.by(() => {
		const byKey = new Map<string, Chip[]>();
		for (const item of items) {
			const parts = item.id.split('_');
			const key = parts.filter(part => !TIER.test(part)).join(' ');
			const chips = byKey.get(key) ?? [];
			chips.push({ item, label: parts.filter(part => TIER.test(part)).join('.') });
			byKey.set(key, chips);
		}
		const misc: Chip[] = [];
		const result: { chips: Chip[]; key: string }[] = [];
		for (const [key, chips] of byKey) {
			if (chips.length > 1 && chips.every(chip => chip.label)) result.push({ chips, key });
			else misc.push(...chips.map(chip => ({ item: chip.item, label: chip.item.name })));
		}
		result.sort((a, b) => a.key.localeCompare(b.key));
		if (misc.length) result.push({ chips: misc, key: 'misc' });
		return result;
	});

	let filter = $state<'all' | 'off' | 'on'>('all');
	let hovered = $state<Item | null>(null);
	let query = $state('');

	const ownedSet = $derived(new Set(owned));
	const visibleGroups = $derived.by(() => {
		const search = query.trim().toLowerCase();
		return groups
			.map(group => ({
				...group,
				chips: group.chips.filter(({ item }) => {
					if (filter !== 'all' && ownedSet.has(item.id) !== (filter === 'on')) return false;
					return !search || item.id.includes(search) || item.name.toLowerCase().includes(search);
				}),
			}))
			.filter(group => group.chips.length > 0);
	});

	function setGroup(chips: Chip[], on: boolean) {
		const ids = new Set(chips.map(chip => chip.item.id));
		onChange(on ? [...new Set([...owned, ...ids])] : owned.filter(id => !ids.has(id)));
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-1.5">
		<input bind:value={query} class="{field} flex-1 basis-32" placeholder="Search id or name" type="search" />
		<div class="flex overflow-hidden rounded-md border border-white/10 text-xs">
			{#each ['all', 'on', 'off'] as const as option (option)}
				<button
					class="cursor-pointer px-2.5 py-1.5 capitalize transition-colors {filter === option ? 'bg-accent-500/30 text-white' : 'text-white/50 hover:bg-white/5'}"
					onclick={() => (filter = option)}
				>
					{option}
				</button>
			{/each}
		</div>
		<span class="font-mono text-[11px] text-white/40">{ownedSet.size}/{items.length}</span>
		<button class={btn} onclick={() => onChange(items.map(item => item.id))}>All</button>
		<button class={btn} onclick={() => onChange([])}>None</button>
	</div>

	{#each visibleGroups as group (group.key)}
		{@const onCount = group.chips.filter(chip => ownedSet.has(chip.item.id)).length}
		<div class="flex flex-col gap-1.5">
			<button
				class="w-fit cursor-pointer text-left text-[11px] font-bold tracking-wider text-white/35 uppercase hover:text-white/70"
				onclick={() => setGroup(group.chips, onCount < group.chips.length)}
				title="Toggle the whole group"
			>
				{group.key} <span class="font-mono font-normal">{onCount}/{group.chips.length}</span>
			</button>
			<div class="flex flex-wrap gap-1.5">
				{#each group.chips as { item, label } (item.id)}
					{@const on = ownedSet.has(item.id)}
					<button
						class="h-7 min-w-7 cursor-pointer rounded-md border px-2 text-[11px] font-semibold transition-colors {on ?
							'border-accent-400/60 bg-accent-500/25 text-accent-100'
						:	'border-white/10 bg-white/5 text-white/40 hover:border-white/25 hover:text-white/70'}"
						onclick={() => onChange(on ? owned.filter(id => id !== item.id) : [...owned, item.id])}
						onfocus={() => (hovered = item)}
						onmouseenter={() => (hovered = item)}
					>
						{label}
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<p class="py-4 text-center text-xs text-white/30">Nothing matches</p>
	{/each}

	<div class="sticky bottom-0 -mx-4 border-t border-white/10 bg-accent-950/95 px-4 py-2 text-xs backdrop-blur">
		{#if hovered}
			<span class="font-semibold text-white">{hovered.name}</span>
			<span class="font-mono text-white/30">{hovered.id}</span>
			<p class="text-white/60">{hovered.description}</p>
		{:else}
			<span class="text-white/30">Hover an item for details, click a group title to toggle it whole</span>
		{/if}
	</div>
</div>
