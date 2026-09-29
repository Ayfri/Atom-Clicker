<script lang="ts">
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { CHROMATIC, CHROMATIC_COLORS } from '$data/chromatic';
	import {CURRENCIES, type CurrencyName} from '$data/currencies';
	import LightIcon from '@components/icons/Light.svelte';
	import WhiteLightIcon from '@components/icons/WhiteLight.svelte';
	import AtomIcon from '@components/icons/Atom.svelte';
	import ElectronIcon from '@components/icons/Electron.svelte';
	import ExcitedPhotonIcon from '@components/icons/ExcitedPhoton.svelte';
	import HiggsBosonIcon from '@components/icons/HiggsBoson.svelte';
	import ProtonIcon from '@components/icons/Proton.svelte';
	import PhotonIcon from '@components/icons/Photon.svelte';

	type SvgProps = SvelteHTMLElements['svg'];

	interface Props extends SvgProps {
		color?: string;
		class?: string;
		icon?: boolean;
		name: CurrencyName;
		size?: number;
	}

	let { name, icon = true, class: className = '', ...rest }: Props = $props();

	const currency = $derived(CURRENCIES[name]);
	const chromaticColor = $derived(CHROMATIC_COLORS.find(color => CHROMATIC[color].currency === name));
</script>

{#if icon}
	{#if currency.id === 'atom'}
		<AtomIcon class="inline {className}" color={currency.color} {...rest} />
	{:else if currency.id === 'electron'}
		<ElectronIcon class="inline {className}" color={currency.color} {...rest} />
	{:else if currency.id === 'excited-photon'}
		<ExcitedPhotonIcon class="inline {className}" color={currency.color} {...rest} />
	{:else if currency.id === 'higgs-boson'}
		<HiggsBosonIcon class="inline {className}" color={currency.color} {...rest} />
	{:else if currency.id === 'proton'}
		<ProtonIcon class="inline {className}" color={currency.color} {...rest} />
	{:else if currency.id === 'photon'}
		<PhotonIcon class="inline {className}" color={currency.color} {...rest} />
	{:else if chromaticColor}
		<LightIcon class="inline {className}" color={currency.color} facets={CHROMATIC[chromaticColor].facets} {...rest} />
	{:else if currency.id === 'white-light'}
		<WhiteLightIcon class="inline {className}" color={currency.color} {...rest} />
	{/if}
{:else}
	<span class="currency">{currency.name}</span>
{/if}
