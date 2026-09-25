<script lang="ts">
	import {gameManager} from '$helpers/GameManager.svelte';
	import {realmManager} from '$helpers/RealmManager.svelte';
	import {REALMS, RealmTypes} from '$data/realms';
	import {GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES, getGeneratorColor} from '$data/generators';
	import {createClickParticleSync, createClickTextParticleSync, type Particle} from '$helpers/particles';
	import {formatNumber} from '$lib/utils';
	import {shouldCreateParticles, addParticles} from '$stores/canvas';
	import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
	import { AtomRenderer, CANVAS_OVERFLOW, NUCLEON_RANGE, type AtomScene } from '$helpers/AtomRenderer';
	import { untrack } from 'svelte';

	const prestigeColors = $derived([
		CURRENCIES[CurrenciesTypes.ATOMS].color,
		...(gameManager.totalProtonisesAllTime > 0 ? [CURRENCIES[CurrenciesTypes.PROTONS].color] : []),
		...(gameManager.totalElectronizesAllTime > 0 ? [CURRENCIES[CurrenciesTypes.ELECTRONS].color] : []),
	]);

	/** The nucleus starts as a lone nucleon and gains one each time the generator count, then the protonise count, doubles. */
	const scene: AtomScene = $derived({
		auras: prestigeColors,
		bonus: gameManager.hasBonus,
		energy: Math.min(1, Math.log10(1 + gameManager.atomsPerSecond) / 12),
		nucleonColors: [
			...prestigeColors,
			...[REALMS[RealmTypes.PHOTONS], REALMS[RealmTypes.RADIATION]].filter(realm => gameManager.realms[realm.id]?.unlocked).map(realm => realm.color),
		],
		nucleons: Math.min(
			NUCLEON_RANGE.max,
			NUCLEON_RANGE.min +
				Math.floor(Math.log2(1 + gameManager.generatorTotals.count)) +
				Math.floor(Math.log2(1 + gameManager.totalProtonisesAllTime)),
		),
		shells: GENERATOR_TYPES.flatMap(name => gameManager.generators[name] ?? []).map((data, line) => ({
			color: getGeneratorColor(data.level),
			count: data.count % GENERATOR_LEVEL_UP_COST,
			line,
		})),
	});

	let atomElement = $state<HTMLButtonElement>();
	let renderer = $state.raw<AtomRenderer>();

	function mountRenderer(canvas: HTMLCanvasElement) {
		const instance = new AtomRenderer(canvas, untrack(() => scene), GENERATOR_TYPES.length);
		renderer = instance;
		return () => {
			instance.destroy();
			renderer = undefined;
		};
	}

	$effect(() => {
		if (!renderer) return;
		renderer.scene = scene;
		renderer.setActive(realmManager.selectedRealmId === RealmTypes.ATOMS);
	});

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
		const rect = getRect();
		if (rect) renderer?.pulse(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2);
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
	aria-label="Atom"
	onclick={handleClick}
	onpointerdown={handlePointerDown}
	bind:this={atomElement}
>
	<canvas
		class="pointer-events-none absolute left-1/2 top-1/2 -translate-1/2"
		style:height="{100 * CANVAS_OVERFLOW}%"
		style:width="{100 * CANVAS_OVERFLOW}%"
		{@attach mountRenderer}
	></canvas>
	<div class="size-1/5 rounded-full" data-hint="atom"></div>
</button>

<style>
	.atom {
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
	}
</style>
