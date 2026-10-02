<script lang="ts">
	import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
	import { GENERATOR_LEVEL_UP_COST, GENERATOR_TYPES, getGeneratorColor } from '#data/generators.js';
	import { REALMS, RealmTypes } from '#data/realms.js';
	import { AmbientField } from '#helpers/AmbientField.js';
	import { AtomRenderer, CANVAS_OVERFLOW, NUCLEON_RANGE, type AtomScene } from '#helpers/AtomRenderer.js';
	import { CachedRect } from '#helpers/CachedRect.svelte.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { ClickParticles } from '#helpers/particles.js';
	import { realmManager } from '#helpers/RealmManager.svelte.js';
	import { formatNumber } from '#lib/utils.js';
	import { ui } from '#stores/ui.svelte.js';
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
		renderer.setActive(realmManager.selectedRealmId === RealmTypes.ATOMS && !ui.covered);
	});

	const atomRect = new CachedRect(RealmTypes.ATOMS, () => atomElement);
	/** Click power only changes on purchases, so the label isn't formatted again on every auto-click. */
	const clickLabel = $derived(`+${formatNumber(gameManager.clickPower)}`);

	/**
	 * Auto-clickers tick at up to 50 Hz, faster ones are batched: one timer, reactive flush and particle burst per click
	 * cost more than the rest of the game at 70 clicks/s on a phone. One burst per tick already saturates the particle caps.
	 */
	const MIN_AUTO_CLICK_INTERVAL_MS = 20;
	const CLICK_ICONS = 5;

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

			// Auto-click atoms are credited with production by the commit loop in +page.svelte, this interval only drives the counters and the visuals.
			gameManager.incrementClicks(true, count);
			const rect = atomRect.current;
			if (!rect) return;
			ClickParticles.emit(
				RealmTypes.ATOMS,
				rect.left + Math.random() * rect.width,
				rect.top + Math.random() * rect.height,
				CurrenciesTypes.ATOMS,
				CLICK_ICONS,
				clickLabel,
			);
			const angle = Math.random() * Math.PI * 2;
			const radius = rect.width * 0.4;
			AmbientField.emit(
				RealmTypes.ATOMS,
				'hum',
				{ x: rect.left + rect.width / 2 + Math.cos(angle) * radius, y: rect.top + rect.height / 2 + Math.sin(angle) * radius },
				{ angle },
			);
		}, intervalMs);
		return () => clearInterval(interval);
	});

	function click(x: number, y: number) {
		gameManager.addAtoms(gameManager.clickPower);
		gameManager.incrementClicks();
		ClickParticles.emit(RealmTypes.ATOMS, x, y, CurrenciesTypes.ATOMS, CLICK_ICONS, clickLabel);
		AmbientField.emit(RealmTypes.ATOMS, 'spark', { x, y });
		const rect = atomRect.current;
		if (rect) renderer?.pulse(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2);
	}

	/** Every finger fires its own pointerdown, where a click only fires once per tap gesture. Keyboard activation still comes through click with detail 0. */
	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		click(event.clientX, event.clientY);
	}

	function handleClick(event: MouseEvent) {
		if (event.detail !== 0) return;
		const rect = atomRect.current;
		if (rect) click(rect.left + rect.width / 2, rect.top + rect.height / 2);
	}
</script>

<button
	class="atom relative mt-3 lg:mt-8 max-lg:landscape:mt-0 flex size-[min(82vw,22rem)] lg:size-112.5 max-lg:landscape:size-[clamp(8rem,100dvh-14rem,18rem)]! items-center justify-center cursor-pointer bg-transparent"
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
