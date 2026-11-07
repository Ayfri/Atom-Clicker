<script lang="ts">
	import { ELEMENTS } from '#data/elements.js';
	import { CHAINS, SITES, type SiteId } from '#data/sites.js';
	import { objectLinks } from '#data/tableLinks.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import SourceArt from '#components/cosmos/periodic/SourceArt.svelte';
	import { ChevronRight, FlaskRound } from '@lucide/svelte';

	interface Props {
		/** One line for an object already found, the discovery card shows the full block. */
		compact?: boolean;
		/** The Cosmos object, the line shows when finding it opens a source of the Periodic Table or unblocks a step of one. */
		objectId: string;
	}

	interface Item {
		/** Element the Table selects on "See it in the Table". */
		focus: number;
		/** `source` opens the whole source, `step` lets an open one forge more. */
		kind: 'source' | 'step';
		site: SiteId;
		/** Elements the event is about. */
		zs: number[];
	}

	let { compact = false, objectId }: Props = $props();

	const items = $derived.by((): Item[] => {
		const links = objectLinks(objectId);
		return [
			...links.sites.map((site): Item => {
				const status = periodicManager.statuses[site];
				const steps = CHAINS[site].steps;
				return { focus: 'z' in status ? status.z : steps[0], kind: 'source', site, zs: steps };
			}),
			...[...Map.groupBy(links.steps, step => step.site)].map(([site, steps]): Item => ({ focus: steps[0].z, kind: 'step', site, zs: steps.map(step => step.z) })),
		];
	});

	const symbols = (item: Item) => `${item.zs.slice(0, 6).map(z => ELEMENTS[z - 1].symbol).join(' ')}${item.zs.length > 6 ? ' …' : ''}`;
	const title = (item: Item) =>
		item.kind === 'source' ? `${SITES[item.site].name} source opened` : `The ${SITES[item.site].name} can forge ${item.zs.map(z => ELEMENTS[z - 1].name.toLowerCase()).join(' and ')}`;
</script>

{#snippet seeButton(item: Item, label: string, spacing: string)}
	<button
		class={['flex min-h-8 items-center gap-0.5 text-xs text-accent-300 hover:text-accent-200', spacing]}
		onclick={() => realmManager.openTable(item.focus)}
	>
		{label}
		<ChevronRight size={14} />
	</button>
{/snippet}

{#if periodicManager.unlocked}
	{#each items as item (item.site + item.kind)}
		{#if compact}
			<div class="flex flex-wrap items-center gap-x-3">
				<p
					class="flex items-center gap-1 text-xs"
					style:color={SITES[item.site].color}
				>
					<FlaskRound
						class="shrink-0"
						size={12}
					/>
					{item.kind === 'source' ? `Opens ${SITES[item.site].name} in the Periodic Table` : `Lets the ${SITES[item.site].name} forge ${symbols(item)}`}
				</p>
				{@render seeButton(item, 'See', '-my-1')}
			</div>
		{:else}
			<div class="flex flex-col gap-2 rounded-lg p-2.5 ring-1 ring-white/10">
				<p class="text-[10px] font-semibold uppercase tracking-widest text-white/40">New in the Periodic Table</p>
				<div class="flex items-center gap-2.5">
					<SourceArt
						class="size-10 shrink-0"
						id={item.site}
					/>
					<div class="flex min-w-0 flex-1 flex-col">
						<p
							class="text-sm font-semibold"
							style:color={SITES[item.site].color}
						>
							{title(item)}
						</p>
						<p class="font-mono text-xs text-white/55">{symbols(item)}</p>
						{@render seeButton(item, 'See it in the Table', '-mb-1')}
					</div>
				</div>
			</div>
		{/if}
	{/each}
{/if}
