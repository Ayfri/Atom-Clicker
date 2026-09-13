<script lang="ts">
	import { getQuarkShopItem } from '$data/quarkShop';
	import { RealmTypes } from '$data/realms';
	import { quarksManager } from '$helpers/QuarksManager.svelte';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { onMount } from 'svelte';

	interface Nucleon {
		size: number;
		type: 'proton' | 'neutron';
		vx: number;
		vy: number;
		x: number;
		y: number;
	}

	interface RadiationParticle {
		alpha: number;
		life: number;
		maxDist: number;
		size: number;
		vx: number;
		vy: number;
		x: number;
		y: number;
	}

	interface Electron {
		angle: number;
		orbitRadius: number;
		speed: number;
	}

	/** Electrons flying in from the ring when fuel is added, absorbed once they reach the core. */
	interface FuelParticle {
		size: number;
		vx: number;
		vy: number;
		x: number;
		y: number;
	}

	const DEFAULT_ACCENT = '#39ff14';
	const MAX_PIXEL_RATIO = 2;
	const MAX_RADIATION_PARTICLES = 40;
	const SPAWN_INTERVAL_MS = 200;
	/** Everything is simulated in the SVG-era -50..50 unit space, the canvas transform maps it to pixels. */
	const VIEW_UNITS = 100;

	const mass = $derived(radiationManager.mass);
	const instability = $derived(radiationManager.instability);
	const power = $derived(radiationManager.controlRodLevel);
	const accent = $derived.by(() => {
		const themeId = quarksManager.equippedThemes[RealmTypes.RADIATION];
		return (themeId ? getQuarkShopItem(themeId)?.theme?.accent : undefined) ?? DEFAULT_ACCENT;
	});

	const targetNucleonCount = $derived(Math.min(60, Math.max(0, Math.floor(mass / 3))));
	const targetElectronCount = $derived(Math.min(6, Math.max(0, Math.floor(mass / 15))));
	/** 0% power freezes the reactor completely, the rest scales with the slider so the core visibly wakes up as it is raised. */
	const speedMultiplier = $derived(power <= 0 ? 0 : 0.2 + power * 1.3 + instability * 0.5);
	const heat = $derived(mass > 0 ? power * power : 0);
	const visible = $derived(realmManager.selectedRealmId === RealmTypes.RADIATION);

	const nucleons: Nucleon[] = [];
	const electrons: Electron[] = [];
	const particles: RadiationParticle[] = [];
	const fuelParticles: FuelParticle[] = [];
	let coreGlow = 0.3;
	let flash = 0;
	let ringAngle = 0;

	let container = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let ctx: CanvasRenderingContext2D | null = null;
	let pixelSize = 0;
	let ratio = 1;

	/** Radial-gradient glow sprites replace the SVG blur filter: one drawImage per body instead of a per-element filter pass. */
	type Sprite = HTMLCanvasElement;
	let sprites: Record<'accent' | 'electron' | 'neutron' | 'proton' | 'white', Sprite> | null = null;
	let coreGradient: CanvasGradient | null = null;
	let accentRgb: [number, number, number] = [57, 255, 20];
	const SPRITE_PX = 64;

	function makeSprite(r: number, g: number, b: number): Sprite {
		const sprite = document.createElement('canvas');
		sprite.width = SPRITE_PX;
		sprite.height = SPRITE_PX;
		const sctx = sprite.getContext('2d');
		if (!sctx) return sprite;
		const half = SPRITE_PX / 2;
		const gradient = sctx.createRadialGradient(half, half, 0, half, half, half);
		gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
		gradient.addColorStop(0.62, `rgba(${r}, ${g}, ${b}, 0.95)`);
		gradient.addColorStop(0.75, `rgba(${r}, ${g}, ${b}, 0.3)`);
		gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
		sctx.fillStyle = gradient;
		sctx.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
		return sprite;
	}

	function hexToRgb(hex: string): [number, number, number] {
		const value = parseInt(hex.slice(1), 16);
		return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
	}

	function buildSprites(accentHex: string) {
		accentRgb = hexToRgb(accentHex);
		const [r, g, b] = accentRgb;
		sprites = {
			accent: makeSprite(r, g, b),
			electron: makeSprite(0, 200, 255),
			neutron: makeSprite(100, 150, 255),
			proton: makeSprite(255, 100, 100),
			white: makeSprite(255, 255, 255),
		};
		if (!ctx) return;
		coreGradient = ctx.createRadialGradient(-10, -10, 0, 0, 0, 35);
		coreGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`);
		coreGradient.addColorStop(0.5, `rgba(${Math.round(r * 0.3)}, ${Math.round(g * 0.3)}, ${Math.round(b * 0.3)}, 0.25)`);
		coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
	}

	/** The sprite is solid up to the body radius and fades out to 1.5x of it, drawn at 3x the radius to keep the soft halo of the old blur filter. */
	function drawBody(sprite: Sprite, x: number, y: number, radius: number, alpha = 1) {
		if (!ctx) return;
		const size = radius * 3;
		ctx.globalAlpha = alpha;
		ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
	}

	function randomInSphere(maxRadius: number): { x: number; y: number } {
		const angle = Math.random() * Math.PI * 2;
		const r = Math.sqrt(Math.random()) * maxRadius;
		return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
	}

	function createNucleon(): Nucleon {
		const pos = randomInSphere(28);
		const angle = Math.random() * Math.PI * 2;
		const speed = 0.15 + Math.random() * 0.2;
		return {
			size: 3 + Math.random() * 2.5,
			type: Math.random() > 0.5 ? 'proton' : 'neutron',
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			x: pos.x,
			y: pos.y,
		};
	}

	function createElectron(index: number): Electron {
		return {
			angle: Math.random() * Math.PI * 2,
			orbitRadius: 34 + index * 2,
			speed: (0.015 + Math.random() * 0.015) * (index % 2 === 0 ? 1 : -1),
		};
	}

	function spawnRadiationParticle() {
		if (particles.length >= MAX_RADIATION_PARTICLES) return;
		const angle = Math.random() * Math.PI * 2;
		const r = 10 + Math.random() * 20;
		const speed = 0.35 + Math.random() * 0.9;
		particles.push({
			alpha: 0,
			life: 1,
			maxDist: 36 + Math.random() * 6,
			size: 0.8 + Math.random() * 1.5,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			x: Math.cos(angle) * r,
			y: Math.sin(angle) * r,
		});
	}

	function spawnFuelBurst(addedMass: number) {
		const count = 8 + Math.min(24, Math.round(addedMass));
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const r = 46 + Math.random() * 4;
			const speed = 0.9 + Math.random() * 0.9;
			fuelParticles.push({
				size: 1 + Math.random() * 1.2,
				vx: -Math.cos(angle) * speed,
				vy: -Math.sin(angle) * speed,
				x: Math.cos(angle) * r,
				y: Math.sin(angle) * r,
			});
		}
	}

	function updateCounts() {
		if (nucleons.length < targetNucleonCount) {
			const toAdd = Math.min(4, targetNucleonCount - nucleons.length);
			for (let i = 0; i < toAdd; i++) nucleons.push(createNucleon());
		} else if (nucleons.length > targetNucleonCount) {
			nucleons.length = targetNucleonCount;
		}

		if (electrons.length < targetElectronCount) {
			for (let i = electrons.length; i < targetElectronCount; i++) electrons.push(createElectron(i));
		} else if (electrons.length > targetElectronCount) {
			electrons.length = targetElectronCount;
		}

		const intensity = power * 0.8 + instability * 0.4;
		if (mass > 0 && Math.random() < intensity) {
			spawnRadiationParticle();
			if (instability > 0.5 && Math.random() < 0.5) spawnRadiationParticle();
		}
	}

	function step() {
		const maxDist = 30;
		const speed = speedMultiplier;

		for (const n of nucleons) {
			let newX = n.x + n.vx * speed;
			let newY = n.y + n.vy * speed;
			let newVx = n.vx;
			let newVy = n.vy;
			const dist = Math.sqrt(newX * newX + newY * newY);

			if (dist > maxDist) {
				const nx = newX / dist;
				const ny = newY / dist;
				const dot = newVx * nx + newVy * ny;
				newVx -= 2 * dot * nx;
				newVy -= 2 * dot * ny;
				newX = nx * maxDist * 0.95;
				newY = ny * maxDist * 0.95;
			}

			if (Math.random() < 0.08) {
				newVx += (Math.random() - 0.5) * 0.08 * speed;
				newVy += (Math.random() - 0.5) * 0.08 * speed;
			}

			n.vx = newVx;
			n.vy = newVy;
			n.x = newX;
			n.y = newY;
		}

		for (const e of electrons) e.angle += e.speed * speed;

		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.life -= 0.012;
			p.vx *= 0.985;
			p.vy *= 0.985;
			p.x += p.vx;
			p.y += p.vy;

			const dist = Math.hypot(p.x, p.y);
			if (p.life <= 0 || dist >= p.maxDist) {
				particles.splice(i, 1);
				continue;
			}

			const edgeFade = Math.min(1, (p.maxDist - dist) / 9);
			const spawnFade = Math.min(1, (1 - p.life) * 8);
			p.alpha = Math.min(p.life, edgeFade, spawnFade);
		}

		for (let i = fuelParticles.length - 1; i >= 0; i--) {
			const p = fuelParticles[i];
			p.x += p.vx;
			p.y += p.vy;
			if (Math.hypot(p.x, p.y) < 8) {
				fuelParticles.splice(i, 1);
				flash = Math.min(1, flash + 0.15);
			}
		}

		flash *= 0.94;
		ringAngle += (0.05 + power * 0.6) * (Math.PI / 180);
		coreGlow = 0.12 + power * 0.3 + Math.sin(performance.now() / 600) * 0.08 * power + instability * 0.15;
	}

	function draw() {
		if (!ctx || !sprites || pixelSize === 0) return;
		const scale = pixelSize / VIEW_UNITS;
		const currentHeat = heat;
		const [r, g, b] = accentRgb;

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, pixelSize, pixelSize);
		ctx.setTransform(scale, 0, 0, scale, pixelSize / 2, pixelSize / 2);
		ctx.globalAlpha = 1;

		// Outer dashed ring
		ctx.save();
		ctx.rotate(ringAngle);
		ctx.setLineDash([3, 3]);
		ctx.lineWidth = 1;
		ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.1 + currentHeat * 0.3})`;
		ctx.beginPath();
		ctx.arc(0, 0, 44, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();

		// Core sphere
		if (coreGradient) {
			ctx.fillStyle = coreGradient;
			ctx.beginPath();
			ctx.arc(0, 0, 35, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.lineWidth = 0.8 + currentHeat * 0.8;
		ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, 0.15 + currentHeat * 0.5 + flash * 0.5)})`;
		ctx.beginPath();
		ctx.arc(0, 0, 35, 0, Math.PI * 2);
		ctx.stroke();

		// Electron orbits
		ctx.lineWidth = 0.4;
		ctx.strokeStyle = 'rgba(0, 200, 255, 0.08)';
		for (const e of electrons) {
			ctx.beginPath();
			ctx.arc(0, 0, e.orbitRadius, 0, Math.PI * 2);
			ctx.stroke();
		}
		const electronPulse = 0.8 + Math.sin(performance.now() / 100) * 0.2;
		for (const e of electrons) {
			drawBody(sprites.electron, Math.cos(e.angle) * e.orbitRadius, Math.sin(e.angle) * e.orbitRadius, 2, electronPulse);
		}

		for (const n of nucleons) drawBody(n.type === 'proton' ? sprites.proton : sprites.neutron, n.x, n.y, n.size, 0.85);
		for (const p of particles) drawBody(sprites.accent, p.x, p.y, p.size, p.alpha);
		for (const p of fuelParticles) drawBody(sprites.electron, p.x, p.y, p.size, 0.9);

		// Central glow, turns white-hot as the power rises and flashes when fuel lands
		drawBody(sprites.accent, 0, 0, 8 + currentHeat * 4 + flash * 6, Math.min(1, coreGlow + flash * 0.4));
		if (currentHeat > 0.05 || flash > 0.02) {
			drawBody(sprites.white, 0, 0, 4 + currentHeat * 4 + flash * 4, Math.min(1, currentHeat * 0.6 + flash * 0.5));
		}
		ctx.globalAlpha = 1;
	}

	let animationFrame = 0;
	let lastSpawn = 0;

	/** Spawning lives in the frame loop on purpose: a setInterval kept adding particles in background tabs where rAF is paused. */
	function animate(now: number) {
		if (now - lastSpawn >= SPAWN_INTERVAL_MS) {
			lastSpawn = now;
			updateCounts();
		}
		step();
		draw();
		animationFrame = requestAnimationFrame(animate);
	}

	function resizeCanvas() {
		if (!canvas || !container || !ctx) return;
		ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
		const cssSize = Math.min(container.clientWidth, container.clientHeight);
		pixelSize = Math.max(1, Math.round(cssSize * ratio));
		canvas.width = pixelSize;
		canvas.height = pixelSize;
		canvas.style.width = `${cssSize}px`;
		canvas.style.height = `${cssSize}px`;
	}

	onMount(() => {
		if (!canvas || !container) return;
		ctx = canvas.getContext('2d');
		buildSprites(accent);
		resizeCanvas();
		const observer = new ResizeObserver(resizeCanvas);
		observer.observe(container);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (ctx) buildSprites(accent);
	});

	// The realm stays mounted while another one is on screen, animating it then costs a frame for nothing.
	$effect(() => {
		if (!visible || !ctx) return;
		lastSpawn = 0;
		animationFrame = requestAnimationFrame(animate);
		return () => {
			cancelAnimationFrame(animationFrame);
			particles.length = 0;
			fuelParticles.length = 0;
		};
	});

	let seenBombard = 0;
	$effect(() => {
		const { mass: added, seq } = radiationManager.lastBombard;
		if (seq <= seenBombard) return;
		seenBombard = seq;
		if (visible) spawnFuelBurst(added);
	});
</script>

<div class="relative w-full h-full flex flex-col items-center justify-center">
	<div bind:this={container} class="relative w-[90%] aspect-square">
		<canvas bind:this={canvas} class="absolute inset-0 m-auto"></canvas>

		{#if mass <= 0}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center">
					<div class="text-white/30 text-sm font-medium">Empty Core</div>
					<div class="text-white/20 text-xs mt-1">Add fuel to start</div>
				</div>
			</div>
		{/if}
	</div>

	{#if mass > 0}
		<div class="text-center mt-2">
			<div class="text-white/40 text-xs uppercase tracking-wider">{power <= 0 ? 'Core idle' : 'Core Mass'}</div>
			<div class="text-radiation text-xl font-mono font-bold">{mass.toFixed(1)} u</div>
		</div>
	{/if}
</div>
