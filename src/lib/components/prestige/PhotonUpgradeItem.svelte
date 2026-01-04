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
	const affordable = $derived(canAffordPhotonUpgrade(upgrade, currentLevel, gameManager));

	function onPurchase() {
		if (affordable) {
			gameManager.purchasePhotonUpgrade(upgrade.id);
		}
	}
</script>

<button
	class="upgrade text-start rounded-sm cursor-pointer p-2 transition-all duration-200 {affordable ? '' : 'opacity-50 cursor-not-allowed'} {isExcited ? 'bg-yellow-900/10 hover:bg-yellow-900/20 border border-yellow-500/20 hover:border-yellow-500/40' : 'bg-realm-900/20 hover:bg-realm-900/30 border border-realm-500/20 hover:border-realm-500/40'}"
	onclick={onPurchase}
>
	<div class="flex justify-between items-start mb-0.5">
		<h3 class="text-xs font-medium leading-tight {isExcited ? 'text-yellow-300' : 'text-realm-300'}">{upgrade.name}</h3>
		<span class="text-xs px-1 py-0.5 rounded-sm whitespace-nowrap ml-1 {isExcited ? 'text-yellow-400 bg-yellow-800/20' : 'text-realm-400 bg-realm-800/30'}">
			{currentLevel}/{upgrade.maxLevel}
		</span>
	</div>
	<p class="text-xs mb-0.5 leading-tight {isExcited ? 'text-yellow-200/80' : 'text-realm-200/80'}">{upgrade.description(currentLevel + 1)}</p>
	<div class="text-xs {isExcited ? 'text-yellow-300' : 'text-realm-300'}">
		<Value value={cost} {currency}/>
	</div>
</button>
