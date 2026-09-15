import { SKILL_UPGRADES } from '$data/skillTree';
import { gameManager } from '$helpers/GameManager.svelte';
import { PROTONS_ATOMS_REQUIRED } from '$lib/constants';
import type { TooltipPosition } from '$stores/tooltip.svelte';

export interface TutorialStep {
	/** Gates the step: it stays hidden (but the tutorial keeps waiting) until this returns true. */
	condition?: () => boolean;
	description: string;
	id: string;
	placement?: TooltipPosition;
	/** Gates the step until this modal id is the currently open one (e.g. the player opened Protonise themselves). */
	requiresModalOpen?: string;
	targetSelector?: string;
	title: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
	{
		id: 'welcome',
		title: 'Welcome to Atom Clicker!',
		description:
			'Click the atom to produce atoms, spend them on buildings and upgrades, then prestige to grow even faster. Let\'s walk through the basics.',
	},
	{
		id: 'click-atom',
		title: 'Click the Atom',
		description: 'Click the atom to manually produce atoms. Every click counts towards your first buildings.',
		placement: 'right',
		targetSelector: '[data-tutorial-target="atom-click"]',
	},
	{
		id: 'buildings-tab',
		title: 'Buy Buildings',
		description: 'Buildings produce atoms automatically over time. Buy your first one to start automating production.',
		placement: 'bottom',
		targetSelector: '[data-tutorial-target="buildings-tab"]',
	},
	{
		id: 'upgrades-tab',
		title: 'Purchase Upgrades',
		description: 'Upgrades boost your production and click power. Check the Upgrades tab regularly for new ones to buy.',
		placement: 'bottom',
		targetSelector: '[data-tutorial-target="upgrades-tab"]',
	},
	{
		id: 'protonise',
		title: 'Prestige to Grow Faster',
		description: 'Now that you have enough atoms, Protonise to reset your run in exchange for permanent Protons that boost future runs.',
		condition: () => gameManager.atoms >= PROTONS_ATOMS_REQUIRED,
		requiresModalOpen: 'protonise',
	},
	{
		id: 'skill-tree',
		title: 'Skill Tree',
		description: 'Spend skill points earned from building levels on the Skill Tree to unlock passive bonuses and new features.',
		condition: () => {
			const roots = Object.values(SKILL_UPGRADES).filter(s => !s.requires || s.requires.length === 0);
			return roots.some(root => gameManager.canAfford(root.cost)) || gameManager.skillUpgrades.length > 0;
		},
		requiresModalOpen: 'skill-tree',
	},
	{
		id: 'done',
		title: "You're All Set!",
		description: 'That covers the basics. Look for the (?) help icons around the game for more details on specific mechanics. Have fun!',
	},
];
