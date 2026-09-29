<script lang="ts" module>
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
	import '@xyflow/svelte/dist/style.css';
	import { Background, BackgroundVariant, Controls, type Edge, type Node, Position, SvelteFlow } from '@xyflow/svelte';
	import { dev } from '$app/environment';
	import SkillEdge, { FILL_MS, type SkillEdgeData } from '@components/game/SkillEdge.svelte';
	import SkillNode, { type SkillNodeData } from '@components/game/SkillNode.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import Value from '@components/ui/Value.svelte';
	import { CurrenciesTypes, type CurrencyName } from '$data/currencies';
	import { RealmTypes } from '$data/realms';
	import { SKILL_BRANCH_COLORS, SKILL_UPGRADES } from '$data/skillTree';
	import { currenciesManager } from '$helpers/CurrenciesManager.svelte';
	import { gameManager } from '$helpers/GameManager.svelte';
	import type { SkillUpgrade } from '$lib/types';
	import { mobile } from '$stores/window.svelte';
	import { onDestroy, onMount } from 'svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let showHiddenSkills = $state(false);

	const edgeTypes = { skill: SkillEdge };
	const nodeTypes = { skill: SkillNode };

	const SKILL_CURRENCIES: CurrencyName[] = [
		CurrenciesTypes.ATOMS,
		CurrenciesTypes.PROTONS,
		CurrenciesTypes.ELECTRONS,
		CurrenciesTypes.PHOTONS,
	];

	const skillList = Object.values(SKILL_UPGRADES);

	/** Distance from the roots, so the tree lights up from its center outward when it opens. */
	const depths = new Map<string, number>();
	function depthOf(skill: SkillUpgrade): number {
		let depth = depths.get(skill.id);
		if (depth === undefined) {
			depth = skill.requires?.length ? 1 + Math.max(...skill.requires.map(req => depthOf(SKILL_UPGRADES[req]))) : 0;
			depths.set(skill.id, depth);
		}
		return depth;
	}

	/** Nodes revealed by a purchase wait for the liquid to reach their parent before appearing. */
	const enterDelays = new Map<string, number>();

	function isCurrencyUnlocked(currency: CurrencyName): boolean {
		return (
			currency === CurrenciesTypes.ATOMS ||
			(currency === CurrenciesTypes.PROTONS && gameManager.canProtonise) ||
			(currency === CurrenciesTypes.ELECTRONS && gameManager.totalElectronizesAllTime > 0) ||
			(currency === CurrenciesTypes.PHOTONS && gameManager.realms[RealmTypes.PHOTONS].unlocked) ||
			(currency === CurrenciesTypes.EXCITED_PHOTONS && gameManager.realms[RealmTypes.PHOTONS].unlocked) ||
			(currency === CurrenciesTypes.HIGGS_BOSON && gameManager.realms[RealmTypes.PHOTONS].unlocked)
		);
	}

	const balances = $derived(
		SKILL_CURRENCIES.filter(isCurrencyUnlocked).map(currency => ({ amount: currenciesManager.getAmount(currency), currency })),
	);
	const ownedShare = $derived(gameManager.skillUpgrades.length / skillList.length);

	let ready = $state(false);
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	function canUnlockSkill(skill: SkillUpgrade): boolean {
		if (!gameManager.skillUpgrades) return false;
		if (gameManager.skillUpgrades.includes(skill.id)) return false;
		if (skill.condition !== undefined && !skill.condition(gameManager)) return false;
		if (skill.requires && !skill.requires.every((req) => gameManager.skillUpgrades?.includes(req))) return false;
		return currenciesManager.getAmount(skill.cost.currency) >= skill.cost.amount;
	}

	function unlockSkill(skill: SkillUpgrade) {
		if (!canUnlockSkill(skill)) return;
		gameManager.purchaseSkill(skill.id);
		updateTree();
	}

	let interval: ReturnType<typeof setInterval>;
	onMount(() => {
		updateTree();
		requestAnimationFrame(() => {
			ready = true;
		});
		interval = setInterval(updateTree, 1000);
	});
	onDestroy(() => clearInterval(interval));

	function updateTree() {
		const unlockedSkills = gameManager.skillUpgrades;
		const firstBuild = enterDelays.size === 0;

		const visibleSkillIds = new Set(
			skillList
				.filter((skill) => {
					if (dev && showHiddenSkills) return true;
					if (unlockedSkills.includes(skill.id)) return true;
					if (!skill.requires || skill.requires.length === 0) return true;
					return skill.requires.some((req) => unlockedSkills.includes(req));
				})
				.map((s) => s.id)
		);

		for (const id of visibleSkillIds) {
			if (!enterDelays.has(id)) enterDelays.set(id, firstBuild ? depthOf(SKILL_UPGRADES[id]) * 70 : FILL_MS + 250);
		}

		const srcHandles = new Map<string, Set<Position>>();
		const tgtHandles = new Map<string, Set<Position>>();
		for (const id of visibleSkillIds) {
			srcHandles.set(id, new Set());
			tgtHandles.set(id, new Set());
		}

		const edgeList: Edge[] = [];
		for (const skill of skillList) {
			if (!visibleSkillIds.has(skill.id)) continue;
			for (const requireId of (skill.requires ?? [])) {
				if (!visibleSkillIds.has(requireId)) continue;
				const req = SKILL_UPGRADES[requireId];
				const diff = { x: skill.position.x - req.position.x, y: skill.position.y - req.position.y };
				const isHoriz = Math.abs(diff.x) > Math.abs(diff.y);
				const [srcDir, tgtDir] = isHoriz
					? diff.x > 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right]
					: diff.y > 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];

				srcHandles.get(requireId)!.add(srcDir);
				tgtHandles.get(skill.id)!.add(tgtDir);

				edgeList.push({
					data: {
						color: SKILL_BRANCH_COLORS[skill.branch],
						enterDelay: enterDelays.get(skill.id)!,
						state: unlockedSkills.includes(skill.id) ? 'owned' : canUnlockSkill(skill) ? 'ready' : 'locked',
					} satisfies SkillEdgeData,
					id: `${requireId}-${skill.id}`,
					source: requireId,
					sourceHandle: `${requireId}-src-${srcDir}`,
					target: skill.id,
					targetHandle: `${skill.id}-tgt-${tgtDir}`,
					type: 'skill',
				});
			}
		}

		nodes = skillList
			.filter((skill) => visibleSkillIds.has(skill.id))
			.map((skill) => ({
				data: {
					...skill,
					affordable: currenciesManager.getAmount(skill.cost.currency) >= skill.cost.amount,
					available: canUnlockSkill(skill),
					color: SKILL_BRANCH_COLORS[skill.branch],
					conditionMet: skill.condition === undefined || skill.condition(gameManager),
					currencyUnlocked: isCurrencyUnlocked(skill.cost.currency),
					enterDelay: enterDelays.get(skill.id)!,
					onUnlock: () => unlockSkill(skill),
					progress: Math.min(1, currenciesManager.getAmount(skill.cost.currency) / skill.cost.amount),
					sourceHandles: Array.from(srcHandles.get(skill.id) ?? []),
					targetHandles: Array.from(tgtHandles.get(skill.id) ?? []),
					unlocked: unlockedSkills.includes(skill.id),
				} satisfies SkillNodeData,
				height: 160,
				id: skill.id,
				position: { ...skill.position },
				type: 'skill',
				width: 340,
			}));

		edges = edgeList;
	}
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
							style:transform="scaleX({ownedShare})"
						></div>
					</div>
					{gameManager.skillUpgrades.length}/{skillList.length}
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
						updateTree();
					}}
				>
					{showHiddenSkills ? 'Hide Hidden' : 'Show Hidden'} (Dev)
				</button>
			{/if}
		</div>
	{/snippet}

	<div
		class="relative size-full overflow-hidden rounded-xl bg-[#0b0f14] bg-[radial-gradient(circle_at_50%_8%,rgb(74_144_226/0.16),transparent_45%),radial-gradient(circle_at_8%_55%,rgb(181_123_255/0.16),transparent_45%),radial-gradient(circle_at_50%_100%,rgb(251_146_60/0.12),transparent_45%),radial-gradient(circle_at_92%_40%,rgb(45_212_191/0.12),transparent_45%)]"
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

		{#if ready}
			<SvelteFlow
				{edges}
				{edgeTypes}
				{nodes}
				{nodeTypes}
				colorMode="dark"
				elementsSelectable={false}
				initialViewport={{ x: mobile.current ? 100 : 500, y: 200, zoom: 0.8 }}
				maxZoom={2}
				minZoom={0.15}
				nodesConnectable={false}
				nodesDraggable={false}
				panOnScroll={false}
				preventScrolling={true}
				translateExtent={[[-10000, -10000], [10000, 10000]]}
				zoomOnPinch={true}
				zoomOnScroll={true}
			>
				<Background bgColor="transparent" gap={40} patternColor="rgb(255 255 255 / 0.12)" size={1.5} variant={BackgroundVariant.Dots} />
				{#if !mobile.current}
					<Controls showZoom={true} showFitView={false} showLock={false} position="bottom-right" />
				{/if}
			</SvelteFlow>
		{:else}
			<div class="flex h-full min-h-96 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent-400 border-t-transparent"></div>
			</div>
		{/if}
	</div>
</Modal>

<style>
	:global(.svelte-flow) {
		--xy-background-color: transparent;
		--xy-controls-button-background-color: var(--color-accent-800);
		--xy-controls-button-border-color: var(--color-accent-800);
		--xy-controls-button-color: var(--color-accent-50);
		--xy-attribution-background-color-default: transparent;
	}

	:global(.svelte-flow__attribution) {
		display: none;
	}

	/* Global so the Tailwind `animate-[skill-*]` classes of the tree, its nodes and its edges can use them. */

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
