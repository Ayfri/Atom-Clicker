import type { SiteId } from '#data/sites.js';
import type { EffectStat } from '#lib/types.js';

export type Family = 'actinide' | 'alkali' | 'alkaline' | 'halogen' | 'lanthanide' | 'metalloid' | 'noble' | 'nonmetal' | 'post' | 'transition';

export type LightColor = 'blue' | 'green' | 'red';

export interface Element {
	column: number;
	family: Family;
	/** Strongest first, empty when no lab has measured the element's spectrum. */
	lines: number[];
	name: string;
	/** Nuclei to forge, `1000 × 10^(k × (12 - log ε))`. */
	need: number;
	/** Share of the element each site makes in the real universe, largest first. */
	origin: [SiteId, number][];
	row: number;
	symbol: string;
	z: number;
}

export interface FamilyInfo {
	color: string;
	name: string;
	/** Percent each identified member adds to the stat. */
	step: number;
	/** Lanthanides boost the Light of each one's strongest line instead, see `lanthanideLight`. */
	stat: EffectStat;
}

export interface Lore {
	discovery: string;
	fact: string;
	/** Absent when the forging site's process says it all, see `reactionOf`. */
	reaction?: string;
}

/** Each family has one color and one bonus, so a tile's color tells what it gives. */
export const FAMILIES: Record<Family, FamilyInfo> = {
	actinide: { color: '#e8a87c', name: 'Actinides', stat: 'stability_capacity', step: 2 },
	alkali: { color: '#ff6b6b', name: 'Alkali metals', stat: 'click', step: 2 },
	alkaline: { color: '#ffa94d', name: 'Alkaline earths', stat: 'generator', step: 2 },
	halogen: { color: '#f06595', name: 'Halogens', stat: 'power_up_multiplier', step: 2 },
	lanthanide: { color: '#66d9e8', name: 'Lanthanides', stat: 'blue_light_gain', step: 2 },
	metalloid: { color: '#a9e34b', name: 'Metalloids', stat: 'electron_gain', step: 2 },
	noble: { color: '#9775fa', name: 'Noble gases', stat: 'excited_photon_chance', step: 2 },
	nonmetal: { color: '#ffd43b', name: 'Nonmetals', stat: 'xp_gain', step: 2 },
	post: { color: '#38d9a9', name: 'Post-transition', stat: 'proton_gain', step: 2 },
	transition: { color: '#4dabf7', name: 'Transition metals', stat: 'global', step: 1 },
};

export const FAMILY_IDS = Object.keys(FAMILIES) as Family[];

/** A family with every member identified multiplies its bonus once more. */
export const SET_BONUS = 1.25;

export const LIGHT_STATS: Record<LightColor, EffectStat> = { blue: 'blue_light_gain', green: 'green_light_gain', red: 'red_light_gain' };

export const STAT_LABELS: Partial<Record<EffectStat, string>> = {
	blue_light_gain: 'Blue Light gain',
	click: 'Click power',
	electron_gain: 'Electron gain',
	excited_photon_chance: 'Excited photon chance',
	generator: 'Generator output',
	global: 'Production',
	green_light_gain: 'Green Light gain',
	power_up_multiplier: 'Power-up strength',
	proton_gain: 'Proton gain',
	red_light_gain: 'Red Light gain',
	stability_capacity: 'Reactor stability',
	xp_gain: 'XP gain',
};

const NAMES =
	'H Hydrogen,He Helium,Li Lithium,Be Beryllium,B Boron,C Carbon,N Nitrogen,O Oxygen,F Fluorine,Ne Neon,Na Sodium,Mg Magnesium,Al Aluminium,Si Silicon,P Phosphorus,S Sulfur,Cl Chlorine,Ar Argon,K Potassium,Ca Calcium,Sc Scandium,Ti Titanium,V Vanadium,Cr Chromium,Mn Manganese,Fe Iron,Co Cobalt,Ni Nickel,Cu Copper,Zn Zinc,Ga Gallium,Ge Germanium,As Arsenic,Se Selenium,Br Bromine,Kr Krypton,Rb Rubidium,Sr Strontium,Y Yttrium,Zr Zirconium,Nb Niobium,Mo Molybdenum,Tc Technetium,Ru Ruthenium,Rh Rhodium,Pd Palladium,Ag Silver,Cd Cadmium,In Indium,Sn Tin,Sb Antimony,Te Tellurium,I Iodine,Xe Xenon,Cs Caesium,Ba Barium,La Lanthanum,Ce Cerium,Pr Praseodymium,Nd Neodymium,Pm Promethium,Sm Samarium,Eu Europium,Gd Gadolinium,Tb Terbium,Dy Dysprosium,Ho Holmium,Er Erbium,Tm Thulium,Yb Ytterbium,Lu Lutetium,Hf Hafnium,Ta Tantalum,W Tungsten,Re Rhenium,Os Osmium,Ir Iridium,Pt Platinum,Au Gold,Hg Mercury,Tl Thallium,Pb Lead,Bi Bismuth,Po Polonium,At Astatine,Rn Radon,Fr Francium,Ra Radium,Ac Actinium,Th Thorium,Pa Protactinium,U Uranium,Np Neptunium,Pu Plutonium,Am Americium,Cm Curium,Bk Berkelium,Cf Californium,Es Einsteinium,Fm Fermium,Md Mendelevium,No Nobelium,Lr Lawrencium,Rf Rutherfordium,Db Dubnium,Sg Seaborgium,Bh Bohrium,Hs Hassium,Mt Meitnerium,Ds Darmstadtium,Rg Roentgenium,Cn Copernicium,Nh Nihonium,Fl Flerovium,Mc Moscovium,Lv Livermorium,Ts Tennessine,Og Oganesson'.split(
		',',
	);

const CODE_SITE: Record<string, SiteId> = { A: 'accelerator', B: 'bigbang', D: 'decay', L: 'lowmass', M: 'massive', N: 'neutron', R: 'cosmic', W: 'whitedwarf', X: 'reactor' };

/**
 * Origin shares in percent for Z 1 to 103, transcribed from Wikimedia Commons' `Nucleosynthesis_periodic_table.svg` (CMG Lee, after
 * Jennifer Johnson). Johnson's "human synthesis" is X (reactor) or A (accelerator), Z 104+ is A. Example: `B23 R13 L64` for Li.
 */
const ORIGINS =
	'B,B91 M5 L4,B23 R13 L64,R,R,M25 L75,M25 L75,M,M,M,M,M99 W1,M99.6 W0.4,M71 W29,M97 W3,M58 W42,M84 W16,M56 W44,M82 W18,M51 W49,M82 W18,M35 W65,M25 W75,M23 W77,M16 W84,M36 W64,M33 W67,M30 W70,M42 W58,M46 W54,M,M,M,M,M,M,M,M13 L87,M8 L92,M16 L84,L87 N13,L63 N37,X,L32 N68,L13 N87,L45 N55,L19 N81,L52 N48,L36 N64,L69 N31,L25 N75,L57 N43,L5 N95,L17 N83,L15 N85,L82 N18,L62 N38,L76 N24,L48 N52,L60 N40,X,L29 N71,L5 N95,L15 N85,L7 N93,L14 N86,L7 N93,L16 N84,L12 N88,L32 N68,L20 N80,L55 N45,L41 N59,L57 N43,L8 N92,L10 N90,L1 N99,L5 N95,L6 N94,L62 N38,L77 N23,L47 N53,L0.5 N99.5,N,N,N,N,N,N,N,N,N,N,N,X,X,X,X,X,X,A,A,A'
		.split(',')
		.map(entry => entry.split(' ').map(part => [CODE_SITE[part[0]], part.length === 1 ? 1 : Number(part.slice(1)) / 100] as [SiteId, number]));

/** Asplund, Amarsi & Grevesse 2021, log ε with H = 12, meteoritic for Li and As. Absent = no stable isotope. */
const LOG_EPS: Record<string, number> = {
	Ag: 0.96, Al: 6.43, Ar: 6.38, As: 2.3, Au: 0.91, B: 2.7, Ba: 2.27, Be: 1.38, Bi: 0.65, Br: 2.54, C: 8.46, Ca: 6.3, Cd: 1.71, Ce: 1.58, Cl: 5.31, Co: 4.94,
	Cr: 5.62, Cs: 1.08, Cu: 4.18, Dy: 1.1, Er: 0.93, Eu: 0.52, F: 4.4, Fe: 7.46, Ga: 3.02, Gd: 1.08, Ge: 3.62, H: 12, He: 10.914, Hf: 0.85, Hg: 1.17, Ho: 0.48,
	I: 1.55, In: 0.8, Ir: 1.32, K: 5.07, Kr: 3.12, La: 1.11, Li: 3.25, Lu: 0.1, Mg: 7.55, Mn: 5.42, Mo: 1.88, N: 7.83, Na: 6.22, Nb: 1.47, Nd: 1.42, Ne: 8.06,
	Ni: 6.2, O: 8.69, Os: 1.35, P: 5.41, Pb: 1.95, Pd: 1.57, Pr: 0.75, Pt: 1.61, Rb: 2.32, Re: 0.26, Rh: 0.78, Ru: 1.75, S: 7.12, Sb: 1.01, Sc: 3.14, Se: 3.34,
	Si: 7.51, Sm: 0.95, Sn: 2.02, Sr: 2.83, Ta: -0.15, Tb: 0.31, Te: 2.18, Th: 0.03, Ti: 4.97, Tl: 0.92, Tm: 0.11, U: -0.54, V: 3.9, W: 0.79, Xe: 2.22, Y: 2.21,
	Yb: 0.85, Zn: 4.56, Zr: 2.59,
};

/**
 * Five strongest neutral-atom lines between 350 and 900 nm in the NIST Atomic Spectra Database, strongest first, in air.
 * At only has UV lines, Fr comes from its transition rates, Cs and Ga keep the lines Bunsen and Lecoq de Boisbaudran named them by,
 * Fm is Sewtz et al. 2003 (PRL 90, 163002). Elements from Md on have no measured line.
 */
const LINES: Record<string, number[]> = {
	H: [656.3, 486.1, 434, 388.9, 410.2], He: [388.9, 587.6, 447.1, 706.5, 501.6], Li: [670.8, 610.4, 812.6, 413.3, 391.5],
	Be: [457.3, 381.3, 825.4, 440.8, 351.6], B: [582.1, 821.2, 624.5, 866.9, 594.3], C: [833.5, 505.2, 538, 711.3, 786.1],
	N: [746.8, 744.2, 575.3, 868, 742.4], O: [844.6, 777.2, 777.5, 615.8, 700.2], F: [685.6, 703.7, 712.8, 775.5, 690.2],
	Ne: [692.9, 703.2, 717.4, 724.5, 837.8], Na: [589, 589.6, 388.2, 443.2, 507.1], Mg: [880.7, 518.4, 517.3, 516.7, 383.8],
	Al: [396.2, 394.4, 877.4, 669.6, 783.6], Si: [742.3, 728.9, 740.6, 390.6, 741.6], P: [619.9, 874.2, 516.2, 534.6, 547.8],
	S: [869.5, 792.4, 868, 887.5, 769.7], Cl: [837.6, 858.6, 822.2, 857.5, 821.2], Ar: [811.5, 763.5, 801.5, 750.4, 794.8],
	K: [766.5, 769.9, 693.9, 691.1, 404.4], Ca: [422.7, 643.9, 646.3, 714.8, 732.6], Sc: [683.5, 681.9, 673.8, 683, 769.8],
	Ti: [521, 506.5, 519.3, 517.4, 498.2], V: [437.9, 411.2, 438.5, 439, 440.9], Cr: [541, 520.8, 520.4, 534.6, 529.8],
	Mn: [403.1, 403.4, 404.1, 380.7, 356.9], Fe: [374.6, 370.6, 372.3, 387.9, 363.1], Co: [350.2, 356.9, 389.4, 353, 350.6],
	Ni: [352.5, 351.5, 361.9, 356.6, 351], Cu: [521.8, 353, 360.9, 406.3, 465.1], Zn: [481.1, 472.2, 468, 577.2, 463],
	Ga: [417.2, 403.3, 780, 773.5, 746.4], Ge: [422.7, 468.6, 783.4, 803.1, 825.6], As: [545.1, 882.2, 506.9, 512.1, 514.2],
	Se: [473.1, 473.9, 474.2, 706.2, 800.1], Br: [827.2, 635.1, 656, 663.2, 614.9], Kr: [810.4, 587.1, 557, 760.2, 427.4],
	Rb: [780, 794.8, 420.2, 421.6, 775.8], Sr: [460.7, 707, 687.8, 679.1, 525.7], Y: [410.2, 407.7, 412.8, 414.3, 362.1],
	Zr: [360.1, 386.4, 389, 468.8, 383.6], Nb: [405.9, 408, 410.1, 412.4, 358], Mo: [379.8, 386.4, 390.3, 550.6, 553.3],
	Tc: [403.2, 485.4, 409.6, 363.6, 371.9], Ru: [372.8, 379.9, 420, 359.3, 358.9], Rh: [369.2, 352.8, 365.8, 370.1, 350.3],
	Pd: [361, 363.5, 351.7, 355.3, 369], Ag: [520.9, 546.5, 827.4, 421.1, 768.8], Cd: [643.8, 361.1, 508.6, 734.6, 480],
	In: [451.1, 410.2, 571, 572.8, 870], Sn: [380.1, 452.5, 365.6, 563.2, 855.3], Sb: [363.8, 372.3, 403.4, 792.5, 857.3],
	Te: [875.8, 806.1, 885.1, 870.1, 797.3], I: [804.4, 885.4, 723.7, 885.7, 511.9], Xe: [823.2, 828, 881.9, 834.7, 840.9],
	Cs: [852.1, 894.3, 455.5, 459.3, 672.3], Ba: [553.5, 648.3, 728, 649.9, 634.2], La: [521.2, 625, 517.7, 523.4, 545.5],
	Ce: [569.9, 516, 522.3, 524.6, 560.1], Pr: [495.1, 494, 504.6, 469.6, 513.3], Nd: [463.4, 492.5, 488.4, 464.1, 468.3],
	Pm: [652, 462.4, 472.8, 478.1, 480.1], Sm: [429.7, 484.2, 374.5, 433.6, 447.1], Eu: [459.4, 462.7, 466.2, 521.5, 583.1],
	Gd: [422.6, 378.3, 407.9, 405.4, 405.8], Tb: [432.6, 431.9, 376.5, 433.8, 390.1], Dy: [421.2, 404.6, 418.7, 419.5, 416.8],
	Ho: [410.4, 405.4, 416.3, 412.7, 410.9], Er: [400.8, 386.3, 415.1, 389.3, 408.8], Tm: [409.4, 410.6, 418.8, 371.8, 388.3],
	Yb: [398.8, 555.6, 769.9, 493.6, 680], Lu: [356.8, 451.9, 412.5, 384.1, 513.5], Hf: [368.2, 378.5, 361.7, 377.8, 352.3],
	Ta: [362.7, 360.7, 364.2, 351.1, 468.2], W: [400.9, 429.5, 386.8, 407.4, 361.8], Re: [372.6, 422.7, 451.3, 488.9, 413.6],
	Os: [426.1, 442, 375.3, 413.6, 378.2], Ir: [351.4, 380, 357.4, 362.9, 397.6], Pt: [381.9, 676, 443, 530.1, 396.6],
	Au: [460.8, 406.5, 627.8, 751.1, 479.3], Hg: [404.7, 435.8, 365, 546.1, 365.5], Tl: [351.9, 535, 377.6, 352.9, 837.4],
	Pb: [405.8, 368.3, 364, 357.3, 374], Bi: [472.3, 351.1, 359.6, 412.2, 449.3], Po: [417.1, 449.3, 796.3, 386.2, 861.8], At: [216.2, 224.4],
	Rn: [745, 705.5, 435, 726.8, 781], Fr: [718, 816.9], Ra: [482.6, 566.1, 714.1, 620, 540], Ac: [418, 388.6, 525.8, 446.3, 471.7],
	Th: [576.1, 645.7, 395, 618.3, 658.4], Pa: [363.7, 398.2, 694.6, 711.5, 736.8], U: [358.5, 356.7, 381.2, 351.5, 387.1],
	Np: [697.2, 837.3, 853, 693, 773.5], Pu: [372.1, 372.6, 374.5, 375.4, 375.8], Am: [605.5, 351, 356.9, 367.3, 428.9],
	Cm: [351, 352.2, 354.2, 354.7, 356.1], Bk: [352.9, 353.6, 355.4, 359, 359.6], Cf: [353.1, 354.1, 359.9, 360.5, 361.7],
	Es: [351.4, 352.3, 355.5, 516.2, 520.4], Fm: [398.1, 398.3],
};

export const LORE: Record<string, Lore> = {
	Ac: { discovery: '1899 · Debierne', fact: 'Its name means "ray" in Greek.', reaction: '²³¹Pa → ²²⁷Ac + ⁴He' },
	Ag: { discovery: 'Antiquity', fact: 'Its Latin name, argentum, named Argentina.' },
	Al: { discovery: '1825 · Ørsted', fact: 'Napoleon III served his finest guests on aluminium plates, then rarer than gold.', reaction: 'carbon burning in a massive star' },
	Am: { discovery: '1944 · Seaborg et al.', fact: 'A speck of it sits in most smoke detectors.', reaction: '²³⁹Pu + 2n → ²⁴¹Pu → ²⁴¹Am' },
	Ar: { discovery: '1894 · Rayleigh & Ramsay', fact: 'Its name means "the lazy one": it reacts with nothing.', reaction: '³²S + ⁴He → ³⁶Ar' },
	As: { discovery: 'c. 1250 · Albertus Magnus', fact: 'Called the king of poisons.' },
	At: { discovery: '1940 · Corson, MacKenzie & Segrè', fact: 'Less than a gram of it exists in the whole Earth at any moment.', reaction: '²¹⁸Po → ²¹⁸At, a rare branch of the uranium chain' },
	Au: { discovery: 'Antiquity', fact: 'Most gold atoms were made when two neutron stars collided.' },
	B: { discovery: '1808 · Gay-Lussac & Thénard', fact: 'Stars burn it, only cosmic rays leave some behind.', reaction: 'p + ¹²C → ¹¹B + fragments' },
	Ba: { discovery: '1808 · Davy', fact: 'Its salts burn the green of fireworks.' },
	Be: { discovery: '1798 · Vauquelin', fact: 'Stars cannot make it: cosmic rays chip it off carbon and oxygen.', reaction: 'p + ¹⁶O → ⁹Be + fragments' },
	Bh: { discovery: '1981 · Münzenberg, GSI', fact: 'Named after Niels Bohr.', reaction: '²⁰⁹Bi + ⁵⁴Cr → ²⁶²Bh + n' },
	Bi: { discovery: '1753 · Geoffroy', fact: 'Its half-life is a billion times the age of the universe.' },
	Bk: { discovery: '1949 · Thompson, Ghiorso & Seaborg', fact: 'Named after Berkeley, the way terbium is named after Ytterby.', reaction: '²⁴¹Am + ⁴He → ²⁴³Bk + 2n' },
	Br: { discovery: '1826 · Balard', fact: 'One of only two elements that are liquid at room temperature.' },
	C: { discovery: 'Antiquity', fact: 'Every carbon atom in you was made in a star.', reaction: '3 ⁴He → ¹²C' },
	Ca: { discovery: '1808 · Davy', fact: 'Your bones are made of supernova ashes.', reaction: '³⁶Ar + ⁴He → ⁴⁰Ca' },
	Cd: { discovery: '1817 · Stromeyer', fact: 'Found as an impurity in zinc ore.' },
	Ce: { discovery: '1803 · Berzelius & Hisinger', fact: 'The sparks of a lighter flint are mostly cerium.' },
	Cf: { discovery: '1950 · Thompson, Street, Ghiorso & Seaborg', fact: 'A gram of californium-252 sheds over two trillion neutrons a second.', reaction: '²⁴²Cm + ⁴He → ²⁴⁵Cf + n' },
	Cl: { discovery: '1774 · Scheele', fact: 'Named for its pale green color.', reaction: 'oxygen burning in a massive star' },
	Cm: { discovery: '1944 · Seaborg, James & Ghiorso', fact: 'Named after Marie and Pierre Curie.', reaction: '²³⁹Pu + ⁴He → ²⁴²Cm + n' },
	Cn: { discovery: '1996 · Hofmann, GSI', fact: 'Named after Copernicus, on his 537th birthday.', reaction: '²⁰⁸Pb + ⁷⁰Zn → ²⁷⁷Cn + n' },
	Co: { discovery: '1735 · Brandt', fact: 'Named after kobolds, goblins miners blamed for useless ore.', reaction: '⁵⁹Ni → ⁵⁹Co' },
	Cr: { discovery: '1797 · Vauquelin', fact: 'Its name comes from the many colors of its compounds.', reaction: '⁵²Fe → ⁵²Mn → ⁵²Cr' },
	Cs: { discovery: '1860 · Bunsen & Kirchhoff', fact: 'Named for the two sky-blue lines Bunsen saw in a spectroscope.' },
	Cu: { discovery: 'Antiquity', fact: 'Humans have worked it for over 10,000 years.' },
	Db: { discovery: '1970 · Ghiorso, Berkeley', fact: 'Named after Dubna, the Russian town whose lab also claimed it.', reaction: '²⁴⁹Cf + ¹⁵N → ²⁶⁰Db + 4n' },
	Ds: { discovery: '1994 · Hofmann, GSI', fact: 'Named after Darmstadt, the city of its lab.', reaction: '²⁰⁸Pb + ⁶²Ni → ²⁶⁹Ds + n' },
	Dy: { discovery: '1886 · Lecoq de Boisbaudran', fact: 'Its name means "hard to get".' },
	Er: { discovery: '1843 · Mosander', fact: 'It amplifies the light in undersea internet cables.' },
	Es: { discovery: '1952 · Ghiorso et al.', fact: 'Found in the fallout of the first hydrogen bomb test.', reaction: '²³⁸U + 15n → ²⁵³U → ²⁵³Es' },
	Eu: { discovery: '1901 · Demarçay', fact: 'Euro banknotes glow under UV light thanks to it.' },
	F: { discovery: '1886 · Moissan', fact: 'The most reactive element, tamed in toothpaste.', reaction: 'neutrinos knock a proton off ²⁰Ne' },
	Fe: { discovery: 'Antiquity', fact: 'The heaviest element a star can fuse for energy.', reaction: '⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe' },
	Fl: { discovery: '1999 · Oganessian, Dubna', fact: 'Named after the Flerov Laboratory in Dubna.', reaction: '²⁴⁴Pu + ⁴⁸Ca → ²⁸⁹Fl + 3n' },
	Fm: { discovery: '1952 · Ghiorso et al.', fact: 'The heaviest element neutron capture alone can make.', reaction: '²³⁸U + 17n → ²⁵⁵U → ²⁵⁵Fm' },
	Fr: { discovery: '1939 · Perey', fact: 'The last element found in nature, by Marguerite Perey.', reaction: '²²⁷Ac → ²²³Fr + ⁴He' },
	Ga: { discovery: '1875 · Lecoq de Boisbaudran', fact: 'Mendeleev predicted it as eka-aluminium, and it melts in your hand.' },
	Gd: { discovery: '1880 · de Marignac', fact: 'MRI contrast agents are built around it.' },
	Ge: { discovery: '1886 · Winkler', fact: "Mendeleev's eka-silicon, and the first transistors were made of it." },
	H: { discovery: '1766 · Cavendish', fact: "Ångström saw it in the Sun's light in 1862.", reaction: 'free protons left by the Big Bang' },
	He: { discovery: '1868 · Janssen & Lockyer', fact: "Read in the Sun's light 27 years before anyone found it on Earth.", reaction: '²H + ²H → ⁴He' },
	Hf: { discovery: '1923 · Coster & von Hevesy', fact: 'Named after Hafnia, Latin for Copenhagen.' },
	Hg: { discovery: 'Antiquity', fact: 'Named after Mercury, the fast messenger god.' },
	Ho: { discovery: '1878 · Cleve', fact: 'Named after Holmia, Latin for Stockholm.' },
	Hs: { discovery: '1984 · Münzenberg, GSI', fact: 'Named after Hesse, the German state of its lab.', reaction: '²⁰⁸Pb + ⁵⁸Fe → ²⁶⁵Hs + n' },
	I: { discovery: '1811 · Courtois', fact: 'Found in seaweed ash while making gunpowder.' },
	In: { discovery: '1863 · Reich & Richter', fact: 'Named for the indigo line in its spectrum.' },
	Ir: { discovery: '1803 · Tennant', fact: 'A thin iridium layer marks the asteroid that ended the dinosaurs.' },
	K: { discovery: '1807 · Davy', fact: 'Bananas are slightly radioactive because of it.', reaction: 'oxygen burning in a massive star' },
	Kr: { discovery: '1898 · Ramsay & Travers', fact: 'Its name means "the hidden one".' },
	La: { discovery: '1839 · Mosander', fact: 'Its name means "to lie hidden".' },
	Li: { discovery: '1817 · Arfwedson', fact: 'The Big Bang made a little, stars mostly destroy it.', reaction: '⁴He + ³H → ⁷Li' },
	Lr: { discovery: '1961 · Ghiorso, Berkeley', fact: 'Named after Ernest Lawrence, inventor of the cyclotron.', reaction: '²⁵²Cf + ¹⁰B → ²⁵⁷Lr + 5n' },
	Lu: { discovery: '1907 · Urbain', fact: 'Named after Lutetia, the Roman name of Paris.' },
	Lv: { discovery: '2000 · Oganessian, Dubna', fact: 'Named after Livermore, the American lab that worked with Dubna on it.', reaction: '²⁴⁸Cm + ⁴⁸Ca → ²⁹³Lv + 3n' },
	Mc: { discovery: '2003 · Oganessian, Dubna', fact: 'Named after the Moscow region.', reaction: '²⁴³Am + ⁴⁸Ca → ²⁸⁸Mc + 3n' },
	Md: { discovery: '1955 · Ghiorso, Seaborg et al.', fact: 'First identified from 17 atoms, made one at a time.', reaction: '²⁵³Es + ⁴He → ²⁵⁶Md + n' },
	Mg: { discovery: '1755 · Black', fact: 'The heart of every chlorophyll molecule.', reaction: '²⁰Ne + ⁴He → ²⁴Mg' },
	Mn: { discovery: '1774 · Gahn', fact: 'Type Ia supernovae make most of it.', reaction: '⁵⁵Co → ⁵⁵Fe → ⁵⁵Mn' },
	Mo: { discovery: '1778 · Scheele', fact: 'Its name comes from the Greek for lead, which it was mistaken for.' },
	Mt: { discovery: '1982 · Münzenberg, GSI', fact: 'Named after Lise Meitner, and first seen as a single atom.', reaction: '²⁰⁹Bi + ⁵⁸Fe → ²⁶⁶Mt + n' },
	N: { discovery: '1772 · Rutherford', fact: 'Most of the air you breathe.', reaction: 'CNO cycle' },
	Na: { discovery: '1807 · Davy', fact: 'Its 589 nm doublet is the orange of old streetlights.', reaction: '¹²C + ¹²C → ²³Na + p' },
	Nb: { discovery: '1801 · Hatchett', fact: 'Named after Niobe, daughter of Tantalus, as it always comes with tantalum.' },
	Nd: { discovery: '1885 · von Welsbach', fact: 'The strongest permanent magnets are made of it.' },
	Ne: { discovery: '1898 · Ramsay & Travers', fact: 'Its red-orange lines are the glow of neon signs.', reaction: '¹⁶O + ⁴He → ²⁰Ne' },
	Nh: { discovery: '2004 · Morita, RIKEN', fact: 'The first element found in Asia, named after Japan, Nihon.', reaction: '²⁰⁹Bi + ⁷⁰Zn → ²⁷⁸Nh + n' },
	Ni: { discovery: '1751 · Cronstedt', fact: "Most of the Earth's core is iron and nickel." },
	No: { discovery: '1966 · Flerov, Dubna', fact: "Named after Alfred Nobel, though Stockholm's own claim to it never held.", reaction: '²³⁸U + ²²Ne → ²⁵⁶No + 4n' },
	Np: { discovery: '1940 · McMillan & Abelson', fact: 'Named after Neptune, the planet past Uranus.', reaction: '²³⁸U + n → ²³⁹U → ²³⁹Np' },
	O: { discovery: '1774 · Priestley & Scheele', fact: 'The third most abundant element in the universe.', reaction: '¹²C + ⁴He → ¹⁶O' },
	Og: { discovery: '2002 · Oganessian, Dubna', fact: 'Only a handful of atoms have ever been made.', reaction: '²⁴⁹Cf + ⁴⁸Ca → ²⁹⁴Og + 3n' },
	Os: { discovery: '1803 · Tennant', fact: 'The densest natural element.' },
	P: { discovery: '1669 · Brand', fact: 'Found by an alchemist boiling down urine.', reaction: 'neon burning in a massive star' },
	Pa: { discovery: '1913 · Fajans & Göhring', fact: 'Its name means "before actinium": it decays into it.', reaction: '²³⁵U → ²³¹Th → ²³¹Pa' },
	Pb: { discovery: 'Antiquity', fact: 'Every uranium and thorium decay chain ends on it.' },
	Pd: { discovery: '1803 · Wollaston', fact: 'Named after the asteroid Pallas, found a year earlier.' },
	Pm: { discovery: '1945 · Marinsky, Glendenin & Coryell', fact: 'Named after Prometheus, who stole fire from the gods.', reaction: '²³⁵U fission → ¹⁴⁷Nd → ¹⁴⁷Pm' },
	Po: { discovery: '1898 · Marie & Pierre Curie', fact: "Named after Poland, Marie Curie's homeland.", reaction: '²¹⁰Bi → ²¹⁰Po, in the uranium chain' },
	Pr: { discovery: '1885 · von Welsbach', fact: 'Its name means "green twin".' },
	Pt: { discovery: '1748 · de Ulloa', fact: 'Spanish conquistadors called it "little silver" and threw it away.' },
	Pu: { discovery: '1940 · Seaborg et al.', fact: 'Named after Pluto, next in line after Uranus and Neptune.', reaction: '²³⁹Np → ²³⁹Pu' },
	Ra: { discovery: '1898 · Marie & Pierre Curie', fact: 'It glows faintly blue in the dark.', reaction: '²³⁰Th → ²²⁶Ra + ⁴He' },
	Rb: { discovery: '1861 · Bunsen & Kirchhoff', fact: 'Named for the deep red lines Bunsen saw in its spectrum.' },
	Re: { discovery: '1925 · Noddack, Tacke & Berg', fact: 'The last stable element to be discovered.' },
	Rf: { discovery: '1969 · Ghiorso, Berkeley', fact: 'Berkeley and Dubna argued over its name for thirty years.', reaction: '²⁴⁹Cf + ¹²C → ²⁵⁷Rf + 4n' },
	Rg: { discovery: '1994 · Hofmann, GSI', fact: 'Named after Wilhelm Röntgen, a century after his X-rays.', reaction: '²⁰⁹Bi + ⁶⁴Ni → ²⁷²Rg + n' },
	Rh: { discovery: '1803 · Wollaston', fact: 'Named for the rose color of its salts.' },
	Rn: { discovery: '1900 · Dorn', fact: 'The radioactive gas that seeps up from granite into basements.', reaction: '²²⁶Ra → ²²²Rn + ⁴He' },
	Ru: { discovery: '1844 · Klaus', fact: 'Named after Ruthenia, the Latin name for Russia.' },
	S: { discovery: 'Antiquity', fact: 'The brimstone of old texts.', reaction: '²⁸Si + ⁴He → ³²S' },
	Sb: { discovery: 'Antiquity', fact: 'Egyptian eye makeup was powdered antimony ore.' },
	Sc: { discovery: '1879 · Nilson', fact: 'Mendeleev predicted it as eka-boron.', reaction: 'explosive oxygen burning' },
	Se: { discovery: '1817 · Berzelius', fact: 'Named after the Moon, Selene.' },
	Sg: { discovery: '1974 · Ghiorso, Berkeley', fact: 'Named after Glenn Seaborg while he was still alive.', reaction: '²⁴⁹Cf + ¹⁸O → ²⁶³Sg + 4n' },
	Si: { discovery: '1824 · Berzelius', fact: 'Rocks, sand and every chip in your phone.', reaction: '¹⁶O + ¹⁶O → ²⁸Si + ⁴He' },
	Sm: { discovery: '1879 · Lecoq de Boisbaudran', fact: 'Named after a mineral, itself named after a Russian mining officer.' },
	Sn: { discovery: 'Antiquity', fact: 'Mixed with copper, it made bronze and gave an age its name.' },
	Sr: { discovery: '1790 · Crawford', fact: 'Its red lines color fireworks.', reaction: 'slow neutron capture on iron' },
	Ta: { discovery: '1802 · Ekeberg', fact: 'Named after Tantalus, as it soaks up no acid.' },
	Tb: { discovery: '1843 · Mosander', fact: 'The green in the phosphors of fluorescent tubes.' },
	Tc: { discovery: '1937 · Perrier & Segrè', fact: 'The first element made by humans before it was found in nature.', reaction: '²³⁵U fission → ⁹⁹Mo → ⁹⁹Tc' },
	Te: { discovery: '1782 · Müller von Reichenstein', fact: 'Named after the Earth, tellus.' },
	Th: { discovery: '1829 · Berzelius', fact: "Named after Thor, it still heats the Earth's interior as it decays." },
	Ti: { discovery: '1791 · Gregor', fact: 'Named after the Titans of Greek myth.', reaction: '⁴⁸Cr → ⁴⁸V → ⁴⁸Ti' },
	Tl: { discovery: '1861 · Crookes', fact: 'Named for the bright green line Crookes saw in its spectrum.' },
	Tm: { discovery: '1879 · Cleve', fact: 'Named after Thule, the far north of old maps.' },
	Ts: { discovery: '2010 · Oganessian, Dubna', fact: 'Its berkelium target was made in a reactor in Tennessee.', reaction: '²⁴⁹Bk + ⁴⁸Ca → ²⁹⁴Ts + 3n' },
	U: { discovery: '1789 · Klaproth', fact: 'Still slowly decaying since a kilonova forged it.' },
	V: { discovery: '1830 · Sefström', fact: 'Named after Vanadís, the Norse goddess of beauty.', reaction: '⁵¹Mn → ⁵¹Cr → ⁵¹V' },
	W: { discovery: '1783 · Elhuyar brothers', fact: 'The highest melting point of any metal.' },
	Xe: { discovery: '1898 · Ramsay & Travers', fact: 'Ion thrusters on spacecraft run on it.' },
	Y: { discovery: '1794 · Gadolin', fact: 'One of four elements named after the Swedish village of Ytterby.' },
	Yb: { discovery: '1878 · de Marignac', fact: 'The fourth element named after Ytterby.' },
	Zn: { discovery: '1746 · Marggraf', fact: 'Galvanized steel is iron dipped in zinc.' },
	Zr: { discovery: '1789 · Klaproth', fact: 'Zircon crystals hold the oldest dated pieces of the Earth.' },
};

const FAMILY_SETS: [Family, string][] = [
	['alkali', 'Li Na K Rb Cs Fr'],
	['alkaline', 'Be Mg Ca Sr Ba Ra'],
	['metalloid', 'B Si Ge As Sb Te'],
	['nonmetal', 'H C N O P S Se'],
	['halogen', 'F Cl Br I At Ts'],
	['noble', 'He Ne Ar Kr Xe Rn Og'],
	['post', 'Al Ga In Sn Tl Pb Bi Po Nh Fl Mc Lv'],
];

function familyOf(z: number, symbol: string): Family {
	if (z >= 57 && z <= 71) return 'lanthanide';
	if (z >= 89 && z <= 103) return 'actinide';
	return FAMILY_SETS.find(([, symbols]) => symbols.split(' ').includes(symbol))?.[0] ?? 'transition';
}

/** Grid row and column, with period 8 on row 8 and the f-block on rows 10 and 11. */
function position(z: number): [number, number] {
	if (z === 1) return [1, 1];
	if (z === 2) return [1, 18];
	if (z >= 57 && z <= 71) return [10, z - 57 + 4];
	if (z >= 89 && z <= 103) return [11, z - 89 + 4];
	const starts = [3, 11, 19, 37, 55, 87];
	const period = starts.findLastIndex(start => z >= start) + 2;
	const index = z - starts[period - 2];
	if (period <= 3) return [period, index < 2 ? index + 1 : index + 11];
	if (period <= 5 || index < 2) return [period, index + 1];
	return [period, z - (period === 6 ? 72 : 104) + 4];
}

/** How much real rarity slows forging: hydrogen to uranium spans 10^(k × 12.5), 10^5 at 0.4. */
const RARITY = 0.4;

/** Abundance sets the need. Without a stable isotope it is uranium's × 1.5 per Z from it, never below polonium's (U / 1.5⁸). */
function needOf(z: number, logEps: number | undefined): number {
	const units = logEps === undefined ? 10 ** (RARITY * (12 - LOG_EPS.U)) * 1.5 ** Math.max(-8, z - 92) : 10 ** (RARITY * (12 - logEps));
	return units * 1000;
}

export const ELEMENTS: Element[] = NAMES.map((entry, i) => {
	const z = i + 1;
	const [symbol, name] = entry.split(' ');
	const [row, column] = position(z);
	return { column, family: familyOf(z, symbol), lines: LINES[symbol] ?? [], name, need: needOf(z, LOG_EPS[symbol]), origin: ORIGINS[i] ?? [['accelerator', 1]], row, symbol, z };
});

export const ELEMENT_COUNT = ELEMENTS.length;

const BY_SYMBOL = Object.fromEntries(ELEMENTS.map(element => [element.symbol, element]));

/** Atomic numbers of space-separated symbols: `zs('U Th')` → `[92, 90]`. */
export const zs = (symbols: string) => symbols.split(' ').map(symbol => BY_SYMBOL[symbol].z);

export const elementBySymbol = (symbol: string): Element => BY_SYMBOL[symbol];

/** Red from 600 nm (infrared included), Green from 500 to 600, Blue under 500 (ultraviolet included). */
export const lightColorOf = (nm: number): LightColor => (nm >= 600 ? 'red' : nm >= 500 ? 'green' : 'blue');

/** A lanthanide boosts the Light color of its strongest line. */
export const lanthanideLight = (element: Element): LightColor => lightColorOf(element.lines[0]);

/** The stat an element boosts: its family's, or the Light of its strongest line for a lanthanide. */
export const elementStat = (element: Element): EffectStat =>
	element.family === 'lanthanide' ? LIGHT_STATS[lanthanideLight(element)] : FAMILIES[element.family].stat;

/** The Prism's tuning window: lines within `width` nm of its center cost `factorIn` times their Light, the others `factorOut`. */
export const TUNING = { factorIn: 0.2, factorOut: 2, max: 875, min: 375, width: 50 } as const;

/** Wavelengths outside this range are never read through the window, they always cost their plain share. */
const TUNING_RANGE = { max: 900, min: 350 } as const;

const lineWeight = (nm: number, tuning: number | null): number =>
	tuning === null || nm < TUNING_RANGE.min || nm > TUNING_RANGE.max ? 1
	: Math.abs(nm - tuning) <= TUNING.width / 2 ? TUNING.factorIn
	: TUNING.factorOut;

/**
 * Light per nucleus, split by the element's lines: Red ≥ 600 nm, Green 500 to 600, Blue under 500. Without a measured spectrum, no Light: see
 * `decayCost`. A `tuning` center weighs each line by its distance to the window, `null` is the plain cost.
 */
export function lightCost(element: Element, tuning: number | null = null): Record<LightColor, number> {
	if (!element.lines.length) return { blue: 0, green: 0, red: 0 };
	const total = element.need / 50;
	const share = (color: LightColor) =>
		Math.ceil(
			(total * element.lines.filter(nm => lightColorOf(nm) === color).reduce((sum, nm) => sum + lineWeight(nm, tuning), 0)) / element.lines.length,
		);
	return { blue: share('blue'), green: share('green'), red: share('red') };
}

/** The whole nm window center that covers the most of `lines`: a window edge as close as possible to one of them, kept inside the tuning range. */
export function bestTuning(lines: number[]): number {
	const weight = (center: number) => lines.reduce((sum, nm) => sum + lineWeight(nm, center), 0);
	let best: { center: number; total: number } | null = null;
	for (const nm of lines) {
		for (const edge of [Math.ceil(nm - TUNING.width / 2), Math.floor(nm + TUNING.width / 2)]) {
			const center = Math.min(Math.max(edge, TUNING.min), TUNING.max);
			const total = weight(center);
			if (!best || total < best.total) best = { center, total };
		}
	}
	return best?.center ?? TUNING.min;
}

/** Position of a wavelength on the tuning strip's 350 to 900 nm axis, in percent. */
export const tuneX = (nm: number): number => ((Math.min(Math.max(nm, TUNING_RANGE.min), TUNING_RANGE.max) - TUNING_RANGE.min) / (TUNING_RANGE.max - TUNING_RANGE.min)) * 100;

/** An identified element's lamp pays back its Light cost in this long. */
export const LAMP_PAYBACK_SECONDS = 10 * 86_400;

/** Nuclei of an element's `need` that one Decay event stands for. */
export const NEED_PER_DECAY_EVENT = 1e6;

/** Decay events an element without a measured spectrum costs, identified by how it decays instead of by its light. */
export const decayCost = (element: Element): number => (element.lines.length ? 0 : Math.ceil(element.need / NEED_PER_DECAY_EVENT));

/** Dan Bruton's wavelength to RGB approximation, dimmed at the edges of vision. */
export function wavelengthColor(nm: number): string {
	const w = Math.min(Math.max(nm, 380), 780);
	const [r, g, b] =
		w < 440 ? [(440 - w) / 60, 0, 1]
		: w < 490 ? [0, (w - 440) / 50, 1]
		: w < 510 ? [0, 1, (510 - w) / 20]
		: w < 580 ? [(w - 510) / 70, 1, 0]
		: w < 645 ? [1, (645 - w) / 65, 0]
		: [1, 0, 0];
	const f = w < 420 ? 0.3 + (0.7 * (w - 380)) / 40 : w > 700 ? 0.3 + (0.7 * (780 - w)) / 80 : 1;
	return `rgb(${Math.round(255 * r * f)} ${Math.round(255 * g * f)} ${Math.round(255 * b * f)})`;
}

/** Position of a wavelength on a 380 to 780 nm strip, in percent. */
export const lineX = (nm: number) => ((Math.min(Math.max(nm, 380), 780) - 380) / 400) * 100;

/** The element's lines as a CSS gradient of thin bars, its barcode. */
export function spectrumGradient(lines: number[]): string {
	if (!lines.length) return 'none';
	const stops = lines
		.toSorted((a, b) => a - b)
		.map(nm => {
			const x = lineX(nm);
			const color = wavelengthColor(nm);
			return `transparent ${x - 0.8}%, ${color} ${x - 0.8}%, ${color} ${x + 0.8}%, transparent ${x + 0.8}%`;
		});
	return `linear-gradient(90deg, ${stops.join(', ')})`;
}

const ROOTS = ['nil', 'un', 'bi', 'tri', 'quad', 'pent', 'hex', 'sept', 'oct', 'enn'];

/** IUPAC systematic name and symbol, defined for any Z: 119 → Ununennium, Uue. */
export function systematic(z: number): { name: string; symbol: string } {
	const digits = [...String(z)].map(Number);
	const name = `${digits.map(digit => ROOTS[digit]).join('')}ium`.replace('nnn', 'nn').replace(/(bi|tri)ium$/, '$1um');
	const symbol = digits.map(digit => ROOTS[digit][0]).join('');
	return { name: name[0].toUpperCase() + name.slice(1), symbol: symbol[0].toUpperCase() + symbol.slice(1) };
}
