<script lang="ts">
	import Login from '#components/modals/Login.svelte';
	import Modal from '#components/ui/Modal.svelte';
	import { COLLIDER_COOLDOWN_SECONDS, COLLIDER_STEP, COLLIDER_STEP_BONUS } from '#data/collider.js';
	import { colliderManager } from '#helpers/ColliderManager.svelte.js';
	import { ColliderRenderer } from '#helpers/ColliderRenderer.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { formatNumberFull } from '#lib/utils.js';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import { TrendingUp, Users, Zap } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { backOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const PARTICLES = 8;
	const RING_LENGTH = 2 * Math.PI * 44;

	/** One tick per cooldown second around the ring, a longer one every 5, like a stopwatch bezel. */
	function ticks(major: boolean): string {
		let path = '';
		for (let i = 0; i < COLLIDER_COOLDOWN_SECONDS; i++) {
			if ((i % 5 === 0) !== major) continue;
			const angle = (i / COLLIDER_COOLDOWN_SECONDS) * 2 * Math.PI;
			const inner = major ? 47.6 : 48.4;
			path += `M${50 + inner * Math.cos(angle)} ${50 + inner * Math.sin(angle)}L${50 + 49.6 * Math.cos(angle)} ${50 + 49.6 * Math.sin(angle)}`;
		}
		return path;
	}

	const MAJOR_TICKS = ticks(true);
	const MINOR_TICKS = ticks(false);

	let bonus = $state<HTMLSpanElement>();
	let button = $state<HTMLButtonElement>();
	/** From the click until the beams collide, the cooldown ring and countdown wait for the impact. */
	let charging = $state(false);
	let now = $state(Date.now());
	let renderer: ColliderRenderer | undefined;
	let showLogin = $state(false);

	const secondsLeft = $derived(Math.max(0, Math.ceil((colliderManager.readyAt - now) / 1000)));
	const stepProgress = $derived((colliderManager.total % COLLIDER_STEP) / COLLIDER_STEP);
	const canInject = $derived(supabaseAuth.isAuthenticated && colliderManager.ready && !colliderManager.pending && !charging);
	const share = $derived(colliderManager.total > 0 ? (colliderManager.injections / colliderManager.total) * 100 : 0);

	const steps = [
		{ icon: Zap, text: `Tap the ring to inject a particle, once every ${COLLIDER_COOLDOWN_SECONDS} seconds.` },
		{ icon: Users, text: 'Every signed-in player feeds the same counter, from anywhere in the world.' },
		{
			icon: TrendingUp,
			text: `Each ${formatNumberFull(COLLIDER_STEP)} particles permanently add +${COLLIDER_STEP_BONUS * 100}% production for everyone, you included.`,
		},
	];

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

	function mountRenderer(canvas: HTMLCanvasElement) {
		const instance = new ColliderRenderer(canvas);
		renderer = instance;
		return () => {
			instance.destroy();
			renderer = undefined;
		};
	}

	async function inject() {
		charging = true;
		renderer?.accelerate();
		if (!(await colliderManager.inject())) {
			renderer?.fizzle();
			charging = false;
			return;
		}
		if (renderer) renderer.collide(impact);
		else impact();
	}

	function impact() {
		charging = false;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		button?.animate([{ transform: 'scale(0.93)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' });
		bonus?.animate([{ color: '#ffffff', transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
	}
</script>

<Modal {onClose} title="Collider" width="sm">
	<div class="flex flex-col items-center gap-7 text-center">
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-semibold tracking-[0.2em] text-accent-300 uppercase">Shared particle accelerator</span>
			<p class="text-sm text-white/60">One ring for every Atom Clicker player. The particles everyone injects add up into a production bonus you all share.</p>
		</div>

		<button
			class="group relative size-56 cursor-pointer rounded-full disabled:cursor-not-allowed"
			disabled={!canInject}
			onclick={inject}
			bind:this={button}
		>
			<div
				class="absolute inset-[12%] rounded-full bg-radial from-accent-400/25 to-transparent to-70% transition-opacity duration-500 {canInject ? 'opacity-100' : 'opacity-0'}"
			></div>
			<svg aria-hidden="true" class="relative size-full -rotate-90 overflow-visible" viewBox="0 0 100 100">
				<path class="stroke-white/15" d={MINOR_TICKS} stroke-width="0.4" />
				<path class="stroke-white/35" d={MAJOR_TICKS} stroke-width="0.6" />
				<circle class="fill-none stroke-white/10" cx="50" cy="50" r="44" stroke-width="3" />
				{#if !charging}
					{#key colliderManager.readyAt}
						<circle
							class="cooldown fill-none stroke-accent-400 transition-[filter] {colliderManager.ready ? 'drop-shadow-[0_0_4px_var(--color-accent-400)]' : ''}"
							cx="50"
							cy="50"
							r="44"
							stroke-dasharray={RING_LENGTH}
							stroke-linecap="round"
							stroke-width="3"
							style:--cooldown="{COLLIDER_COOLDOWN_SECONDS * 1000}ms"
							style:--elapsed="{Math.min(0, colliderManager.readyAt - Date.now() - COLLIDER_COOLDOWN_SECONDS * 1000)}ms"
							style:--length={RING_LENGTH}
						/>
					{/key}
				{/if}
				<g class="orbit transition-opacity duration-300 {charging ? 'opacity-0' : ''}">
					{#each { length: PARTICLES }, i (i)}
						{const angle = $derived((i / PARTICLES) * 2 * Math.PI)}
						<circle class="fill-white/70" cx={50 + 44 * Math.cos(angle)} cy={50 + 44 * Math.sin(angle)} r="1.2" />
					{/each}
				</g>
			</svg>
			<canvas aria-hidden="true" class="-top-[35%] -left-[10%] h-[170%] w-[120%]" {@attach mountRenderer}></canvas>
			<span class="absolute inset-0 flex flex-col items-center justify-center gap-1">
				{#if charging}
					<span class="animate-pulse text-sm font-bold tracking-[0.2em] text-white/70 uppercase">Accelerating</span>
				{:else if colliderManager.ready || secondsLeft === 0}
					<span class="text-2xl font-bold text-white transition-transform group-enabled:group-hover:scale-110">Inject</span>
					<span class="text-xs text-white/50">{supabaseAuth.isAuthenticated ? 'fire one particle' : 'sign in to inject'}</span>
				{:else}
					<span class="flex flex-col items-center gap-1" in:scale={{ duration: 500, easing: backOut, start: 1.6 }}>
						<span class="font-mono text-3xl font-bold text-white">{secondsLeft}s</span>
						<span class="text-xs text-white/50">until your next particle</span>
					</span>
				{/if}
			</span>
		</button>

		<div class="grid w-full grid-cols-3 items-start gap-2">
			<div class="flex flex-col gap-0.5">
				<span class="font-mono text-xl font-bold text-accent-300 sm:text-3xl" bind:this={bonus}>+{(gameManager.colliderBonus * 100).toFixed(1)}%</span>
				<span class="text-xs text-white/50">production for everyone</span>
			</div>
			<div class="flex flex-col gap-0.5">
				<span class="font-mono text-xl font-bold text-white sm:text-3xl">{formatNumberFull(colliderManager.total)}</span>
				<span class="text-xs text-white/50">particles in the ring</span>
			</div>
			<div class="flex flex-col gap-0.5">
				<span class="font-mono text-xl font-bold text-white sm:text-3xl">{formatNumberFull(colliderManager.injections)}</span>
				<span class="text-xs text-white/50">
					{colliderManager.injections > 0 ? `yours, ${share < 0.1 ? '<0.1' : share.toFixed(1)}% of the ring` : 'injected by you'}
				</span>
			</div>
		</div>

		<div class="flex w-full flex-col gap-1.5">
			<div class="flex justify-between text-xs">
				<span class="text-white/60">Next +{COLLIDER_STEP_BONUS * 100}% at {formatNumberFull((Math.floor(colliderManager.total / COLLIDER_STEP) + 1) * COLLIDER_STEP)}</span>
				<span class="font-mono text-white/50">{formatNumberFull(COLLIDER_STEP - (colliderManager.total % COLLIDER_STEP))} to go</span>
			</div>
			<div class="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
				<div class="h-full rounded-full bg-accent-400 transition-[width] duration-700 ease-out" style:width="{stepProgress * 100}%"></div>
			</div>
		</div>

		<div class="flex w-full flex-col gap-3 text-left">
			<span class="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">How it works</span>
			<ol class="flex flex-col gap-3">
				{#each steps as { icon: Icon, text }, i (i)}
					<li class="flex items-start gap-3 text-sm text-white/70">
						<Icon class="mt-0.5 size-4 shrink-0 text-accent-300" />
						{text}
					</li>
				{/each}
			</ol>
		</div>

		{#if !supabaseAuth.isAuthenticated}
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
		/** A negative delay resumes the fill where the cooldown is, instead of restarting it empty on open. */
		animation: charge var(--cooldown) linear var(--elapsed) both;
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
