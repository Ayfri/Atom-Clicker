<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import type { PhotonUpgrade } from '$lib/types';

	interface Props {
		id: string;
		isExcited?: boolean;
		upgrade: PhotonUpgrade;
	}

	let { id, isExcited = false, upgrade }: Props = $props();

	const currentLevel = $derived(gameManager.photonUpgrades[id] || 0);

	function onLevelChange(e: Event & { currentTarget: HTMLInputElement }) {
		const val = parseInt(e.currentTarget.value);
		if (!isNaN(val) && val >= 0) {
			gameManager.photonUpgrades[id] = val;
		}
	}
</script>

<div
	class="p-3 rounded-lg border flex flex-col gap-2 transition-colors group {isExcited
		? 'bg-yellow-900/10 border-yellow-700/20 hover:border-yellow-500/40'
		: 'bg-realm-900/20 border-realm-700/30 hover:border-realm-500/50'}"
>
	<div class="flex items-start justify-between gap-2">
		<div class="font-bold text-sm transition-colors group-hover:text-white {isExcited ? 'text-yellow-200' : 'text-realm-200'}">
			{upgrade.name}
		</div>
		<div class="text-[11px] font-mono text-white/40">{id}</div>
	</div>

	<div class="text-xs text-white/50 line-clamp-2 leading-tight min-h-[2.5em]">
		{upgrade.description(currentLevel)}
	</div>

	<div class="flex items-center gap-3 mt-1">
		<div class="relative flex-1">
			<input
				type="number"
				min="0"
				value={currentLevel}
				onchange={onLevelChange}
				class="w-full bg-black/40 rounded-md px-2 py-1.5 text-sm border focus:outline-none text-white font-bold transition-all {isExcited
					? 'border-yellow-500/30 focus:border-yellow-400/60'
					: 'border-realm-500/30 focus:border-realm-400/60'}"
			/>
		</div>
		<div class="flex flex-col items-end whitespace-nowrap">
			<span class="text-xs uppercase tracking-widest font-black text-white/50 leading-none">Level</span>
			<span class="text-[11px] text-white/30 font-bold leading-none mt-1">Max: {upgrade.maxLevel}</span>
		</div>
	</div>
</div>
