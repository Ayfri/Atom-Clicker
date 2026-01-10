<script lang="ts">
	import {gameManager} from '$helpers/GameManager.svelte';
	import {BUILDING_TYPES, BUILDING_COLORS, BUILDING_LEVEL_UP_COST} from '$data/buildings';
	import {onDestroy} from 'svelte';
	import {createClickParticleSync, createClickTextParticleSync, type Particle} from '$helpers/particles';
	import {formatNumber} from '$lib/utils';
	import {shouldCreateParticles, addParticles} from '$stores/canvas';
	import {app} from '$stores/pixi';
	import { CurrenciesTypes } from '$data/currencies';

	let atomElement = $state<HTMLButtonElement>();

	export function simulateClick() {
		if (!atomElement) return;

		const rect = atomElement.getBoundingClientRect();
		const x = rect.left + Math.random() * rect.width;
		const y = rect.top + Math.random() * rect.height;

		const event = new MouseEvent('click', {
			clientX: x,
			clientY: y,
			bubbles: true
		});
		atomElement.dispatchEvent(event);
	}

	let interval: ReturnType<typeof setInterval>;
	$effect(() => {
		const value = gameManager.autoClicksPerSecond;
		if (interval) clearInterval(interval);
		if (value > 0) {
			interval = setInterval(() => simulateClick(), 1000 / value);
		}
	});

	async function handleClick(event: MouseEvent) {
		gameManager.addAtoms(gameManager.clickPower);
		gameManager.incrementClicks(!event.isTrusted);

		// TODO: Re-add main atom click animation

		// Only create particles if graphics support is available
		if (shouldCreateParticles() && $app?.canvas) {
			const newParticles: Particle[] = [];
			const textParticle = createClickTextParticleSync(
				event.clientX + Math.random() * 10,
				event.clientY + Math.random() * 10,
				`+${formatNumber(gameManager.clickPower)}`
			);
			if (textParticle) newParticles.push(textParticle);

			for (let i = 0; i < 5; i++) {
				const particle = createClickParticleSync(
					event.clientX + Math.random() * 10,
					event.clientY + Math.random() * 10,
					CurrenciesTypes.ATOMS
				);
				if (particle) newParticles.push(particle);
			}

			if (newParticles.length > 0) {
				addParticles(newParticles);
			}
		}
	}

	onDestroy(() => clearInterval(interval));
</script>

<button
	class="atom relative mt-20 flex size-64 sm:size-75 md:size-90 lg:size-112.5 items-center justify-center cursor-pointer bg-transparent"
	class:bonus={gameManager.hasBonus}
	onclick={async e => await handleClick(e)}
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

		@media screen and (width <= 1000px) {
			--electron-line-spacing: 40px;
			--initial-electrons-spacing: 110px;
		}

		@media screen and (width <= 600px) {
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
