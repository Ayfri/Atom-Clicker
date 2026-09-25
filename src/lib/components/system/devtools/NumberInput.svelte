<script lang="ts">
	import { formatNumber, formatNumberFull } from '$lib/utils';
	import { tick } from 'svelte';
	import { field, parseNumber } from './shared.svelte';

	interface Props {
		class?: string;
		onCommit: (value: number) => void;
		value: number;
	}

	let { class: className = '', onCommit, value }: Props = $props();

	/** Raw text while focused, null otherwise so the field shows the live formatted value. */
	let draft = $state<string | null>(null);
	const parsed = $derived(draft === null ? value : parseNumber(draft));

	function commit() {
		if (draft !== null && Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
		draft = null;
	}
</script>

<input
	class="{field} {className} {Number.isNaN(parsed) ? 'border-red-500/70!' : ''}"
	onblur={commit}
	onfocus={async e => {
		const input = e.currentTarget;
		draft = String(value);
		await tick();
		input.select();
	}}
	oninput={e => (draft = e.currentTarget.value)}
	onkeydown={e => {
		e.stopPropagation();
		if (e.key === 'Escape') draft = null;
		if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
	}}
	spellcheck="false"
	title="{formatNumberFull(value)} - accepts 1e30, 250k, 3Qa"
	type="text"
	value={draft ?? formatNumber(value)}
/>
