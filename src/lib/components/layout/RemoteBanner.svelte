<script lang="ts">
	import { remoteMessage } from '$stores/remoteMessage.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import { X, Megaphone } from 'lucide-svelte';

	onMount(() => {
		remoteMessage.startPolling();
	});

	onDestroy(() => {
		remoteMessage.stopPolling();
	});
</script>

{#if remoteMessage.message}
	{#if remoteMessage.isVisible}
		<div
			class="remote-message-banner fixed inset-x-0 top-0 z-60 flex h-6 items-center justify-center bg-black/60 px-4 text-center backdrop-blur-xs border-b border-white/5"
			transition:slide={{ duration: 300 }}
		>
			<div class="text-[10px] leading-tight text-white/90 md:text-xs">
				{@html remoteMessage.message.message_html}
			</div>

			<button
				class="absolute right-2 flex items-center justify-center rounded-full p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
				onclick={() => remoteMessage.dismiss()}
				title="Dismiss"
			>
				<X size={12} />
			</button>
		</div>
	{:else}
		<button
			class="fixed right-0 top-0 z-60 flex items-center justify-center rounded-l-lg bg-black/60 p-1 text-white/40 transition-all hover:bg-black/80 hover:text-white"
			onclick={() => remoteMessage.show()}
			title="Show message"
			transition:fade={{ duration: 200 }}
		>
			<Megaphone size={14} />
		</button>
	{/if}
{/if}

<style>
	/* Ensure any links inside the HTML message are styled appropriately */
	:global(.remote-message-banner a) {
		color: #60a5fa; /* blue-400 */
		text-decoration: underline;
	}
	:global(.remote-message-banner a:hover) {
		color: #93c5fd; /* blue-300 */
	}
</style>
