<script lang="ts">
	import HiggsBoson from '#components/icons/HiggsBoson.svelte';
	import { CURRENCIES, CurrenciesTypes } from '#data/currencies.js';
	import { POWER_UPS } from '#data/powerUp.js';
	import { RealmTypes } from '#data/realms.js';
	import { AmbientField } from '#helpers/AmbientField.js';
	import { AtomRenderer } from '#helpers/AtomRenderer.js';
	import { gameManager } from '#helpers/GameManager.svelte.js';
	import { quarksManager } from '#helpers/QuarksManager.svelte.js';
	import type { PowerUp } from '#lib/types.js';
	import { formatNumber, randomBetween, randomValue } from '#lib/utils.js';
	import { onMount } from 'svelte';

	const VISIBLE_DURATION = 25000;
	const FADE_OUT_DURATION = 30000;
	const COLLECT_DURATION = 500;
	const MESSAGE_DURATION = 3000;
	const MARGIN = 100;
	/** Half the label width, keeps the collect label inside the screen on phones. */
	const LABEL_HALF_WIDTH = 150;
	const SPARKS = 10;

	const powerUp = $state({
		description: '',
		duration: 0,
		id: crypto.randomUUID(),
		multiplier: 0,
		name: '',
		startTime: Date.now(),
	} satisfies PowerUp);

	let showBonus = $state(false);
	let phase = $state<'collected' | 'fading' | 'idle'>('idle');
	let messageShown = $state(false);
	/** The label never outlives the boost it announces. */
	const messageDuration = $derived(Math.min(MESSAGE_DURATION, powerUp.duration));
	/** Fractions of the screen rather than pixels, so a bonus spawned in landscape stays on screen after a rotation. */
	let x = $state(0);
	let y = $state(0);

	const left = $derived(`calc(${MARGIN}px + ${x} * (100% - ${MARGIN * 2}px))`);
	const top = $derived(`calc(${MARGIN}px + ${y} * (100dvh - ${MARGIN * 2}px))`);

	let spawnTimeout: ReturnType<typeof setTimeout> | null = null;
	let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
	let disappearTimeout: ReturnType<typeof setTimeout> | null = null;

	function spawnBonusAtom() {
		if (fadeTimeout) clearTimeout(fadeTimeout);
		if (disappearTimeout) clearTimeout(disappearTimeout);

		x = Math.random();
		y = Math.random();

		const randomPowerUp = randomValue(POWER_UPS);
		powerUp.multiplier = randomPowerUp.multiplier * gameManager.powerUpEffectMultiplier;
		powerUp.duration = randomPowerUp.duration * gameManager.powerUpDurationMultiplier;
		powerUp.description = `Atoms ×${formatNumber(powerUp.multiplier)} for ${formatNumber(powerUp.duration / 1000)}s`;
		powerUp.id = crypto.randomUUID();
		powerUp.name = randomPowerUp.name;

		showBonus = true;
		phase = 'idle';

		fadeTimeout = setTimeout(() => {
			if (showBonus) phase = 'fading';
		}, VISIBLE_DURATION);

		disappearTimeout = setTimeout(() => {
			if (showBonus) {
				showBonus = false;
				scheduleNextSpawn();
			}
		}, FADE_OUT_DURATION);
	}

	function onClick(event: MouseEvent) {
		if (phase === 'collected') return;

		phase = 'collected';
		AmbientField.emit(RealmTypes.ATOMS, 'bloom', event, { color: CURRENCIES[CurrenciesTypes.HIGGS_BOSON].color, count: 18, surge: 16, target: AtomRenderer.current?.target() });
		messageShown = true;
		powerUp.startTime = Date.now();
		gameManager.addPowerUp(powerUp);
		gameManager.incrementBonusHiggsBosonClicks();
		quarksManager.collectHiggsBoson();

		setTimeout(() => (messageShown = false), messageDuration);

		if (fadeTimeout) clearTimeout(fadeTimeout);
		if (disappearTimeout) clearTimeout(disappearTimeout);

		setTimeout(() => {
			showBonus = false;
			scheduleNextSpawn();
		}, COLLECT_DURATION);
	}

	function scheduleNextSpawn() {
		if (spawnTimeout) clearTimeout(spawnTimeout);
		spawnTimeout = setTimeout(spawnBonusAtom, randomBetween(gameManager.powerUpInterval[0], gameManager.powerUpInterval[1]));
	}

	function forceSpawn() {
		if (spawnTimeout) clearTimeout(spawnTimeout);
		spawnBonusAtom();
	}

	onMount(() => {
		scheduleNextSpawn();
		return () => {
			if (spawnTimeout) clearTimeout(spawnTimeout);
			if (fadeTimeout) clearTimeout(fadeTimeout);
			if (disappearTimeout) clearTimeout(disappearTimeout);
		};
	});
</script>

<svelte:window onforce-bonus={forceSpawn} />

{#if showBonus}
	<button
		class={[
			'group absolute z-20 size-14 -translate-1/2 cursor-pointer touch-manipulation select-none',
			phase === 'fading' && 'animate-[higgs-fade_5s_ease-in_forwards]',
			phase === 'collected' && 'pointer-events-none',
		]}
		style:left={left}
		style:top={top}
		aria-label="Collect the Higgs Boson"
		onclick={onClick}
	>
		<span
			class={[
				'absolute inset-0',
				phase === 'collected' ?
					'animate-[higgs-collect_500ms_ease-out_forwards]'
				:	'motion-safe:animate-[higgs-spawn_700ms_cubic-bezier(0.2,0.9,0.3,1.4),higgs-float_3.2s_ease-in-out_700ms_infinite]',
			]}
		>
			<span
				class="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgb(251_191_36/0.4),transparent_65%)] motion-safe:animate-[higgs-pulse_1.8s_ease-in-out_infinite]"
			></span>
			<span class="absolute inset-1 rounded-full border border-amber-300/70 opacity-0 motion-safe:animate-[higgs-ripple_2.6s_ease-out_infinite]"></span>
			<span class="absolute inset-1 rounded-full border border-amber-300/70 opacity-0 motion-safe:animate-[higgs-ripple_2.6s_ease-out_1.3s_infinite]"></span>
			<span
				class="absolute inset-0 rounded-full border border-dashed border-amber-200/40 motion-safe:animate-[higgs-spin_14s_linear_infinite_reverse]"
			></span>
			<span
				class={[
					'absolute inset-0 grid place-items-center transition-[scale] duration-200 group-hover:scale-115',
					phase === 'fading' && 'motion-safe:animate-[higgs-blink_0.5s_ease-in-out_infinite]',
				]}
			>
				<span class="motion-safe:animate-[higgs-spin_9s_linear_infinite]">
					<HiggsBoson class="drop-shadow-[0_0_6px_#fbbf24]" size={36} />
				</span>
			</span>
		</span>

		{#if phase === 'collected'}
			<span class="absolute inset-0 rounded-full border-2 border-amber-200 animate-[higgs-shock_500ms_ease-out_forwards]"></span>
			{#each { length: SPARKS }, i (i)}
				<span
					class="absolute left-1/2 top-1/2 size-1.5 -translate-1/2 rounded-full bg-amber-200 animate-[higgs-spark_500ms_ease-out_forwards] motion-reduce:hidden"
					style:--a="{(i * 360) / SPARKS}deg"
				></span>
			{/each}
		{/if}
	</button>
{/if}

{#if messageShown}
	<div
		class="pointer-events-none absolute z-20 w-75 -translate-1/2 text-center drop-shadow-lg motion-safe:animate-[higgs-label_ease-out_forwards]"
		style:animation-duration="{messageDuration}ms"
		style:left="clamp({LABEL_HALF_WIDTH}px, {left}, 100% - {LABEL_HALF_WIDTH}px)"
		style:top={top}
	>
		<p class="font-bold text-amber-300 text-xs tracking-[0.2em] uppercase">{powerUp.name}</p>
		<p class="font-bold text-lg text-white">{powerUp.description}</p>
	</div>
{/if}

<style>
	@keyframes -global-higgs-spawn {
		from {
			opacity: 0;
			transform: scale(0) rotate(-120deg);
		}
	}

	@keyframes -global-higgs-float {
		50% {
			transform: translateY(-5px);
		}
	}

	@keyframes -global-higgs-pulse {
		50% {
			opacity: 0.55;
			transform: scale(0.85);
		}
	}

	@keyframes -global-higgs-ripple {
		from {
			opacity: 0.8;
			transform: scale(0.7);
		}
		to {
			opacity: 0;
			transform: scale(2.2);
		}
	}

	@keyframes -global-higgs-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes -global-higgs-blink {
		50% {
			opacity: 0.35;
		}
	}

	@keyframes -global-higgs-fade {
		to {
			opacity: 0;
		}
	}

	@keyframes -global-higgs-collect {
		to {
			opacity: 0;
			transform: scale(1.7);
		}
	}

	@keyframes -global-higgs-shock {
		from {
			opacity: 1;
			transform: scale(0.6);
		}
		to {
			opacity: 0;
			transform: scale(3.2);
		}
	}

	@keyframes -global-higgs-spark {
		from {
			transform: rotate(var(--a)) translateX(8px);
		}
		to {
			opacity: 0;
			transform: rotate(var(--a)) translateX(48px) scale(0.3);
		}
	}

	@keyframes -global-higgs-label {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.9);
		}
		12%,
		70% {
			opacity: 1;
			transform: none;
		}
		to {
			opacity: 0;
			transform: translateY(-28px);
		}
	}
</style>
