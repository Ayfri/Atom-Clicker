<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { SAVE_KEY, SAVE_VERSION } from '$helpers/saves';
	import { statsConfig } from '$helpers/statConstants';
	import type { GameState } from '$lib/types';
	import { getItem } from '$lib/utils/safeLocalStorage';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { toastStore } from '$stores/toasts.svelte';
	import { btn, btnAccent, btnDanger, field, reloadWithSave, snapshots } from '../shared.svelte';
	import NumberInput from '../NumberInput.svelte';
	import Section from '../Section.svelte';

	const saveSize = $derived.by(() => {
		gameManager.lastSave;
		return getItem(SAVE_KEY)?.length ?? 0;
	});

	async function copy(text: string, what: string) {
		await navigator.clipboard.writeText(text);
		toastStore.success({ message: `${what} copied to the clipboard.`, title: 'DevTools', duration: 2000 });
	}

	function download() {
		const url = URL.createObjectURL(new Blob([JSON.stringify(gameManager.getCurrentState(), null, 2)], { type: 'application/json' }));
		Object.assign(document.createElement('a'), { download: `atom-clicker-${new Date().toISOString().slice(0, 19)}.json`, href: url }).click();
		URL.revokeObjectURL(url);
	}

	let importText = $state<string | null>(null);
	const importError = $derived.by(() => {
		if (!importText) return null;
		try {
			JSON.parse(importText);
			return null;
		} catch (error) {
			return (error as Error).message;
		}
	});

	let snapshotName = $state('');

	/** Reads one field instead of `getCurrentState()`, so each row only re-renders when its own value changes and not on every tick. */
	function read(key: string): unknown {
		if (key === 'radiation') return radiationManager.getState();
		if (key === 'selectedRealmId') return realmManager.selectedRealmId;
		if (key === 'tutorial') return gameManager.tutorialManager.state;
		return (gameManager as unknown as Record<string, unknown>)[key];
	}

	let query = $state('');
	const keys = $derived(Object.keys(statsConfig).filter(key => key.toLowerCase().includes(query.trim().toLowerCase())));
	let editing = $state<{ key: string; text: string } | null>(null);
	const editError = $derived.by(() => {
		if (!editing) return null;
		try {
			JSON.parse(editing.text);
			return null;
		} catch (error) {
			return (error as Error).message;
		}
	});

	/** `loadSaveData` already knows how to route the odd keys (settings merge, radiation, tutorial, selected realm). */
	function write(key: string, value: unknown) {
		gameManager.loadSaveData({ [key]: value } as Partial<GameState>);
		gameManager.syncFeatures();
		gameManager.checkRealmUnlocks();
	}

	let rawJson = $state<string | null>(null);
	let cloudJson = $state<string | null>(null);

	async function fetchCloud() {
		cloudJson = 'Loading...';
		const supabase = supabaseAuth.supabase;
		const user = supabase && (await supabase.auth.getUser()).data.user;
		if (!supabase || !user) return (cloudJson = 'Not signed in');
		const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
		cloudJson = error ? error.message : JSON.stringify(data, null, 2);
	}
</script>

<Section title="Local save">
	<div class="mb-2 flex flex-wrap gap-x-3 font-mono text-[11px] text-white/50">
		<span>v{SAVE_VERSION}</span>
		<span>{(saveSize / 1024).toFixed(1)} KB</span>
		<span>saved {new Date(gameManager.lastSave).toLocaleTimeString()}</span>
		{#if gameManager.saveIntegrityTampered}<span class="text-red-400">checksum tampered</span>{/if}
	</div>
	{#each gameManager.saveIntegrityWarnings as warning (warning)}
		<p class="mb-1 text-[11px] text-yellow-300/80">{warning}</p>
	{/each}
	<div class="flex flex-wrap gap-1">
		<button class={btnAccent} onclick={() => gameManager.save()}>Save now</button>
		<button class={btn} onclick={() => copy(getItem(SAVE_KEY) ?? '', 'Stored save')}>Copy stored</button>
		<button class={btn} onclick={download}>Download JSON</button>
		<button class={btn} onclick={() => (importText = importText === null ? '' : null)}>Import</button>
		<button class="{btnDanger} ml-auto" onclick={() => confirm('Wipe the local save and reload?') && reloadWithSave(null)}>Hard reset</button>
	</div>
	{#if importText !== null}
		<textarea bind:value={importText} class="{field} mt-2 h-24 resize-y" placeholder="Paste a stored save or a raw state JSON"></textarea>
		<div class="mt-1 flex items-center gap-2">
			<span class="flex-1 truncate text-[11px] text-red-300">{importError ?? ''}</span>
			<button class={btnAccent} disabled={!importText || !!importError} onclick={() => reloadWithSave(importText)}>Load and reload</button>
		</div>
	{/if}
</Section>

<Section title="Snapshots">
	<form
		class="flex gap-1"
		onsubmit={e => {
			e.preventDefault();
			snapshots.capture(snapshotName.trim() || `Snapshot ${snapshots.list.length + 1}`);
			snapshotName = '';
		}}
	>
		<input bind:value={snapshotName} class={field} placeholder="Name, e.g. before electronize" />
		<button class={btnAccent} type="submit">Capture</button>
	</form>
	<div class="mt-1.5 flex flex-col gap-0.5">
		{#each snapshots.list as snapshot (snapshot.date)}
			<div class="flex items-center gap-2 rounded px-1 text-xs hover:bg-white/5">
				<span class="min-w-0 flex-1 truncate text-white/80">{snapshot.name}</span>
				<span class="font-mono text-[10px] text-white/30">{new Date(snapshot.date).toLocaleString()}</span>
				<button class={btn} onclick={() => snapshots.restore(snapshot)}>Load</button>
				<button class={btn} onclick={() => snapshots.remove(snapshot.date)}>x</button>
			</div>
		{:else}
			<p class="text-[11px] text-white/30">Captures the stored save, loading one reloads the page.</p>
		{/each}
	</div>
</Section>

<Section title="State editor">
	<input bind:value={query} class="{field} mb-1.5" placeholder="Filter keys" type="search" />
	<div class="flex flex-col">
		{#each keys as key (key)}
			{@const value = read(key)}
			<div class="grid grid-cols-[10rem_1fr] items-center gap-2 border-b border-white/5 py-0.5 text-xs last:border-0">
				<span class="truncate font-mono text-[11px] text-white/50" title={key}>{key}</span>
				{#if typeof value === 'number'}
					<NumberInput onCommit={next => write(key, next)} {value} />
				{:else if typeof value === 'string'}
					<input class={field} onchange={e => write(key, e.currentTarget.value)} {value} />
				{:else}
					<button
						class="truncate rounded px-1 text-left font-mono text-[11px] text-white/40 hover:bg-white/5 hover:text-white/70"
						onclick={() => (editing = editing?.key === key ? null : { key, text: JSON.stringify(value, null, 2) })}
					>
						{Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value ?? {}).length}}`}
						{JSON.stringify(value)?.slice(0, 80)}
					</button>
				{/if}
			</div>
			{#if editing?.key === key}
				<textarea
					bind:value={editing.text}
					class="{field} my-1 h-48 resize-y"
					onkeydown={e => {
						e.stopPropagation();
						if (e.key === 'Escape') editing = null;
						if (e.key === 'Enter' && e.ctrlKey && !editError && editing) {
							write(key, JSON.parse(editing.text));
							editing = null;
						}
					}}
				></textarea>
				<p class="mb-1 text-[10px] {editError ? 'text-red-300' : 'text-white/30'}">{editError ?? 'Ctrl+Enter to apply, Esc to cancel'}</p>
			{/if}
		{/each}
	</div>
</Section>

<Section collapsed title="Raw JSON">
	{#snippet actions()}
		<button class={btn} onclick={() => (rawJson = JSON.stringify(gameManager.getCurrentState(), null, 2))}>{rawJson ? 'Refresh' : 'Show'}</button>
		<button class={btn} onclick={() => copy(JSON.stringify(gameManager.getCurrentState(), null, 2), 'State JSON')}>Copy</button>
	{/snippet}
	{#if rawJson}
		<pre class="max-h-96 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px] text-green-300/90">{rawJson}</pre>
	{/if}
</Section>

<Section collapsed title="Cloud profile">
	{#snippet actions()}
		<button class={btn} onclick={fetchCloud}>Fetch</button>
	{/snippet}
	{#if cloudJson}
		<pre class="max-h-96 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px] text-green-300/90">{cloudJson}</pre>
	{/if}
</Section>
