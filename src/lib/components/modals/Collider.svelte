<script lang="ts">
	import Login from '@components/modals/Login.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import { COLLIDER_STEP, COLLIDER_STEP_BONUS } from '$data/collider';
	import { colliderManager } from '$helpers/ColliderManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { formatNumberFull } from '$lib/utils';
	import { supabaseAuth } from '$stores/supabaseAuth.svelte';
	import { onMount } from 'svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const PARTICLES = 8;
	const RING_LENGTH = 2 * Math.PI * 44;

	let now = $state(Date.now());
	let showLogin = $state(false);

	const secondsLeft = $derived(Math.max(0, Math.ceil((colliderManager.readyAt - now) / 1000)));
	const stepProgress = $derived((colliderManager.total % COLLIDER_STEP) / COLLIDER_STEP);
	const canInject = $derived(supabaseAuth.isAuthenticated && colliderManager.ready && !colliderManager.pending);

	onMount(() => {
		colliderManager.sync();
	});

	/** The countdown only ticks while the cooldown runs. */
	$effect(() => {
		if (colliderManager.ready) return;
		now = Date.now();
		const interval = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(interval);
	});
</script>

<Modal {onClose} title="Collider" width="sm">
	<div class="flex flex-col items-center gap-6 text-center">
		<p class="text-sm text-white/60">
			Every player feeds the same ring. Inject one particle a minute, every {formatNumberFull(COLLIDER_STEP)} injected by anyone boosts
			everyone's production by {COLLIDER_STEP_BONUS * 100}%.
		</p>

		<button
			class="group relative size-56 cursor-pointer rounded-full disabled:cursor-not-allowed"
			disabled={!canInject}
			onclick={() => colliderManager.inject()}
		>
			<svg class="size-full -rotate-90 overflow-visible" viewBox="0 0 100 100">
				<circle class="fill-none stroke-white/10" cx="50" cy="50" r="44" stroke-width="3" />
				{#key colliderManager.readyAt}
					<circle
						class="cooldown fill-none stroke-accent-400 transition-[filter] {colliderManager.ready ? 'drop-shadow-[0_0_4px_var(--color-accent-400)]' : ''}"
						cx="50"
						cy="50"
						r="44"
						stroke-dasharray={RING_LENGTH}
						stroke-linecap="round"
						stroke-width="3"
						style:--duration="{Math.max(0, colliderManager.readyAt - Date.now())}ms"
						style:--length={RING_LENGTH}
					/>
				{/key}
				<g class="orbit">
					{#each { length: PARTICLES }, i (i)}
						{@const angle = (i / PARTICLES) * 2 * Math.PI}
						<circle class="fill-white/70" cx={50 + 44 * Math.cos(angle)} cy={50 + 44 * Math.sin(angle)} r="1.2" />
					{/each}
				</g>
			</svg>
			<span class="absolute inset-0 flex flex-col items-center justify-center gap-1">
				{#if colliderManager.pending}
					<span class="text-lg font-bold text-white/70">Injecting...</span>
				{:else if colliderManager.ready || secondsLeft === 0}
					<span class="text-2xl font-bold text-white transition-transform group-enabled:group-hover:scale-110">Inject</span>
				{:else}
					<span class="font-mono text-3xl font-bold text-white">{secondsLeft}s</span>
					<span class="text-xs text-white/50">until your next particle</span>
				{/if}
			</span>
		</button>

		<div class="flex w-full flex-col gap-2">
			<span class="font-mono text-3xl font-bold text-accent-300">+{(gameManager.colliderBonus * 100).toFixed(1)}%</span>
			<span class="text-sm text-white/60">production for every player</span>
		</div>

		<div class="flex w-full flex-col gap-1.5">
			<div class="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
				<div class="h-full rounded-full bg-accent-400" style:width="{stepProgress * 100}%"></div>
			</div>
			<div class="flex justify-between text-xs text-white/50">
				<span>{formatNumberFull(colliderManager.total)} particles injected</span>
				<span>{formatNumberFull(COLLIDER_STEP - (colliderManager.total % COLLIDER_STEP))} to the next +{COLLIDER_STEP_BONUS * 100}%</span>
			</div>
		</div>

		{#if supabaseAuth.isAuthenticated}
			<span class="text-sm text-white/60">You injected {formatNumberFull(colliderManager.injections)} particles</span>
		{:else}
			<div class="flex w-full items-center justify-between gap-3 rounded-lg bg-black/20 p-3 text-left text-sm text-white/60">
				Sign in to inject particles, the bonus already applies to you.
				<button
					class="shrink-0 cursor-pointer rounded-lg bg-accent-600 px-4 py-2 font-bold text-white transition-colors hover:bg-accent-500"
					onclick={() => (showLogin = true)}
				>
					Sign in
				</button>
			</div>
		{/if}
	</div>
</Modal>

{#if showLogin}
	<Login onClose={() => (showLogin = false)} />
{/if}

<style>
	.cooldown {
		animation: charge var(--duration) linear both;
	}

	.orbit {
		animation: spin 12s linear infinite;
		transform-origin: 50px 50px;
	}

	@keyframes charge {
		from {
			stroke-dashoffset: var(--length);
		}
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.orbit {
			animation: none;
		}
	}
</style>
