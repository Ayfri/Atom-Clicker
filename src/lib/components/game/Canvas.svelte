<script lang="ts">
	import { loadParticleAssets, ParticleEngine } from '$helpers/particles';
	import { particleQueue, shouldCreateParticles } from '$stores/canvas';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import { onDestroy, onMount } from 'svelte';

	// PixiJS used to normalize deltas to 60fps frames and clamp long gaps, the particle math still expects that.
	const FRAME_MS = 1000 / 60;
	const MAX_FRAME_MS = 100;
	// Cheap phones report a 3x ratio, which triples the fill cost of a fullscreen canvas for no visible gain.
	const MAX_PIXEL_RATIO = 2;

	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D | null = null;
	let engine: ParticleEngine | null = null;
	let frame = 0;
	let lastTime = 0;
	let unsubscribeQueue: (() => void) | null = null;

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

		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.restore();
		engine.draw(ctx);

		frame = engine.count > 0 ? requestAnimationFrame(loop) : 0;
	}

	function resize() {
		if (!canvas || !ctx) return;

		const width = innerWidth.current ?? window.innerWidth;
		const height = innerHeight.current ?? window.innerHeight;
		const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		canvas.width = Math.max(1, Math.round(width * ratio));
		canvas.height = Math.max(1, Math.round(height * ratio));
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	}

	// Responsive resize
	$effect(() => {
		innerWidth.current;
		innerHeight.current;
		resize();
	});

	onMount(async () => {
		if (!shouldCreateParticles()) {
			console.info('Particle system disabled.');
			return;
		}

		await loadParticleAssets();

		canvas = document.createElement('canvas');
		ctx = canvas.getContext('2d');
		if (!ctx) return;

		resize();
		document.body.appendChild(canvas);
		engine = new ParticleEngine(particleQueue);
		unsubscribeQueue = particleQueue.subscribe(added => {
			if (added.length > 0) start();
		});
	});

	onDestroy(() => {
		unsubscribeQueue?.();
		cancelAnimationFrame(frame);
		engine?.destroy();
		canvas?.remove();
		canvas = null;
		ctx = null;
		engine = null;
	});
</script>
