<script lang="ts">
	import '../app.css';
	import { browser } from '$app/env';
	import { beforeNavigate } from '$app/navigation';
	import { page, updated } from '$app/state';
	import PrestigeAnimation from '#components/prestige/PrestigeAnimation.svelte';
	import Analytics from '#components/system/Analytics.svelte';
	import DevTools from '#components/system/devtools/DevTools.svelte';
	import SEO from '#components/system/SEO.svelte';
	import Hints from '#components/tutorial/Hints.svelte';
	import TooltipPortal from '#components/ui/TooltipPortal.svelte';
	import { prestigeStore } from '#stores/prestige.svelte.js';
	import { toastStore } from '#stores/toasts.svelte.js';
	import { LoaderCircle } from '@lucide/svelte';
	import { onMount, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	// The error page and the benchmark analysis tool stand alone, none of the in-game overlays belong there.
	const isStandalone = $derived(!!page.error || page.url.pathname.startsWith('/benchmark'));

	let mounted = $state(false);
	let updatePromptShown = false;

	onMount(() => (mounted = true));

	// The old build's chunks are gone from Cloudflare, so a client-side navigation would hit a dead import
	beforeNavigate((navigation) => {
		if (navigation.shallow) return;

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
			duration: 0,
		});
	});
</script>

<SEO />
<Analytics />

<!-- The server-rendered loading shell stays over the app until it mounts, then fades out instead of vanishing. -->
{#if !mounted}
	<div class="fixed inset-0 z-100 flex flex-col items-center justify-center gap-4 bg-page px-6 text-center" out:fade={{ duration: 250 }}>
		<h1 class="text-4xl font-bold">Atom Clicker</h1>
		<p class="max-w-xl text-slate-300">
			A free incremental game. Click atoms, buy generators and upgrades, prestige through protons, electrons and photons, and climb the
			leaderboard.
		</p>
		<LoaderCircle
			size={64}
			class="loading-action rotate-115"
		/>
		<noscript><p>Atom Clicker needs JavaScript enabled to run.</p></noscript>
	</div>
{/if}
{#if browser}
	<PrestigeAnimation
		animation={prestigeStore.animation}
		onComplete={() => prestigeStore.reset()}
	/>
	{@render children?.()}
	{#if !isStandalone}
		<DevTools />
		<Hints />
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
