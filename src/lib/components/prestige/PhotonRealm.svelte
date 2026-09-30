<script lang="ts">
	import { CHROMATIC, CHROMATIC_COLORS } from '$data/chromatic';
	import { CURRENCIES, CurrenciesTypes } from '$data/currencies';
	import { FeatureTypes } from '$data/features';
	import { getQuarkShopItem } from '$data/quarkShop';
	import { RealmTypes } from '$data/realms';
	import { AmbientField } from '$helpers/AmbientField';
	import { ChromaticField, type ChromaticPhoton } from '$helpers/chromaticField';
	import { chromaticManager } from '$helpers/ChromaticManager.svelte';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { REALM_SWITCH_MS, realmManager } from '$helpers/RealmManager.svelte';
	import { createClickParticleSync, type Particle } from '$helpers/particles';
	import { drawPhotonIcon, pulseOpacity } from '$helpers/photonCanvas';
	import type { NumberNotation } from '$lib/types';
	import { formatNumber } from '$lib/utils';
	import { addParticles } from '$stores/canvas';
	import { mobile } from '$stores/window.svelte';
	import Ambient from '@components/game/Ambient.svelte';
	import PhotonCounter from '@components/prestige/PhotonCounter.svelte';
	import PhotonUpgrades from '@components/prestige/PhotonUpgrades.svelte';
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';

	function simulateClick() {
		if (!container) return;

		// Filter valid targets
		const allowExcited = (gameManager.photonUpgrades['excited_auto_click'] || 0) > 0;
		const validCircles = circles.filter(c => allowExcited || c.type !== 'excited');
		const targets = validCircles.length + chromatic.photons.length;
		if (targets === 0) return;

		// Colored photons share the draw with the circles, one auto-click chips at their HP instead of collecting.
		const pick = Math.floor(Math.random() * targets);
		if (pick >= validCircles.length) return hitChromatic(chromatic.photons[pick - validCircles.length], true);
		const randomCircle = validCircles[pick];

		// Hidden, the click spawns no particles, and measuring the translated realm forced a layout on every auto-click.
		if (!visible) return clickCircle(randomCircle, 0, 0, true);

		const rect = getContainerRect();
		if (!rect) return;

		clickCircle(randomCircle, rect.left + randomCircle.x, rect.top + randomCircle.y, true);
	}

	const chromatic = new ChromaticField();
	let lastHoveredChromaticId: number | null = null;
	const prismUnlocked = $derived(gameManager.totalIonizesAllTime > 0);

	function hitChromatic(photon: ChromaticPhoton, auto: boolean) {
		const broken = chromatic.hit(photon, auto);
		if (!broken) return;
		chromaticManager.collect(broken, gameManager.totalIonizesAllTime);
		if (!broken.half) gameManager.dailyStats.chromaticBreaks = (gameManager.dailyStats.chromaticBreaks ?? 0) + 1;
		if (!visible || broken.drop === 0) return;

		const rect = getContainerRect();
		if (!rect) return;
		const addedParticles: Particle[] = [];
		for (let i = 0; i < 5; i++) {
			const particle = createClickParticleSync(rect.left + broken.x, rect.top + broken.y, CHROMATIC[broken.color].currency);
			if (particle) addedParticles.push(particle);
		}
		if (addedParticles.length > 0) addParticles(addedParticles);
	}

	$effect(() => {
		if (!prismUnlocked) return;
		const interval = setInterval(() => chromatic.spawn(canvasWidth, canvasHeight), chromaticManager.spawnInterval);
		return () => clearInterval(interval);
	});

	interface Circle {
		id: number;
		x: number;
		y: number;
		size: number;
		photons: number;
		lifetime: number;
		maxLifetime: number;
		rotation: number;
		/** Degrees per second, signed so photons turn both ways. */
		spin: number;
		/** Offset of the float cycle, so neighbours never bob in sync. */
		phase: number;
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
	// The icon's outer ring is drawn at the very edge of `size`, so a bare radius makes a 30px photon a 28px target. Pad it to
	// a comfortable thumb size on phones.
	const HIT_PADDING = 6;
	const MIN_HIT_RADIUS = 22;

	// Mirrors the label styling of the previous DOM markup: `font-bold text-xs` on the app font.
	const FONT_FAMILY = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
	const FONT_SIZE = 12;
	const LABEL_SHADOW_BLUR = 5;
	const RING_GAP = 3;
	const POP_DURATION = 350;
	const FLOAT_AMPLITUDE = 3;
	const FLOAT_PERIOD = 2600;
	const MIN_SPIN = 10;
	const MAX_SPIN = 30;
	// Cheap phones often report a 3x ratio, which triples the fill cost for no visible gain here.
	const MAX_PIXEL_RATIO = 2;

	const sizeMultiplier = $derived(gameManager.effects.value('photon_size', baseSizeMultiplier, gameManager));
	const circleLifetime = $derived(baseCircleLifetime + gameManager.effects.value('photon_duration', 0, gameManager));
	const excitedLifetimeMultiplier = $derived(gameManager.effects.value('excited_photon_duration', 1, gameManager));

	function getCircleValue(circle: Circle) {
		const stat = circle.type === 'excited' ? 'excited_photon_stability' : 'photon_stability';
		return Math.floor(gameManager.effects.value(stat, circle.photons, gameManager));
	}

	interface LabelSprite {
		bitmap: ImageBitmap;
		height: number;
		width: number;
	}

	/** Shadowed text was ~70% of the frame, so each label is rasterized once until the values or pixel ratio change. */
	let labelCache = new Map<string, LabelSprite>();
	let labelEffects: unknown = null;
	let labelNotation: NumberNotation = 'suffix';
	let labelStability = 1;
	let pixelRatio = 1;

	function clearLabels() {
		for (const label of labelCache.values()) label.bitmap.close();
		labelCache.clear();
	}

	/** Stable Photons scale the value with the live Stability Field, which moves every tick without rebuilding the effects. */
	function syncLabels() {
		const effects = gameManager.effects;
		const { notation } = gameManager.settings.display;
		const stability = gameManager.stabilityMultiplier;
		if (effects === labelEffects && notation === labelNotation && stability === labelStability) return;
		labelEffects = effects;
		labelNotation = notation;
		labelStability = stability;
		clearLabels();
	}

	function getCircleLabel(circle: Circle) {
		const key = `${circle.type}:${circle.photons}`;
		let label = labelCache.get(key);
		if (label === undefined) {
			label = rasterizeLabel(`+${formatNumber(getCircleValue(circle))}`, circle.type === 'excited');
			labelCache.set(key, label);
		}
		return label;
	}

	function rasterizeLabel(text: string, excited: boolean): LabelSprite {
		const font = `700 ${FONT_SIZE}px ${FONT_FAMILY}`;
		const padding = LABEL_SHADOW_BLUR + 2;
		const image = new OffscreenCanvas(1, 1);
		const label = image.getContext('2d') as OffscreenCanvasRenderingContext2D;

		label.font = font;
		const width = Math.ceil(label.measureText(text).width) + padding * 2;
		const height = FONT_SIZE + padding * 2;
		// Resizing resets the context, so the text state is set afterwards.
		image.width = Math.ceil(width * pixelRatio);
		image.height = Math.ceil(height * pixelRatio);

		label.scale(pixelRatio, pixelRatio);
		label.font = font;
		label.textAlign = 'center';
		label.textBaseline = 'middle';
		label.fillStyle = excited ? '#FFD700' : '#ffffff';
		label.shadowColor = 'rgba(0, 0, 0, 0.8)';
		// Shadow blur ignores the transform, so this matches the device-pixel blur the main canvas used.
		label.shadowBlur = LABEL_SHADOW_BLUR;
		label.fillText(text, width / 2, height / 2);

		// An ImageBitmap blits ~10% faster than the OffscreenCanvas it comes from.
		return { bitmap: image.transferToImageBitmap(), height, width };
	}

	function spawnCircle() {
		// The canvas size is already tracked by the ResizeObserver, reading a fresh rect here forced a layout per spawn.
		if (!container || canvasWidth === 0) return;
		if (circles.length >= MAX_CIRCLES) return;

		const margin = MAX_SIZE;

		const photonValueBonus = gameManager.photonValueBonus;
		const isExcited = Math.random() < gameManager.excitedPhotonChance;

		const baseSize = Math.random() * (MAX_SIZE - MIN_SIZE) + MIN_SIZE;
		const basePhotons = Math.floor(Math.random() * (MAX_PHOTONS - MIN_PHOTONS + 1)) + MIN_PHOTONS;

		let finalPhotons = basePhotons;

		if (isExcited) {
			// Excited photons give 1 excited photon currency (or 2 if double chance), plus a share of the max photon value
			const baseExcited = Math.random() < gameManager.excitedPhotonDoubleChance ? 2 : 1;
			finalPhotons = baseExcited + (MAX_PHOTONS + photonValueBonus) * gameManager.excitedPhotonFromMaxBonus;
		} else {
			finalPhotons = Math.random() < gameManager.photonDoubleChance ? (basePhotons + photonValueBonus) * 2 : basePhotons + photonValueBonus;
		}

		let maxLifetime = circleLifetime;
		if (isExcited) {
			maxLifetime *= excitedLifetimeMultiplier;
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
			spin: (Math.random() < 0.5 ? -1 : 1) * (MIN_SPIN + Math.random() * (MAX_SPIN - MIN_SPIN)),
			phase: Math.random() * Math.PI * 2,
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
			if (!chromatic.empty && Math.random() < chromaticManager.resonanceChance) {
				hitChromatic(chromatic.photons[Math.floor(Math.random() * chromatic.photons.length)], false);
			}
			if (Math.random() < chromaticManager.excitationChance) chromatic.spawn(canvasWidth, canvasHeight, circle);
		} else {
			const amount = baseAmount * gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.PHOTONS);
			currenciesManager.add(CurrenciesTypes.PHOTONS, amount);
		}

		const index = circles.indexOf(circle);
		if (index !== -1) circles.splice(index, 1);
		if (lastHoveredId === circle.id) lastHoveredId = null;

		// The auto-clicker keeps collecting from another realm, but its particles must not float over that realm.
		if (visible) {
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
			AmbientField.emit(RealmTypes.PHOTONS, isAuto ? 'hum' : 'spark', { x, y }, { color: CURRENCIES[currencyType].color });
		}

		// Excited stabilization: interacting with the realm resets/collapses it
		const excitedStabilizationLevel = gameManager.photonUpgrades['excited_stabilization'] || 0;
		if (excitedStabilizationLevel > 0) {
			if (gameManager.features[isAuto ? FeatureTypes.STABLE_PHOTON_AUTO_CLICK : FeatureTypes.STABLE_PHOTON_CLICK]) return;

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
		chromatic.update(deltaTime, canvasWidth, canvasHeight, visible);
	}

	function opacity(circle: Circle) {
		return Math.max(0, 1 - circle.lifetime / circle.maxLifetime);
	}

	/** Pops in past full size then settles (ease-out-back). */
	function scale(circle: Circle) {
		if (circle.lifetime >= POP_DURATION) return 1;
		const t = circle.lifetime / POP_DURATION - 1;
		return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
	}

	/** Vertical float, also applied to hit tests so a bobbing photon is clicked where it is drawn. */
	function floatOffset(circle: Circle, still: boolean) {
		return still ? 0 : Math.sin((circle.lifetime / FLOAT_PERIOD) * Math.PI * 2 + circle.phase) * FLOAT_AMPLITUDE;
	}

	// The canvas fills the container, so one rect serves both. getBoundingClientRect forces a synchronous layout, and this
	// runs on every pointermove and every auto-click, so it is measured once and invalidated on scroll/resize.
	let cachedRect: DOMRect | null = null;

	function getContainerRect() {
		if (!container) return null;
		// Off-screen realms are translated sideways, a rect measured then would send every click past the photons.
		if (!visible) return container.getBoundingClientRect();
		if (!cachedRect) cachedRect = container.getBoundingClientRect();
		return cachedRect;
	}

	// A rect measured during the swing-in is transformed, so it is dropped again once the realm has settled.
	$effect(() => {
		visible;
		cachedRect = null;
		const timeout = setTimeout(() => (cachedRect = null), REALM_SWITCH_MS + 50);
		return () => clearTimeout(timeout);
	});

	$effect(() => {
		const invalidate = () => (cachedRect = null);
		window.addEventListener('resize', invalidate, { passive: true });
		window.addEventListener('scroll', invalidate, { capture: true, passive: true });
		return () => {
			window.removeEventListener('resize', invalidate);
			window.removeEventListener('scroll', invalidate, { capture: true });
		};
	});

	/** Takes the layout size from the ResizeObserver, a bounding rect taken mid-swing is projected by the 3D transform. */
	function resizeCanvas({ height, width }: DOMRectReadOnly) {
		if (!canvas || !ctx) return;

		cachedRect = null;
		const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
		if (ratio !== pixelRatio) clearLabels();
		pixelRatio = ratio;

		canvasWidth = width;
		canvasHeight = height;
		canvas.width = Math.max(1, Math.round(width * ratio));
		canvas.height = Math.max(1, Math.round(height * ratio));
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	}

	function render() {
		if (!canvas || !ctx) return;

		// Nothing to show: skip the clear entirely once the last circle is gone.
		const hasCircles = circles.length > 0 || !chromatic.empty;
		if (!hasCircles && !hadCircles) return;
		hadCircles = hasCircles;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);
		const still = prefersReducedMotion.current;
		syncLabels();

		for (const circle of circles) {
			const alpha = opacity(circle);
			if (alpha <= 0) continue;

			const currentScale = scale(circle);
			const size = circle.size * currentScale;
			const excited = circle.type === 'excited';
			const rotation = still ? circle.rotation : circle.rotation + (circle.spin * circle.lifetime) / 1000;

			ctx.save();
			ctx.translate(circle.x, circle.y + floatOffset(circle, still));

			ctx.save();
			ctx.rotate((rotation * Math.PI) / 180);
			drawPhotonIcon(ctx, excited, size, excited ? alpha * pulseOpacity(circle.lifetime) : alpha);
			ctx.restore();

			// `alpha` is also the remaining lifetime, so the ring drains clockwise from the top as the photon fades.
			ctx.globalAlpha = alpha * 0.5;
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = CURRENCIES[excited ? CurrenciesTypes.EXCITED_PHOTONS : CurrenciesTypes.PHOTONS].color;
			ctx.beginPath();
			ctx.arc(0, 0, size / 2 + RING_GAP, -Math.PI / 2, -Math.PI / 2 + alpha * Math.PI * 2);
			ctx.stroke();

			const label = getCircleLabel(circle);
			const labelWidth = label.width * currentScale;
			const labelHeight = label.height * currentScale;
			ctx.globalAlpha = alpha;
			ctx.drawImage(label.bitmap, -labelWidth / 2, -labelHeight / 2, labelWidth, labelHeight);

			ctx.restore();
		}

		chromatic.draw(ctx, still);
	}

	function circleAt(x: number, y: number) {
		const still = prefersReducedMotion.current;
		// Later circles are drawn on top, so they take the pointer first.
		for (let i = circles.length - 1; i >= 0; i--) {
			const circle = circles[i];
			const radius = Math.max(MIN_HIT_RADIUS, (circle.size * scale(circle)) / 2 + HIT_PADDING);
			const dx = x - circle.x;
			const dy = y - circle.y - floatOffset(circle, still);
			if (dx * dx + dy * dy <= radius * radius) return circle;
		}
		return null;
	}

	function circleFromEvent(event: MouseEvent) {
		const rect = getContainerRect();
		if (!rect) return null;
		return circleAt(event.clientX - rect.left, event.clientY - rect.top);
	}

	function chromaticFromEvent(event: MouseEvent) {
		const rect = getContainerRect();
		if (!rect) return null;
		return chromatic.at(event.clientX - rect.left, event.clientY - rect.top);
	}

	function handleClick(event: MouseEvent) {
		// A drag that already collected photons must not also count as a tap.
		if (collectedWhileDown) {
			collectedWhileDown = false;
			return;
		}

		// Colored photons are drawn above the circles, so they take the tap first.
		const photon = chromaticFromEvent(event);
		if (photon) return hitChromatic(photon, false);
		const circle = circleFromEvent(event);
		if (circle) clickCircle(circle, event.clientX, event.clientY, false);
	}

	function handlePointerDown(event: PointerEvent) {
		pointerDown = true;
		collectedWhileDown = false;
		lastHoveredId = circleFromEvent(event)?.id ?? null;
		lastHoveredChromaticId = chromaticFromEvent(event)?.id ?? null;
	}

	function handlePointerUp() {
		pointerDown = false;
	}

	function handlePointerMove(event: PointerEvent) {
		// Dragging over a colored photon deals one hit per entry, it has to be left and re-entered to hit again.
		const photon = chromaticFromEvent(event);
		if (photon) {
			hovering = true;
			if (photon.id !== lastHoveredChromaticId && hoverCollection) {
				hitChromatic(photon, false);
				if (pointerDown) collectedWhileDown = true;
			}
			lastHoveredChromaticId = photon.id;
			return;
		}
		lastHoveredChromaticId = null;

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
		lastHoveredChromaticId = null;
	}

	// Every realm stays mounted, the hidden ones are only translated off screen, so the canvas has to know.
	const visible = $derived(realmManager.selectedRealmId === RealmTypes.PHOTONS);

	/** Visible circles age in the render loop. Hidden ones only need to expire, a 60 Hz timer there woke the phone for nothing. */
	const HIDDEN_UPDATE_INTERVAL_MS = 250;

	$effect(() => {
		if (visible) return;
		const interval = setInterval(updateCircles, HIDDEN_UPDATE_INTERVAL_MS);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (!canvas) return;

		ctx = canvas.getContext('2d');

		// The first observation fires right after `observe`, so it also sets the initial size.
		const observer = new ResizeObserver(([entry]) => resizeCanvas(entry.contentRect));
		if (container) observer.observe(container);

		return () => observer.disconnect();
	});

	// Draw on the browser's own frame cadence, and not at all while the tab or the realm is hidden.
	$effect(() => {
		if (!canvas || !visible) return;

		let frame = requestAnimationFrame(function loop() {
			frame = requestAnimationFrame(loop);
			updateCircles();
			if (!document.hidden) render();
		});

		return () => cancelAnimationFrame(frame);
	});

	/**
	 * An equipped Quark theme rebuilds the `realm-*` shades from its two colors, so every `realm-*` class below follows it.
	 * The photons keep their currency color, a golden normal photon would pass for an excited one.
	 */
	const themePalette = $derived.by(() => {
		const themeId = quarksManager.equippedThemes[RealmTypes.PHOTONS];
		const theme = themeId ? getQuarkShopItem(themeId)?.theme : undefined;
		if (!theme) return undefined;

		const accent = theme.accent;
		const secondary = theme.accentSecondary ?? accent;
		const shades: [number, string][] = [
			[200, `color-mix(in oklab, ${accent} 45%, white)`],
			[300, `color-mix(in oklab, ${accent} 70%, white)`],
			[400, accent],
			[500, secondary],
			[600, `color-mix(in oklab, ${secondary} 85%, black)`],
			[700, `color-mix(in oklab, ${secondary} 70%, black)`],
			[800, `color-mix(in oklab, ${secondary} 55%, black)`],
			[900, `color-mix(in oklab, ${secondary} 45%, black)`],
			[950, `color-mix(in oklab, ${secondary} 30%, black)`],
		];
		return shades.map(([shade, color]) => `--color-realm-${shade}: ${color};`).join(' ');
	});

	// Collecting by dragging over photons also has to suppress the page scroll on touch devices.
	const hoverCollection = $derived(gameManager.features[FeatureTypes.HOVER_COLLECTION]);

	// Calculate auto-clicks per second from photon upgrades
	const photonAutoClicksPer5Seconds = $derived(gameManager.photonAutoClicksPer5Seconds);

	// Calculate current spawn rate reactively
	const currentSpawnRate = $derived(gameManager.photonSpawnInterval);
	const excitedUnlocked = $derived(gameManager.currencies[CurrenciesTypes.EXCITED_PHOTONS].earnedAllTime > 0);

	/** Photon upgrades thicken the dust, Excited Photons add gold and the Prism splits it into Red, Green and Blue light. */
	const ambience = $derived({
		colors: [
			CURRENCIES[CurrenciesTypes.PHOTONS].color,
			...(excitedUnlocked ? [CURRENCIES[CurrenciesTypes.EXCITED_PHOTONS].color] : []),
			...(prismUnlocked ? CHROMATIC_COLORS.map(color => CURRENCIES[CHROMATIC[color].currency].color) : []),
		],
		density: 3 + Math.min(8, Math.floor(gameManager.photonUpgradeLevels / 4)) + (excitedUnlocked ? 3 : 0) + (prismUnlocked ? 4 : 0),
	});

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
		return clearLabels;
	});
</script>

<div class="relative pt-12 lg:pt-4 transition-all duration-1000 ease-in-out" style={themePalette}>
	<!-- Same glows the Atom Realm gets from its prestiges: the first Ionize splits the light into Red, Green and Blue. -->
	{#if visible && prismUnlocked}
		<div aria-hidden="true" class="fixed inset-0 -z-50 pointer-events-none overflow-hidden">
			<div class="absolute bg-[#ff4d5e]/12 blur-[160px] h-64 left-[12%] rounded-full top-[12%] w-64"></div>
			<div class="absolute bg-[#2ee6a0]/10 blur-[160px] h-64 right-[15%] rounded-full top-[35%] w-64"></div>
			<div class="absolute bg-[#4d8dff]/12 blur-[180px] bottom-[8%] h-80 left-[35%] rounded-full w-80"></div>
		</div>
	{/if}
	{#if visible}
		<Ambient accent={CURRENCIES[CurrenciesTypes.PHOTONS].color} {ambience} realm={RealmTypes.PHOTONS} />
	{/if}
	<!-- The side padding clears the fixed nav and realm switcher until the viewport is wide enough to center past them. On desktop
	     the upgrades panel is 100dvh - 150px (this padding, the realm's lg:pt-4 and the footer) and the photon field stretches to match it. -->
	<div class="h-full flex flex-col lg:flex-row max-lg:landscape:flex-row px-4 lg:pl-24 lg:pr-28 2xl:px-4 pt-12 max-lg:landscape:pt-2 pb-6 max-w-7xl mx-auto gap-4 {mobile.current ? 'min-h-screen' : ''}">
		<!-- Game Area - Left side (2/3 on desktop, full width on mobile) -->
		<div class="flex-1 lg:w-2/3 flex flex-col items-center max-lg:landscape:sticky max-lg:landscape:top-0 max-lg:landscape:self-start">
			<PhotonCounter />

			<div
				class="relative w-full {mobile.current ? 'h-[40vh] min-h-75 landscape:h-[max(10rem,100dvh-15rem)] landscape:min-h-0' : 'flex-1 min-h-80'} overflow-hidden"
				data-photon-realm
				bind:this={container}
			>
				<div aria-hidden="true" class="photon-field absolute inset-0 pointer-events-none text-realm-400">
					<svg class="photon-wave absolute h-24 left-0 -mt-12 top-1/2 w-[200%]" preserveAspectRatio="none" viewBox="0 0 400 40">
						<path d="M0 20 Q50 4 100 20 T200 20 T300 20 T400 20" />
					</svg>
					<svg class="photon-wave photon-wave-reverse absolute h-24 left-0 -mt-12 top-1/2 w-[200%]" preserveAspectRatio="none" viewBox="0 0 400 40">
						<path d="M0 20 Q25 30 50 20 T100 20 T150 20 T200 20 T250 20 T300 20 T350 20 T400 20" />
					</svg>
				</div>

				<p class="absolute bottom-3 inset-x-0 pointer-events-none text-center text-realm-200/40 text-xs">
					A photon every {formatNumber(currentSpawnRate / 1000)}s · lasts {formatNumber(circleLifetime / 1000)}s
					{#if excitedUnlocked}· {formatNumber(gameManager.excitedPhotonChance * 100)}% excited{/if}
				</p>

				<!-- `pointer-events-auto` opts out of the global `canvas` rule in app.css, which targets the particle overlay. -->
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
		<div class="w-full lg:w-1/3 lg:max-w-xs max-lg:landscape:w-5/12 max-lg:landscape:shrink-0">
			<PhotonUpgrades />
		</div>
	</div>
</div>

<style>
	/* Static glow and interference rings, faded out at the edges so the field has no hard border. */
	.photon-field {
		background:
			radial-gradient(ellipse 55% 50% at 50% 50%, color-mix(in srgb, var(--color-realm-500) 14%, transparent), transparent 70%),
			repeating-radial-gradient(circle at 50% 50%, transparent 0 46px, color-mix(in srgb, var(--color-realm-400) 8%, transparent) 46px 47px);
		mask-image: radial-gradient(ellipse 70% 65% at 50% 50%, black 30%, transparent 75%);
	}

	/* Each path repeats every half of its width, so sliding by -50% loops seamlessly. Transform only, on the compositor. */
	.photon-wave {
		animation: photon-wave 16s linear infinite;
		fill: none;
		opacity: 0.22;
		stroke: currentColor;
		stroke-width: 1.5px;
		will-change: transform;
	}

	.photon-wave path {
		vector-effect: non-scaling-stroke;
	}

	.photon-wave-reverse {
		animation-direction: reverse;
		animation-duration: 11s;
		opacity: 0.12;
	}

	@keyframes photon-wave {
		to {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.photon-wave {
			animation: none;
		}
	}
</style>
