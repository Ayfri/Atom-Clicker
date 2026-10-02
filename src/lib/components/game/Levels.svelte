<script lang="ts">
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import { prefersReducedMotion } from 'svelte/motion';

	let badge: HTMLElement;
	let track: HTMLElement;
	let lastLevel = gameManager.playerLevel;
	let pop: Animation | undefined;

	/** Late game can level up on every production commit, so a pop still playing is never restarted. */
	$effect(() => {
		const level = gameManager.playerLevel;
		if (level > lastLevel && pop?.playState !== 'running' && !prefersReducedMotion.current) {
			pop = badge.animate([{ transform: 'scale(1)' }, { color: '#fff', offset: 0.25, transform: 'scale(1.4)' }, { transform: 'scale(1)' }], {
				duration: 450,
				easing: 'ease-out',
			});
			track.animate([{ boxShadow: '0 0 10px 1px rgb(74 144 226 / 0.8)' }, { boxShadow: '0 0 0 0 rgb(74 144 226 / 0)' }], { duration: 700, easing: 'ease-out' });
		}
		lastLevel = level;
	});
</script>

<div
	class="fixed inset-x-0 z-10 flex flex-col-reverse gap-1.5 px-3 pt-2 pb-1 transition-[top] duration-300 md:inset-x-auto md:left-1/2 md:w-3/5 md:-translate-x-1/2 md:flex-col"
	style:top="var(--banner-height)"
>
	<div class="flex items-baseline justify-between px-0.5 text-xs tabular-nums">
		<span class="flex items-baseline gap-1 font-semibold tracking-wider text-white/45 uppercase">
			Level
			<b bind:this={badge} class="inline-block text-base font-bold tracking-normal text-accent-300">{gameManager.playerLevel}</b>
		</span>
		<span class="text-white/40">
			<span class="text-white/85">{formatNumber(gameManager.currentLevelXP, 0)}</span>
			/ {formatNumber(gameManager.nextLevelXP, 0)} XP
		</span>
	</div>
	<div bind:this={track} class="h-1.5 overflow-hidden rounded-full bg-white/10">
		<!-- Sliding a full-width fill keeps its gradient and rounded tip intact where scaleX squashed them, and moves on the
		     compositor all the same. XP changes on every 50 Hz commit, so no transition restarts on it. -->
		<div
			class="h-full rounded-full bg-linear-to-r from-accent-600 to-accent-300"
			style:transform="translateX({gameManager.xpProgress - 100}%)"
		></div>
	</div>
</div>
