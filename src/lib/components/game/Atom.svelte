<script lang="ts">
	import {gameManager} from '$helpers/GameManager.svelte';
	import {realmManager} from '$helpers/RealmManager.svelte';
	import {RealmTypes} from '$data/realms';
	import {BUILDING_TYPES, BUILDING_COLORS, BUILDING_LEVEL_UP_COST} from '$data/buildings';
	import {onDestroy} from 'svelte';
	import {createClickParticleSync, createClickTextParticleSync, type Particle} from '$helpers/particles';
	import {formatNumber} from '$lib/utils';
	import {shouldCreateParticles, addParticles} from '$stores/canvas';
	import { CurrenciesTypes } from '$data/currencies';

	let atomElement = $state<HTMLButtonElement>();

	// getBoundingClientRect forces a synchronous reflow, so the auto-clicker reuses the last measurement instead of taking one per click.
	let cachedRect: DOMRect | null = null;

	function getRect() {
		if (!cachedRect && atomElement) cachedRect = atomElement.getBoundingClientRect();
		return cachedRect;
	}

	$effect(() => {
		const invalidate = () => (cachedRect = null);
		window.addEventListener('resize', invalidate, { passive: true });
		window.addEventListener('scroll', invalidate, { capture: true, passive: true });
		return () => {
			window.removeEventListener('resize', invalidate);
			window.removeEventListener('scroll', invalidate, { capture: true });
		};
	});

	function simulateClick() {
		const rect = getRect();
		if (!rect) return;

		click(rect.left + Math.random() * rect.width, rect.top + Math.random() * rect.height, true);
	}

	let interval: ReturnType<typeof setInterval>;
	$effect(() => {
		const value = gameManager.autoClicksPerSecond;
		if (interval) clearInterval(interval);
		if (value > 0) {
			interval = setInterval(simulateClick, 1000 / value);
		}
	});

	function click(x: number, y: number, isAuto: boolean) {
		const clickPower = gameManager.clickPower;
		// Auto-click atoms are credited once per second by GameManager.tick(), this interval only drives the counters and the visuals.
		if (!isAuto) gameManager.addAtoms(clickPower);
		gameManager.incrementClicks(isAuto);

		// The atom realm stays mounted while another one is on screen, so its auto-click particles would drift over that realm.
		if (!shouldCreateParticles() || realmManager.selectedRealmId !== RealmTypes.ATOMS) return;

		const newParticles: Particle[] = [];
		const textParticle = createClickTextParticleSync(x + Math.random() * 10, y + Math.random() * 10, `+${formatNumber(clickPower)}`);
		if (textParticle) newParticles.push(textParticle);

		for (let i = 0; i < 5; i++) {
			const particle = createClickParticleSync(x + Math.random() * 10, y + Math.random() * 10, CurrenciesTypes.ATOMS);
			if (particle) newParticles.push(particle);
		}

		if (newParticles.length > 0) addParticles(newParticles);
	}

	onDestroy(() => clearInterval(interval));
</script>

<button
	class="atom relative mt-20 flex size-64 sm:size-75 md:size-90 lg:size-112.5 items-center justify-center cursor-pointer bg-transparent"
	class:bonus={gameManager.hasBonus}
	data-tutorial-target="atom-click"
	onclick={e => click(e.clientX, e.clientY, false)}
	bind:this={atomElement}
>
	{#each BUILDING_TYPES.filter(name => name in gameManager.buildings) as name, i}
		{@const data = gameManager.buildings[name]}

		{#if data && data.count > 0}
			{@const color = BUILDING_COLORS[data.level]}
			<div class="electron-shell" style="--line: {i}; --count: {data.count % BUILDING_LEVEL_UP_COST}; --color: {color};">
				{#each new Array(data.count % BUILDING_LEVEL_UP_COST) as _, j}
					<div class="electron" style="--i: {j};"></div>
				{/each}
			</div>
		{/if}
	{/each}
	<div class="nucleus h-15 w-15 rounded-full md:h-12.5 md:w-12.5"></div>
</button>

<style>
	.atom {
		--electron-line-spacing: 50px;
		--initial-electrons-spacing: 130px;
		--nucleus-size: 60px;
		--speed: 1;
		-webkit-tap-highlight-color: transparent;

		&.bonus {
			--speed: 2;
		}

		@media screen and (width < 64rem) {
			--electron-line-spacing: 40px;
			--initial-electrons-spacing: 110px;
		}

		@media screen and (width < 40rem) {
			--electron-line-spacing: 30px;
			--initial-electrons-spacing: 100px;
			--nucleus-size: 50px;
		}
	}

	.nucleus {
		background: radial-gradient(circle at 30% 30%, #4a90e2, #2c3e50);
		box-shadow: 0 0 20px rgba(74, 144, 226, 0.5);
	}

	.electron-shell {
		--radius: calc(var(--initial-electrons-spacing) + var(--line) * var(--electron-line-spacing));
		animation: rotate calc((4s + var(--line) * 2s) / var(--speed)) linear infinite;
		border: 2px solid color-mix(in oklab, var(--color) 10%, transparent 10%);
		border-radius: 50%;
		height: var(--radius);
		position: absolute;
		width: var(--radius);
	}

	.electron {
		--size: max(5px, calc(5px + var(--line) * 1px));
		--offset: calc(var(--line) * 20deg);
		--angle: calc(var(--offset) + (var(--i) / var(--count)) * 360deg);

		/* use angle to calculate position with cosinus and sinus */
		left: calc(50% + var(--radius) / 2 * cos(var(--angle)) - var(--size) / 2);
		top: calc(50% + var(--radius) / 2 * sin(var(--angle)) - var(--size) / 2);

		background: var(--color);
		border-radius: 50%;
		box-shadow: 0 0 10px color-mix(in oklab, var(--color) 50%, transparent 10%);
		height: var(--size);
		transition: all 0.5s;
		position: absolute;
		width: var(--size);
	}

	@keyframes rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	:global(.bounce) {
		animation: bounce 0.6s ease-in-out;
	}

	@keyframes bounce {
		0% {
			transform: scale(1);
		}
		25% {
			transform: scale(1.025);
		}
		50% {
			transform: scale(0.99);
		}
		75% {
			transform: scale(1.005);
		}
		100% {
			transform: scale(1);
		}
	}
</style>
