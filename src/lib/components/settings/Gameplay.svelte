<script lang="ts">
	import SettingRow from '#components/ui/SettingRow.svelte';
	import Switch from '#components/ui/Switch.svelte';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import type { NumberNotation } from '#lib/types.js';
	import { ui } from '#stores/ui.svelte.js';
	import { Hash, Lightbulb, MoonStar, RotateCcw } from '@lucide/svelte';

	const notations: { example: string; id: NumberNotation }[] = [
		{ example: '1.50Qa', id: 'suffix' },
		{ example: '1.50e15', id: 'scientific' },
	];
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-3">
	<SettingRow description="Keep earning while the game is closed." icon={MoonStar} title="Offline progress">
		<Switch bind:checked={gameManager.settings.gameplay.offlineProgressEnabled} label="Offline progress" />
	</SettingRow>

	<SettingRow description="How big numbers are written." icon={Hash} title="Number notation">
		<div class="flex shrink-0 rounded-lg border border-white/10 bg-white/5 p-1" aria-label="Number notation" role="radiogroup">
			{#each notations as { example, id } (id)}
				{const selected = $derived(gameManager.settings.display.notation === id)}
				<button
					aria-checked={selected}
					class="rounded-md px-3 py-1.5 font-mono text-sm font-semibold transition-colors {selected ? 'bg-accent text-white' : 'text-white/60 hover:text-white'}"
					onclick={() => (gameManager.settings.display.notation = id)}
					role="radio"
					type="button"
				>
					{example}
				</button>
			{/each}
		</div>
	</SettingRow>

	<SettingRow description="Show tips next to new mechanics as you unlock them." icon={Lightbulb} title="Tips">
		<Switch checked={gameManager.tutorialManager.state.enabled} label="Tips" onchange={enabled => gameManager.tutorialManager.setEnabled(enabled)} />
	</SettingRow>

	<SettingRow description="Show every tip again from the start." icon={RotateCcw} title="Replay tips">
		<button
			class="shrink-0 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
			onclick={() => {
				ui.closeModal();
				gameManager.tutorialManager.forget();
			}}
			type="button"
		>
			Replay
		</button>
	</SettingRow>
</div>
