<script lang="ts">
	import {gameManager} from '$helpers/GameManager.svelte';
	import {realmManager} from '$helpers/RealmManager.svelte';
	import {RealmTypes} from '$data/realms';
	import {BUILDING_TYPES, BUILDING_COLORS, BUILDING_LEVEL_UP_COST} from '$data/buildings';
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

	/**
	 * Auto-clickers tick at up to 50 Hz, faster ones are batched: one timer, reactive flush and particle burst per click
	 * cost more than the rest of the game at 70 clicks/s on a phone. One burst per tick already saturates the particle caps.
	 */
	const MIN_AUTO_CLICK_INTERVAL_MS = 20;
	const MAX_BURSTS_PER_BATCH = 1;

	$effect(() => {
		const value = gameManager.autoClicksPerSecond;
		if (value <= 0) return;

		const intervalMs = Math.max(1000 / value, MIN_AUTO_CLICK_INTERVAL_MS);
		const clicksPerTick = (value * intervalMs) / 1000;
		let pending = 0;
		const interval = setInterval(() => {
			pending += clicksPerTick;
			const count = Math.floor(pending + 1e-9);
			if (count < 1) return;
			pending -= count;

			// Auto-click atoms are credited once per second by GameManager.tick(), this interval only drives the counters and the visuals.
			gameManager.incrementClicks(true, count);
			const rect = getRect();
			if (!rect) return;
			for (let i = 0; i < Math.min(count, MAX_BURSTS_PER_BATCH); i++) {
				spawnParticles(rect.left + Math.random() * rect.width, rect.top + Math.random() * rect.height);
			}
		}, intervalMs);
		return () => clearInterval(interval);
	});

	function click(x: number, y: number) {
		gameManager.addAtoms(gameManager.clickPower);
		gameManager.incrementClicks();
		spawnParticles(x, y);
	}

	function spawnParticles(x: number, y: number) {
		// The atom realm stays mounted while another one is on screen, so its auto-click particles would drift over that realm.
		if (!shouldCreateParticles() || realmManager.selectedRealmId !== RealmTypes.ATOMS) return;

		const newParticles: Particle[] = [];
		const textParticle = createClickTextParticleSync(x + Math.random() * 10, y + Math.random() * 10, `+${formatNumber(gameManager.clickPower)}`);
		if (textParticle) newParticles.push(textParticle);

		for (let i = 0; i < 5; i++) {
			const particle = createClickParticleSync(x + Math.random() * 10, y + Math.random() * 10, CurrenciesTypes.ATOMS);
			if (particle) newParticles.push(particle);
		}

		if (newParticles.length > 0) addParticles(newParticles);
	}

	/** Every finger fires its own pointerdown, where a click only fires once per tap gesture. Keyboard activation still comes through click with detail 0. */
	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		click(event.clientX, event.clientY);
	}

	function handleClick(event: MouseEvent) {
		if (event.detail !== 0) return;
		const rect = getRect();
		if (rect) click(rect.left + rect.width / 2, rect.top + rect.height / 2);
	}
</script>

<button
	class="atom relative mt-20 flex size-64 sm:size-75 md:size-90 lg:size-112.5 items-center justify-center cursor-pointer bg-transparent"
	class:bonus={gameManager.hasBonus}
	onclick={handleClick}
	onpointerdown={handlePointerDown}
	bind:this={atomElement}
>
	{#each BUILDING_TYPES.filter(name => name in gameManager.buildings) as name, i}
		{@const data = gameManager.buildings[name]}

		{#if data && data.count % BUILDING_LEVEL_UP_COST > 0}
			{@const count = data.count % BUILDING_LEVEL_UP_COST}
			<!-- One round-capped dash per electron: `pathLength` spaces them evenly, where a div per electron cost a style and paint pass each. -->
			<svg class="electron-shell" style="--line: {i}; --color: {BUILDING_COLORS[data.level]};">
				<circle class="orbit" cx="50%" cy="50%" />
				<circle class="electrons" cx="50%" cy="50%" pathLength={count} stroke-dasharray="0 1" stroke-dashoffset={(-count * i * 20) / 360} />
			</svg>
		{/if}
	{/each}
	<div class="nucleus h-15 w-15 rounded-full md:h-12.5 md:w-12.5" data-hint="atom"></div>
</button>

<style>
	.atom {
		--electron-line-spacing: 50px;
		--initial-electrons-spacing: 130px;
		--nucleus-size: 60px;
		--speed: 1;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;

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
		height: var(--radius);
		overflow: visible;
		position: absolute;
		width: var(--radius);
	}

	.orbit {
		fill: none;
		r: calc(var(--radius) / 2 - 1px);
		stroke: color-mix(in oklab, var(--color) 10%, transparent 10%);
		stroke-width: 2px;
	}

	.electrons {
		fill: none;
		filter: drop-shadow(0 0 5px color-mix(in oklab, var(--color) 50%, transparent 10%));
		r: calc(var(--radius) / 2);
		stroke: var(--color);
		stroke-linecap: round;
		stroke-width: calc(5px + var(--line) * 1px);
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
