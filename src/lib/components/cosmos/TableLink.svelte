<script lang="ts">
	import { SITES } from '#data/sites.js';
	import { hasSourceLinks, instrumentLinks, unlockPhrase } from '#data/tableLinks.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { FlaskRound } from '@lucide/svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		class?: ClassValue;
		/** The instrument on offer, the line shows what it leads to in the Periodic Table. */
		instrumentId: string;
	}

	let { class: className, instrumentId }: Props = $props();

	const links = $derived(instrumentLinks(instrumentId));
	/** Sources stay hidden until the Spectroscope opens the Table, only the Spectroscope's own line always shows. */
	const shown = $derived(links.table || (periodicManager.unlocked && hasSourceLinks(links)));
	const color = $derived(links.table ? undefined : SITES[links.sites[0] ?? links.steps[0].site].color);
</script>

{#if shown}
	<p
		class={['flex items-start gap-1 text-xs', links.table && 'text-accent-300', className]}
		style:color
	>
		<FlaskRound
			class="mt-0.5 shrink-0"
			size={12}
		/>
		<span>{links.table ? 'Opens the Periodic Table' : `Periodic Table: ${unlockPhrase(links, 'line')}`}</span>
	</p>
{/if}
