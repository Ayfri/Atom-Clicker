<script lang="ts">
	import { RealmTypes } from '$data/realms';
	import { radiationManager } from '$helpers/RadiationManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { onDestroy } from 'svelte';

	const mass = $derived(radiationManager.mass);
	const instability = $derived(radiationManager.instability);

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

	let nucleons = $state<Nucleon[]>([]);
	let electrons = $state<Electron[]>([]);
	let particles = $state<RadiationParticle[]>([]);
	// Monotonic, because Date.now() based ids collide when two updateCounts() run in the same millisecond and break the keyed each blocks.
	let nextEntityId = 0;
	let coreGlow = $state(0.3);

	const targetNucleonCount = $derived(Math.min(60, Math.max(0, Math.floor(mass / 3))));
	const targetElectronCount = $derived(Math.min(6, Math.max(0, Math.floor(mass / 15))));
	const speedMultiplier = $derived(0.3 + instability * 1.5);

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
		const speed = (0.15 + Math.random() * 0.2) * speedMultiplier;
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

		// Spawn radiation particles based on mass/instability
		// More frequent spawning
		const intensity = 0.3 + instability * 0.7;
		if (mass > 0 && Math.random() < intensity) {
			spawnRadiationParticle();
			// Chance for double spawn at high instability
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

		coreGlow = 0.25 + Math.sin(Date.now() / 600) * 0.08 + instability * 0.15;

		animationFrame = requestAnimationFrame(animate);
	}

	// The realm stays mounted while another one is on screen, animating it then costs a frame for nothing.
	const visible = $derived(realmManager.selectedRealmId === RealmTypes.RADIATION);

	// Spawning is tied to the same visibility: only `animate` retires particles, so a hidden reactor used to grow the
	// particle array (and its SVG nodes) forever while nobody was looking at it.
	$effect(() => {
		if (!visible) {
			particles = [];
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
				stroke="rgba(57, 255, 20, 0.1)"
				stroke-width="1"
				stroke-dasharray="3 3"
			>
				<animateTransform
					attributeName="transform"
					type="rotate"
					from="0 0 0"
					to="360 0 0"
					dur="25s"
					repeatCount="indefinite"
				></animateTransform>
			</circle>

			<defs>
				<radialGradient
					id="coreGradient"
					cx="30%"
					cy="30%"
				>
					<stop
						offset="0%"
						stop-color="rgba(57, 255, 20, 0.35)"
					></stop>
					<stop
						offset="50%"
						stop-color="rgba(30, 70, 32, 0.25)"
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
				stroke="rgba(57, 255, 20, 0.25)"
				stroke-width="0.8"
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
					fill="rgba(57, 255, 20, {p.alpha})"
					filter="url(#nucleonGlow)"
				></circle>
			{/each}

			<!-- Central glow -->
			<circle
				cx="0"
				cy="0"
				r="8"
				fill="rgba(57, 255, 20, {coreGlow})"
				filter="url(#nucleonGlow)"
			></circle>
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

	<div class="text-center mt-2">
		<div class="text-white/40 text-xs uppercase tracking-wider">Core Mass</div>
		<div class="text-green-400 text-xl font-mono font-bold">{mass.toFixed(1)} u</div>
	</div>
</div>
