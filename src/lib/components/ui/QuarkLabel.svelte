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

<style>
	.quark-wordmark {
		background: linear-gradient(90deg, #4a9eff, #3ddc84, #ff4d4d);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 0 4px rgba(61, 220, 132, 0.35)) drop-shadow(0 0 8px rgba(74, 158, 255, 0.2));
	}
</style>
