<script lang="ts">
	import '@/app.css';
	import { browser } from '$app/environment';
	import { beforeNavigate } from '$app/navigation';
	import { page, updated } from '$app/state';
	import PrestigeAnimation from '@components/prestige/PrestigeAnimation.svelte';
	import Analytics from '@components/system/Analytics.svelte';
	import DevTools from '@components/system/devtools/DevTools.svelte';
	import SEO from '@components/system/SEO.svelte';
	import TutorialOverlay from '@components/tutorial/TutorialOverlay.svelte';
	import TooltipPortal from '@components/ui/TooltipPortal.svelte';
	import { prestigeStore } from '$stores/prestige.svelte';
	import { toastStore } from '$stores/toasts.svelte';
	import { LoaderCircle } from '@lucide/svelte';
	import { type Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	// The benchmark route is a standalone analysis tool, none of the in-game overlays belong there.
	const isBenchmark = $derived(page.url.pathname.startsWith('/benchmark'));

	let updatePromptShown = false;

	// The old build's chunks are gone from Cloudflare, so a client-side navigation would hit a dead import
	beforeNavigate(navigation => {
		if (updated.current && navigation.to?.url) {
			navigation.cancel();
			location.href = navigation.to.url.href;
		}
	});

	$effect(() => {
		if (!updated.current || updatePromptShown) return;
		updatePromptShown = true;
		toastStore.info({
			action: () => location.reload(),
			actionLabel: 'Reload',
			title: 'New Version Available',
			message: 'Reload to get the latest version, your progress is saved.',
			is_infinite: true,
		});
	});
</script>

<SEO />
<Analytics />

{#if !browser}
	<div class="flex h-screen w-screen items-center justify-center gap-4 flex-col">
		<h1 class="text-2xl font-bold animate-pulse">Loading...</h1>
		<LoaderCircle
			size={64}
			class="loading-action rotate-115"
		/>
	</div>
{:else}
	<PrestigeAnimation
		animation={prestigeStore.animation}
		onComplete={() => prestigeStore.reset()}
	/>
	{@render children?.()}
	{#if !isBenchmark}
		<DevTools />
		<TutorialOverlay />
	{/if}
	<TooltipPortal />
{/if}

<style>
	:global(.loading-action) {
		animation: spin 1.25s cubic-bezier(0.75, 0.97, 0.25, 0.03) infinite;
	}

	@keyframes spin {
		0% {
			rotate: 0deg;
		}
		100% {
			rotate: 360deg;
		}
	}
</style>
