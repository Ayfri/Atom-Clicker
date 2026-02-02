<script lang="ts">
	import HiggsBoson from '@components/icons/HiggsBoson.svelte';
	import { POWER_UPS } from '$data/powerUp';
	import { gameManager } from '$helpers/GameManager.svelte';
	import type { PowerUp } from '$lib/types';
	import { randomBetween, randomValue, formatNumber } from '$lib/utils';
	import { onDestroy, onMount } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	// Constants
	const VISIBLE_DURATION = 25000;
	const FADE_OUT_DURATION = 30000;
	const CLICK_FADE_DURATION = 300;
	const MARGIN = 100;

	const powerUp = $state({
		description: '',
		duration: 0,
		id: Date.now().toString(),
		multiplier: 0,
		startTime: Date.now(),
	} satisfies PowerUp);

	let showBonus = $state(false);
	let isFadingOut = $state(false);
	let clickable = $state(true);
	let isHovered = $state(false);
	let messageShown = $state(false);
	let x = $state(0);
	let y = $state(0);

	let spawnTimeout: ReturnType<typeof setTimeout> | null = null;
	let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
	let disappearTimeout: ReturnType<typeof setTimeout> | null = null;

	function spawnBonusAtom() {
		if (fadeTimeout) clearTimeout(fadeTimeout);
		if (disappearTimeout) clearTimeout(disappearTimeout);

		x = Math.random() * ((innerWidth.current ?? window.innerWidth) - MARGIN * 2) + MARGIN;
		y = Math.random() * ((innerHeight.current ?? window.innerHeight) - MARGIN * 2) + MARGIN;

		const randomPowerUp = randomValue(POWER_UPS);
		powerUp.multiplier = randomPowerUp.multiplier * gameManager.powerUpEffectMultiplier;
		powerUp.duration = randomPowerUp.duration * gameManager.powerUpDurationMultiplier;
		// powerUp.duration = 60000; // Debug
		powerUp.description = `Multiplies atoms by ${formatNumber(powerUp.multiplier)} for ${formatNumber(powerUp.duration / 1000)} seconds`;
		powerUp.id = Date.now().toString();

		showBonus = true;
		isFadingOut = false;
		clickable = true;

		// After 25 seconds, start fade-out
		fadeTimeout = setTimeout(() => {
			if (showBonus) isFadingOut = true;
		}, VISIBLE_DURATION);

		// After 30 seconds, disappear completely
		disappearTimeout = setTimeout(() => {
			if (showBonus) {
				showBonus = false;
				scheduleNextSpawn();
			}
		}, FADE_OUT_DURATION);
	}

	function onClick() {
		if (!clickable) return;

		clickable = false;
		messageShown = true;
		powerUp.startTime = Date.now();
		gameManager.addPowerUp(powerUp);
		gameManager.incrementBonusHiggsBosonClicks();

		setTimeout(() => (messageShown = false), 3000);

		// Clear timeouts
		if (fadeTimeout) clearTimeout(fadeTimeout);
		if (disappearTimeout) clearTimeout(disappearTimeout);

		// Disappear immediately after click
		setTimeout(() => {
			showBonus = false;
			scheduleNextSpawn();
		}, CLICK_FADE_DURATION);
	}

	function scheduleNextSpawn() {
		if (spawnTimeout) clearTimeout(spawnTimeout);
		spawnTimeout = setTimeout(spawnBonusAtom, randomBetween(gameManager.powerUpInterval[0], gameManager.powerUpInterval[1]));
	}

	function forceSpawn() {
		if (spawnTimeout) clearTimeout(spawnTimeout);
		spawnBonusAtom();
	}

	onMount(() => {
		scheduleNextSpawn();
		window.addEventListener('force-bonus', forceSpawn);
	});
	onDestroy(() => {
		if (spawnTimeout) clearTimeout(spawnTimeout);
		if (fadeTimeout) clearTimeout(fadeTimeout);
		if (disappearTimeout) clearTimeout(disappearTimeout);
		if (typeof window !== 'undefined') window.removeEventListener('force-bonus', forceSpawn);
	});
</script>

{#if showBonus}
	<!-- Outer element to handle global opacity -->
	<button
		class="absolute z-20 w-10 h-10 rounded-full cursor-pointer transition-opacity ease-in-out duration-2000"
		class:opacity-100={!isFadingOut}
		class:opacity-0={isFadingOut}
		style="left: {x}px; top: {y}px;"
		onclick={onClick}
		onmouseenter={() => (isHovered = true)}
		onmouseleave={() => (isHovered = false)}
		aria-label="Collect bonus power-up"
	>
		<div
			class="w-full h-full flex items-center justify-center transition-transform duration-2000 ease-in-out vibrate"
			class:drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]={isHovered}
		>
			<HiggsBoson size={36} />
		</div>
	</button>
{/if}

{#if messageShown}
	<p
		class="absolute z-20 w-75 -translate-x-1/2 -translate-y-1/2 transform text-center font-bold text-lg text-white pointer-events-none drop-shadow-lg"
		style="left: {x}px; top: {y}px;"
	>
		{powerUp.description}
	</p>
{/if}

<style>
	@keyframes vibrate {
		0% {
			transform: translate(0, 0);
		}
		20% {
			transform: translate(-1px, 1px);
		}
		40% {
			transform: translate(-1px, -1px);
		}
		60% {
			transform: translate(1px, 1px);
		}
		80% {
			transform: translate(1px, -1px);
		}
		100% {
			transform: translate(0, 0);
		}
	}

	.vibrate {
		animation: vibrate 0.1s linear infinite;
	}
</style>
