<script lang="ts">
	interface Props {
		alt?: string;
		class?: string;
		src?: string | null | undefined;
	}

	let { alt = '?', class: className = '', src }: Props = $props();
	let hasError = $state(false);

	$effect(() => {
		// Reset error state if src changes
		void src;
		hasError = false;
	});

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

<div class="aspect-square flex-none overflow-hidden rounded-full {className}">
	{#if src && !hasError}
		<img
			class="h-full object-cover w-full"
			onerror={() => (hasError = true)}
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
