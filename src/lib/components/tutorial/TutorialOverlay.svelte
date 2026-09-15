<script lang="ts">
	import { REALM_TUTORIALS } from '$data/realmTutorials';
	import { TUTORIAL_STEPS } from '$data/tutorialSteps';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { realmManager } from '$helpers/RealmManager.svelte';
	import { ui } from '$stores/ui.svelte';
	import { highlightCurrencies } from '$lib/utils/highlightCurrencies';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import { fade } from 'svelte/transition';

	const tutorial = $derived(gameManager.tutorialManager);
	const step = $derived(TUTORIAL_STEPS[tutorial.state.step]);
	const isLastStep = $derived(tutorial.state.step === TUTORIAL_STEPS.length - 1);

	// Gated steps (e.g. "open Protonise for the first time") stay pending until their
	// condition/modal requirement is met, instead of blocking play with a forced Next click.
	const stepReady = $derived.by(() => {
		if (!step) return false;
		if (step.condition && !step.condition()) return false;
		if (step.requiresModalOpen && ui.activeModalId !== step.requiresModalOpen) return false;
		return true;
	});

	// Each realm can have several sequential steps (e.g. Radiation: intro -> fuel -> power ->
	// upgrades). They fire the moment the player switches into an unlocked realm and reaches each
	// step's own condition, independently of the main walkthrough (which realm it is, or whether
	// that walkthrough is even still active/completed). Steps are shown in array order: the first
	// one not yet seen whose condition (if any) currently holds.
	const pendingRealmStep = $derived.by(() => {
		const realmId = realmManager.selectedRealmId;
		const steps = REALM_TUTORIALS[realmId];
		if (!steps || !gameManager.realms[realmId]?.unlocked) return null;
		const nextStep = steps.find(s => !tutorial.hasSeenRealmStep(realmId, s.id) && (!s.condition || s.condition()));
		return nextStep ? { realmId, step: nextStep } : null;
	});

	function dismissRealmStep() {
		if (!pendingRealmStep) return;
		gameManager.tutorialManager.markRealmStepSeen(pendingRealmStep.realmId, pendingRealmStep.step.id);
	}

	let targetRect = $state<DOMRect | null>(null);
	let calloutElement = $state<HTMLDivElement>();
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	function updateTargetRect() {
		if (!stepReady || !step?.targetSelector) {
			targetRect = null;
			return;
		}
		const el = document.querySelector(step.targetSelector);
		targetRect = el ? el.getBoundingClientRect() : null;
	}

	$effect(() => {
		if (!tutorial.state.active) {
			if (pollInterval) clearInterval(pollInterval);
			pollInterval = null;
			return;
		}

		// Re-read reactive deps inside the effect so target changes are tracked
		step;
		stepReady;
		updateTargetRect();

		if (pollInterval) clearInterval(pollInterval);
		pollInterval = setInterval(updateTargetRect, 200);

		return () => {
			if (pollInterval) clearInterval(pollInterval);
			pollInterval = null;
		};
	});

	function next() {
		gameManager.tutorialManager.next(TUTORIAL_STEPS.length);
	}

	function skip() {
		gameManager.tutorialManager.skip();
	}

	const margin = 16;

	// Clamp the highlight ring itself to the viewport so a huge target (e.g. a full-height panel)
	// never pushes the anchor point for the callout off-screen.
	const visibleTargetRect = $derived.by(() => {
		if (!targetRect) return null;
		const viewportWidth = innerWidth.current ?? window.innerWidth;
		const viewportHeight = innerHeight.current ?? window.innerHeight;

		const left = Math.max(0, targetRect.left);
		const top = Math.max(0, targetRect.top);
		const right = Math.min(viewportWidth, targetRect.right);
		const bottom = Math.min(viewportHeight, targetRect.bottom);

		return { bottom, left, right, top, height: Math.max(0, bottom - top), width: Math.max(0, right - left) };
	});

	const calloutPosition = $derived.by(() => {
		if (!visibleTargetRect || !calloutElement) return { left: margin, top: margin };

		const placement = step?.placement ?? 'bottom';
		const viewportWidth = innerWidth.current ?? window.innerWidth;
		const viewportHeight = innerHeight.current ?? window.innerHeight;
		const calloutRect = calloutElement.getBoundingClientRect();
		const target = visibleTargetRect;

		let left = target.left + target.width / 2 - calloutRect.width / 2;
		let top = target.bottom + margin;

		switch (placement) {
			case 'top':
				top = target.top - calloutRect.height - margin;
				break;
			case 'left':
				left = target.left - calloutRect.width - margin;
				top = target.top + target.height / 2 - calloutRect.height / 2;
				break;
			case 'right':
				left = target.right + margin;
				top = target.top + target.height / 2 - calloutRect.height / 2;
				break;
		}

		// Always clamp fully inside the viewport, regardless of the preferred placement,
		// so the callout can never render partially or fully off-screen.
		left = Math.max(margin, Math.min(left, viewportWidth - calloutRect.width - margin));
		top = Math.max(margin, Math.min(top, viewportHeight - calloutRect.height - margin));

		return { left, top };
	});
</script>

{#snippet stepCounter()}
	<div class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
		Step {tutorial.state.step + 1} / {TUTORIAL_STEPS.length}
	</div>
{/snippet}

{#if pendingRealmStep}
	<div
		class="fixed inset-0 z-99999 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
		transition:fade={{ duration: 200 }}
	>
		<div class="w-full max-w-md rounded-2xl border border-white/10 bg-linear-to-br from-accent-900 to-accent-800 p-6 shadow-2xl">
			<h2 class="text-xl font-bold text-white">{pendingRealmStep.step.title}</h2>
			<p class="mt-2 text-sm text-white/70">{@html highlightCurrencies(pendingRealmStep.step.description)}</p>
			<div class="mt-6 flex justify-end">
				<button
					class="rounded-lg bg-accent-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-400"
					onclick={dismissRealmStep}
				>
					Got it
				</button>
			</div>
		</div>
	</div>
{:else if tutorial.state.active && step && stepReady}
	{#if targetRect}
		<div class="fixed inset-0 z-99998 pointer-events-none overflow-hidden" transition:fade={{ duration: 200 }}>
			<div
				class="absolute rounded-xl ring-4 ring-accent-400 transition-all duration-300"
				style="left: {targetRect.left - 6}px; top: {targetRect.top - 6}px; width: {targetRect.width + 12}px; height: {targetRect.height +
					12}px; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);"
			></div>
		</div>

		<div
			bind:this={calloutElement}
			class="fixed z-99999 w-80 max-w-[calc(100vw-2rem)] pointer-events-auto rounded-xl border border-white/10 bg-accent-950/95 p-4 shadow-2xl backdrop-blur-md"
			style="left: {calloutPosition.left}px; top: {calloutPosition.top}px;"
			transition:fade={{ duration: 200 }}
		>
			{@render stepCounter()}
			<h3 class="text-base font-bold text-white">{step.title}</h3>
			<p class="mt-1.5 text-sm text-white/70">{@html highlightCurrencies(step.description)}</p>
			<div class="mt-4 flex items-center justify-between">
				<button class="text-xs font-semibold text-white/40 hover:text-white transition-colors" onclick={skip}>Skip tutorial</button>
				<button
					class="rounded-lg bg-accent-500 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-400"
					onclick={next}
				>
					{isLastStep ? 'Finish' : 'Next'}
				</button>
			</div>
		</div>
	{:else}
		<div
			class="fixed inset-0 z-99999 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
			transition:fade={{ duration: 200 }}
		>
			<div class="w-full max-w-md rounded-2xl border border-white/10 bg-linear-to-br from-accent-900 to-accent-800 p-6 shadow-2xl">
				{@render stepCounter()}
				<h2 class="text-xl font-bold text-white">{step.title}</h2>
				<p class="mt-2 text-sm text-white/70">{@html highlightCurrencies(step.description)}</p>
				<div class="mt-6 flex items-center justify-between">
					<button class="text-xs font-semibold text-white/40 hover:text-white transition-colors" onclick={skip}>Skip tutorial</button>
					<button
						class="rounded-lg bg-accent-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-400"
						onclick={next}
					>
						{isLastStep ? "Let's Go!" : 'Start Tutorial'}
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
