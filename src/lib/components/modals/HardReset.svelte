<script lang="ts">
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatDuration } from '$lib/utils';
	import { autoSave } from '$stores/autoSave.svelte';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { toastStore } from '$stores/toasts.svelte';
	import { TriangleAlert } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let holding = $state(false);

	const losses = $derived([
		['Play time', formatDuration(gameManager.inGameTime)],
		['Level', gameManager.playerLevel.toString()],
		['Achievements', gameManager.achievements.length.toString()],
	]);

	onMount(() => gameManager.unlockAchievement('reset_modal_opener'));

	function handleReset() {
		gameManager.reset();
		toastStore.info({ message: 'Your progress has been completely wiped.', title: 'Game Reset' });
		onClose();
	}

	/** Capture phase so Escape only closes this dialog, not the Settings modal listening on window underneath. */
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.stopImmediatePropagation();
		onClose();
	}

	function holdKey(e: KeyboardEvent, down: boolean) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		if (!e.repeat) holding = down;
	}
</script>

<svelte:window onkeydowncapture={onKeydown} />

<div class="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onclick={onClose} role="presentation" transition:fade={{ duration: 200 }}>
	<div
		aria-labelledby="hard-reset-title"
		aria-modal="true"
		class="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/40 bg-linear-to-b from-red-950 to-accent-900 p-6 text-center shadow-[0_0_60px] shadow-red-600/30"
		onclick={e => e.stopPropagation()}
		onkeydown={e => e.stopPropagation()}
		role="dialog"
		tabindex="-1"
		transition:scale={{ duration: 250, start: 0.9 }}
	>
		<div class="pointer-events-none absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-red-600/30 blur-3xl"></div>

		<div class="relative mx-auto mb-4 flex size-16 items-center justify-center">
			<span class="absolute inset-0 animate-ping rounded-full bg-red-500/20"></span>
			<span class="relative flex size-16 items-center justify-center rounded-full border border-red-500/50 bg-red-500/20 text-red-300">
				<TriangleAlert size={30} />
			</span>
		</div>

		<h2 class="text-2xl font-bold text-white" id="hard-reset-title">Wipe everything?</h2>
		<p class="mt-1 text-sm text-white/60">Every atom, generator, upgrade and prestige on this device is gone for good.</p>

		<div class="my-5 grid grid-cols-3 gap-2">
			{#each losses as [label, value] (label)}
				<div class="rounded-lg border border-white/10 bg-black/30 p-2">
					<p class="truncate font-semibold text-white">{value}</p>
					<p class="text-xs text-white/50">{label}</p>
				</div>
			{/each}
		</div>

		<p class="mb-5 text-xs text-yellow-300/90">
			Your best leaderboard score is kept.
			{#if supabaseAuth.isAuthenticated && autoSave.enabled}
				Cloud auto-save is on, so the fresh save will replace your cloud save within 30 seconds.
			{/if}
		</p>

		<div class="flex flex-col gap-2">
			<button
				class="relative overflow-hidden rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3 font-semibold text-red-100 select-none touch-none"
				onblur={() => (holding = false)}
				onkeydown={e => holdKey(e, true)}
				onkeyup={e => holdKey(e, false)}
				onpointercancel={() => (holding = false)}
				onpointerdown={() => (holding = true)}
				onpointerleave={() => (holding = false)}
				onpointerup={() => (holding = false)}
			>
				<span
					class="absolute inset-0 origin-left bg-red-600 ease-linear {holding ? 'scale-x-100 duration-1500' : 'scale-x-0 duration-200'} transition-transform"
					ontransitionend={() => holding && handleReset()}
				></span>
				<span class="relative">{holding ? 'Keep holding...' : 'Hold to reset'}</span>
			</button>
			<button class="rounded-xl px-4 py-3 font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white" onclick={onClose}>Cancel</button>
		</div>
	</div>
</div>
