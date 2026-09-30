<script lang="ts">
	import { CurrenciesTypes } from '$data/currencies';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { LAYERS } from '$helpers/statConstants';
	import { ELECTRONS_PROTONS_REQUIRED } from '$lib/constants';
	import type { PrestigeListItem } from '$lib/types';
	import PrestigeModal from '@components/prestige/PrestigeModal.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const base = $derived(gameManager.electronizeBaseGain);
	/** The base gain rises by one every tenfold of protons, and upgrades multiply it, so the whole gain scales with it. */
	const next = $derived(
		base > 0
			? {
					at: ELECTRONS_PROTONS_REQUIRED * 10 ** base,
					gain: (gameManager.electronizeElectronsGain * (base + 1)) / base,
					progress: 1 + Math.log10(gameManager.protons / ELECTRONS_PROTONS_REQUIRED) - base,
				}
			: undefined,
	);
	const perks: PrestigeListItem[] = $derived(gameManager.totalElectronizesAllTime === 0 ? [{ label: 'Opens Electron upgrades' }] : []);
</script>

<PrestigeModal
	animation="electronize"
	{base}
	count={gameManager.totalElectronizesAllTime}
	currency={CurrenciesTypes.ELECTRONS}
	formula="The base grows by one for every tenfold of protons past 1 billion, and your upgrades multiply it."
	gain={gameManager.electronizeElectronsGain}
	layer={LAYERS.ELECTRONIZE}
	{next}
	{onClose}
	onPrestige={() => gameManager.electronize()}
	{perks}
	required={ELECTRONS_PROTONS_REQUIRED}
	source={CurrenciesTypes.PROTONS}
	stat="electron_gain"
	tagline="A deeper reset: trade every Proton for Electrons, spent on their own upgrades and deeper skills."
/>
