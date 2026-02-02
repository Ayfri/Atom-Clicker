<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { HardDrive, Cloud, Download, RefreshCw } from 'lucide-svelte';

	let jsonView = $state<'save' | 'supabase'>('save');
	let supabaseData = $state<unknown>(null);
	let loadingSupabase = $state(false);

	const saveData = $derived(gameManager.getCurrentState());

	async function loadSupabaseData() {
		loadingSupabase = true;
		try {
			const supabase = supabaseAuth.supabase;
			if (!supabase) {
				supabaseData = { error: 'Supabase not initialized' };
				return;
			}

			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data, error } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', user.id)
					.single();

				if (error) throw error;
				supabaseData = data;
			} else {
				supabaseData = { error: 'Not logged in' };
			}
		} catch (e) {
			supabaseData = { error: e instanceof Error ? e.message : 'Unknown error' };
		} finally {
			loadingSupabase = false;
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		alert('Copied to clipboard!');
	}
</script>

<div class="space-y-4">
	<!-- View Selector -->
	<div class="flex gap-2">
		<button
			class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer text-sm {jsonView === 'save' ? 'bg-accent-600/50 text-white border border-accent-500/50' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'}"
			onclick={() => jsonView = 'save'}
		>
			<HardDrive size={16} />
			<span>Local Save</span>
		</button>
		<button
			class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer text-sm {jsonView === 'supabase' ? 'bg-accent-600/50 text-white border border-accent-500/50' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'}"
			onclick={() => {
				jsonView = 'supabase';
				if (!supabaseData && !loadingSupabase) {
					loadSupabaseData();
				}
			}}
		>
			<Cloud size={16} />
			<span>Supabase Data</span>
		</button>
	</div>

	{#if jsonView === 'save'}
		<div class="bg-white/5 rounded-lg p-3 border border-white/5">
			<div class="flex justify-between items-center mb-3">
				<h3 class="text-base font-bold flex items-center gap-2 text-accent-300">
					<HardDrive size={18} />
					<span>Current Save State</span>
				</h3>
				<button
					class="flex items-center gap-2 bg-accent-600/50 hover:bg-accent-600 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer border border-accent-500/50"
					onclick={() => copyToClipboard(JSON.stringify(saveData, null, 2))}
				>
					<Download size={14} />
					<span>Copy JSON</span>
				</button>
			</div>
			<pre class="bg-black/30 p-3 rounded text-[10px] overflow-auto max-h-[60vh] font-mono border border-white/5 text-green-400/90">{JSON.stringify(saveData, null, 2)}</pre>
		</div>
	{:else}
		<div class="bg-white/5 rounded-lg p-3 border border-white/5">
			<div class="flex justify-between items-center mb-3">
				<h3 class="text-base font-bold flex items-center gap-2 text-accent-300">
					<Cloud size={18} />
					<span>Supabase Save Data</span>
				</h3>
				<div class="flex gap-2">
					<button
						class="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer"
						onclick={loadSupabaseData}
						disabled={loadingSupabase}
					>
						<RefreshCw size={14} class={loadingSupabase ? 'animate-spin' : ''} />
						<span>Refresh</span>
					</button>
				</div>
			</div>
			{#if loadingSupabase}
				<div class="bg-black/30 p-8 rounded text-center border border-white/5">
					<RefreshCw size={24} class="animate-spin mx-auto mb-2 text-accent-400" />
					<div class="text-white/60 text-xs">Loading Supabase data...</div>
				</div>
			{:else if supabaseData}
				<pre class="bg-black/30 p-3 rounded text-[10px] overflow-auto max-h-[60vh] font-mono border border-white/5 text-green-400/90">{JSON.stringify(supabaseData, null, 2)}</pre>
			{:else}
				<div class="bg-black/30 p-8 rounded text-center border border-white/5">
					<Cloud size={24} class="mx-auto mb-2 text-white/40" />
					<div class="text-white/60 text-xs">No data loaded yet</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
