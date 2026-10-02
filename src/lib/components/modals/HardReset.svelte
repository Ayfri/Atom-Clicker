<script lang="ts">
	import HoldButton from '#components/ui/HoldButton.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { formatDuration, formatNumber } from '#lib/utils.js';
	import { autoSave } from '#stores/autoSave.svelte.js';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import { toastStore } from '#stores/toasts.svelte.js';
	import { TriangleAlert } from '@lucide/svelte';
	import { onMount } from 'svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const losses = $derived([
		['Play time', formatDuration(gameManager.inGameTime)],
		['Level', formatNumber(gameManager.playerLevel)],
		['Achievements', gameManager.achievements.length.toString()],
	]);

	onMount(() => gameManager.unlockAchievement('reset_modal_opener'));

	function handleReset() {
		gameManager.reset();
		toastStore.info({ message: 'Your progress has been completely wiped.', title: 'Game Reset' });
		onClose();
	}
</script>

<Modal class="border border-red-500/40 bg-linear-to-b from-red-950 to-accent-900 text-center shadow-[0_0_60px] shadow-red-600/30" dialog {onClose} title="Wipe everything?">
	<div class="pointer-events-none absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-red-600/30 blur-3xl"></div>

	<div class="relative mx-auto mb-4 flex size-16 items-center justify-center">
		<span class="absolute inset-0 rounded-full bg-red-500/20 motion-safe:animate-ping"></span>
		<span class="relative flex size-16 items-center justify-center rounded-full border border-red-500/50 bg-red-500/20 text-red-300">
			<TriangleAlert aria-hidden="true" size={30} />
		</span>
	</div>

	<h2 class="text-2xl font-bold text-white">Wipe everything?</h2>
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
		<HoldButton
			class="w-full rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3 font-semibold text-red-100 select-none"
			holdDuration={1500}
			onHoldComplete={handleReset}
			style="--hold-color: #dc2626; --hold-glow: rgb(220 38 38 / 0.5)"
		>
			<span class="relative">Hold to reset</span>
		</HoldButton>
		<button class="rounded-xl px-4 py-3 font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white" onclick={onClose} type="button">Cancel</button>
	</div>
</Modal>
