<script lang="ts">
	import { dev } from '$app/env';
</script>

{#if dev}
	<!-- Lazy so the panel and its tabs stay out of the game chunk. -->
	{#await import('./DevToolsPanel.svelte') then { default: DevToolsPanel }}
		<DevToolsPanel />
	{/await}
{/if}
