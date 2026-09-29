<script lang="ts" module>
	import { skillLinkPath } from '@components/game/SkillEdge.svelte';
	import { SKILL_NODE_SIZE, SKILL_UPGRADES } from '$data/skillTree';
	import type { SkillUpgrade } from '$lib/types';

	const SKILLS = Object.values(SKILL_UPGRADES);

	const LINKS = SKILLS.flatMap(target =>
		(target.requires ?? []).map(source => ({ id: `${source}-${target.id}`, path: skillLinkPath(SKILL_UPGRADES[source], target), source, target })),
	);

	const TREE_BOUNDS = {
		maxX: Math.max(...SKILLS.map(({ position }) => position.x)) + SKILL_NODE_SIZE.width,
		maxY: Math.max(...SKILLS.map(({ position }) => position.y)) + SKILL_NODE_SIZE.height,
		minX: Math.min(...SKILLS.map(({ position }) => position.x)),
		minY: Math.min(...SKILLS.map(({ position }) => position.y)),
	};

	const ROOT_CENTER = {
		x: SKILL_UPGRADES.unlockLevels.position.x + SKILL_NODE_SIZE.width / 2,
		y: SKILL_UPGRADES.unlockLevels.position.y + SKILL_NODE_SIZE.height / 2,
	};

	const depths = new Map<string, number>();
	/** Distance from the root, so the tree lights up from its center outward when it opens. */
	function depthOf(skill: SkillUpgrade): number {
		let depth = depths.get(skill.id);
		if (depth === undefined) {
			depth = skill.requires?.length ? 1 + Math.max(...skill.requires.map(id => depthOf(SKILL_UPGRADES[id]))) : 0;
			depths.set(skill.id, depth);
		}
		return depth;
	}

	/** Background stars stay fixed while the dot grid pans with the tree, which gives the view some depth. */
	const STARS = Array.from({ length: 70 }, () => ({
		delay: Math.random() * 6,
		duration: 3 + Math.random() * 4,
		size: Math.random() < 0.15 ? 2 : 1,
		x: Math.random() * 100,
		y: Math.random() * 100,
	}));

	const DUST = Array.from({ length: 12 }, () => ({
		delay: Math.random() * -20,
		duration: 14 + Math.random() * 12,
		x: Math.random() * 100,
	}));
</script>

<script lang="ts">
	import { LocateFixed, Minus, Plus } from '@lucide/svelte';
	import { dev } from '$app/environment';
	import SkillEdge, { FILL_MS } from '@components/game/SkillEdge.svelte';
	import SkillNode, { type SkillStatus } from '@components/game/SkillNode.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { RealmTypes } from '$data/realms';
	import { SKILL_BRANCH_COLORS } from '$data/skillTree';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import { PanZoom } from '$helpers/PanZoom.svelte';
	import { mobile } from '$stores/window.svelte';
	import { onMount } from 'svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	const SKILL_CURRENCIES: CurrencyName[] = [CurrenciesTypes.ATOMS, CurrenciesTypes.PROTONS, CurrenciesTypes.ELECTRONS, CurrenciesTypes.PHOTONS];

	const panZoom = new PanZoom({ bounds: TREE_BOUNDS, home: { ...ROOT_CENTER, zoom: mobile.current ? 0.6 : 0.8 }, maxZoom: 2, minZoom: 0.15 });

	let showHiddenSkills = $state(false);
	let statuses = $state.raw<Record<string, SkillStatus>>({});
	/** Set when a skill first shows up: skills revealed by a purchase wait for the liquid to reach their parent. */
	const enterDelays = new Map<string, number>();

	function isCurrencyKnown(currency: CurrencyName): boolean {
		return (
			currency === CurrenciesTypes.ATOMS ||
			(currency === CurrenciesTypes.PROTONS && gameManager.canProtonise) ||
			(currency === CurrenciesTypes.ELECTRONS && gameManager.totalElectronizesAllTime > 0) ||
			((currency === CurrenciesTypes.PHOTONS || currency === CurrenciesTypes.EXCITED_PHOTONS || currency === CurrenciesTypes.HIGGS_BOSON) &&
				gameManager.realms[RealmTypes.PHOTONS].unlocked)
		);
	}

	const balances = $derived(SKILL_CURRENCIES.filter(isCurrencyKnown).map(currency => ({ amount: currenciesManager.getAmount(currency), currency })));

	function refresh() {
		const owned = gameManager.skillUpgrades;
		const firstRefresh = enterDelays.size === 0;
		statuses = Object.fromEntries(
			SKILLS.map(skill => {
				const amount = currenciesManager.getAmount(skill.cost.currency);
				const status: SkillStatus = {
					affordable: amount >= skill.cost.amount,
					available: gameManager.canPurchaseSkill(skill),
					conditionMet: skill.condition?.(gameManager) ?? true,
					currencyKnown: isCurrencyKnown(skill.cost.currency),
					owned: owned.includes(skill.id),
					progress: Math.min(1, amount / skill.cost.amount),
					visible: (dev && showHiddenSkills) || owned.includes(skill.id) || !skill.requires?.length || skill.requires.some(id => owned.includes(id)),
				};
				if (status.visible && !enterDelays.has(skill.id)) enterDelays.set(skill.id, firstRefresh ? depthOf(skill) * 70 : FILL_MS + 250);
				return [skill.id, status];
			}),
		);
	}

	function unlock(skill: SkillUpgrade) {
		if (gameManager.purchaseSkill(skill.id)) refresh();
	}

	refresh();
	onMount(() => {
		const interval = setInterval(refresh, 1000);
		return () => clearInterval(interval);
	});
</script>

<Modal {onClose} containerClass="m-2 !p-0 rounded-xl" width="lg">
	{#snippet header()}
		<div class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 pr-10">
			<div class="flex items-center gap-3">
				<h2 class="text-2xl font-bold text-white">Skill Tree</h2>
				<HelpIcon position="bottom">
					{#snippet content()}
						<p class="text-xs text-white/80">
							Spend your currencies here to unlock new mechanics: levels, automation, offline progress and new realms. Skills are
							never lost when you prestige. Nodes require their prerequisites first, and the ring around each icon fills up as you
							save for it.
						</p>
					{/snippet}
				</HelpIcon>
				<div class="flex items-center gap-2 text-sm text-white/60 tabular-nums">
					<div class="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
						<div
							class="h-full origin-left rounded-full bg-yellow-400 transition-transform duration-700"
							style:transform="scaleX({gameManager.skillUpgrades.length / SKILLS.length})"
						></div>
					</div>
					{gameManager.skillUpgrades.length}/{SKILLS.length}
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-3 text-sm font-medium text-white/90">
				{#each balances as { amount, currency } (currency)}
					<Value value={amount} {currency} currencyClass="h-5 w-5" />
				{/each}
			</div>
			{#if dev}
				<button
					class="rounded-lg bg-accent-800 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-accent-700 active:bg-accent-600"
					onclick={() => {
						showHiddenSkills = !showHiddenSkills;
						refresh();
					}}
				>
					{showHiddenSkills ? 'Hide Hidden' : 'Show Hidden'} (Dev)
				</button>
			{/if}
		</div>
	{/snippet}

	<div
		{@attach panZoom.attach}
		class="relative size-full cursor-grab touch-none overflow-hidden rounded-xl bg-[#0b0f14] bg-[radial-gradient(circle_at_50%_8%,rgb(74_144_226/0.16),transparent_45%),radial-gradient(circle_at_8%_55%,rgb(181_123_255/0.16),transparent_45%),radial-gradient(circle_at_50%_100%,rgb(251_146_60/0.12),transparent_45%),radial-gradient(circle_at_92%_40%,rgb(45_212_191/0.12),transparent_45%)] active:cursor-grabbing"
	>
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			{#each STARS as { delay, duration, size, x, y }, i (i)}
				<span
					class="absolute rounded-full bg-white opacity-20 motion-safe:animate-[skill-twinkle_var(--t)_ease-in-out_infinite]"
					style:--t="{duration}s"
					style:animation-delay="{delay}s"
					style:height="{size}px"
					style:left="{x}%"
					style:top="{y}%"
					style:width="{size}px"
				></span>
			{/each}
			{#each DUST as { delay, duration, x }, i (i)}
				<span
					class="absolute -bottom-2 size-1 rounded-full bg-accent-200/40 motion-safe:animate-[skill-drift_var(--t)_linear_infinite] motion-reduce:hidden"
					style:--t="{duration}s"
					style:animation-delay="{delay}s"
					style:left="{x}%"
				></span>
			{/each}
		</div>

		<!-- Dots shrink and fade out with the zoom, a dense grid at low zoom would outshine the tree. -->
		<div
			class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgb(255_255_255/0.12)_var(--dot),transparent_var(--dot))]"
			style:--dot="{Math.max(0.75, 1.5 * panZoom.zoom)}px"
			style:background-position="{panZoom.x}px {panZoom.y}px"
			style:background-size="{40 * panZoom.zoom}px {40 * panZoom.zoom}px"
			style:opacity={Math.min(1, Math.max(0, (panZoom.zoom - 0.2) / 0.6))}
		></div>

		<div class="absolute top-0 left-0 origin-top-left" style:transform="translate({panZoom.x}px, {panZoom.y}px) scale({panZoom.zoom})">
			<svg class="pointer-events-none absolute overflow-visible" height="1" width="1">
				{#each LINKS as { id, path, source, target } (id)}
					{@const status = statuses[target.id]}
					{#if statuses[source].visible && status.visible}
						<SkillEdge
							color={SKILL_BRANCH_COLORS[target.branch]}
							enterDelay={enterDelays.get(target.id) ?? 0}
							{path}
							state={status.owned ? 'owned' : status.available ? 'ready' : 'locked'}
						/>
					{/if}
				{/each}
			</svg>
			{#each SKILLS as skill (skill.id)}
				{@const status = statuses[skill.id]}
				{#if status.visible}
					<SkillNode enterDelay={enterDelays.get(skill.id) ?? 0} onUnlock={() => unlock(skill)} {skill} {status} />
				{/if}
			{/each}
		</div>

		<div class="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg border border-white/10 bg-accent-900/90 text-white/80">
			<button aria-label="Zoom in" class="grid size-10 place-items-center hover:bg-white/10" onclick={() => panZoom.zoomBy(1.25)}>
				<Plus size={18} />
			</button>
			<button aria-label="Zoom out" class="grid size-10 place-items-center hover:bg-white/10" onclick={() => panZoom.zoomBy(0.8)}>
				<Minus size={18} />
			</button>
			<button aria-label="Center the tree" class="grid size-10 place-items-center hover:bg-white/10" onclick={() => panZoom.recenter()}>
				<LocateFixed size={18} />
			</button>
		</div>
	</div>
</Modal>

<style>
	/* Global so the Tailwind `animate-[skill-*]` classes of the tree, its nodes and its links can use them. */

	@keyframes -global-skill-appear {
		from {
			opacity: 0;
		}
	}

	@keyframes -global-skill-badge-in {
		from {
			transform: scale(0);
		}
	}

	@keyframes -global-skill-breathe {
		50% {
			opacity: 0.9;
		}
	}

	@keyframes -global-skill-bubble-pop {
		to {
			opacity: 0;
			transform: scale(2.2);
		}
	}

	@keyframes -global-skill-charge {
		70% {
			transform: scale(1.08) rotate(-4deg);
		}
		80% {
			transform: scale(1.1) rotate(4deg);
		}
		90% {
			transform: scale(1.12) rotate(-4deg);
		}
		100% {
			transform: scale(1.14);
		}
	}

	@keyframes -global-skill-draw {
		from {
			stroke-dashoffset: 1;
		}
	}

	@keyframes -global-skill-drift {
		from {
			opacity: 0;
			transform: translateY(0);
		}
		15%,
		85% {
			opacity: 1;
		}
		to {
			opacity: 0;
			transform: translateY(-85vh);
		}
	}

	@keyframes -global-skill-flash {
		from {
			opacity: 0.6;
		}
		to {
			opacity: 0;
		}
	}

	/* The bright dash riding the liquid's front, its length (0.04) matches the dash array. */
	@keyframes -global-skill-head {
		from {
			stroke-dashoffset: 0.04;
		}
		to {
			stroke-dashoffset: -0.96;
		}
	}

	@keyframes -global-skill-march {
		to {
			stroke-dashoffset: -24;
		}
	}

	@keyframes -global-skill-node-in {
		from {
			opacity: 0;
			transform: scale(0.6) translateY(16px);
		}
	}

	@keyframes -global-skill-pop {
		from {
			transform: scale(1.3);
		}
	}

	@keyframes -global-skill-rise {
		0% {
			opacity: 0;
			transform: translateY(0) scale(1);
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-64px) scale(0.3);
		}
	}

	@keyframes -global-skill-shockwave {
		from {
			opacity: 1;
			transform: scale(0.8);
		}
		to {
			opacity: 0;
			transform: scale(2.8);
		}
	}

	@keyframes -global-skill-spark {
		from {
			opacity: 1;
			transform: rotate(var(--a)) translateX(0);
		}
		to {
			opacity: 0;
			transform: rotate(var(--a)) translateX(var(--d)) scale(0.3);
		}
	}

	@keyframes -global-skill-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes -global-skill-twinkle {
		50% {
			opacity: 0.9;
		}
	}
</style>
