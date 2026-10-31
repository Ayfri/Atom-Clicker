<script lang="ts">
	import { ELEMENTS } from '#data/elements.js';
	import { CHAINS, SITE_IDS, SITES } from '#data/sites.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { ChevronRight } from '@lucide/svelte';

	interface Props {
		/** The Cosmos object, the line shows when finding it opens a source of the Periodic Table. */
		objectId: string;
	}

	let { objectId }: Props = $props();

	const siteId = $derived(SITE_IDS.find(id => SITES[id].object === objectId));
	const site = $derived(siteId && SITES[siteId]);
	const steps = $derived(siteId ? CHAINS[siteId].steps : []);

	function open() {
		if (!siteId) return;
		const status = periodicManager.statuses[siteId];
		realmManager.openTable('z' in status ? status.z : steps[0]);
	}
</script>

{#if site && periodicManager.unlocked}
	<div class="flex flex-col items-start gap-0.5">
		<p
			class="text-xs"
			style:color={site.color}
		>
			{site.glyph} Opens {site.name} in the Periodic Table: {steps
				.slice(0, 3)
				.map(z => ELEMENTS[z - 1].symbol)
				.join(', ')}{steps.length > 3 ? '…' : ''}
		</p>
		<button
			class="-mb-1 flex min-h-8 items-center gap-0.5 text-xs text-accent-300 hover:text-accent-200"
			onclick={open}
		>
			See in the Table
			<ChevronRight size={14} />
		</button>
	</div>
{/if}
