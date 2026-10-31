<script lang="ts">
	import { ELEMENTS } from '#data/elements.js';
	import { CHAINS, FORGED_BY, SITES, type SiteId } from '#data/sites.js';
	import { periodicManager } from '#helpers/PeriodicManager.svelte.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { toastStore } from '#stores/toasts.svelte.js';
	import { FlaskRound } from '@lucide/svelte';
	import { untrack } from 'svelte';

	const symbols = (zs: number[]) => zs.map(z => ELEMENTS[z - 1].symbol).join(', ');

	/** The forged set is rebuilt every second, the count only moves when an element is made. */
	const forgedCount = $derived(periodicManager.forged.size);

	let forgedBefore = new Set<number>();
	let loadsBefore = -1;
	let openBefore = new Set<SiteId>();
	let wasUnlocked = false;

	/** Announces what the Periodic Table made while it is closed, its own toasts take over when it is open. */
	$effect(() => {
		const { loads, open, unlocked } = periodicManager;
		void forgedCount;
		const forged = untrack(() => periodicManager.forged);
		/** A loaded save or the Spectroscope arriving replaces the whole state, that is no news. */
		const silent = !unlocked || !wasUnlocked || loads !== loadsBefore || untrack(() => realmManager.tableOpen || realmManager.introPlaying);
		const freshElements = silent ? [] : [...forged].filter(z => !forgedBefore.has(z)).sort((a, b) => a - b);
		const freshSites = silent ? [] : [...open].filter(id => !openBefore.has(id));
		forgedBefore = new Set(forged);
		loadsBefore = loads;
		openBefore = new Set(open);
		wasUnlocked = unlocked;

		if (freshElements.length === 1) {
			const [z] = freshElements;
			toastStore.info({
				action: () => realmManager.openTable(z),
				actionLabel: 'Read it',
				icon: FlaskRound,
				message: `Forged by ${SITES[FORGED_BY[z]].name}`,
				title: `${ELEMENTS[z - 1].name} is ready to read`,
			});
		} else if (freshElements.length > 1) {
			toastStore.info({
				action: () => realmManager.openTable(freshElements[0]),
				actionLabel: 'Read them',
				icon: FlaskRound,
				message: freshElements.length > 4 ? `${symbols(freshElements.slice(0, 4))}…` : symbols(freshElements),
				title: `${freshElements.length} elements are ready to read`,
			});
		}

		for (const id of freshSites) {
			toastStore.info({
				action: () => realmManager.openTable(CHAINS[id].steps[0]),
				actionLabel: 'See it',
				icon: FlaskRound,
				message: `Forges ${symbols(CHAINS[id].steps.slice(0, 3))}…`,
				title: `${SITES[id].name} opened in the Periodic Table`,
			});
		}
	});
</script>
