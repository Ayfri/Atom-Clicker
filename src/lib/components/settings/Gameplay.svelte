<script lang="ts">
	import SettingRow from '#components/ui/SettingRow.svelte';
	import Switch from '#components/ui/Switch.svelte';
	import Tabs from '#components/ui/Tabs.svelte';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import type { NumberNotation } from '#lib/types.js';
	import { ui } from '#stores/ui.svelte.js';
	import { Hash, Lightbulb, MoonStar, RotateCcw } from '@lucide/svelte';

	const notations: { id: NumberNotation; label: string }[] = [
		{ id: 'suffix', label: '1.50Qa' },
		{ id: 'scientific', label: '1.50e15' },
	];
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-3">
	<SettingRow description="Keep earning while the game is closed." icon={MoonStar} title="Offline progress">
		<Switch bind:checked={gameManager.settings.gameplay.offlineProgressEnabled} label="Offline progress" />
	</SettingRow>

	<SettingRow description="How big numbers are written." icon={Hash} title="Number notation">
		<Tabs
			buttonClass="px-3 py-1.5 font-mono text-sm"
			class="shrink-0"
			label="Number notation"
			onselect={id => (gameManager.settings.display.notation = id)}
			role="radiogroup"
			selected={gameManager.settings.display.notation}
			tabs={notations}
		/>
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
