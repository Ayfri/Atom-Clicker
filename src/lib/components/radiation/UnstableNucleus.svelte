<script lang="ts">
	import { RealmTypes } from '$data/realms';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { onDestroy } from 'svelte';

	const mass = $derived(radiationManager.mass);
	const instability = $derived(radiationManager.instability);
	const power = $derived(radiationManager.controlRodLevel);

	// Core nucleons (Protons/Neutrons only)
	interface Nucleon {
		id: number;
		type: 'proton' | 'neutron';
		size: number;
		vx: number;
		vy: number;
		x: number;
		y: number;
	}

	// Floating radiation particles
	interface RadiationParticle {
		alpha: number;
		id: number;
		life: number;
		maxDist: number;
		size: number;
		vx: number;
		vy: number;
		x: number;
		y: number;
	}

	// Electron orbit
	interface Electron {
		angle: number;
		id: number;
		orbitRadius: number;
		speed: number;
	}

	/** Electrons flying in from the ring when fuel is added, absorbed once they reach the core. */
	interface FuelParticle {
		id: number;
		size: number;
		vx: number;
		vy: number;
		x: number;
		y: number;
	}

	let nucleons = $state<Nucleon[]>([]);
	let electrons = $state<Electron[]>([]);
	let particles = $state<RadiationParticle[]>([]);
	let fuelParticles = $state<FuelParticle[]>([]);
	// Monotonic, because Date.now() based ids collide when two updateCounts() run in the same millisecond and break the keyed each blocks.
	let nextEntityId = 0;
	let coreGlow = $state(0.3);
	let flash = $state(0);
	let ringAngle = $state(0);

	const targetNucleonCount = $derived(Math.min(60, Math.max(0, Math.floor(mass / 3))));
	const targetElectronCount = $derived(Math.min(6, Math.max(0, Math.floor(mass / 15))));
	/** 0% power freezes the reactor completely, the rest scales with the slider so the core visibly wakes up as it is raised. */
	const speedMultiplier = $derived(power <= 0 ? 0 : 0.2 + power * 1.3 + instability * 0.5);
	const heat = $derived(mass > 0 ? power * power : 0);

	function randomInSphere(maxRadius: number): { x: number; y: number } {
		const angle = Math.random() * Math.PI * 2;
		const r = Math.sqrt(Math.random()) * maxRadius;
		return {
			x: Math.cos(angle) * r,
			y: Math.sin(angle) * r,
		};
	}

	function createNucleon(id: number): Nucleon {
		const pos = randomInSphere(28);
		const angle = Math.random() * Math.PI * 2;
		const speed = 0.15 + Math.random() * 0.2;
		return {
			id,
			type: Math.random() > 0.5 ? 'proton' : 'neutron',
			size: 3 + Math.random() * 2.5,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			x: pos.x,
			y: pos.y,
		};
	}

	function createElectron(id: number): Electron {
		return {
			angle: Math.random() * Math.PI * 2,
			id,
			orbitRadius: 34 + id * 2,
			speed: (0.015 + Math.random() * 0.015) * (id % 2 === 0 ? 1 : -1),
		};
	}

	function spawnRadiationParticle() {
		const angle = Math.random() * Math.PI * 2;
		const r = 10 + Math.random() * 20; // Start inside core
		const speed = 0.35 + Math.random() * 0.9;
		particles.push({
			alpha: 0,
			id: nextEntityId++,
			life: 1.0,
			maxDist: 36 + Math.random() * 6, // Stay inside the r=44 ring so nothing reaches the panel border
			size: 0.8 + Math.random() * 1.5, // Smaller: 0.8-2.3
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
				id: nextEntityId++,
				size: 1 + Math.random() * 1.2,
				vx: -Math.cos(angle) * speed,
				vy: -Math.sin(angle) * speed,
				x: Math.cos(angle) * r,
				y: Math.sin(angle) * r,
			});
		}
		fuelParticles = [...fuelParticles];
	}

	function updateCounts() {
		// Nucleons
		const currentN = nucleons.length;
		if (currentN < targetNucleonCount) {
			const toAdd = Math.min(4, targetNucleonCount - currentN);
			for (let i = 0; i < toAdd; i++) {
				nucleons.push(createNucleon(nextEntityId++));
			}
			nucleons = [...nucleons]; // Trigger reactivity
		} else if (currentN > targetNucleonCount) {
			nucleons = nucleons.slice(0, targetNucleonCount);
		}

		// Electrons
		const currentE = electrons.length;
		if (currentE < targetElectronCount) {
			for (let i = currentE; i < targetElectronCount; i++) {
				electrons.push(createElectron(i));
			}
			electrons = [...electrons];
		} else if (currentE > targetElectronCount) {
			electrons = electrons.slice(0, targetElectronCount);
		}

		const intensity = power * 0.8 + instability * 0.4;
		if (mass > 0 && Math.random() < intensity) {
			spawnRadiationParticle();
			if (instability > 0.5 && Math.random() < 0.5) {
				spawnRadiationParticle();
			}
		}
	}

	let animationFrame: number;

	/** Entities are mutated in place: rebuilding the three arrays every frame churned ~100 objects per frame for the GC. */
	function animate() {
		const maxDist = 30;

		for (const n of nucleons) {
			let newX = n.x + n.vx * speedMultiplier;
			let newY = n.y + n.vy * speedMultiplier;
			let newVx = n.vx;
			let newVy = n.vy;

			const dist = Math.sqrt(newX * newX + newY * newY);

			if (dist > maxDist) {
				const nx = newX / dist;
				const ny = newY / dist;
				const dot = newVx * nx + newVy * ny;
				newVx = newVx - 2 * dot * nx;
				newVy = newVy - 2 * dot * ny;
				newX = nx * maxDist * 0.95;
				newY = ny * maxDist * 0.95;
			}

			if (Math.random() < 0.08) {
				newVx += (Math.random() - 0.5) * 0.08 * speedMultiplier;
				newVy += (Math.random() - 0.5) * 0.08 * speedMultiplier;
			}

			n.vx = newVx;
			n.vy = newVy;
			n.x = newX;
			n.y = newY;
		}

		for (const e of electrons) e.angle += e.speed * speedMultiplier;

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

			/** Particles dissolve over the last units before their own radius, otherwise they get visibly clipped by the SVG frame. */
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
		ringAngle += 0.05 + power * 0.6;
		coreGlow = 0.12 + power * 0.3 + Math.sin(Date.now() / 600) * 0.08 * power + instability * 0.15;

		animationFrame = requestAnimationFrame(animate);
	}

	let seenBombard = 0;
	$effect(() => {
		const { mass: added, seq } = radiationManager.lastBombard;
		if (seq <= seenBombard) return;
		seenBombard = seq;
		if (visible) spawnFuelBurst(added);
	});

	// The realm stays mounted while another one is on screen, animating it then costs a frame for nothing.
	const visible = $derived(realmManager.selectedRealmId === RealmTypes.RADIATION);

	// Spawning is tied to the same visibility: only `animate` retires particles, so a hidden reactor used to grow the
	// particle array (and its SVG nodes) forever while nobody was looking at it.
	$effect(() => {
		if (!visible) {
			particles = [];
			fuelParticles = [];
			return;
		}

		const syncInterval = setInterval(updateCounts, 200);
		animationFrame = requestAnimationFrame(animate);

		return () => {
			clearInterval(syncInterval);
			cancelAnimationFrame(animationFrame);
		};
	});

	onDestroy(() => cancelAnimationFrame(animationFrame));
</script>

<div class="relative w-full h-full flex flex-col items-center justify-center">
	<div class="relative w-[90%] aspect-square">
		<svg
			viewBox="-50 -50 100 100"
			class="w-full h-full"
		>
			<!-- Outer ring -->
			<circle
				cx="0"
				cy="0"
				r="44"
				fill="none"
				stroke="var(--color-radiation)"
				stroke-opacity={0.1 + heat * 0.3}
				stroke-width="1"
				stroke-dasharray="3 3"
				transform="rotate({ringAngle})"
			></circle>

			<defs>
				<radialGradient
					id="coreGradient"
					cx="30%"
					cy="30%"
				>
					<stop
						offset="0%"
						stop-color="var(--color-radiation)"
						stop-opacity="0.35"
					></stop>
					<stop
						offset="50%"
						stop-color="color-mix(in srgb, var(--color-radiation) 30%, black)"
						stop-opacity="0.25"
					></stop>
					<stop
						offset="100%"
						stop-color="rgba(0, 0, 0, 0.15)"
					></stop>
				</radialGradient>
				<filter id="nucleonGlow">
					<feGaussianBlur
						stdDeviation="0.8"
						result="blur"
					></feGaussianBlur>
					<feMerge>
						<feMergeNode in="blur"></feMergeNode>
						<feMergeNode in="SourceGraphic"></feMergeNode>
					</feMerge>
				</filter>
			</defs>

			<!-- Core sphere -->
			<circle
				cx="0"
				cy="0"
				r="35"
				fill="url(#coreGradient)"
				stroke="var(--color-radiation)"
				stroke-opacity={0.15 + heat * 0.5 + flash * 0.5}
				stroke-width={0.8 + heat * 0.8}
			></circle>

			<!-- Electron orbits -->
			{#each electrons as electron (electron.id)}
				{@const ex = Math.cos(electron.angle) * electron.orbitRadius}
				{@const ey = Math.sin(electron.angle) * electron.orbitRadius}
				<circle
					cx="0"
					cy="0"
					r={electron.orbitRadius}
					fill="none"
					stroke="rgba(0, 200, 255, 0.08)"
					stroke-width="0.4"
				></circle>
				<circle
					cx={ex}
					cy={ey}
					r="2"
					fill="rgba(0, 200, 255, 0.85)"
					filter="url(#nucleonGlow)"
				>
					<animate
						attributeName="opacity"
						values="0.6;1;0.6"
						dur="0.6s"
						repeatCount="indefinite"
					></animate>
				</circle>
			{/each}

			<!-- Nucleons (Protons/Neutrons) -->
			{#each nucleons as nucleon (nucleon.id)}
				<circle
					cx={nucleon.x}
					cy={nucleon.y}
					r={nucleon.size}
					fill={nucleon.type === 'proton' ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 150, 255, 0.8)'}
					filter="url(#nucleonGlow)"
				></circle>
			{/each}

			<!-- Floating Green Particles -->
			{#each particles as p (p.id)}
				<circle
					cx={p.x}
					cy={p.y}
					r={p.size}
					fill="var(--color-radiation)"
					fill-opacity={p.alpha}
					filter="url(#nucleonGlow)"
				></circle>
			{/each}

			<!-- Incoming fuel -->
			{#each fuelParticles as p (p.id)}
				<circle
					cx={p.x}
					cy={p.y}
					r={p.size}
					fill="rgba(0, 200, 255, 0.9)"
					filter="url(#nucleonGlow)"
				></circle>
			{/each}

			<!-- Central glow, turns white-hot as the power rises and flashes when fuel lands -->
			<circle
				cx="0"
				cy="0"
				r={8 + heat * 4 + flash * 6}
				fill="var(--color-radiation)"
				fill-opacity={coreGlow + flash * 0.4}
				filter="url(#nucleonGlow)"
			></circle>
			{#if heat > 0.05 || flash > 0.02}
				<circle
					cx="0"
					cy="0"
					r={4 + heat * 4 + flash * 4}
					fill="white"
					fill-opacity={heat * 0.6 + flash * 0.5}
					filter="url(#nucleonGlow)"
				></circle>
			{/if}
		</svg>

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
