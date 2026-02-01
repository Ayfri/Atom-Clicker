<script lang="ts">
	import '@xyflow/svelte/dist/style.css';
	import { Background, Controls, type Edge, type Node, Position, SvelteFlow } from '@xyflow/svelte';
	import SkillNode from '@components/game/SkillNode.svelte';
	import Modal from '@components/ui/Modal.svelte';
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

	const nodeTypes = { skill: SkillNode };

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
		interval = setInterval(updateTree, 300);
	});
	onDestroy(() => clearInterval(interval));

	function updateTree() {
		nodes = Object.values(SKILL_UPGRADES).map((skill) => ({
			id: skill.id,
			type: 'skill',
			position: { ...skill.position },
			data: {
				...skill,
				unlocked: gameManager.skillUpgrades.includes(skill.id),
				available: canUnlockSkill(skill)
			}
		}));

		edges = Object.values(SKILL_UPGRADES).flatMap((skill) =>
			(skill.requires ?? []).map<Edge>((requireId) => {
				const req = SKILL_UPGRADES[requireId];
				const diff = { x: skill.position.x - req.position.x, y: skill.position.y - req.position.y };
				const isHoriz = Math.abs(diff.x) > Math.abs(diff.y);
				const [srcDir, tgtDir] = isHoriz
					? diff.x > 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right]
					: diff.y > 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];

				return {
					id: `${requireId}-${skill.id}`,
					source: requireId,
					target: skill.id,
					sourceHandle: `${requireId}-${srcDir}`,
					targetHandle: `${skill.id}-${tgtDir}`,
					type: 'smoothstep',
					class: canUnlockSkill(skill) || gameManager.skillUpgrades.includes(skill.id) ? 'unlocking' : ''
				};
			})
		);
	}
</script>

<Modal {onClose} containerClass="m-2 !p-0 rounded-xl" width="lg">
	{#snippet header()}
		<div class="flex w-full items-center justify-between">
			<h2 class="text-2xl font-bold text-white">Skill Tree</h2>
		</div>
	{/snippet}

	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		colorMode="dark"
		minZoom={0.3}
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
