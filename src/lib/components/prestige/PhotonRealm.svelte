<script lang="ts">
	import { CurrenciesTypes } from '$data/currencies';
	import { FeatureTypes } from '$data/features';
	import { RealmTypes } from '$data/realms';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { calculateEffects } from '$helpers/effects';
	import { createClickParticleSync, type Particle } from '$helpers/particles';
	import { drawPhotonIcon, pulseOpacity } from '$helpers/photonCanvas';
	import type { SkillUpgrade, Upgrade } from '$lib/types';
	import { formatNumber } from '$lib/utils';
	import { addParticles } from '$stores/canvas';
	import { mobile } from '$stores/window.svelte';
	import PhotonCounter from '@components/prestige/PhotonCounter.svelte';
	import PhotonUpgrades from '@components/prestige/PhotonUpgrades.svelte';
	import { onMount } from 'svelte';

	function simulateClick() {
		if (!container || circles.length === 0) return;

		// Filter valid targets
		const allowExcited = (gameManager.photonUpgrades['excited_auto_click'] || 0) > 0;
		const validCircles = circles.filter(c => allowExcited || c.type !== 'excited');

		if (validCircles.length === 0) return;

		// Get a random circle from our valid circles array
		const randomCircle = validCircles[Math.floor(Math.random() * validCircles.length)];

		const rect = getContainerRect();
		if (!rect) return;

		clickCircle(randomCircle, rect.left + randomCircle.x, rect.top + randomCircle.y, true);
	}

	interface Circle {
		id: number;
		x: number;
		y: number;
		size: number;
		photons: number;
		lifetime: number;
		maxLifetime: number;
		rotation: number;
		type?: 'normal' | 'excited';
		baseValue?: number;
	}

	// Circles are drawn to a canvas, so they deliberately stay out of the reactive graph.
	let circles: Circle[] = [];
	let nextId = 0;
	let canvas = $state<HTMLCanvasElement>();
	let canvasHeight = 0;
	let canvasWidth = 0;
	let container = $state<HTMLDivElement>();
	let collectedWhileDown = false;
	let ctx: CanvasRenderingContext2D | null = null;
	let hadCircles = false;
	let hovering = $state(false);
	let lastHoveredId: number | null = null;
	let lastUpdateTime = Date.now();
	let pointerDown = false;

	// Base values - will be modified by upgrades
	let baseSpawnRate = 2000;
	let baseCircleLifetime = 5000;
	let baseSizeMultiplier = 1;

	const MAX_CIRCLES = 100;
	const MIN_SIZE = 30;
	const MAX_SIZE = 80;
	const MIN_PHOTONS = 1;
	const MAX_PHOTONS = 10;

	// Mirrors the label styling of the previous DOM markup: `font-bold text-xs` on the app font.
	const FONT_FAMILY = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
	const FONT_SIZE = 12;
	const LABEL_SHADOW_BLUR = 5;
	// Cheap phones often report a 3x ratio, which triples the fill cost for no visible gain here.
	const MAX_PIXEL_RATIO = 2;

	/**
	 * `calculateEffects` caches its effect index on the source array identity, so handing it a freshly filtered array
	 * rebuilt the whole index on every spawn and every click. The full source list keeps the cache warm, and the bucket
	 * it reads back is the same one the pre-filtered list would have produced.
	 */
	const singleSourceCache = new Map<string, (Upgrade | SkillUpgrade)[]>();
	let singleSourceKey: unknown = null;

	function sourcesById(id: string) {
		if (singleSourceKey !== gameManager.allEffectSources) {
			singleSourceKey = gameManager.allEffectSources;
			singleSourceCache.clear();
		}

		let cached = singleSourceCache.get(id);
		if (!cached) {
			const upgrade = gameManager.allEffectSources.find(u => u.id === id);
			cached = upgrade ? [upgrade] : [];
			singleSourceCache.set(id, cached);
		}
		return cached;
	}

	function getSizeMultiplier() {
		return calculateEffects(gameManager.allEffectSources, gameManager, baseSizeMultiplier, { type: 'photon_size' });
	}

	function getPhotonValueBonus() {
		return calculateEffects(sourcesById('photon_value'), gameManager, 0, { type: 'click' });
	}

	function getExcitedFromMaxBonus() {
		return calculateEffects(gameManager.allEffectSources, gameManager, 0, { type: 'excited_photon_from_max' });
	}

	function getLifetimeBonus() {
		return calculateEffects(sourcesById('circle_lifetime'), gameManager, 0, { type: 'photon_duration' });
	}

	function getExcitedLifetimeMultiplier() {
		return calculateEffects(gameManager.allEffectSources, gameManager, 1, { type: 'excited_photon_duration' });
	}

	function getDoubleChance() {
		return calculateEffects(gameManager.allEffectSources, gameManager, 0, { type: 'photon_double_chance' });
	}

	function getExcitedDoubleChance() {
		return calculateEffects(gameManager.allEffectSources, gameManager, 0, { type: 'excited_photon_double' });
	}

	function getIsExcited() {
		return Math.random() < gameManager.excitedPhotonChance;
	}

	function getCircleValue(circle: Circle) {
		const amount = circle.photons;
		const type = circle.type === 'excited' ? 'excited_photon_stability' : 'photon_stability';
		return Math.floor(calculateEffects(gameManager.allEffectSources, gameManager, amount, { type }));
	}

	// Labels are redrawn every frame, so results are memoized until the effect sources change.
	let labelCache = new Map<string, string>();
	let labelCacheKey: unknown = null;

	function getCircleLabel(circle: Circle) {
		if (labelCacheKey !== gameManager.allEffectSources) {
			labelCacheKey = gameManager.allEffectSources;
			labelCache.clear();
		}

		const key = `${circle.type}:${circle.photons}`;
		let label = labelCache.get(key);
		if (label === undefined) {
			label = `+${formatNumber(getCircleValue(circle))}`;
			labelCache.set(key, label);
		}
		return label;
	}

	function spawnCircle() {
		// The canvas size is already tracked by the ResizeObserver, reading a fresh rect here forced a layout per spawn.
		if (!container || canvasWidth === 0) return;
		if (circles.length >= MAX_CIRCLES) return;

		const margin = MAX_SIZE;

		// Apply upgrades
		const sizeMultiplier = getSizeMultiplier();
		const photonValueBonus = getPhotonValueBonus();
		const lifetimeBonus = getLifetimeBonus();
		const doubleChance = getDoubleChance();

		const isExcited = getIsExcited();

		const baseSize = Math.random() * (MAX_SIZE - MIN_SIZE) + MIN_SIZE;
		const basePhotons = Math.floor(Math.random() * (MAX_PHOTONS - MIN_PHOTONS + 1)) + MIN_PHOTONS;

		let finalPhotons = basePhotons;

		if (isExcited) {
			// Excited photons give 1 excited photon currency (or 2 if double chance)
			const excitedDoubleChance = getExcitedDoubleChance();
			const baseExcited = Math.random() < excitedDoubleChance ? 2 : 1;

			// Add bonus from max photon value
			const maxPhotonValue = MAX_PHOTONS + photonValueBonus;
			const fromMaxBonusFactor = getExcitedFromMaxBonus();

			finalPhotons = baseExcited + (maxPhotonValue * fromMaxBonusFactor);
		} else {
			// Apply double chance for normal photons
			finalPhotons = Math.random() < doubleChance ? (basePhotons + photonValueBonus) * 2 : basePhotons + photonValueBonus;
		}

		// Calculate Max Lifetime
		let maxLifetime = baseCircleLifetime + lifetimeBonus;
		if (isExcited) {
			maxLifetime *= getExcitedLifetimeMultiplier();
		}

		const circle: Circle = {
			id: nextId++,
			x: Math.random() * (canvasWidth - margin * 2) + margin,
			y: Math.random() * (canvasHeight - margin * 2) + margin,
			size: baseSize * sizeMultiplier,
			photons: Math.floor(finalPhotons),
			lifetime: 0,
			maxLifetime: maxLifetime,
			rotation: Math.random() * 360,
			type: isExcited ? 'excited' : 'normal',
			baseValue: isExcited ? 1 : 1
		};

		circles.push(circle);
	}

	function clickCircle(circle: Circle, x: number, y: number, isAuto: boolean) {
		const baseAmount = getCircleValue(circle);

		if (circle.type === 'excited') {
			const amount = baseAmount * gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.EXCITED_PHOTONS);
			currenciesManager.add(CurrenciesTypes.EXCITED_PHOTONS, amount);
		} else {
			const amount = baseAmount * gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.PHOTONS);
			currenciesManager.add(CurrenciesTypes.PHOTONS, amount);
		}

		const index = circles.indexOf(circle);
		if (index !== -1) circles.splice(index, 1);
		if (lastHoveredId === circle.id) lastHoveredId = null;

		const particleCount = Math.floor(circle.photons / 2) + 1;
		const addedParticles: Particle[] = [];
		const currencyType = circle.type === 'excited' ? CurrenciesTypes.EXCITED_PHOTONS : CurrenciesTypes.PHOTONS;

		for (let i = 0; i < particleCount; i++) {
			const particle = createClickParticleSync(x, y, currencyType);
			if (particle) addedParticles.push(particle);
		}
		if (addedParticles.length > 0) {
			addParticles(addedParticles);
		}

		// Excited stabilization: interacting with the realm resets/collapses it
		const excitedStabilizationLevel = gameManager.photonUpgrades['excited_stabilization'] || 0;
		if (excitedStabilizationLevel > 0) {
			const hasAutoBypass = gameManager.upgrades.includes('electron_bypass_photon_autoclick_stability');
			const hasManualBypass = gameManager.upgrades.includes('electron_bypass_photon_click_stability');

			if ((isAuto && hasAutoBypass) || (!isAuto && hasManualBypass)) return;

			gameManager.lastInteractionTime = Date.now();
		}
	}

	function updateCircles() {
		const currentTime = Date.now();
		const deltaTime = currentTime - lastUpdateTime;
		lastUpdateTime = currentTime;

		// In-place compaction, this runs ~60 times per second on up to 100 circles.
		let alive = 0;
		for (const circle of circles) {
			circle.lifetime += deltaTime;
			if (circle.lifetime < circle.maxLifetime) circles[alive++] = circle;
		}
		circles.length = alive;
	}

	function opacity(circle: Circle) {
		return Math.max(0, 1 - circle.lifetime / circle.maxLifetime);
	}

	function scale(circle: Circle) {
		const fadeInDuration = 150; // 0.15s
		if (circle.lifetime < fadeInDuration) {
			return circle.lifetime / fadeInDuration;
		}
		return 1;
	}

	// The canvas fills the container, so one rect serves both. getBoundingClientRect forces a synchronous layout, and this
	// runs on every pointermove and every auto-click, so it is measured once and invalidated on scroll/resize.
	let cachedRect: DOMRect | null = null;

	function getContainerRect() {
		if (!cachedRect && container) cachedRect = container.getBoundingClientRect();
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

	function resizeCanvas() {
		if (!canvas || !container || !ctx) return;

		const rect = container.getBoundingClientRect();
		cachedRect = rect;
		const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

		canvasWidth = rect.width;
		canvasHeight = rect.height;
		canvas.width = Math.max(1, Math.round(rect.width * ratio));
		canvas.height = Math.max(1, Math.round(rect.height * ratio));
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	}

	function render() {
		if (!canvas || !ctx) return;

		// Nothing to show: skip the clear entirely once the last circle is gone.
		const hasCircles = circles.length > 0;
		if (!hasCircles && !hadCircles) return;
		hadCircles = hasCircles;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		for (const circle of circles) {
			const alpha = opacity(circle);
			if (alpha <= 0) continue;

			const currentScale = scale(circle);
			const size = circle.size * currentScale;
			const excited = circle.type === 'excited';

			ctx.save();
			ctx.translate(circle.x, circle.y);

			ctx.save();
			ctx.rotate((circle.rotation * Math.PI) / 180);
			drawPhotonIcon(ctx, excited, size, excited ? alpha * pulseOpacity(circle.lifetime) : alpha);
			ctx.restore();

			ctx.globalAlpha = alpha;
			ctx.font = `700 ${FONT_SIZE * currentScale}px ${FONT_FAMILY}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = excited ? '#FFD700' : '#ffffff';
			ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
			ctx.shadowBlur = LABEL_SHADOW_BLUR * currentScale;
			ctx.fillText(getCircleLabel(circle), 0, 0);

			ctx.restore();
		}
	}

	function circleAt(x: number, y: number) {
		// Later circles are drawn on top, so they take the pointer first.
		for (let i = circles.length - 1; i >= 0; i--) {
			const circle = circles[i];
			const radius = (circle.size * scale(circle)) / 2;
			const dx = x - circle.x;
			const dy = y - circle.y;
			if (dx * dx + dy * dy <= radius * radius) return circle;
		}
		return null;
	}

	function circleFromEvent(event: MouseEvent) {
		const rect = getContainerRect();
		if (!rect) return null;
		return circleAt(event.clientX - rect.left, event.clientY - rect.top);
	}

	function handleClick(event: MouseEvent) {
		// A drag that already collected photons must not also count as a tap.
		if (collectedWhileDown) {
			collectedWhileDown = false;
			return;
		}

		const circle = circleFromEvent(event);
		if (circle) clickCircle(circle, event.clientX, event.clientY, false);
	}

	function handlePointerDown(event: PointerEvent) {
		pointerDown = true;
		collectedWhileDown = false;
		lastHoveredId = circleFromEvent(event)?.id ?? null;
	}

	function handlePointerUp() {
		pointerDown = false;
	}

	function handlePointerMove(event: PointerEvent) {
		const circle = circleFromEvent(event);
		hovering = circle !== null;

		// Equivalent of the per-circle `onpointerenter`: only fire when entering a new circle.
		// Touch only emits moves while pressed, so this doubles as swipe-to-collect on mobile.
		if (circle && circle.id !== lastHoveredId && hoverCollection) {
			clickCircle(circle, event.clientX, event.clientY, false);
			if (pointerDown) collectedWhileDown = true;
			lastHoveredId = null;
			hovering = false;
			return;
		}

		lastHoveredId = circle?.id ?? null;
	}

	function handlePointerLeave() {
		hovering = false;
		pointerDown = false;
		lastHoveredId = null;
	}

	// Update circles logic
	$effect(() => {
		lastUpdateTime = Date.now();
		const interval = setInterval(updateCircles, 16);
		return () => clearInterval(interval);
	});

	// Every realm stays mounted, the hidden ones are only translated off screen, so the canvas has to know.
	const visible = $derived(realmManager.selectedRealmId === RealmTypes.PHOTONS);

	$effect(() => {
		if (!canvas) return;

		ctx = canvas.getContext('2d');
		resizeCanvas();

		const observer = new ResizeObserver(resizeCanvas);
		if (container) observer.observe(container);

		return () => observer.disconnect();
	});

	// Draw on the browser's own frame cadence, and not at all while the tab or the realm is hidden.
	$effect(() => {
		if (!canvas || !visible) return;

		let frame = requestAnimationFrame(function loop() {
			frame = requestAnimationFrame(loop);
			if (!document.hidden) render();
		});

		return () => cancelAnimationFrame(frame);
	});

	// Collecting by dragging over photons also has to suppress the page scroll on touch devices.
	const hoverCollection = $derived(gameManager.features[FeatureTypes.HOVER_COLLECTION]);

	// Calculate auto-clicks per second from photon upgrades
	const photonAutoClicksPer5Seconds = $derived(gameManager.photonAutoClicksPer5Seconds);

	// Calculate current spawn rate reactively
	const currentSpawnRate = $derived(gameManager.photonSpawnInterval);

	// Set up auto-clicker subscription
	$effect(() => {
		const clicksPer5Seconds = photonAutoClicksPer5Seconds;
		if (clicksPer5Seconds > 0) {
			const interval = setInterval(() => simulateClick(), 5000 / clicksPer5Seconds);
			return () => clearInterval(interval);
		}
	});

	// Update spawn rate when upgrades change
	$effect(() => {
		const interval = setInterval(spawnCircle, currentSpawnRate);
		return () => clearInterval(interval);
	});

	onMount(() => {
		lastUpdateTime = Date.now();
	});
</script>

<div class="relative pt-12 lg:pt-4 transition-all duration-1000 ease-in-out">
	<div class="h-full flex flex-col lg:flex-row px-4 pt-12 pb-6 max-w-7xl mx-auto gap-4 {mobile.current ? 'min-h-screen' : ''}">
		<!-- Game Area - Left side (2/3 on desktop, full width on mobile) -->
		<div class="flex-1 lg:w-2/3 flex flex-col items-center">
			<PhotonCounter />

			<div
				class="relative w-full {mobile.current ? 'h-[40vh] min-h-75' : 'h-87.5 lg:h-162.5'} overflow-hidden"
				data-photon-realm
				bind:this={container}
			>
				<!-- `pointer-events-auto` opts out of the global `canvas` rule in app.css, which targets the PixiJS overlay. -->
				<canvas
					bind:this={canvas}
					class="absolute inset-0 w-full h-full pointer-events-auto"
					class:cursor-pointer={hovering}
					onclick={handleClick}
					onpointercancel={handlePointerUp}
					onpointerdown={handlePointerDown}
					onpointerleave={handlePointerLeave}
					onpointermove={handlePointerMove}
					onpointerup={handlePointerUp}
					style:touch-action={hoverCollection ? 'none' : 'auto'}
				></canvas>
			</div>
		</div>

		<!-- Upgrades Area - Right side (1/3 on desktop, full width on mobile) -->
		<div class="w-full lg:w-1/3 lg:max-w-xs">
			<PhotonUpgrades />
		</div>
	</div>
</div>
