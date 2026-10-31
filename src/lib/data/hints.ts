import { CHROMATIC, CHROMATIC_COLORS } from '#data/chromatic.js';
import { SPECTROSCOPE_ID } from '#data/cosmos.js';
import { CurrenciesTypes } from '#data/currencies.js';
import { ELEMENT_GENERATOR_PERCENT, ELEMENTS, FAMILY_IDS, GENERATOR_ELEMENTS, SET_BONUS } from '#data/elements.js';
import { FeatureTypes } from '#data/features.js';
import { GENERATOR_TYPES, GENERATORS } from '#data/generators.js';
import { APP_REWARD_QUARKS } from '#data/quarks.js';
import { RealmTypes, type RealmType } from '#data/realms.js';
import { SITE_IDS } from '#data/sites.js';
import { SKILL_UPGRADES } from '#data/skillTree.js';
import { chromaticManager } from '#helpers/ChromaticManager.svelte.js';
import { cosmosManager } from '#helpers/CosmosManager.svelte.js';
import { currenciesManager } from '#helpers/CurrenciesManager.svelte.js';
import { gameManager } from '#helpers/GameManager.svelte.js';
import { periodicManager, TUNING_DEFAULT } from '#helpers/PeriodicManager.svelte.js';
import { radiationManager } from '#helpers/RadiationManager.svelte.js';
import { realmManager } from '#helpers/RealmManager.svelte.js';
import { reveals } from '#helpers/reveals.svelte.js';
import { APP_PRODUCTION_PERCENT, ELECTRONS_PROTONS_REQUIRED, PROTONS_ATOMS_REQUIRED } from '#lib/constants.js';
import { installStore } from '#stores/install.svelte.js';
import { photonUpgradesTab } from '#stores/photonUpgradesTab.svelte.js';
import type { TooltipPosition } from '#stores/tooltip.svelte.js';
import { ui } from '#stores/ui.svelte.js';

type HintScope = RealmType | 'cosmos' | 'table';

export interface Hint {
	/** A button that runs `run` and replaces "Got it", the hint is done by `done` as usual. */
	action?: { label: string; run: () => void };
	/** The action that teaches the hint, it is marked seen as soon as this holds, even if it was never displayed. Without it the hint shows a "Got it" button. */
	done?: () => boolean;
	/** `realm:name`, the realm prefix also scopes the replay buttons. */
	id: string;
	placement?: TooltipPosition;
	/** Only shown while this realm, or the Cosmos above them, fills the screen. */
	realm: HintScope;
	/** Draws a circular halo instead of a rounded rectangle around the target. */
	round?: boolean;
	/** When the hint becomes relevant. */
	show?: () => boolean;
	/** Candidate targets, the first one currently visible wins. Without targets the hint is a card docked at the bottom. */
	targets?: string[];
	text: string;
	title: string;
}

/** In-game time before the install hint shows up, an hour in means the player came to stay. */
const INSTALL_HINT_PLAY_MS = 3_600_000;
const SKILL_TREE_ROOTS = Object.values(SKILL_UPGRADES).filter(skill => !skill.requires || skill.requires.length === 0);
const AFFINITY_ELEMENTS = [...new Set(Object.values(GENERATOR_ELEMENTS).flat())];
const FAMILY_MEMBERS = FAMILY_IDS.map(family => ELEMENTS.filter(element => element.family === family).map(element => element.z));

/** Identified members of each family. */
const familyProgress = () => FAMILY_MEMBERS.map(members => ({ lit: members.filter(z => periodicManager.identifiedSet.has(z)).length, size: members.length }));

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
		targets: ['#upgrades-list [data-hint="upgrade"]', '[data-hint="upgrades-tab"]'],
		text: 'Upgrades boost your clicks and generators. Grab one whenever you can afford it.',
		title: 'Upgrades',
	},
	{
		done: () => gameManager.overdriveActive.length > 0,
		id: 'atoms:overdrive',
		placement: 'left',
		realm: RealmTypes.ATOMS,
		show: () => gameManager.features[FeatureTypes.OVERDRIVE],
		targets: ['[data-hint="overdrive"]', '[data-hint="generators-tab"]'],
		text: "Overdrive doubles a generator's output for 1 Higgs Boson every 5 minutes. It stays on while your Higgs Bosons last.",
		title: 'Overdrive',
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
	{
		done: () => realmManager.tableOpen,
		id: 'atoms:table',
		placement: 'right',
		realm: RealmTypes.ATOMS,
		show: () => periodicManager.introSeen && periodicManager.ready.length > 0,
		targets: ['#nav-periodic-table'],
		text: 'An element is ready in the Periodic Table. Open it from here, whatever realm you are in.',
		title: 'An element is ready',
	},
	{
		id: 'atoms:affinity',
		placement: 'left',
		realm: RealmTypes.ATOMS,
		show: () => periodicManager.unlocked && AFFINITY_ELEMENTS.some(z => periodicManager.identifiedSet.has(z)),
		targets: ['[data-hint="generator-elements"]'],
		text: `Every element you identify boosts the generators made of it, +${ELEMENT_GENERATOR_PERCENT}% each.`,
		title: 'Element affinities',
	},
	{
		action: { label: 'Show me', run: () => ui.openSettings('install') },
		done: () => gameManager.installedApp || installStore.installed || (ui.activeModalId === 'settings' && ui.activeTab === 'install'),
		id: 'atoms:install',
		placement: 'right',
		realm: RealmTypes.ATOMS,
		show: () => gameManager.inGameTime >= INSTALL_HINT_PLAY_MS && installStore.canInstall,
		targets: ['#nav-settings'],
		text: `Install Atom Clicker as an app: playing from it gives +${APP_PRODUCTION_PERCENT}% production, and ${APP_REWARD_QUARKS} Quarks to your account.`,
		title: 'Play from the app',
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
	{
		done: () => realmManager.cosmosOpen,
		id: 'radiation:cosmos',
		placement: 'left',
		realm: RealmTypes.RADIATION,
		show: () => cosmosManager.unlocked,
		targets: ['#cosmos-entry'],
		text: 'Your first Ionize lit up the sky above the realms. Look up into the Cosmos from here, whatever realm you are in.',
		title: 'The Cosmos',
	},
	{
		done: () => cosmosManager.discovered.length > 0,
		id: 'cosmos:observe',
		placement: 'top',
		realm: 'cosmos',
		round: true,
		targets: ['[data-hint="cosmos-reticle"]'],
		text: 'Drag the sky to keep the signal inside the reticle until its ring fills.',
		title: 'Observe',
	},
	{
		done: () => Object.keys(cosmosManager.studies).length > 0,
		id: 'cosmos:study',
		placement: 'top',
		realm: 'cosmos',
		show: () => cosmosManager.discovered.length > 0,
		targets: ['[data-hint="cosmos-study"]', '[data-hint="cosmos-sky"]'],
		text: 'Every object in your sky radiates Starlight. Study one to raise its Starlight and its boost to the realms.',
		title: 'Study',
	},
	{
		done: () => cosmosManager.instruments.length > 0,
		id: 'cosmos:instrument',
		placement: 'top',
		realm: 'cosmos',
		show: () =>
			cosmosManager.apertureMaxed && cosmosManager.nextInstrument !== null && currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) >= cosmosManager.nextInstrument.cost,
		targets: ['[data-hint="cosmos-instrument"]', '[data-hint="cosmos-sky"]'],
		text: 'A better instrument reveals a new batch of the sky, and a new way to observe it.',
		title: 'Instruments',
	},
	{
		done: () => periodicManager.unlocked,
		id: 'cosmos:spectroscope',
		placement: 'top',
		realm: 'cosmos',
		show: () =>
			cosmosManager.apertureMaxed &&
			cosmosManager.nextInstrument?.id === SPECTROSCOPE_ID &&
			currenciesManager.getAmount(CurrenciesTypes.STARLIGHT) >= cosmosManager.nextInstrument.cost,
		targets: ['[data-hint="cosmos-instrument"]', '[data-hint="cosmos-sky"]'],
		text: 'Starlight carries the fingerprint of what made it. A spectroscope can read it.',
		title: 'Spectroscope',
	},
	{
		done: () => realmManager.tableOpen || periodicManager.identified.length > 0,
		id: 'cosmos:table',
		placement: 'bottom',
		realm: 'cosmos',
		show: () => periodicManager.introSeen,
		targets: ['[data-hint="cosmos-table"]'],
		text: 'The Periodic Table lives here and in the menu. Open it whenever an element is ready.',
		title: 'The Periodic Table',
	},
	{
		done: () => periodicManager.identified.length > 0,
		id: 'table:identify',
		placement: 'left',
		realm: 'table',
		round: true,
		show: () => periodicManager.ready.length > 0,
		targets: ['[data-hint="table-stage"]'],
		text: "Helium was read in the Sun's light before anyone found it on Earth. Hold a forged atom to pour Light in and read it.",
		title: 'Read the light',
	},
	{
		done: () => Object.values(periodicManager.sites).some(forge => forge && forge.level > 0),
		id: 'table:forge',
		placement: 'bottom',
		realm: 'table',
		show: () => periodicManager.identified.length > 0,
		targets: ['[data-hint="table-forges"]'],
		text: 'Each source in the sky makes its elements on its own, one after the other. Study a source with Starlight to make them faster.',
		title: 'Synthesis',
	},
	{
		id: 'table:waiting',
		placement: 'bottom',
		realm: 'table',
		show: () => Object.values(periodicManager.statuses).some(status => status.kind === 'waiting' && status.missing.length > 0),
		targets: ['[data-hint="table-waiting"]'],
		text: 'This source needs an element another source makes first. It resumes on its own.',
		title: 'Waiting on another source',
	},
	{
		done: () => periodicManager.identified.length >= 5,
		id: 'table:lamp',
		placement: 'bottom',
		realm: 'table',
		show: () => periodicManager.identified.length > 0 && Object.values(periodicManager.lampLight).some(rate => rate > 0),
		targets: ['[data-hint="table-lights"]'],
		text: 'An element you can read, you can also make glow. Each identified element now adds its own Light.',
		title: 'Lamps',
	},
	{
		done: () => familyProgress().some(({ lit, size }) => lit === size),
		id: 'table:families',
		placement: 'top',
		realm: 'table',
		show: () => familyProgress().some(({ lit }) => lit >= 2),
		targets: ['[data-hint="table-family"]'],
		text: `Elements of a family add up their bonus. Read the whole family to multiply it by ${SET_BONUS}.`,
		title: 'Families',
	},
	{
		id: 'table:sources',
		placement: 'bottom',
		realm: 'table',
		show: () => periodicManager.identified.length >= 5 && SITE_IDS.some(id => !periodicManager.open.has(id)),
		targets: ['[data-hint="table-locked"]'],
		text: 'More sources hide in the sky. Each one opens when you discover the object that makes it, or identify the elements it is built from.',
		title: 'Sources to find',
	},
	{
		done: () => periodicManager.tuning !== TUNING_DEFAULT,
		id: 'table:tuning',
		placement: 'bottom',
		realm: 'table',
		show: () => periodicManager.tuned,
		targets: ['[data-hint="table-tuning"]'],
		text: "Slide the window over an element's lines. Those lines cost 5x less Light.",
		title: 'Tuning',
	},
	{
		done: () => periodicManager.identified.some(z => !ELEMENTS[z - 1].lines.length),
		id: 'table:decay',
		placement: 'bottom',
		realm: 'table',
		show: () => periodicManager.ready.some(z => !ELEMENTS[z - 1].lines.length),
		targets: ['[data-hint="table-decay"]'],
		text: "Nobody has ever seen this element's light. It's identified by how it decays.",
		title: 'Decay',
	},
];
