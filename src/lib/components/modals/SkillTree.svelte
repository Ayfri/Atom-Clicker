<script lang="ts">
	import '@xyflow/svelte/dist/style.css';
	import { Background, Controls, type Edge, type Node, Position, SvelteFlow } from '@xyflow/svelte';
	import { dev } from '$app/environment';
	import SkillNode from '@components/game/SkillNode.svelte';
	import HelpIcon from '@components/ui/HelpIcon.svelte';
	import Modal from '@components/ui/Modal.svelte';
	import { CurrenciesTypes } from '$data/currencies';
	import { RealmTypes } from '$data/realms';
	import { SKILL_UPGRADES } from '$data/skillTree';
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

	const nodeTypes = { skill: SkillNode };

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
		const skillList = Object.values(SKILL_UPGRADES);
		const unlockedSkills = gameManager.skillUpgrades;

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
					id: `${requireId}-${skill.id}`,
					source: requireId,
					target: skill.id,
					sourceHandle: `${requireId}-src-${srcDir}`,
					targetHandle: `${skill.id}-tgt-${tgtDir}`,
					type: 'smoothstep',
					class: canUnlockSkill(skill) || unlockedSkills.includes(skill.id) ? 'unlocking' : ''
				});
			}
		}

		nodes = skillList
			.filter((skill) => visibleSkillIds.has(skill.id))
			.map((skill) => {
				const currency = skill.cost.currency;
				const currencyUnlocked =
					currency === CurrenciesTypes.ATOMS ||
					(currency === CurrenciesTypes.PROTONS && gameManager.canProtonise) ||
					(currency === CurrenciesTypes.ELECTRONS && gameManager.totalElectronizesAllTime > 0) ||
					(currency === CurrenciesTypes.PHOTONS && gameManager.realms[RealmTypes.PHOTONS].unlocked) ||
					(currency === CurrenciesTypes.EXCITED_PHOTONS && gameManager.realms[RealmTypes.PHOTONS].unlocked) ||
					(currency === CurrenciesTypes.HIGGS_BOSON && gameManager.realms[RealmTypes.PHOTONS].unlocked);

				const unlocked = unlockedSkills.includes(skill.id);
				const effectBreakdown = unlocked && skill.effects.length > 0
					? skill.effects.map(effect => {
						const result = effect.apply(1, gameManager);
						return {
							description: effect.description,
							percentChange: (result - 1) * 100,
							type: effect.type,
						};
					})
					: null;

				return {
					id: skill.id,
					type: 'skill',
					position: { ...skill.position },
					width: 288,
					height: 144,
					data: {
						...skill,
						available: canUnlockSkill(skill),
						conditionMet: skill.condition === undefined || skill.condition(gameManager),
						currencyUnlocked,
						effectBreakdown,
						sourceHandles: Array.from(srcHandles.get(skill.id) ?? []),
						targetHandles: Array.from(tgtHandles.get(skill.id) ?? []),
						unlocked,
					}
				};
			});

		edges = edgeList;
	}
</script>

<Modal {onClose} containerClass="m-2 !p-0 rounded-xl" width="lg">
	{#snippet header()}
		<div class="flex w-full items-center justify-between gap-4 pr-10">
			<div class="flex items-center gap-2">
				<h2 class="text-2xl font-bold text-white">Skill Tree</h2>
				<HelpIcon position="bottom">
					{#snippet content()}
						<p class="text-xs text-white/80">
							Skill points are earned by leveling up buildings. Spend them here to unlock nodes that grant permanent passive
							bonuses or new features. Nodes require their prerequisites to be unlocked first, and the currency shown on each node
							is the cost to unlock it.
						</p>
					{/snippet}
				</HelpIcon>
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

	{#if ready}
		<SvelteFlow
			{nodes}
			{edges}
			{nodeTypes}
			colorMode="dark"
			minZoom={0.15}
			maxZoom={2}
			initialViewport={{ x: mobile.current ? 100 : 500, y: 200, zoom: 0.8 }}
			translateExtent={[[-10000, -10000], [10000, 10000]]}
			elementsSelectable={false}
			nodesConnectable={false}
			nodesDraggable={false}
			panOnScroll={false}
			preventScrolling={true}
			zoomOnPinch={true}
			zoomOnScroll={true}
			onnodeclick={({ node }) => unlockSkill(node.data as unknown as SkillUpgrade)}
		>
			<Background gap={35} lineWidth={1} />
			{#if !mobile.current}
				<Controls showZoom={true} showFitView={false} showLock={false} position="bottom-right" />
			{/if}
		</SvelteFlow>
	{:else}
		<div class="flex h-full min-h-96 items-center justify-center">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent-400 border-t-transparent"></div>
		</div>
	{/if}
</Modal>

<style>
	:global(.svelte-flow) {
		--background-color: transparent;
		--xy-background-color: var(--color-accent-900);
		--xy-edge-stroke: var(--color-accent-800);
		--xy-edge-stroke-width: 5;
		--xy-controls-button-background-color: var(--color-accent-800);
		--xy-controls-button-border-color: var(--color-accent-800);
		--xy-controls-button-color: var(--color-accent-50);
		--xy-attribution-background-color-default: transparent;
	}

	:global(.svelte-flow__edge.unlocking path) {
		--xy-edge-stroke: var(--color-accent-400);
	}

	:global(.svelte-flow__attribution) {
		display: none;
	}
</style>
