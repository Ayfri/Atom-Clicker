<script lang="ts">
	import ElectronizeIcon from '#components/icons/Electronize.svelte';
	import PhotonIcon from '#components/icons/Photon.svelte';
	import ProtoniseIcon from '#components/icons/Protonise.svelte';
	import { CURRENCIES } from '#data/currencies.js';
	import { REALMS } from '#data/realms.js';
	import { formatNumber } from '#lib/utils.js';
	import { Lock, Radiation } from '@lucide/svelte';
	import type { Component } from 'svelte';

	interface Milestone {
		color: string;
		count: number | null;
		icon: Component<{ color?: string; size?: number }>;
		label: string;
		reached: boolean;
	}

	interface Props {
		electronizes: number;
		photonRealm: boolean;
		protonizes: number;
		radiationRealm: boolean;
	}

	let { electronizes, photonRealm, protonizes, radiationRealm }: Props = $props();

	/** Locked milestones stay hidden behind `???` so a profile never spoils what comes next. */
	const milestones: Milestone[] = $derived([
		{ color: CURRENCIES.Protons.color, count: protonizes, icon: ProtoniseIcon, label: 'Protonized', reached: protonizes > 0 },
		{ color: CURRENCIES.Electrons.color, count: electronizes, icon: ElectronizeIcon, label: 'Electronized', reached: electronizes > 0 },
		{ color: REALMS.photons.color, count: null, icon: PhotonIcon, label: 'Photon Realm', reached: photonRealm },
		{ color: REALMS.radiation.color, count: null, icon: Radiation, label: 'Radiation Realm', reached: radiationRealm },
	]);
</script>

<section class="rounded-2xl border border-white/10 bg-black/20 p-4">
	<h3 class="mb-3 text-xs font-semibold tracking-wider text-white/40 uppercase">Journey</h3>
	<ol class="grid grid-cols-2 gap-3 md:grid-cols-4">
		{#each milestones as milestone (milestone.label)}
			<li class="flex flex-col items-center gap-2 rounded-xl p-3 text-center {milestone.reached ? 'bg-white/5' : 'border border-dashed border-white/10 opacity-50'}">
				<span class="flex size-11 items-center justify-center rounded-full bg-black/40">
					{#if milestone.reached}
						<milestone.icon color={milestone.color} size={24} />
					{:else}
						<Lock class="text-white/50" size={16} />
					{/if}
				</span>
				<span class="text-sm font-semibold text-white">{milestone.reached ? milestone.label : '???'}</span>
				{#if milestone.reached && milestone.count}
					<span class="text-xs text-white/50">{formatNumber(milestone.count)} times</span>
				{/if}
			</li>
		{/each}
	</ol>
</section>
