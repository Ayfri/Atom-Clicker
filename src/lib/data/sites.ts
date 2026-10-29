import { ELEMENTS, elementBySymbol, LORE, zs, type Element } from '#data/elements.js';

export type SiteId = 'accelerator' | 'bigbang' | 'cosmic' | 'decay' | 'lowmass' | 'massive' | 'neutron' | 'reactor' | 'whitedwarf';

export interface Site {
	color: string;
	/** What opens it, shown while it is locked. */
	gate: string;
	glyph: string;
	name: string;
	/** Cosmos object whose discovery opens it. */
	object?: string;
	/** Elements whose identification opens it, for the sites no Cosmos object gates. */
	opensWith?: string;
	short: string;
}

export interface Seed {
	/** Elements forged elsewhere first. */
	needs: number[];
	/** Cosmos object to discover first. */
	object?: string;
	why: string;
}

export interface Chain {
	/** Z → what must happen before that step can start. */
	seeds: Record<number, Seed>;
	steps: number[];
}

export const SITES: Record<SiteId, Site> = {
	accelerator: { color: '#8a93a6', gate: 'Identify fermium', glyph: '⊕', name: 'Accelerator', opensWith: 'Fm', short: 'Accelerator' },
	bigbang: { color: '#9db8ff', gate: 'Given', glyph: '☀', name: 'Big Bang', short: 'Big Bang' },
	cosmic: { color: '#6ff0c4', gate: 'Find the cosmic rays', glyph: '⇶', name: 'Cosmic rays', object: 'cosmic_rays', short: 'Cosmic rays' },
	decay: { color: '#c6f36b', gate: 'Identify uranium and thorium', glyph: '☢', name: 'Radioactive decay', opensWith: 'U Th', short: 'Decay' },
	lowmass: { color: '#ffb36b', gate: 'Discover Mira', glyph: '⬤', name: 'Dying low-mass stars', object: 'mira', short: 'Red giants' },
	massive: { color: '#ff6b8b', gate: 'Discover the Crab Nebula', glyph: '✸', name: 'Exploding massive stars', object: 'crab_nebula', short: 'Supernovae' },
	neutron: { color: '#b98aff', gate: 'Detect the GW170817 kilonova', glyph: '✺', name: 'Merging neutron stars', object: 'kilonova', short: 'Kilonova' },
	reactor: { color: '#8a93a6', gate: 'Identify uranium', glyph: '⚛', name: 'Reactor', opensWith: 'U', short: 'Reactor' },
	whitedwarf: { color: '#e6ecff', gate: "Discover Tycho's Supernova", glyph: '◎', name: 'Exploding white dwarfs', object: 'tycho', short: 'White dwarfs' },
};

export const SITE_IDS = Object.keys(SITES) as SiteId[];

/** Beam then target of each element's discovery reaction, both forged elsewhere first. */
const BEAMS: Record<string, string> = {
	Bh: 'Cr Bi', Cn: 'Zn Pb', Db: 'N Cf', Ds: 'Ni Pb', Fl: 'Ca Pu', Hs: 'Fe Pb', Lr: 'B Cf', Lv: 'Ca Cm', Mc: 'Ca Am', Md: 'He Es', Mt: 'Fe Bi', Nh: 'Zn Bi',
	No: 'Ne U', Og: 'Ca Cf', Rf: 'C Cf', Rg: 'Ni Bi', Sg: 'O Cf', Ts: 'Ca Bk',
};

const ACCELERATED = ELEMENTS.slice(100);

/**
 * Each site forges the elements it makes most of in Johnson's data, except by design Li (Big Bang), the decay chain, Np and Pu (reactor),
 * and Pb, Bi (low-mass stars), where slow neutron capture really ends.
 */
export const CHAINS: Record<SiteId, Chain> = {
	accelerator: {
		seeds: Object.fromEntries(
			ACCELERATED.map(element => {
				const [beam, target] = BEAMS[element.symbol].split(' ');
				return [
					element.z,
					{ needs: zs(`${beam} ${target}`), why: `A ${elementBySymbol(beam).name.toLowerCase()} beam on a ${elementBySymbol(target).name.toLowerCase()} target.` },
				];
			}),
		),
		steps: ACCELERATED.map(element => element.z),
	},
	bigbang: { seeds: { 3: { needs: [], object: 'cmb', why: "The Big Bang's lithium shows in the oldest light there is." } }, steps: zs('H He Li') },
	cosmic: { seeds: { 4: { needs: zs('C N O'), why: 'Cosmic rays chip it off carbon, nitrogen and oxygen.' } }, steps: zs('Be B') },
	decay: { seeds: { 84: { needs: zs('U Th'), why: 'These are born from uranium and thorium decaying.' } }, steps: zs('Po At Rn Fr Ra Ac Pa') },
	lowmass: {
		seeds: { 6: { needs: zs('He'), why: 'A red giant fuses helium into carbon.' }, 38: { needs: zs('Fe'), why: 'Slow neutron capture builds on iron seeds.' } },
		steps: zs('C N Sr Y Zr Nb Mo Cd Sn Te Ba La Ce Nd Hf W Hg Tl Pb Bi'),
	},
	massive: {
		seeds: { 8: { needs: zs('He'), why: 'A massive star fuses helium into oxygen.' } },
		steps: zs('O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ga Ge As Se Br Kr Rb'),
	},
	neutron: {
		seeds: { 44: { needs: zs('Fe'), why: 'Rapid neutron capture builds on iron seeds.' } },
		steps: zs('Ru Rh Pd Ag In Sb I Xe Cs Pr Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Ta Re Os Ir Pt Au Th U'),
	},
	reactor: { seeds: { 43: { needs: zs('U'), why: 'The reactor splits and bombards uranium.' } }, steps: zs('Tc Pm Np Pu Am Cm Bk Cf Es Fm') },
	whitedwarf: {
		seeds: { 22: { needs: zs('C O'), why: 'A white dwarf is the carbon and oxygen core a star leaves behind.' } },
		steps: zs('Ti V Cr Mn Fe Co Ni Cu Zn'),
	},
};

/** Nuclei per second at study level 0, set so each site's slowest element takes 10 days, which each study level divides. */
export const BASE_RATES = Object.fromEntries(
	SITE_IDS.map(id => [id, Math.max(...CHAINS[id].steps.map(z => ELEMENTS[z - 1].need)) / (10 * 86_400)]),
) as Record<SiteId, number>;

/** The site that forges each element. */
export const FORGED_BY: Record<number, SiteId> = Object.fromEntries(SITE_IDS.flatMap(id => CHAINS[id].steps.map(z => [z, id])));

/** The process a site runs, for elements whose lore names no specific reaction. */
const SITE_REACTIONS: Partial<Record<SiteId, string>> = {
	lowmass: 'slow neutron capture in a red giant',
	massive: 'neutron capture in a massive star',
	neutron: 'rapid neutron capture in a kilonova',
	whitedwarf: 'a white dwarf detonating',
};

export const reactionOf = (element: Element): string => LORE[element.symbol]?.reaction ?? SITE_REACTIONS[FORGED_BY[element.z]] ?? '';

/** Sites whose open decay chains pay Decay events. */
export const DECAY_SITES: SiteId[] = ['accelerator', 'decay'];

/** Decay events per second of each open decay site, times `1 + study level`. */
export const DECAY_EVENTS_PER_SECOND = 1;

/** Starlight for a site's next study level, each level adds the base forge rate again. */
export const siteStudyCost = (level: number) => 1e9 * 4 ** level;

/** Shared Collider injections that synthesize element `z` past 118: 30K for 119, then ×1.5 per element. */
export const colliderGoal = (z: number) => 30_000 * 1.5 ** (z - 119);
