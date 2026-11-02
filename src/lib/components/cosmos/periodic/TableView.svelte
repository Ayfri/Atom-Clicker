<script lang="ts">
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { ui } from '#stores/ui.svelte.js';
	import Neutrino from '#components/cosmos/periodic/Neutrino.svelte';
	import PeriodicTable from '#components/cosmos/periodic/PeriodicTable.svelte';
	import { cubicInOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	$effect(() => ui.cover());
</script>

<!-- Above the Cosmos (z-45), the realm switcher and its dock (z-46), below the modals (z-50). Phones end it above the nav, over the realm bar. -->
<div
	class="fixed inset-x-0 bottom-[var(--mobile-dock-height,0px)] z-47 select-none bg-cosmos-sky text-white lg:left-18"
	style:top="var(--banner-height)"
	transition:fly|global={{ duration: 400, easing: cubicInOut, y: '100%' }}
>
	<Neutrino />
	<PeriodicTable onClose={() => (realmManager.tableOpen = false)} />
</div>
