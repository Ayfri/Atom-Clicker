<script lang="ts">
	import { loadParticleAssets, ParticleEngine } from '$helpers/particles';
	import { particlesEnabled, setParticleSink } from '$stores/canvas';
	import { ui } from '$stores/ui.svelte';
	import { onDestroy, onMount } from 'svelte';

	// The particle math expects deltas in 60fps frames, with long gaps clamped.
	const FRAME_MS = 1000 / 60;
	const MAX_FRAME_MS = 100;
	// Cheap phones report a 3x ratio, which triples the fill cost of a fullscreen canvas for no visible gain.
	const MAX_PIXEL_RATIO = 2;

	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D | null = null;
	let engine: ParticleEngine | null = null;
	let frame = 0;
	let lastTime = 0;
	let observer: ResizeObserver | null = null;
	let ratio = 1;

	/** The loop only runs while particles are alive: an idle pending rAF still costs Chrome a full main frame per vsync. */
	function start() {
		if (frame || !engine || !ctx) return;
		lastTime = performance.now();
		frame = requestAnimationFrame(loop);
	}

	function loop(now: number) {
		if (!engine || !ctx || !canvas) return;
		const deltaMs = Math.min(now - lastTime, MAX_FRAME_MS);
		lastTime = now;
		engine.update(deltaMs / FRAME_MS);

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		engine.draw(ctx, ratio);

		frame = engine.count > 0 ? requestAnimationFrame(loop) : 0;
	}

	function resize({ height, width }: DOMRectReadOnly) {
		if (!canvas) return;
		ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
		canvas.width = Math.max(1, Math.round(width * ratio));
		canvas.height = Math.max(1, Math.round(height * ratio));
	}

	onMount(async () => {
		if (!particlesEnabled) {
			console.info('Particle system disabled.');
			return;
		}

		await loadParticleAssets();

		canvas = document.createElement('canvas');
		ctx = canvas.getContext('2d');
		if (!ctx) return;

		/**
		 * Fixed and sized by CSS: a pixel width taken from innerWidth in landscape kept the page that wide after rotating
		 * back, phones then zoomed out to fit it and innerWidth never shrank again.
		 */
		canvas.style.cssText = 'height: 100%; inset: 0; position: fixed; width: 100%;';
		observer = new ResizeObserver(([entry]) => resize(entry.contentRect));
		observer.observe(canvas);
		document.body.appendChild(canvas);
		engine = new ParticleEngine();
		setParticleSink(particles => {
			if (ui.covered) return;
			engine?.add(particles);
			start();
		});
	});

	onDestroy(() => {
		setParticleSink(null);
		cancelAnimationFrame(frame);
		observer?.disconnect();
		engine?.destroy();
		canvas?.remove();
		canvas = null;
		ctx = null;
		engine = null;
	});
</script>
