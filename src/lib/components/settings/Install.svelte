<script lang="ts">
	import QuarkIcon from '#components/icons/Quark.svelte';
	import { APP_REWARD_QUARKS } from '#data/quarks.js';
	import { APP_PRODUCTION_PERCENT } from '#lib/constants.js';
	import { installStore } from '#stores/install.svelte.js';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import { AppWindow, Check, Download, TrendingUp, WifiOff, Zap } from '@lucide/svelte';

	/** Electron orbits of the app icon, `delay` spreads the electrons so they never line up. */
	const ORBITS = [
		{ angle: 0, delay: 0, duration: 5 },
		{ angle: 60, delay: -2.4, duration: 6.5 },
		{ angle: 120, delay: -1.1, duration: 8 },
	];
	const perks = [
		{ icon: AppWindow, label: 'Its own window' },
		{ icon: Zap, label: 'Opens straight into the game' },
		{ icon: WifiOff, label: 'Plays offline' },
	];
</script>

<div class="mx-auto flex max-w-md flex-col items-center gap-6 pt-2 text-center">
	<div class="rise relative size-24 rounded-[1.75rem] border border-white/10 bg-linear-to-b from-accent-800 to-accent-900 shadow-[0_8px_24px_rgb(0_0_0/0.35)]">
		<svg class="absolute inset-0" viewBox="0 0 96 96">
			{#each ORBITS as orbit (orbit.angle)}
				<ellipse class="stroke-accent-400/35" cx="48" cy="48" fill="none" rx="34" ry="12" stroke-width="1.5" transform="rotate({orbit.angle} 48 48)" />
			{/each}
			<circle class="fill-accent-400" cx="48" cy="48" r="7" />
		</svg>
		{#each ORBITS as orbit (orbit.angle)}
			<div class="orbit" style:--angle="{orbit.angle}deg" style:--delay="{orbit.delay}s" style:--duration="{orbit.duration}s">
				<div class="arm"><span class="electron"></span></div>
			</div>
		{/each}
	</div>

	<div class="rise flex flex-col gap-1" style:animation-delay="80ms">
		<h3 class="text-xl font-bold text-white">Play from the app</h3>
		<p class="text-sm text-white/60">Install Atom Clicker and get rewarded for playing from it.</p>
	</div>

	<div class="grid w-full grid-cols-2 gap-3">
		<div class="rise flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] p-4" style:animation-delay="160ms">
			<TrendingUp class="text-accent" size={22} />
			<span class="text-2xl font-bold text-white tabular-nums">+{APP_PRODUCTION_PERCENT}%</span>
			<span class="text-xs text-white/50">production in the app</span>
		</div>
		<div class="rise flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] p-4" style:animation-delay="240ms">
			<QuarkIcon size={22} />
			<span class="text-2xl font-bold text-white tabular-nums">+{APP_REWARD_QUARKS}</span>
			<span class="text-xs text-white/50">Quarks, {supabaseAuth.isAuthenticated ? 'once per account' : 'sign in to claim'}</span>
		</div>
	</div>

	<div class="rise flex w-full flex-col items-center gap-2" style:animation-delay="320ms">
		{#if installStore.installed}
			<p class="flex items-center gap-2 font-semibold text-accent"><Check size={18} /> Installed</p>
			<p class="text-sm text-white/55">Open Atom Clicker from your apps to collect the rewards.</p>
		{:else}
			<button
				class="flex w-full max-w-56 items-center justify-center gap-2 rounded-xl bg-accent-500 py-2.5 font-semibold text-white shadow-[0_0_20px_rgb(74_144_226/0.35)] transition enabled:hover:bg-accent-400 enabled:hover:shadow-[0_0_28px_rgb(74_144_226/0.5)] disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
				disabled={!installStore.canInstall}
				onclick={() => installStore.install()}
				type="button"
			>
				<Download size={18} />
				Install
			</button>
			{#if !installStore.canInstall}
				<p class="text-xs text-white/40">Your browser's menu or address bar can install it too.</p>
			{/if}
		{/if}
	</div>

	<ul class="rise flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-white/45" style:animation-delay="400ms">
		{#each perks as perk (perk.label)}
			<li class="flex items-center gap-1.5">
				<perk.icon class="text-accent/70" size={14} />
				{perk.label}
			</li>
		{/each}
	</ul>
</div>

<style>
	/* Each electron spins in a flat circle squashed into its orbit's ellipse, and its own counter transform undoes the squash so it
	   stays round. Transforms only, so the orbits run on the compositor. */
	.orbit {
		inset: 14px;
		position: absolute;
		transform: rotate(var(--angle)) scaleY(0.353);
	}

	.arm {
		animation: orbit-spin var(--duration) linear var(--delay) infinite;
		inset: 0;
		position: absolute;
	}

	.electron {
		animation: orbit-counter var(--duration) linear var(--delay) infinite;
		background: var(--color-accent-200);
		border-radius: 9999px;
		box-shadow: 0 0 6px var(--color-accent-400);
		height: 6px;
		left: 50%;
		margin: -3px;
		position: absolute;
		top: 0;
		width: 6px;
	}

	.rise {
		animation: rise 500ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.arm,
		.electron,
		.rise {
			animation: none;
		}
	}

	@keyframes orbit-counter {
		from {
			transform: rotate(0deg) scaleY(2.833);
		}
		to {
			transform: rotate(-360deg) scaleY(2.833);
		}
	}

	@keyframes orbit-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
