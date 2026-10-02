<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		alt?: string;
		class?: ClassValue;
		src?: string | null | undefined;
	}

	let { alt = '?', class: className, src }: Props = $props();
	/** Remembers which picture failed, so a new `src` gets its own try. */
	let failedSrc = $state<Props['src']>();
	const hasError = $derived(failedSrc === src);

	const initials = $derived.by(() => {
		const name = alt.trim();
		if (!name || name === '?') return '?';
		const parts = name.split(/[ \-_]/).filter(Boolean);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return name[0].toUpperCase();
	});
</script>

<div class={['aspect-square flex-none overflow-hidden rounded-full', className]}>
	{#if src && !hasError}
		<img
			class="h-full object-cover w-full"
			onerror={() => (failedSrc = src)}
			{alt}
			{src}
		/>
	{:else}
		<div
			class="bg-linear-135 from-accent-500/60 to-accent-300/20 flex font-bold h-full items-center justify-center text-white w-full"
		>
			{initials}
		</div>
	{/if}
</div>
