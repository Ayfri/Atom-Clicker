import { CHROMATIC, CHROMATIC_COLORS } from '#data/chromatic.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { FeatureTypes } from '#data/features.js';
import { GENERATOR_TYPES, GENERATORS } from '#data/generators.js';
import { RealmTypes, type RealmType } from '#data/realms.js';
import { SKILL_UPGRADES } from '#data/skillTree.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import { realmManager } from '#helpers/RealmManager.svelte.js';
import { reveals } from '#helpers/reveals.svelte.js';
import { ELECTRONS_PROTONS_REQUIRED, PROTONS_ATOMS_REQUIRED } from '#lib/constants.js';
import { photonUpgradesTab } from '#stores/photonUpgradesTab.svelte.js';
import type { TooltipPosition } from '#stores/tooltip.svelte.js';
import { ui } from '#stores/ui.svelte.js';

export interface Hint {
	/** The action that teaches the hint, it is marked seen as soon as this holds, even if it was never displayed. Without it the hint shows a "Got it" button. */
	done?: () => boolean;
	/** `realm:name`, the realm prefix also scopes the replay buttons. */
	id: string;
	placement?: TooltipPosition;
	/** Only shown while this realm is selected. */
	realm: RealmType;
	/** Draws a circular halo instead of a rounded rectangle around the target. */
	round?: boolean;
	/** When the hint becomes relevant. */
	show?: () => boolean;
	/** Candidate targets, the first one currently visible wins. Without targets the hint is a card docked at the bottom. */
	targets?: string[];
	text: string;
	title: string;
}

const SKILL_TREE_ROOTS = Object.values(SKILL_UPGRADES).filter(skill => !skill.requires || skill.requires.length === 0);

const realmHint = (realm: RealmType, title: string): Hint => ({
	done: () => realmManager.selectedRealmId === realm,
	id: `atoms:realm-${realm}`,
	placement: 'left',
	realm: RealmTypes.ATOMS,
	show: () => gameManager.realms[realm]?.unlocked === true,
	targets: [`#realm-${realm}`],
	text: 'A new realm just opened. Switch between realms here at any time.',
	title,
});

/** Shown one at a time in this order, the first pending one stays until it completes. */
export const HINTS: Hint[] = [
	{
		done: () => gameManager.totalClicksAllTime >= 10 || gameManager.totalGeneratorsPurchasedAllTime > 0,
		id: 'atoms:click',
		placement: 'bottom',
		realm: RealmTypes.ATOMS,
		round: true,
		targets: ['[data-hint="atom"]'],
		text: 'Click the atom to create your first Atoms.',
		title: 'Welcome to Atom Clicker!',
	},
	{
		done: () => gameManager.totalGeneratorsPurchasedAllTime > 0,
		id: 'atoms:generator',
		placement: 'left',
		realm: RealmTypes.ATOMS,
		show: () => gameManager.canAfford(GENERATORS[GENERATOR_TYPES[0]].cost),
		targets: ['#generators-list > button:not([hidden])', '[data-hint="generators-tab"]'],
		text: 'Generators create Atoms on their own, every second. Buy your first one!',
		title: 'Automate it',
	},
	{
		done: () => gameManager.totalUpgradesPurchasedAllTime > 0,
		id: 'atoms:upgrade',
		placement: 'right',
		realm: RealmTypes.ATOMS,
		show: () => reveals.upgrades,
		targets: ['#upgrades-list button', '[data-hint="upgrades-tab"]'],
		text: 'Upgrades boost your clicks and generators. Grab one whenever you can afford it.',
		title: 'Upgrades',
	},
	{
		done: () => ui.activeModalId === 'protonise' || gameManager.totalProtonisesAllTime > 0,
		id: 'atoms:protonise',
		placement: 'right',
		realm: RealmTypes.ATOMS,
		show: () => gameManager.atoms >= PROTONS_ATOMS_REQUIRED,
		targets: ['#nav-protonise'],
		text: 'Reset this run in exchange for Protons, a permanent boost to every future run.',
		title: 'Time to Protonize',
	},
	{
		done: () => ui.activeModalId === 'skill-tree' || gameManager.skillUpgrades.length > 0,
		id: 'atoms:skill-tree',
		placement: 'right',
		realm: RealmTypes.ATOMS,
		show: () => SKILL_TREE_ROOTS.some(root => gameManager.canAfford(root.cost)),
		targets: ['#nav-skill-tree'],
		text: 'The Skill Tree unlocks new mechanics like levels, automation and new realms, and you keep them forever.',
		title: 'Skill Tree',
	},
	{
		done: () => ui.activeModalId === 'boosts',
		id: 'atoms:boosts',
		placement: 'right',
		realm: RealmTypes.ATOMS,
		show: () => gameManager.boostPointsAvailable > 0,
		targets: ['#nav-boosts'],
		text: 'Every generator level earns a boost point, spend them here to boost a currency until your next reset.',
		title: 'Boosts',
	},
	{
		done: () => ui.activeModalId === 'collider',
		id: 'atoms:collider',
		placement: 'right',
		realm: RealmTypes.ATOMS,
		show: () => gameManager.features[FeatureTypes.COLLIDER],
		targets: ['#nav-collider'],
		text: 'Every player feeds this ring. Inject a particle once a minute to raise the production of everyone, you included.',
		title: 'The Collider',
	},
	{
		done: () => ui.activeModalId === 'electronize' || gameManager.totalElectronizesAllTime > 0,
		id: 'atoms:electronize',
		placement: 'right',
		realm: RealmTypes.ATOMS,
		show: () => gameManager.protons >= ELECTRONS_PROTONS_REQUIRED,
		targets: ['#nav-electronize'],
		text: 'A deeper reset: trade your Protons for Electrons and their own upgrades.',
		title: 'Electronize',
	},
	realmHint(RealmTypes.PHOTONS, 'The Photon Realm'),
	realmHint(RealmTypes.RADIATION, 'The Radiation Realm'),
	{
		done: () => gameManager.currencies[CurrenciesTypes.PHOTONS].earnedAllTime > 0,
		id: 'photons:intro',
		placement: 'bottom',
		realm: RealmTypes.PHOTONS,
		targets: ['[data-photon-realm]'],
		text: 'Click the floating circles to collect Photons, and keep an eye out, not everything that falls is quite so ordinary.',
		title: 'The Photon Realm',
	},
	{
		done: () => photonUpgradesTab.selected === CurrenciesTypes.EXCITED_PHOTONS,
		id: 'photons:excited-photons',
		placement: 'bottom',
		realm: RealmTypes.PHOTONS,
		show: () => gameManager.currencies[CurrenciesTypes.EXCITED_PHOTONS].earnedAllTime > 0,
		targets: ['[data-hint="excited-photons-tab"]'],
		text: 'That glow was no accident. Excited Photons have their own tab full of stronger upgrades.',
		title: 'Excited Photons',
	},
	{
		done: () => CHROMATIC_COLORS.some(color => chromaticManager.kills[color] > 0),
		id: 'photons:chromatic',
		placement: 'bottom',
		realm: RealmTypes.PHOTONS,
		show: () => gameManager.totalIonizesAllTime > 0,
		targets: ['[data-photon-realm]'],
		text: 'The Prism splits light into Red, Green and Blue photons. They are tougher, tap them several times to break them.',
		title: 'Colored Photons',
	},
	{
		done: () => Object.keys(chromaticManager.upgradeLevels).length > 0,
		id: 'photons:prism',
		placement: 'bottom',
		realm: RealmTypes.PHOTONS,
		show: () => CHROMATIC_COLORS.some(color => currenciesManager.getAmount(CHROMATIC[color].currency) >= 10),
		targets: ['[data-hint="prism-tab"]'],
		text: 'Each color pays its own Light. Spend it in the Prism tab to break them faster.',
		title: 'The Prism',
	},
	{
		done: () => currenciesManager.getEarnedAllTime(CurrenciesTypes.WHITE_LIGHT) > 0,
		id: 'photons:white-light',
		placement: 'bottom',
		realm: RealmTypes.PHOTONS,
		show: () => chromaticManager.recombinable > 0,
		targets: ['[data-hint="prism-recombine"]', '[data-hint="prism-tab"]'],
		text: 'Red, Green and Blue add up to White. Recombine them into White Light, which buys the strongest boosts.',
		title: 'White Light',
	},
	{
		done: () => radiationManager.mass > 0,
		id: 'radiation:intro',
		placement: 'top',
		realm: RealmTypes.RADIATION,
		targets: ['[data-hint="radiation-fuel"]'],
		text: 'A dormant reactor, waiting for fuel. Turn Electrons into core mass here and see what wakes up.',
		title: 'The Radiation Realm',
	},
	{
		id: 'radiation:fuel',
		placement: 'bottom',
		realm: RealmTypes.RADIATION,
		show: () => radiationManager.controlRodLevel > 0,
		targets: ['[data-hint="radiation-mass"]'],
		text: 'Fuel burns while the power is up, and nothing refills it until the Breeder Reactor upgrade. Watch the burn rate so the core never runs dry.',
		title: 'Core Fuel',
	},
	{
		id: 'radiation:stability',
		placement: 'top',
		realm: RealmTypes.RADIATION,
		show: () => radiationManager.stableControlLevel > 0,
		targets: ['[data-hint="radiation-lever"]'],
		text: 'The ∞ mark is the power your regen keeps up with. The core burns a share of its fuel, so more fuel lowers the mark. Above it, the core shrinks until burn and regen meet.',
		title: 'Steady Power',
	},
	{
		done: () => Object.keys(radiationManager.upgradeLevels).length > 0,
		id: 'radiation:upgrades',
		placement: 'top',
		realm: RealmTypes.RADIATION,
		show: () => radiationManager.currentCpm >= 10,
		targets: ['[data-hint="radiation-upgrades"]'],
		text: 'The reactor has room to grow. What exactly improves is best discovered by browsing.',
		title: 'Reactor Upgrades',
	},
	{
		done: () => ui.activeModalId === 'ionize' || gameManager.totalIonizesAllTime > 0,
		id: 'radiation:ionize',
		placement: 'right',
		realm: RealmTypes.RADIATION,
		show: () => radiationManager.currentCpm >= radiationManager.ionizeCpm || radiationManager.ionizeReady,
		targets: ['#nav-ionize'],
		text: 'The core is past the ionization line. Hold it there for a full minute, then Ionize here.',
		title: 'Ionize',
	},
];
