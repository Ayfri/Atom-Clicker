import { mul } from '#helpers/effects.js';
import type { Effect, EffectStat } from '#lib/types.js';

export const CosmosEras = {
	BALLOON: 'balloon',
	GRAVITATIONAL: 'gravitational',
	GREAT_REFRACTOR: 'great_refractor',
	NAKED_EYE: 'naked_eye',
	OCCULTATION: 'occultation',
	PHOTOGRAPHY: 'photography',
	PREDICTION: 'prediction',
	RADIO: 'radio',
	REFLECTOR: 'reflector',
	REFRACTOR: 'refractor',
	SPECTROSCOPY: 'spectroscopy',
	SURVEY: 'survey',
} as const;

export type CosmosEra = (typeof CosmosEras)[keyof typeof CosmosEras];

export interface CosmosInstrument {
	/** Starlight price, 0 for the instrument the player starts with. */
	cost: number;
	description: string;
	era: CosmosEra;
	id: string;
	/** Faintest apparent magnitude it reaches with no Aperture level, each level adds `APERTURE_STEP`. */
	limit: number;
	name: string;
	/** Faintest magnitude it can ever reach, the Aperture stops widening there and only the next instrument sees further. */
	reach: number;
	/** Time between paying for it and owning it, while the workshop builds it. */
	researchMs: number;
	/** Reads the light of what is already found instead of seeing further: it stays out of the Aperture and the sight limit. */
	tool?: boolean;
	year: string;
}

export interface CosmosObject {
	/** Each study level and the discovery itself multiply `boost.stat` by `1 + boost.amount`, additively. */
	boost: { amount: number; label: string; stat: EffectStat };
	color: string;
	discoverer: string;
	era: CosmosEra;
	fact: string;
	/** Part of the sky from the start, never observed. */
	given?: boolean;
	id: string;
	/** Apparent magnitude, lower is brighter: the instrument's limit has to reach it before the signal shows. */
	magnitude: number;
	name: string;
	/** Planet a moon or ring belongs to, the Sky list groups it under that planet. */
	orbits?: string;
	/** Starlight per second at discovery, each study level adds it again. */
	starlight: number;
	year: string;
}

/** Every Ionize adds 15% of the base Starlight. */
export const IONIZE_STARLIGHT_STEP = 0.15;
/** An Ionize pays this many seconds of Starlight, scaled by how far the reactor went past the ionization line. */
export const IONIZE_FLASH_SECONDS = 600;
/** Magnitudes one Aperture level adds to every instrument's limit. */
export const APERTURE_STEP = 0.5;
/** Time a paid Aperture level takes to widen, so each one is felt instead of clicked through. */
export const APERTURE_WIDEN_MS = 5000;
const APERTURE_BASE_COST = 90;
/** Growth past the last instrument's first level, low because no later discovery raises the income that pays for them. */
const APERTURE_LAST_GROWTH = 1.25;
/** Share of an instrument's price its first Aperture level costs, so widening a new instrument keeps up with what it cost. */
const APERTURE_INSTRUMENT_SHARE = 1 / 30;
const STUDY_COST_GROWTH = 2.5;
/** Seconds of the object's own Starlight the first study costs. */
const STUDY_COST_SECONDS = 30;

/**
 * Every instrument's reach stops at its era's faintest object, so Aperture levels bought ahead never skip an era. The eras after
 * Galileo start from the same base: objects like Uranus are brighter than Titan, what hid them was a disc to tell from a star, a
 * glare or an unknown place, which the instrument's research stands for.
 */
export const COSMOS_INSTRUMENTS: CosmosInstrument[] = [
	{
		cost: 0,
		description: 'The planets wander among the fixed stars.',
		era: CosmosEras.NAKED_EYE,
		id: 'eye',
		limit: -5,
		name: 'Naked eye',
		reach: 0.5,
		researchMs: 0,
		year: 'Antiquity',
	},
	{
		cost: 650_000,
		description: 'Moons around Jupiter, rings around Saturn.',
		era: CosmosEras.REFRACTOR,
		id: 'refractor',
		limit: -1.5,
		name: "Galileo's refractor",
		reach: 9,
		researchMs: 5 * 60_000,
		year: '1609',
	},
	{
		cost: 2_900_000_000,
		description: 'A mirror wide enough to tell a planet from a star.',
		era: CosmosEras.REFLECTOR,
		id: 'reflector',
		limit: -1.5,
		name: "Herschel's reflector",
		reach: 10,
		researchMs: 8 * 60_000,
		year: '1781',
	},
	{
		cost: 24_000_000_000,
		description: 'Uranus strays from its path, something unseen pulls on it.',
		era: CosmosEras.PREDICTION,
		id: 'prediction',
		limit: -1.5,
		name: "Le Verrier's prediction",
		reach: 13.5,
		researchMs: 10 * 60_000,
		year: '1846',
	},
	{
		cost: 36_000_000_000,
		description: "Kirchhoff and Bunsen's prism splits starlight into a rainbow crossed by dark lines, the fingerprints of the elements that made it.",
		era: CosmosEras.SPECTROSCOPY,
		id: 'spectroscope',
		limit: -1.5,
		name: 'Spectroscope',
		reach: 13.5,
		researchMs: 11 * 60_000,
		tool: true,
		year: '1859',
	},
	{
		cost: 64_000_000_000,
		description: "The Naval Observatory's 26-inch lens, the largest in the world, sharp enough to pull tiny moons out of the glare of Mars.",
		era: CosmosEras.GREAT_REFRACTOR,
		id: 'great_refractor',
		limit: -1.5,
		name: 'Great Equatorial refractor',
		reach: 14,
		researchMs: 12 * 60_000,
		year: '1877',
	},
	{
		cost: 200_000_000_000,
		description: 'Electroscopes carried 5 km up in a hydrogen balloon, losing their charge faster the higher they fly.',
		era: CosmosEras.BALLOON,
		id: 'balloon',
		limit: -1.5,
		name: "Hess's balloon",
		reach: 14.3,
		researchMs: 13 * 60_000,
		year: '1912',
	},
	{
		cost: 900_000_000_000,
		description: 'Two photographs of the same stars, flipped back and forth until one dot jumps.',
		era: CosmosEras.PHOTOGRAPHY,
		id: 'blink_comparator',
		limit: -1.5,
		name: "Lowell's blink comparator",
		reach: 16,
		researchMs: 15 * 60_000,
		year: '1930',
	},
	{
		cost: 1_600_000_000_000,
		description: 'A 15 m horn built to talk to satellites, so quiet that any hiss left in it had to come from the sky.',
		era: CosmosEras.RADIO,
		id: 'horn_antenna',
		limit: -1.5,
		name: 'Holmdel Horn Antenna',
		reach: 16.5,
		researchMs: 17 * 60_000,
		year: '1965',
	},
	{
		cost: 2_500_000_000_000,
		description: 'A telescope flying above the clouds, timing a star as Uranus slides in front of it.',
		era: CosmosEras.OCCULTATION,
		id: 'airborne_observatory',
		limit: -1.5,
		name: 'Kuiper Airborne Observatory',
		reach: 17,
		researchMs: 20 * 60_000,
		year: '1977',
	},
	{
		cost: 4_200_000_000_000,
		description: 'A wide camera sweeps the sky past Neptune night after night, hunting for anything that crawls between three photographs.',
		era: CosmosEras.SURVEY,
		id: 'sky_survey',
		limit: -1.5,
		name: "Palomar's Samuel Oschin Telescope",
		reach: 21.5,
		researchMs: 25 * 60_000,
		year: '2001',
	},
	{
		cost: 7_000_000_000_000,
		description: 'Two 4 km laser arms in Louisiana and Washington and a third in Italy, feeling space itself stretch by a thousandth of a proton.',
		era: CosmosEras.GRAVITATIONAL,
		id: 'ligo',
		limit: -1.5,
		name: 'LIGO and Virgo',
		reach: 21.5,
		researchMs: 30 * 60_000,
		year: '2017',
	},
];

/** The instruments that see further, each one taking over the Aperture from the last. */
const TELESCOPES = COSMOS_INSTRUMENTS.filter(instrument => !instrument.tool);

/** By era, the brightest first within an era, so each Aperture level brings the next one within reach. */
export const COSMOS_OBJECTS: CosmosObject[] = [
	{
		boost: { amount: 0.03, label: 'photon value', stat: 'photon_value' },
		color: '#ffb52e',
		discoverer: 'Everyone',
		era: CosmosEras.NAKED_EYE,
		fact: 'It holds 99.8% of the mass of the Solar System.',
		given: true,
		id: 'sun',
		magnitude: -26.7,
		name: 'Sun',
		starlight: 1,
		year: 'Prehistory',
	},
	{
		boost: { amount: 0.01, label: 'production', stat: 'global' },
		color: '#4f8fd6',
		discoverer: 'Everyone',
		era: CosmosEras.NAKED_EYE,
		fact: 'The only world known to carry life.',
		given: true,
		id: 'earth',
		magnitude: -Infinity,
		name: 'Earth',
		starlight: 1,
		year: 'Prehistory',
	},
	{
		boost: { amount: 0.03, label: 'click power', stat: 'click' },
		color: '#c9ccd6',
		discoverer: 'Prehistoric skywatchers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It drifts 3.8 cm farther from the Earth every year.',
		id: 'moon',
		magnitude: -12.7,
		name: 'Moon',
		orbits: 'earth',
		starlight: 1.4,
		year: 'Prehistory',
	},
	{
		boost: { amount: 0.03, label: 'power-up duration', stat: 'power_up_duration' },
		color: '#e8cf9a',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its clouds trap so much heat that it is hotter than Mercury.',
		id: 'venus',
		magnitude: -4.4,
		name: 'Venus',
		starlight: 2.8,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.03, label: 'power-up strength', stat: 'power_up_multiplier' },
		color: '#f2f0ff',
		discoverer: 'Tycho Brahe',
		era: CosmosEras.NAKED_EYE,
		fact: 'A new star outshone Venus for weeks, and Tycho showed it lay far beyond the Moon: the heavens could change. It was a white dwarf blowing itself apart.',
		id: 'tycho',
		/** As it shone in November 1572, bright enough to see in daylight. */
		magnitude: -4,
		name: "Tycho's Supernova",
		starlight: 4,
		year: '1572',
	},
	{
		boost: { amount: 0.01, label: 'production', stat: 'global' },
		color: '#d9a877',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It weighs more than twice all the other planets put together.',
		id: 'jupiter',
		magnitude: -2.4,
		name: 'Jupiter',
		starlight: 5.6,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.03, label: 'Red Light', stat: 'red_light_gain' },
		color: '#ffb08a',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its red comes from iron oxide dust covering the whole surface.',
		id: 'mars',
		magnitude: -1.5,
		name: 'Mars',
		starlight: 11,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.03, label: 'XP', stat: 'xp_gain' },
		color: '#a39a90',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its year lasts 88 days, but one sunrise to the next takes 176.',
		id: 'mercury',
		magnitude: -0.4,
		name: 'Mercury',
		starlight: 28,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.03, label: 'Electrons', stat: 'electron_gain' },
		color: '#e6d39c',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It is so light that, on average, it is less dense than water.',
		id: 'saturn',
		magnitude: 0.5,
		name: 'Saturn',
		starlight: 70,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.03, label: 'excited photon chance', stat: 'excited_photon_chance' },
		color: '#ff7a4d',
		discoverer: 'David Fabricius',
		era: CosmosEras.NAKED_EYE,
		fact: 'The first star seen to change on a cycle: a red giant swelling and shrinking every 332 days, trailing a tail of gas 13 light years long.',
		id: 'mira',
		/** Not its brightness, which swings from 2 to 10: telling it came back took months of watching the same spot. */
		magnitude: 0.5,
		name: 'Mira',
		starlight: 110,
		year: '1596',
	},
	{
		boost: { amount: 0.03, label: 'generator output', stat: 'generator' },
		color: '#9c8f80',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'The largest moon in the Solar System, wider than Mercury.',
		id: 'ganymede',
		magnitude: 4.6,
		name: 'Ganymede',
		orbits: 'jupiter',
		starlight: 175,
		year: '1610',
	},
	{
		boost: { amount: 0.03, label: 'click power', stat: 'click' },
		color: '#e8d46a',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'The most volcanic world in the Solar System.',
		id: 'io',
		magnitude: 5,
		name: 'Io',
		orbits: 'jupiter',
		starlight: 420,
		year: '1610',
	},
	{
		boost: { amount: 0.03, label: 'XP', stat: 'xp_gain' },
		color: '#d8c8b0',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'An ocean of liquid water lies under its ice shell.',
		id: 'europa',
		magnitude: 5.3,
		name: 'Europa',
		orbits: 'jupiter',
		starlight: 1050,
		year: '1610',
	},
	{
		boost: { amount: 0.03, label: 'Stability Field capacity', stat: 'stability_capacity' },
		color: '#6f675e',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'One of the most heavily cratered surfaces known.',
		id: 'callisto',
		magnitude: 5.7,
		name: 'Callisto',
		orbits: 'jupiter',
		starlight: 2800,
		year: '1610',
	},
	{
		boost: { amount: 0.03, label: 'excited photon chance', stat: 'excited_photon_chance' },
		color: '#ff8fa3',
		discoverer: 'Nicolas-Claude Fabri de Peiresc',
		era: CosmosEras.REFRACTOR,
		fact: 'A cloud of glowing hydrogen 1,300 light years away where new stars are being born, lit by the four young stars of the Trapezium at its heart.',
		id: 'orion_nebula',
		/** Not its glow, which the naked eye sees at 4 as a fuzzy star: telling it was a cloud took a telescope. */
		magnitude: 6,
		name: 'Orion Nebula',
		starlight: 4400,
		year: '1610',
	},
	{
		boost: { amount: 0.03, label: 'photon value', stat: 'photon_value' },
		color: '#e0a64a',
		discoverer: 'Christiaan Huygens',
		era: CosmosEras.REFRACTOR,
		fact: 'The only moon with a thick atmosphere, denser than the Earth’s.',
		id: 'titan',
		magnitude: 8.3,
		name: 'Titan',
		orbits: 'saturn',
		starlight: 7000,
		year: '1655',
	},
	{
		boost: { amount: 0.03, label: 'power-up strength', stat: 'power_up_multiplier' },
		color: '#d9cfb8',
		discoverer: 'Christiaan Huygens',
		era: CosmosEras.REFRACTOR,
		fact: 'Mostly water ice, hundreds of thousands of km wide yet often about ten meters thick.',
		id: 'saturn_rings',
		/** Not their brightness, the sharpness needed to see them as a ring instead of two ears. */
		magnitude: 9,
		name: "Saturn's rings",
		orbits: 'saturn',
		starlight: 17_500,
		year: '1659',
	},
	{
		boost: { amount: 0.03, label: 'Stability Field speed', stat: 'stability_speed' },
		color: '#ffad7a',
		discoverer: 'John Bevis',
		era: CosmosEras.REFRACTOR,
		fact: "What is left of a star seen exploding in 1054, around a pulsar spinning 30 times a second. Messier took it for Halley's comet in 1758 and began his catalogue so nobody would again.",
		id: 'crab_nebula',
		/** Not its 8.4: a smudge only a long look tells apart from the stars, at the refractor's limit. */
		magnitude: 9,
		name: 'Crab Nebula',
		starlight: 26_000,
		year: '1731',
	},
	{
		boost: { amount: 0.03, label: 'Protons', stat: 'proton_gain' },
		color: '#bfe3ff',
		discoverer: 'Johann Palitzsch, as Edmond Halley predicted',
		era: CosmosEras.REFRACTOR,
		fact: 'Halley saw that the comets of 1531, 1607 and 1682 were one and the same, and said it would return in 1758. It did, on Christmas night, 16 years after his death.',
		id: 'halley',
		/** Not its brightness: what it took was knowing when and where to look. */
		magnitude: 9,
		name: "Halley's Comet",
		starlight: 38_000,
		year: '1758',
	},
	{
		boost: { amount: 0.03, label: 'Green Light', stat: 'green_light_gain' },
		color: '#9fdde3',
		discoverer: 'William Herschel',
		era: CosmosEras.REFLECTOR,
		fact: 'It rolls around the Sun on its side, its axis tilted 98°.',
		id: 'uranus',
		magnitude: 5.7,
		name: 'Uranus',
		starlight: 56_000,
		year: '1781',
	},
	{
		boost: { amount: 0.01, label: 'production', stat: 'global' },
		color: '#a9a39b',
		discoverer: 'Giuseppe Piazzi',
		era: CosmosEras.REFLECTOR,
		fact: 'Taken for the missing planet between Mars and Jupiter, it made Herschel coin the word "asteroid". It is a dwarf planet today.',
		id: 'ceres',
		magnitude: 6.7,
		name: 'Ceres',
		starlight: 105_000,
		year: '1801',
	},
	{
		boost: { amount: 0.03, label: 'click power', stat: 'click' },
		color: '#a4a4a8',
		discoverer: 'Karl Ludwig Hencke',
		era: CosmosEras.REFLECTOR,
		fact: 'Millions of rocks between Mars and Jupiter, yet all of them together weigh less than 4% of the Moon.',
		id: 'asteroid_belt',
		/** Astraea's, the fifth asteroid: after its find in 1845 new ones turned up every year. */
		magnitude: 8.7,
		name: 'Asteroid belt',
		starlight: 175_000,
		year: '1845',
	},
	{
		boost: { amount: 0.03, label: 'Blue Light', stat: 'blue_light_gain' },
		color: '#4f7be0',
		discoverer: 'Urbain Le Verrier and Johann Galle',
		era: CosmosEras.PREDICTION,
		fact: 'Found on paper before anyone saw it, less than 1° from where Le Verrier said it would be.',
		id: 'neptune',
		magnitude: 7.8,
		name: 'Neptune',
		starlight: 280_000,
		year: '1846',
	},
	{
		boost: { amount: 0.03, label: 'Stability Field strength', stat: 'stability_boost' },
		color: '#d9c2bb',
		discoverer: 'William Lassell',
		era: CosmosEras.PREDICTION,
		fact: 'It orbits backward, against Neptune’s spin: a dwarf planet from beyond Neptune, captured long ago.',
		id: 'triton',
		magnitude: 13.5,
		name: 'Triton',
		orbits: 'neptune',
		starlight: 700_000,
		year: '1846',
	},
	{
		boost: { amount: 0.03, label: 'power-up duration', stat: 'power_up_duration' },
		color: '#b0a394',
		discoverer: 'Asaph Hall',
		era: CosmosEras.GREAT_REFRACTOR,
		fact: 'Seen from Mars, it is barely more than a bright star.',
		id: 'deimos',
		magnitude: 12.9,
		name: 'Deimos',
		orbits: 'mars',
		starlight: 1_750_000,
		year: '1877',
	},
	{
		boost: { amount: 0.03, label: 'Protons', stat: 'proton_gain' },
		color: '#8a7b6e',
		discoverer: 'Asaph Hall',
		era: CosmosEras.GREAT_REFRACTOR,
		fact: 'It circles Mars faster than Mars turns, so it rises in the west, and it sinks a little closer every century.',
		id: 'phobos',
		/** Brighter than Deimos at 11.8, but 2.5 times closer to Mars' glare: Hall caught it six days after Deimos. */
		magnitude: 13.4,
		name: 'Phobos',
		orbits: 'mars',
		starlight: 4_200_000,
		year: '1877',
	},
	{
		boost: { amount: 0.03, label: 'generator output', stat: 'generator' },
		color: '#c9a77c',
		discoverer: 'Gustav Witt',
		era: CosmosEras.GREAT_REFRACTOR,
		fact: 'The first asteroid found to come closer than Mars. Its close passes measured the size of the Solar System, and NEAR Shoemaker landed on it in 2001.',
		id: 'eros',
		/** Not its brightness: Witt found it as a short trail on a two-hour photographic exposure. */
		magnitude: 14,
		name: 'Eros',
		starlight: 6_000_000,
		year: '1898',
	},
	{
		boost: { amount: 0.03, label: 'click power', stat: 'click' },
		color: '#6ff0c4',
		discoverer: 'Victor Hess',
		era: CosmosEras.BALLOON,
		fact: 'The air grew more charged the higher Hess flew, by day and during an eclipse alike: particles were raining from space, not from the Sun.',
		id: 'cosmic_rays',
		/** Not a brightness, they shine at none: what it took was flying above most of the air. */
		magnitude: 14.3,
		name: 'Cosmic rays',
		starlight: 7_000_000,
		year: '1912',
	},
	{
		boost: { amount: 0.01, label: 'production', stat: 'global' },
		color: '#c9cdf0',
		discoverer: 'Edwin Hubble',
		era: CosmosEras.PHOTOGRAPHY,
		fact: 'Known for a thousand years as a small cloud. In 1924 Hubble timed pulsing stars in it and found it 2.5 million light years away: the Milky Way is one galaxy among countless others.',
		id: 'andromeda',
		/** Not its glow, which the naked eye sees at 3.4: proving it a galaxy took single stars in it, picked out on long photographs. */
		magnitude: 14.6,
		name: 'Andromeda Galaxy',
		starlight: 8_000_000,
		year: '1924',
	},
	{
		boost: { amount: 0.03, label: 'XP', stat: 'xp_gain' },
		color: '#e0bf9a',
		discoverer: 'Clyde Tombaugh',
		era: CosmosEras.PHOTOGRAPHY,
		fact: 'A planet for 76 years. Its great heart-shaped glacier is named Tombaugh Regio, after the farm boy who found it.',
		id: 'pluto',
		/** As it shone in 1930, far from its perihelion. */
		magnitude: 15.1,
		name: 'Pluto',
		starlight: 10_500_000,
		year: '1930',
	},
	{
		boost: { amount: 0.01, label: 'production', stat: 'global' },
		color: '#ffb36b',
		discoverer: 'Arno Penzias and Robert Wilson',
		era: CosmosEras.RADIO,
		fact: 'A hiss from every direction that stayed after the pigeons nesting in the antenna were moved out: the light of the Big Bang, cooled to 2.7 degrees above absolute zero.',
		id: 'cmb',
		/** Not a brightness, it is invisible: what it took was an antenna quiet enough to hear it. */
		magnitude: 16.5,
		name: 'Cosmic microwave background',
		starlight: 17_000_000,
		year: '1965',
	},
	{
		boost: { amount: 0.03, label: 'Stability Field capacity', stat: 'stability_capacity' },
		color: '#8c949e',
		discoverer: 'James Elliot, Edward Dunham and Jessica Mink',
		era: CosmosEras.OCCULTATION,
		fact: 'A star blinked out five times before Uranus passed over it, and five times after: thin rings, darker than coal.',
		id: 'uranus_rings',
		/** Not their brightness, too dark to be seen at all: the precision needed to catch the star they briefly hide. */
		magnitude: 16,
		name: "Uranus' rings",
		orbits: 'uranus',
		starlight: 28_000_000,
		year: '1977',
	},
	{
		boost: { amount: 0.03, label: 'Red Light', stat: 'red_light_gain' },
		color: '#c8603f',
		discoverer: 'Michael Brown, Chad Trujillo and David Rabinowitz',
		era: CosmosEras.SURVEY,
		fact: 'One of the reddest worlds known. Its year lasts over 11,000 of ours, and at its farthest it is 30 times farther out than Neptune.',
		id: 'sedna',
		magnitude: 21,
		name: 'Sedna',
		starlight: 70_000_000,
		year: '2003',
	},
	{
		boost: { amount: 0.03, label: 'Electrons', stat: 'electron_gain' },
		color: '#e6e4e0',
		discoverer: 'Michael Brown, Chad Trujillo and David Rabinowitz',
		era: CosmosEras.SURVEY,
		fact: 'Almost as wide as Pluto and heavier. Its discovery made astronomers define what a planet is, and Pluto lost its place in 2006.',
		id: 'eris',
		/** Brighter than Sedna at 18.7, but 97 AU out it crawled too slowly for the search software, it sat in the 2003 images until 2005. */
		magnitude: 21.5,
		name: 'Eris',
		starlight: 175_000_000,
		year: '2005',
	},
	{
		boost: { amount: 0.03, label: 'Protons', stat: 'proton_gain' },
		color: '#b98aff',
		discoverer: 'LIGO, Virgo and some 70 observatories',
		era: CosmosEras.GRAVITATIONAL,
		fact: 'Two neutron stars merged 130 million light years away. Their ripples in space arrived first, then a glow full of freshly made gold and platinum.',
		id: 'kilonova',
		/** Its real peak: what it took was the ripples telling every telescope where to look. */
		magnitude: 17.5,
		name: 'GW170817 kilonova',
		starlight: 280_000_000,
		year: '2017',
	},
];

export const COSMOS_OBJECTS_BY_ID = Object.fromEntries(COSMOS_OBJECTS.map(object => [object.id, object]));

/**
 * Sky list sections, each in order of distance: the Sun out to the asteroid belt, Jupiter out to the Kuiper belt, the bodies beyond it, then deep sky. Moons and
 * rings follow their planet, nearest first, and Halley sits by its semi-major axis, between Saturn and Uranus.
 */
export const SKY_SECTIONS: string[][] = [
	['sun', 'mercury', 'venus', 'earth', 'moon', 'eros', 'mars', 'phobos', 'deimos', 'asteroid_belt', 'ceres'],
	[
		'jupiter',
		'io',
		'europa',
		'ganymede',
		'callisto',
		'saturn',
		'saturn_rings',
		'titan',
		'halley',
		'uranus',
		'uranus_rings',
		'neptune',
		'triton',
		'pluto',
	],
	['eris', 'sedna'],
	['cosmic_rays', 'mira', 'orion_nebula', 'crab_nebula', 'tycho', 'andromeda', 'kilonova', 'cmb'],
];

/** Magnitudes read with their sign, `-4.4` or `+0.5`, the way astronomers write them. */
export const formatMagnitude = (magnitude: number): string => `${magnitude > 0 ? '+' : ''}${magnitude.toFixed(1)}`;

/** Share of the bright sky drawn for a limiting magnitude: the naked eye's start shows the brightest stars, the refractor's end the whole field. */
export const skySight = (limit: number): number => Math.min(1, Math.max(0, (limit + 5) / 13));

/** Each instrument takes over the Aperture at the level where the previous one hits its reach, that level costs a share of the instrument. */
const APERTURE_ANCHORS = TELESCOPES.map((instrument, i) => {
	const previous = TELESCOPES[i - 1];
	return previous
		? { cost: instrument.cost * APERTURE_INSTRUMENT_SHARE, level: (previous.reach - previous.limit) / APERTURE_STEP }
		: { cost: APERTURE_BASE_COST, level: 0 };
});

/** Levels between two anchors climb geometrically from one to the next, past the last one by `APERTURE_LAST_GROWTH`. */
const APERTURE_CURVES = APERTURE_ANCHORS.map((anchor, i) => {
	const next = APERTURE_ANCHORS[i + 1];
	return { ...anchor, growth: next ? (next.cost / anchor.cost) ** (1 / (next.level - anchor.level)) : APERTURE_LAST_GROWTH };
});

export const apertureCost = (level: number): number => {
	const { cost, growth, level: from } = APERTURE_CURVES.findLast(curve => curve.level <= level)!;
	return cost * growth ** (level - from);
};

export const ionizeStarlightMultiplier = (ionizes: number): number => 1 + IONIZE_STARLIGHT_STEP * ionizes;

export const studyCost = (object: CosmosObject, level: number): number => object.starlight * STUDY_COST_SECONDS * STUDY_COST_GROWTH ** level;

/** Discovery counts as the first step, so a freshly discovered object already boosts its stat. */
export const cosmosEffects = (object: CosmosObject, level: number): Effect[] => [mul(object.boost.stat, 1 + object.boost.amount * (level + 1))];
