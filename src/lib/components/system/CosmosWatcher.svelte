<script lang="ts">
	import { COSMOS_INSTRUMENTS, SPECTROSCOPE_ID } from '#data/cosmos.js';
	import { instrumentReadyMessage } from '#data/tableLinks.js';
	import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { toastStore } from '#stores/toasts.svelte.js';
	import { FlaskRound } from '@lucide/svelte';
	import { untrack } from 'svelte';

	let instrumentsBefore: string[] = [];
	let loadsBefore = -1;

	/** Announces an instrument that finishes building, in the Cosmos or not, offline catch-up included. The Spectroscope has its own introduction. */
	$effect(() => {
		const { instruments, loads } = cosmosManager;
		/** A loaded save replaces the whole state, its instruments are no news. */
		const fresh = loads === loadsBefore ? instruments.filter(id => !instrumentsBefore.includes(id) && id !== SPECTROSCOPE_ID) : [];
		instrumentsBefore = instruments;
		loadsBefore = loads;

		untrack(() => {
			if (!periodicManager.unlocked) return;
			for (const id of fresh) {
				const built = COSMOS_INSTRUMENTS.find(item => item.id === id);
				const message = built && cosmosManager.owns(built) ? instrumentReadyMessage(built) : null;
				if (message) {
					toastStore.info({
						action: () => {
							realmManager.tableOpen = false;
							realmManager.cosmosOpen = true;
						},
						actionLabel: 'Open the Cosmos',
						icon: FlaskRound,
						message,
						title: `${built!.name} is ready`,
					});
				}
			}
		});
	});
</script>
