<script lang="ts">
	import Quark from '#components/icons/Quark.svelte';

	interface Props {
		class?: string;
		icon?: boolean;
		size?: number;
	}

	let { class: className = '', icon = false, size = 12 }: Props = $props();
</script>

<span class="inline-flex items-center gap-0.5 align-top whitespace-nowrap {className}">
	{#if icon}
		<Quark {size} />
	{/if}
	<span aria-hidden="true" class="quark-wordmark">Quarks</span><span class="sr-only">Quarks</span>
</span>
