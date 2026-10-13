<script lang="ts">
	import QuarkIcon from '#components/icons/Quark.svelte';
	import SettingRow from '#components/ui/SettingRow.svelte';
	import { APP_REWARD_QUARKS } from '#data/quarks.js';
	import { APP_PRODUCTION_PERCENT } from '#lib/constants.js';
	import { installStore } from '#stores/install.svelte.js';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import { MonitorDown, TrendingUp } from '@lucide/svelte';
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

	<ul class="flex flex-col gap-2 px-1 text-sm text-white/60">
		<li class="flex items-center gap-2">
			<TrendingUp class="shrink-0 text-accent" size={16} />
			<span><span class="font-semibold text-accent">+{APP_PRODUCTION_PERCENT}% production</span> while the game runs as the app</span>
		</li>
		<li class="flex items-center gap-2">
			<QuarkIcon class="shrink-0 text-accent" mono size={16} />
			<span><span class="font-semibold text-accent">+{APP_REWARD_QUARKS} Quarks</span> once per account, the first time you open the app signed in</span>
		</li>
	</ul>
	{#if !supabaseAuth.isAuthenticated}
		<p class="px-1 text-xs text-white/45">Sign in to collect the Quarks, the +{APP_PRODUCTION_PERCENT}% works without an account.</p>
	{/if}
</div>
