<script lang="ts">
	import SettingRow from '#components/ui/SettingRow.svelte';
	import { installStore } from '#stores/install.svelte.js';
	import { MonitorDown } from '@lucide/svelte';
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-3">
	<SettingRow description="Get its own window and icon, open straight into the game and keep playing without a connection." icon={MonitorDown} title="Install the app">
		<button
			class="shrink-0 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors enabled:hover:bg-white/10 disabled:text-white/40"
			disabled={!installStore.canInstall}
			onclick={() => installStore.install()}
			type="button"
		>
			{installStore.installed ? 'Installed' : 'Install'}
		</button>
	</SettingRow>
</div>
