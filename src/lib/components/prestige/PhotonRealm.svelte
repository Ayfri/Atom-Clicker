<script lang="ts">
	import { CurrenciesTypes } from '$data/currencies';
	import { FeatureTypes } from '$data/features';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { calculateEffects, getUpgradesWithEffects } from '$helpers/effects';
	import { createClickParticleSync, type Particle } from '$helpers/particles';
	import { formatNumber } from '$lib/utils';
	import { addParticles } from '$stores/canvas';
	import { mobile } from '$stores/window.svelte';
	import PhotonCounter from '@components/prestige/PhotonCounter.svelte';
	import PhotonUpgrades from '@components/prestige/PhotonUpgrades.svelte';
	import Currency from '@components/ui/Currency.svelte';
	import { onMount } from 'svelte';

	export function simulateClick() {
		if (!container || circles.length === 0) return;

		// Filter valid targets
		const allowExcited = (gameManager.photonUpgrades['excited_auto_click'] || 0) > 0;
		const validCircles = circles.filter(c => allowExcited || c.type !== 'excited');

		if (validCircles.length === 0) return;

		// Get a random circle from our valid circles array
		const randomCircle = validCircles[Math.floor(Math.random() * validCircles.length)];

		// Get the container's position to calculate absolute coordinates
		const containerRect = container.getBoundingClientRect();
		const absoluteX = containerRect.left + randomCircle.x;
		const absoluteY = containerRect.top + randomCircle.y;

		// Create a synthetic mouse event with the circle's coordinates
		const event = new MouseEvent('click', {
			clientX: absoluteX,
			clientY: absoluteY,
			bubbles: true
		});

		// Trigger the click directly on the circle
		clickCircle(randomCircle, event);
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

	let circles: Circle[] = $state([]);
	let nextId = 0;
	let container = $state<HTMLDivElement>();
	let lastUpdateTime = Date.now();

	// Base values - will be modified by upgrades
	let baseSpawnRate = 2000;
	let baseCircleLifetime = 5000;
	let baseSizeMultiplier = 1;

	const MAX_CIRCLES = 100;
	const MIN_SIZE = 30;
	const MAX_SIZE = 80;
	const MIN_PHOTONS = 1;
	const MAX_PHOTONS = 10;

	function getSizeMultiplier() {
		const options = { type: 'photon_size' as const };
		const upgrades = getUpgradesWithEffects(gameManager.allEffectSources, options);
		return calculateEffects(upgrades, gameManager, baseSizeMultiplier, options);
	}

	function getPhotonValueBonus() {
		const upgrade = gameManager.allEffectSources.find(u => u.id === 'photon_value');
		if (!upgrade) return 0;
		return calculateEffects([upgrade], gameManager, 0, { type: 'click' });
	}

	function getExcitedFromMaxBonus() {
		const options = { type: 'excited_photon_from_max' as const };
		const upgrades = getUpgradesWithEffects(gameManager.allEffectSources, options);
		return calculateEffects(upgrades, gameManager, 0, options);
	}

	function getLifetimeBonus() {
		const upgrade = gameManager.allEffectSources.find(u => u.id === 'circle_lifetime');
		if (!upgrade) return 0;
		return calculateEffects([upgrade], gameManager, 0, { type: 'photon_duration' });
	}

	function getExcitedLifetimeMultiplier() {
		const options = { type: 'excited_photon_duration' as const };
		const upgrades = getUpgradesWithEffects(gameManager.allEffectSources, options);
		return calculateEffects(upgrades, gameManager, 1, options);
	}

	function getDoubleChance() {
		const options = { type: 'photon_double_chance' as const };
		const upgrades = getUpgradesWithEffects(gameManager.allEffectSources, options);
		return calculateEffects(upgrades, gameManager, 0, options);
	}

	function getExcitedDoubleChance() {
		const options = { type: 'excited_photon_double' as const };
		const upgrades = getUpgradesWithEffects(gameManager.allEffectSources, options);
		return calculateEffects(upgrades, gameManager, 0, options);
	}

	function getIsExcited() {
		return Math.random() < gameManager.excitedPhotonChance;
	}

	function getCircleValue(circle: Circle) {
		const amount = circle.photons;
		const type = circle.type === 'excited' ? 'excited_photon_stability' : 'photon_stability';
		const upgrades = getUpgradesWithEffects(gameManager.allEffectSources, { type });
		return Math.floor(calculateEffects(upgrades, gameManager, amount, { type }));
	}

	function spawnCircle() {
		if (!container) return;

		const rect = container.getBoundingClientRect();
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
			x: Math.random() * (rect.width - margin * 2) + margin,
			y: Math.random() * (rect.height - margin * 2) + margin,
			size: baseSize * sizeMultiplier,
			photons: Math.floor(finalPhotons),
			lifetime: 0,
			maxLifetime: maxLifetime,
			rotation: Math.random() * 360,
			type: isExcited ? 'excited' : 'normal',
			baseValue: isExcited ? 1 : 1
		};

		circles = [...circles, circle];
		// Limit the number of circles to 100
		circles = circles.slice(0, MAX_CIRCLES);
	}

	function clickCircle(circle: Circle, event: MouseEvent) {
		const baseAmount = getCircleValue(circle);

		if (circle.type === 'excited') {
			const amount = baseAmount * gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.EXCITED_PHOTONS);
			currenciesManager.add(CurrenciesTypes.EXCITED_PHOTONS, amount);
		} else {
			const amount = baseAmount * gameManager.getCurrencyBoostMultiplier(CurrenciesTypes.PHOTONS);
			currenciesManager.add(CurrenciesTypes.PHOTONS, amount);
		}

		circles = circles.filter((c) => c.id !== circle.id);

		const particleCount = Math.floor(circle.photons / 2) + 1;
		const addedParticles: Particle[] = [];
		const currencyType = circle.type === 'excited' ? CurrenciesTypes.EXCITED_PHOTONS : CurrenciesTypes.PHOTONS;

		for (let i = 0; i < particleCount; i++) {
			const particle = createClickParticleSync(event.clientX, event.clientY, currencyType);
			if (particle) addedParticles.push(particle);
		}
		if (addedParticles.length > 0) {
			addParticles(addedParticles);
		}

		// Excited stabilization: interacting with the realm resets/collapses it
		const excitedStabilizationLevel = gameManager.photonUpgrades['excited_stabilization'] || 0;
		if (excitedStabilizationLevel > 0) {
			const isAuto = !event.isTrusted;
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

		circles = circles
			.map((circle) => ({
				...circle,
				lifetime: circle.lifetime + deltaTime
			}))
			.filter((circle) => circle.lifetime < circle.maxLifetime);
	}

	// Update circles logic
	$effect(() => {
		lastUpdateTime = Date.now();
		const interval = setInterval(updateCircles, 16);
		return () => clearInterval(interval);
	});

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

	const opacity = $derived((circle: Circle) => Math.max(0, 1 - circle.lifetime / circle.maxLifetime));
	const scale = $derived((circle: Circle) => {
		const fadeInDuration = 150; // 0.15s
		if (circle.lifetime < fadeInDuration) {
			return circle.lifetime / fadeInDuration;
		}
		return 1;
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
				{#each circles as circle (circle.id)}
					<button
						class="absolute cursor-pointer flex items-center justify-center rounded-full"
						onclick={(event) => clickCircle(circle, event)}
						onpointerenter={(event) => {
							if (gameManager.features[FeatureTypes.HOVER_COLLECTION]) {
								clickCircle(circle, event);
							}
						}}
						style="
							height: {circle.size}px;
							left: {circle.x}px;
							opacity: {opacity(circle)};
							top: {circle.y}px;
							transform: translate(-50%, -50%) scale({scale(circle)});
							width: {circle.size}px;
						"
					>
						<div class="w-full h-full {circle.type === 'excited' ? 'animate-pulse' : ''}">
							<Currency
								name={circle.type === 'excited' ? CurrenciesTypes.EXCITED_PHOTONS : CurrenciesTypes.PHOTONS}
								class="w-full h-full object-contain drop-shadow-[0_0_10px_{circle.type === 'excited' ? 'rgba(255,215,0,0.8)' : 'rgba(139,69,191,0.5)'}]"
								style="transform: rotate({circle.rotation}deg);"
							/>
						</div>
						<span
							class="absolute font-bold text-xs pointer-events-none drop-shadow-[0_0_5px_rgba(0,0,0,0.8)] {circle.type === 'excited' ? 'text-[#FFD700]' : 'text-white'}"
						>
							+{formatNumber(getCircleValue(circle))}
						</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Upgrades Area - Right side (1/3 on desktop, full width on mobile) -->
		<div class="w-full lg:w-1/3 lg:max-w-xs">
			<PhotonUpgrades />
		</div>
	</div>
</div>
