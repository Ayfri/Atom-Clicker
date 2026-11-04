<script lang="ts">
	import QuarkIcon from '#components/icons/Quark.svelte';
	import { APP_REWARD_QUARKS } from '#data/quarks.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import { APP_PRODUCTION_MULTIPLIER, APP_PRODUCTION_PERCENT } from '#lib/constants.js';
	import { formatNumber } from '#lib/utils.js';
	import { installStore } from '#stores/install.svelte.js';
	import { supabaseAuth } from '#stores/supabaseAuth.svelte.js';
	import { AppWindow, Check, Download, TrendingUp, WifiOff, Zap } from '@lucide/svelte';

	/**
	 * The logo's orbits (`static/currencies/atom.svg`). `start` is where its electron sits in the logo, as the turn of the orbit, so the
	 * animation begins on the real logo and reduced motion shows it as is. `size` is the electron's diameter in logo units.
	 */
	const ORBITS = [
		{ angle: 0, duration: 5, size: 1.6, start: 270 },
		{ angle: 60, duration: 6.5, size: 1.6, start: 334.8 },
		{ angle: 120, duration: 8, size: 2, start: 54.4 },
	];
	const perks = [
		{ description: 'No tabs or address bar, only the game.', icon: AppWindow, label: 'Its own window' },
		{ description: 'One click from your taskbar, dock or home screen.', icon: Zap, label: 'Straight into the game' },
		{ description: 'Pages you already opened load without a connection.', icon: WifiOff, label: 'Plays offline' },
	];

	/** `installed` is a browser tab right after the install: the bonus only runs in the app window, so it still points there. */
	const status = $derived(gameManager.installedApp ? 'active' : installStore.installed ? 'installed' : 'pitch');
	const active = $derived(status === 'active');
	/** What the bonus is worth on the current production, `atomsPerSecond` already includes it inside the app. */
	const bonusPerSecond = $derived(
		active ? gameManager.atomsPerSecond * (1 - 1 / APP_PRODUCTION_MULTIPLIER) : gameManager.atomsPerSecond * (APP_PRODUCTION_MULTIPLIER - 1),
	);
	const quarkStatus = $derived.by(() => {
		if (!supabaseAuth.isAuthenticated) return 'sign in to claim';
		if (quarksManager.appRewardClaimed) return 'collected';
		return active ? 'added on the next sync' : 'once per account';
	});
</script>

<div class="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
	<div class="rise relative">
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 size-52 -translate-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(74_144_226/0.16),transparent)]"
			aria-hidden="true"
		></div>
		<div class={['logo relative size-24 sm:size-28', active && 'active']}>
			<svg class="absolute inset-0 overflow-visible" fill="none" stroke-linecap="round" viewBox="0 0 24 24">
				<g class="stroke-accent-400" opacity="0.8" stroke-width="1">
					{#each ORBITS as orbit (orbit.angle)}
						<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate({orbit.angle} 12 12)" />
					{/each}
				</g>
				<circle class="fill-accent-400" cx="12" cy="12" r="1.5" />
			</svg>
			{#each ORBITS as orbit (orbit.angle)}
				<div
					class="orbit"
					style:--angle="{orbit.angle}deg"
					style:--delay="{(-orbit.start / 360) * orbit.duration}s"
					style:--duration="{orbit.duration}s"
					style:--size="{orbit.size * 5}%"
				>
					<div class="arm"><span class="electron"></span></div>
				</div>
			{/each}
		</div>
		{#if status !== 'pitch'}
			<span class="badge absolute right-0 bottom-1 flex size-8 items-center justify-center rounded-full bg-green-500 text-white ring-4 ring-accent-900">
				<Check size={18} strokeWidth={3} />
			</span>
		{/if}
	</div>

	<div class="rise flex flex-col items-center gap-1.5" style:animation-delay="80ms">
		{#if active}
			<h3 class="text-xl font-bold text-white sm:text-2xl">You're playing from the app</h3>
			<p class="max-w-sm text-sm text-white/60">Your app bonus is on for as long as you play here. Thanks for installing Atom Clicker.</p>
		{:else if status === 'installed'}
			<h3 class="text-xl font-bold text-white sm:text-2xl">Installed</h3>
			<p class="max-w-sm text-sm text-white/60">The bonus only runs in the app window, open Atom Clicker from your apps to turn it on.</p>
		{:else}
			<h3 class="text-xl font-bold text-white sm:text-2xl">Play from the app</h3>
			<p class="max-w-sm text-sm text-white/60">
				Install Atom Clicker on this device and every session you play from it produces more, on top of a one-time Quark reward.
			</p>
		{/if}
	</div>

	<div class="grid w-full grid-cols-2 gap-3">
		<div
			class={['rise flex flex-col items-center gap-1 rounded-xl p-4', active ? 'bg-green-500/[0.07] ring-1 ring-green-400/25' : 'bg-white/[0.03]']}
			style:animation-delay="160ms"
		>
			<TrendingUp class={active ? 'text-green-400' : 'text-accent'} size={22} />
			<span class={['text-2xl font-bold tabular-nums sm:text-3xl', active ? 'text-green-300' : 'text-white']}>+{APP_PRODUCTION_PERCENT}%</span>
			{#if active}
				<span class="flex items-center gap-1 text-xs font-medium text-green-300"><Check size={13} strokeWidth={3} /> Production, active</span>
			{:else}
				<span class="text-xs text-white/50">production in the app</span>
			{/if}
			{#if bonusPerSecond > 0}
				<span class="text-xs text-white/40 tabular-nums">
					{active ? `+${formatNumber(bonusPerSecond)} atoms/s from it` : `worth +${formatNumber(bonusPerSecond)} atoms/s now`}
				</span>
			{/if}
		</div>
		<div class="rise flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] p-4" style:animation-delay="240ms">
			<QuarkIcon size={22} />
			<span class="text-2xl font-bold text-white tabular-nums sm:text-3xl">+{APP_REWARD_QUARKS}</span>
			{#if quarkStatus === 'collected'}
				<span class="flex items-center gap-1 text-xs font-medium text-green-300"><Check size={13} strokeWidth={3} /> Quarks collected</span>
			{:else}
				<span class="text-xs text-white/50">Quarks, {quarkStatus}</span>
			{/if}
		</div>
	</div>

	{#if status === 'pitch'}
		<div class="rise flex w-full flex-col items-center gap-2" style:animation-delay="320ms">
			<button
				class="flex w-full max-w-60 items-center justify-center gap-2 rounded-xl bg-accent-500 py-2.5 font-semibold text-white shadow-[0_0_20px_rgb(74_144_226/0.35)] transition enabled:hover:bg-accent-400 enabled:hover:shadow-[0_0_28px_rgb(74_144_226/0.5)] disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
				disabled={!installStore.canInstall}
				onclick={() => installStore.install()}
				type="button"
			>
				<Download size={18} />
				Install Atom Clicker
			</button>
			<p class="text-xs text-white/40">
				{installStore.canInstall ? 'Free, takes a second, and your progress comes along.' : "Your browser's menu or address bar can install it too."}
			</p>
		</div>
	{/if}

	<ul class="rise grid w-full gap-4 border-t border-white/10 pt-5 text-left sm:grid-cols-3 sm:text-center" style:animation-delay="400ms">
		{#each perks as perk (perk.label)}
			<li class="flex items-start gap-3 sm:flex-col sm:items-center sm:gap-1.5">
				{#if active}
					<Check class="mt-0.5 shrink-0 text-green-400 sm:mt-0" size={16} strokeWidth={3} />
				{:else}
					<perk.icon class="mt-0.5 shrink-0 text-accent/70 sm:mt-0" size={16} />
				{/if}
				<div class="flex flex-col gap-0.5">
					<span class="text-sm font-medium text-white/80">{perk.label}</span>
					<span class="text-xs text-white/45">{perk.description}</span>
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	/* The glow is a static filter on the logo, the moving electrons sit outside it so it never repaints. */
	.logo.active svg {
		filter: drop-shadow(0 0 6px rgb(74 144 226 / 0.55));
	}

	/* Each electron spins in a flat circle squashed into its orbit's ellipse (ry 4 / rx 10 = 0.4), and its own counter transform
	   undoes the squash so it stays round. Transforms only, so the orbits run on the compositor. The inset leaves the logo's 2 of 24
	   units around the orbits, and sizes are percentages of the 20 unit orbit box, so everything scales with the logo. */
	.orbit {
		inset: 8.333%;
		position: absolute;
		transform: rotate(var(--angle)) scaleY(0.4);
	}

	.arm {
		animation: orbit-spin var(--duration) linear var(--delay) infinite;
		inset: 0;
		position: absolute;
	}

	.electron {
		animation: orbit-counter var(--duration) linear var(--delay) infinite;
		background: var(--color-accent-400);
		border-radius: 9999px;
		height: var(--size);
		left: 50%;
		margin: calc(var(--size) / -2);
		position: absolute;
		top: 0;
		width: var(--size);
	}

	.logo.active .electron {
		box-shadow: 0 0 6px var(--color-accent-400);
	}

	.badge {
		animation: badge 400ms cubic-bezier(0.22, 1, 0.36, 1) 250ms backwards;
	}

	.rise {
		animation: rise 500ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
	}

	/* Paused rather than removed, so the negative delays keep the electrons where the logo draws them. */
	@media (prefers-reduced-motion: reduce) {
		.arm,
		.electron {
			animation-play-state: paused;
		}

		.badge,
		.rise {
			animation: none;
		}
	}

	@keyframes badge {
		from {
			opacity: 0;
			transform: scale(0.7);
		}
	}

	@keyframes orbit-counter {
		from {
			transform: rotate(0deg) scaleY(2.5);
		}
		to {
			transform: rotate(-360deg) scaleY(2.5);
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
