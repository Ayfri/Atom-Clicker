<script lang="ts">
	import Value from '@components/ui/Value.svelte';
	import type { CurrencyName } from '$data/currencies';
	import { getPhotonUpgradeCost, canAffordPhotonUpgrade } from '$data/photonUpgrades';
	import { gameManager } from '$helpers/GameManager.svelte';
	import type { PhotonUpgrade } from '$lib/types';

	interface Props {
		currency: CurrencyName;
		isExcited?: boolean;
		upgrade: PhotonUpgrade;
	}

	let { currency, isExcited = false, upgrade }: Props = $props();

	const currentLevel = $derived(gameManager.photonUpgrades[upgrade.id] || 0);
	const cost = $derived(getPhotonUpgradeCost(upgrade, currentLevel));
	const isMaxed = $derived(currentLevel >= upgrade.maxLevel);
	const affordable = $derived(canAffordPhotonUpgrade(upgrade, currentLevel, gameManager) && !isMaxed);

	function onPurchase() {
		if (affordable && !isMaxed) {
			gameManager.purchasePhotonUpgrade(upgrade.id);
		}
	}
</script>

<button
	class="upgrade text-start rounded-sm p-2 transition-all duration-200 border
	{isMaxed
		? `${isExcited ? 'bg-yellow-900/10' : 'bg-realm-900/10'} opacity-85 cursor-default`
		: `${isExcited ? 'bg-yellow-900/10 hover:bg-yellow-900/20 border-yellow-500/20 hover:border-yellow-500/40' : 'bg-realm-900/20 hover:bg-realm-900/30 border-realm-500/20 hover:border-realm-500/40'} ${affordable ? 'opacity-100 cursor-pointer' : 'opacity-45 cursor-not-allowed'}`
	}"
	onclick={onPurchase}
	disabled={isMaxed}
>
	<div class="flex justify-between items-start mb-0.5">
		<h3 class="text-xs font-medium leading-tight {isExcited ? 'text-yellow-300' : 'text-realm-300'}">
			{upgrade.name}
			{#if isMaxed}
				<span class="ml-1 text-[10px] uppercase font-bold {isExcited ? 'text-yellow-400/70 bg-yellow-400/10' : 'text-realm-400/70 bg-realm-400/10'} px-1 rounded-sm">Maxed</span>
			{/if}
		</h3>
		<span class="text-xs px-1 py-0.5 rounded-sm whitespace-nowrap ml-1 {isMaxed ? (isExcited ? 'text-yellow-400/70 bg-yellow-800/10' : 'text-realm-400/70 bg-realm-800/10') : (isExcited ? 'text-yellow-400 bg-yellow-800/20' : 'text-realm-400 bg-realm-800/30')}">
			{currentLevel}/{upgrade.maxLevel}
		</span>
	</div>
	<p class="text-xs mb-0.5 leading-tight {isExcited ? 'text-yellow-200/50' : 'text-realm-200/50'}">
		{isMaxed ? upgrade.description(currentLevel) : upgrade.description(currentLevel + 1)}
	</p>
	<div class="text-xs {isExcited ? 'text-yellow-300/60' : 'text-realm-300/60'}">
		{#if !isMaxed}
			<Value value={cost} {currency}/>
		{/if}
	</div>
</button>
