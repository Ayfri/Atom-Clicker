import type { LightColor } from '#data/elements.js';
import { mul } from '#helpers/effects.js';
import type { Effect, EffectStat } from '#lib/types.js';

/** The instrument that reads elements in starlight and opens the Table. */
export const SPECTROSCOPE_ID = 'spectroscope';

/** Light per second of a discovered object at study level 0 and weight 1, each study level adds it again. */
export const SKY_LIGHT = 0.3;

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
	/** A longer read for the curious, shown under `fact`: what the object is and the story of how it was found. */
	details: string;
	discoverer: string;
	era: CosmosEra;
	fact: string;
	/** Part of the sky from the start, never observed. */
	given?: boolean;
	id: string;
	/** Visible Light the object radiates per `SKY_LIGHT` unit, weights sum to 1. Read once the Spectroscope is owned. */
	light?: Partial<Record<LightColor, number>>;
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
export const APERTURE_WIDEN_MS = 10_000;
/** Launching an observation costs this many seconds of atom production, so atoms keep a use once the Cosmos is open. */
export const OBSERVE_APS_SECONDS = 60;
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
		cost: 2_600_000,
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
		cost: 9_800_000_000,
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
		cost: 62_000_000_000,
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
		cost: 150_000_000_000,
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
		cost: 180_000_000_000,
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
		cost: 660_000_000_000,
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
		cost: 3_100_000_000_000,
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
		cost: 5_600_000_000_000,
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
		cost: 10_000_000_000_000,
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
		cost: 16_000_000_000_000,
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
		cost: 110_000_000_000_000,
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
		details:
			'The Sun is an ordinary star, one of a few hundred billion in the Milky Way, a ball of hydrogen and helium about 4.6 billion years old. Deep in its core, hydrogen is fused into helium, and that is where all its light and heat come from. Light made there takes many thousands of years to climb out, then crosses space to the Earth in about eight minutes. Every culture watched it, and around 270 BC Aristarchus already argued that the Earth goes around it.',
		discoverer: 'Everyone',
		era: CosmosEras.NAKED_EYE,
		fact: 'It holds 99.8% of the mass of the Solar System.',
		given: true,
		id: 'sun',
		light: { blue: 1 / 3, green: 1 / 3, red: 1 / 3 },
		magnitude: -26.7,
		name: 'Sun',
		starlight: 1,
		year: 'Prehistory',
	},
	{
		boost: { amount: 0.01, label: 'production', stat: 'global' },
		color: '#4f8fd6',
		details:
			"The Earth formed about 4.5 billion years ago, and its oceans cover about 70% of its surface under a thin blanket of air. Around 240 BC, Eratosthenes measured its size from the shadows cast in two Egyptian cities, and came close. For most of history people placed it at the center of everything, until Copernicus set it in motion in 1543. In 1968 the Apollo 8 crew watched it rise over the Moon's horizon and took the photograph known as Earthrise.",
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
		details:
			'The Moon most likely formed when a body about the size of Mars hit the young Earth and the debris gathered into a ball. It always shows us the same face, because it turns exactly once each time it circles the Earth. Its pull raises the tides in our oceans. Galileo pointed a telescope at it in 1609 and drew mountains and craters, showing it was a rugged world, and in 1969 Apollo 11 put the first humans on its surface.',
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
		details:
			'Venus is the brightest planet in our sky and the third brightest object after the Sun and the Moon, bright enough to cast shadows in a dark place. It spins backward compared with most planets, so slowly that one turn takes longer than its trip around the Sun. Babylonian scribes recorded its comings and goings on clay tablets more than 3,000 years ago. In 1610 Galileo saw it go through phases like the Moon, proof that it circles the Sun and not the Earth.',
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
		details:
			'Tycho Brahe, 25 years old, noticed it in Cassiopeia on November 11, 1572, while walking home, and he was so surprised that he asked passers-by to confirm they saw it too. He kept measuring it night after night until it faded from sight about sixteen months later. His book about it gave stars like this their name, nova, Latin for new. Its remains are still expanding today and glow in X-ray and radio light.',
		discoverer: 'Tycho Brahe',
		era: CosmosEras.NAKED_EYE,
		fact: 'A new star outshone Venus for weeks, and Tycho showed it lay far beyond the Moon: the heavens could change. It was a white dwarf blowing itself apart.',
		id: 'tycho',
		light: { blue: 1 },
		/** As it shone in November 1572, bright enough to see in daylight. */
		magnitude: -4,
		name: "Tycho's Supernova",
		starlight: 4,
		year: '1572',
	},
	{
		boost: { amount: 0.01, label: 'production', stat: 'global' },
		color: '#d9a877',
		details:
			'Jupiter is a gas giant made mostly of hydrogen and helium, with no solid surface to stand on. Its Great Red Spot is a storm wider than the Earth that has been raging for well over a century. It spins faster than any other planet, with a day of about ten hours. Babylonian astronomers followed it for more than 2,000 years, and a spacecraft named Juno has been orbiting it since 2016.',
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
		details:
			"Mars is about half as wide as the Earth, a cold desert with the largest volcano known in the Solar System, Olympus Mons, about two and a half times as tall as Mount Everest. Dry riverbeds and lake basins show that liquid water once flowed across it. Johannes Kepler used Tycho Brahe's careful measurements of its path to discover that planets move on ellipses, not circles. Today robot rovers roll across its dust while orbiters circle above.",
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
		details:
			'Mercury is the smallest planet, not much wider than our Moon, and a world of extremes: scorching by day, below minus 150 degrees Celsius by night. Even so, ice hides in craters near its poles that the Sun never reaches. Because it never strays far from the Sun, it can only be seen briefly at dawn or dusk, which made it hard to study for centuries. Mariner 10 flew past it in 1974, and the MESSENGER probe orbited it from 2011 to 2015.',
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
		details:
			'Saturn is a gas giant of hydrogen and helium, the second largest planet, and it spins so fast, one day lasting about ten and a half hours, that it bulges at the equator. A six-sided storm swirls around its north pole. It is the farthest planet visible without a telescope, a slow pale-yellow light that ancient astronomers followed for centuries. The Cassini probe orbited it from 2004 to 2017 and ended its mission by diving into the clouds on purpose.',
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
		details:
			'In August 1596 the astronomer David Fabricius noticed a star in the constellation Cetus, watched it fade away over the following weeks, and wondered what it was. It came back years later, so it was no ordinary new star. Johannes Hevelius then named it Mira, Latin for the wonderful one. At its brightest the naked eye sees it, and at its faintest it is hundreds of times dimmer. The Sun is expected to swell into a red giant like it in about five billion years.',
		discoverer: 'David Fabricius',
		era: CosmosEras.NAKED_EYE,
		fact: 'The first star seen to change on a cycle: a red giant swelling and shrinking every 332 days, trailing a tail of gas 13 light years long.',
		id: 'mira',
		light: { red: 1 },
		/** Not its brightness, which swings from 2 to 10: telling it came back took months of watching the same spot. */
		magnitude: 0.5,
		name: 'Mira',
		starlight: 110,
		year: '1596',
	},
	{
		boost: { amount: 0.03, label: 'generator output', stat: 'generator' },
		color: '#9c8f80',
		details:
			"Ganymede is made of rock and ice, and it is the only moon known to have its own magnetic field, which makes auroras flicker around its poles. Strong evidence points to a deep salty ocean hidden under its crust. Galileo first called Jupiter's moons the Medicean stars, after his patrons the Medici family, but the names used today, Io, Europa, Ganymede and Callisto, were proposed by Simon Marius, who claimed to have seen them at about the same time. A European probe, JUICE, is on its way to orbit Ganymede in the 2030s.",
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
		details:
			"Io is squeezed and stretched all the time by the pull of Jupiter and its neighbor moons, and that friction heats its inside and powers hundreds of volcanoes. Sulfur paints its surface in yellows, oranges and reds. In 1979 Voyager 1 caught the first volcanic plume ever seen on another world. Long before, in 1676, Ole Rømer noticed that Io's eclipses behind Jupiter ran late when the Earth was far away, and concluded that light takes time to travel.",
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
		details:
			"Europa is a little smaller than our Moon, with a smooth shell of ice cracked by long dark lines and almost no craters, a sign that its surface is young. Its hidden ocean may hold more water than all of the Earth's oceans put together. That makes it one of the places scientists most want to check for signs of life. NASA's Europa Clipper, launched in 2024, is due to arrive around 2030.",
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
		details:
			"Callisto is the outermost of the four large moons Galileo found, a ball of ice and rock whose surface has barely changed in about four billion years. It sits farther from Jupiter than the others, so it avoids most of the planet's harsh radiation, which is why it is often suggested for a future crewed base. Its huge Valhalla impact basin is ringed by ripples spanning thousands of kilometers. Galileo tracked all four moons through January 1610 and saw that they circled Jupiter, strong evidence that not everything in the sky circles the Earth.",
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
		details:
			"The Orion Nebula hangs just below the three stars of Orion's Belt, and in a dark sky the naked eye sees it as a fuzzy star. It is the nearest region where massive stars are forming, with newborn stars only a few million years old, and Hubble has photographed discs of gas around them where planets may be forming. Nicolas-Claude Fabri de Peiresc, a French scholar, is the first known to have observed it through a telescope, in 1610. Charles Messier later listed it as number 42 of his catalogue.",
		discoverer: 'Nicolas-Claude Fabri de Peiresc',
		era: CosmosEras.REFRACTOR,
		fact: 'A cloud of glowing hydrogen 1,300 light years away where new stars are being born, lit by the four young stars of the Trapezium at its heart.',
		id: 'orion_nebula',
		light: { green: 0.4, red: 0.6 },
		/** Not its glow, which the naked eye sees at 4 as a fuzzy star: telling it was a cloud took a telescope. */
		magnitude: 6,
		name: 'Orion Nebula',
		starlight: 4400,
		year: '1610',
	},
	{
		boost: { amount: 0.03, label: 'photon value', stat: 'photon_value' },
		color: '#e0a64a',
		details:
			"Titan is the second largest moon in the Solar System, bigger than the planet Mercury, and wrapped in an orange haze. Its air is mostly nitrogen, like ours, but at its surface, around minus 180 degrees Celsius, methane falls as rain and fills rivers and lakes. Huygens spotted it in 1655 with a telescope he built with his brother. In 2005 the probe named after him parachuted through the haze and landed on it, a landing farther from the Earth than any before.",
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
		details:
			"When Galileo looked at Saturn in 1610 he saw two odd bulges on its sides and thought it had two large moons. Two years later they vanished, because the rings were edge-on, and he never solved the puzzle. Christiaan Huygens, with a better telescope, understood in the 1650s that a thin flat ring surrounds the planet, and published his explanation in 1659. By 1859 James Clerk Maxwell had proved that the rings must be made of countless separate particles, from dust grains to boulders.",
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
		details:
			"In 1054, Chinese court astronomers recorded a guest star in Taurus, bright enough to see in daylight for about three weeks and at night for almost two years. The English amateur John Bevis spotted the faint cloud it left in 1731, and the Earl of Rosse gave it its name in the 1840s, after a drawing of his that looked like a crab. It lies about 6,500 light years away, and its gas is still flying outward at more than a thousand kilometers per second.",
		discoverer: 'John Bevis',
		era: CosmosEras.REFRACTOR,
		fact: "What is left of a star seen exploding in 1054, around a pulsar spinning 30 times a second. Messier took it for Halley's comet in 1758 and began his catalogue so nobody would again.",
		id: 'crab_nebula',
		light: { blue: 1 },
		/** Not its 8.4: a smudge only a long look tells apart from the stars, at the refractor's limit. */
		magnitude: 9,
		name: 'Crab Nebula',
		starlight: 26_000,
		year: '1731',
	},
	{
		boost: { amount: 0.03, label: 'Protons', stat: 'proton_gain' },
		color: '#bfe3ff',
		details:
			"Its nucleus is a lumpy ball of ice and dust about fifteen kilometers long, seen up close by several space probes in 1986. It returns about every 76 years, and the next visit is due in 2061. People have recorded it since at least 240 BC, and the Bayeux Tapestry shows it hanging over England in 1066. Johann Palitzsch, a farmer who studied the sky in his spare time, was the first to see it come back.",
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
		details:
			"On March 13, 1781, William Herschel, a musician turned astronomer, was scanning the sky from his garden in Bath when he saw a star that looked like a small disc. He first took it for a comet, but its orbit showed it was a planet, the first found with a telescope, and it roughly doubled the known width of the Solar System. Herschel wanted to name it after King George III, and the name Uranus won out only decades later. It had been logged as a star on many earlier maps.",
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
		details:
			"Giuseppe Piazzi, a priest and astronomer in Palermo, spotted a faint moving star on the first night of the 19th century, January 1, 1801. He followed it for about six weeks, until it vanished into the Sun's glare. The young mathematician Carl Friedrich Gauss then invented a new way to compute an orbit from a few observations, and thanks to it astronomers found Ceres again at the end of the year. It is the largest object in the asteroid belt, about 940 kilometers wide, and the Dawn probe found bright salt deposits on its surface in 2015.",
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
		details:
			"The asteroid belt is a wide ring of leftover rock between Mars and Jupiter, building blocks that never grew into a planet, probably because Jupiter's gravity kept stirring them up. Despite the crowd, the space between rocks is so vast that spacecraft cross it without trouble. The largest is Ceres, and most of the rest are tiny, down to grains of dust. Karl Hencke, a German postmaster and amateur astronomer, found the fifth asteroid, Astraea, in 1845 after searching for fifteen years, and new ones turned up every year after that.",
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
		details:
			"By the 1840s Uranus kept straying from its predicted path, and two mathematicians, Urbain Le Verrier in France and John Couch Adams in England, worked out separately where an unseen planet had to be pulling on it. Le Verrier mailed his answer to Berlin, and Johann Galle found the planet on September 23, 1846, within about an hour of looking. Neptune is a deep blue ice giant with the fastest winds known in the Solar System. It takes about 165 years to circle the Sun, and in 2011 it completed its first orbit since that night.",
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
		details:
			"William Lassell, a brewer from Liverpool who built his own telescopes, found Triton only a few weeks after Neptune itself was found. It is among the coldest places ever measured in the Solar System, with a surface of frozen nitrogen. When Voyager 2 flew by in 1989, it photographed dark plumes rising from the ice. Triton is slowly spiraling toward Neptune, and in billions of years it will likely be torn apart into a ring.",
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
		details:
			"Deimos is the smaller of the two moons of Mars, a lumpy rock about 12 kilometers across, with a smooth surface because loose dust has filled in many of its craters. Asaph Hall found it in August 1877 at the US Naval Observatory in Washington, when Mars passed unusually close to the Earth. He was ready to give up the search, and his wife Angeline urged him to try one more night. Its name means dread, and the name of its sibling Phobos means fear.",
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
		details:
			"Phobos is a potato-shaped rock about 22 kilometers across, and one huge crater, Stickney, about 9 kilometers wide and named after Hall's wife Angeline, covers a large part of one side. It orbits only about 6,000 kilometers above Mars, so close that Mars will probably tear it apart in tens of millions of years. Jonathan Swift wrote about two Martian moons in Gulliver's Travels in 1726, more than 150 years before Hall found Phobos in August 1877, six days after Deimos. Its name means fear.",
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
		details:
			"Eros is shaped like a peanut, about 34 kilometers long, covered in craters and boulders, and it spins once every five hours or so. It is one of the largest asteroids that come near the Earth. Gustav Witt found it in Berlin on August 13, 1898, as a short trail on a photographic plate, and the French astronomer Auguste Charlois, working on his own, spotted it the same night. In 2000 the NEAR Shoemaker probe became the first spacecraft to orbit an asteroid.",
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
		details:
			"Cosmic rays are not rays but atomic nuclei, mostly protons, flying through space almost as fast as light. When one hits the upper air, it triggers a shower of particles, and some of them reach the ground and pass through you every day. A few carry far more energy than any particle accelerator on Earth can give, and many of them are thought to come from exploding stars. Hess made seven balloon flights in 1912, reaching about 5 kilometers, and won the Nobel Prize in 1936.",
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
		details:
			"The Andromeda Galaxy is the nearest large galaxy, home to about a trillion stars, and on a dark night it is among the farthest things the naked eye can see. The Persian astronomer al-Sufi described it as a little cloud around the year 964. Whether such clouds lay inside the Milky Way was still hotly debated in 1920. Hubble settled it with pulsing stars of the kind whose rhythm, as Henrietta Leavitt had shown, reveals how far away they are.",
		discoverer: 'Edwin Hubble',
		era: CosmosEras.PHOTOGRAPHY,
		fact: 'Known for a thousand years as a small cloud. In 1924 Hubble timed pulsing stars in it and found it 2.5 million light years away: the Milky Way is one galaxy among countless others.',
		id: 'andromeda',
		light: { green: 0.5, red: 0.5 },
		/** Not its glow, which the naked eye sees at 3.4: proving it a galaxy took single stars in it, picked out on long photographs. */
		magnitude: 14.6,
		name: 'Andromeda Galaxy',
		starlight: 8_000_000,
		year: '1924',
	},
	{
		boost: { amount: 0.03, label: 'XP', stat: 'xp_gain' },
		color: '#e0bf9a',
		details:
			"Percival Lowell predicted a ninth planet, and after his death Clyde Tombaugh, a young assistant at the Lowell Observatory in Arizona, searched for it by photographing the same patch of sky on different nights. He flipped between the plates in a blink comparator until one tiny dot jumped, and that was Pluto, in February 1930. Its name was suggested by Venetia Burney, an eleven-year-old girl in Oxford. Its largest moon, Charon, is half its width, and the two circle a point in the space between them.",
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
		details:
			"In 1964 Arno Penzias and Robert Wilson at Bell Labs in New Jersey tried to get rid of a faint static in their giant horn antenna, and nothing worked. They soon learned that a team at nearby Princeton was preparing to look for exactly this signal, and both groups published together in 1965. The light was released about 380,000 years after the Big Bang, when the Universe cooled enough to become transparent. Penzias and Wilson won the Nobel Prize in 1978, and a small part of the snow on an old analog TV between channels is this ancient light.",
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
		details:
			"On March 10, 1977, astronomers flew a 91 centimeter telescope aboard a jet, the Kuiper Airborne Observatory, high above most of the air's blur and clouds to watch Uranus pass in front of a star. They had only meant to study its atmosphere, so the rings were a surprise. Uranus was the second planet found to have rings, after Saturn, and 13 rings are known today. Voyager 2 confirmed them up close in 1986.",
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
		details:
			"Sedna was found on November 14, 2003, in images from the Samuel Oschin telescope at Palomar, as a faint dot that crept very slowly across the sky because it is so far away. When found, it was the most distant object known to orbit the Sun. It is about 1,000 kilometers wide, and the team named it after the Inuit goddess of the sea, who is said to live in the cold dark depths of the Arctic Ocean. It never comes near Neptune, so how it ended up on such an orbit is still an open question.",
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
		details:
			"Eris was photographed in 2003 but not noticed until Mike Brown's team went through the images again in January 2005, and it was announced in July that year. Its nickname was Xena, and its official name comes from the Greek goddess of discord, a good fit for the argument it started. Its moon, Dysnomia, is named after the goddess's daughter. A year on Eris lasts about 560 Earth years, and its icy surface reflects light almost like fresh snow.",
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
		details:
			"On August 17, 2017, the LIGO and Virgo detectors felt ripples in space that lasted about a hundred seconds, and less than two seconds later a space telescope saw a short burst of gamma rays from the same direction. Within hours, telescopes around the world searched the sky, and a new point of light appeared in a galaxy called NGC 4993. It was the first event ever seen in both gravitational waves and light, and it faded over a few weeks. It also showed that merging neutron stars cause the short gamma ray bursts astronomers had puzzled over for decades.",
		discoverer: 'LIGO, Virgo and some 70 observatories',
		era: CosmosEras.GRAVITATIONAL,
		fact: 'Two neutron stars merged 130 million light years away. Their ripples in space arrived first, then a glow full of freshly made gold and platinum.',
		id: 'kilonova',
		light: { blue: 0.5, red: 0.5 },
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
