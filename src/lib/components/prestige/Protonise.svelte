<script lang="ts">
	import PrestigeModal from '#components/prestige/PrestigeModal.svelte';
	import { CurrenciesTypes } from '#data/currencies.js';
	import { boostTiersUnlockedByNextProtonise } from '#data/upgrades.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { LAYERS } from '#helpers/statConstants.js';
	import { PROTONS_ATOMS_REQUIRED } from '#lib/constants.js';
	import type { PrestigeListItem } from '#lib/types.js';
	import { formatNumber } from '#lib/utils.js';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const base = $derived(gameManager.atoms < PROTONS_ATOMS_REQUIRED ? 0 : Math.floor(Math.sqrt(gameManager.atoms / PROTONS_ATOMS_REQUIRED)));
	/** The base gain is a square root, so four times the atoms of the current step doubles it. */
	const next = $derived.by(() => {
		if (base === 0) return undefined;
		const step = base ** 2 * PROTONS_ATOMS_REQUIRED;
		return {
			at: 4 * step,
			gain: gameManager.effects.value('proton_gain', 2 * base, gameManager) * gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.PROTONS),
			progress: Math.log(gameManager.atoms / step) / Math.log(4),
		};
	});
	const perks: PrestigeListItem[] = $derived.by(() => {
		const boostTiers = boostTiersUnlockedByNextProtonise(gameManager);
		const startAtoms = gameManager.effects.value('start_atoms', 0, gameManager);
		return [
			...(gameManager.totalProtonisesAllTime === 0 ? [{ label: 'Opens Proton upgrades and currency Boosts' }] : []),
			...(boostTiers > 0 ? [{ label: `${boostTiers} more generator Boost upgrades` }] : []),
			...(startAtoms > 0 ? [{ currencies: [CurrenciesTypes.ATOMS], label: `Starts with ${formatNumber(startAtoms)} atoms` }] : []),
		];
	});
</script>

<PrestigeModal
	animation="protonise"
	{base}
	count={gameManager.totalProtonisesAllTime}
	currency={CurrenciesTypes.PROTONS}
	formula="The base is the square root of your atoms in billions: four times the atoms doubles it."
	gain={gameManager.protoniseProtonsGain}
	layer={LAYERS.PROTONIZER}
	{next}
	{onClose}
	onPrestige={() => gameManager.protonise()}
	{perks}
	required={PROTONS_ATOMS_REQUIRED}
	source={CurrenciesTypes.ATOMS}
	stat="proton_gain"
	tagline="Trade this run for Protons, spent on upgrades and skills that stay with you through every Protonize."
/>
