import { mul } from '#helpers/effects.js';
import type { Effect, EffectStat } from '#lib/types.js';

const CosmosEras = {
	NAKED_EYE: 'naked_eye',
	PREDICTION: 'prediction',
	REFLECTOR: 'reflector',
	REFRACTOR: 'refractor',
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
	/** Time between paying for it and owning it, while the workshop builds it. */
	researchMs: number;
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

/** Every Ionize adds a quarter of the base Starlight. */
export const IONIZE_STARLIGHT_STEP = 0.25;
/** An Ionize pays this many seconds of Starlight, scaled by how far the reactor went past the ionization line. */
export const IONIZE_FLASH_SECONDS = 600;
/** Magnitudes one Aperture level adds to every instrument's limit. */
export const APERTURE_STEP = 0.5;
/** Time a paid Aperture level takes to widen, so each one is felt instead of clicked through. */
export const APERTURE_WIDEN_MS = 5000;
const APERTURE_BASE_COST = 60;
const APERTURE_COST_GROWTH = 1.6;
const STUDY_COST_GROWTH = 1.5;
/** Seconds of the object's own Starlight the first study costs. */
const STUDY_COST_SECONDS = 30;

/** Limits are set against the Aperture levels the previous era needed, so each new instrument still asks for a few more. */
export const COSMOS_INSTRUMENTS: CosmosInstrument[] = [
	{
		cost: 0,
		description: 'The planets wander among the fixed stars.',
		era: CosmosEras.NAKED_EYE,
		id: 'eye',
		limit: -5,
		name: 'Naked eye',
		researchMs: 0,
		year: 'Antiquity',
	},
	{
		cost: 50_000,
		description: 'Moons around Jupiter, rings around Saturn.',
		era: CosmosEras.REFRACTOR,
		id: 'refractor',
		limit: -1.5,
		name: "Galileo's refractor",
		researchMs: 5 * 60_000,
		year: '1609',
	},
	{
		cost: 5_000_000,
		description: 'A mirror wide enough to tell a planet from a star.',
		era: CosmosEras.REFLECTOR,
		id: 'reflector',
		limit: -5.5,
		name: "Herschel's reflector",
		researchMs: 8 * 60_000,
		year: '1781',
	},
	{
		cost: 50_000_000,
		description: 'Uranus strays from its path, something unseen pulls on it.',
		era: CosmosEras.PREDICTION,
		id: 'prediction',
		limit: -4.5,
		name: "Le Verrier's prediction",
		researchMs: 10 * 60_000,
		year: '1846',
	},
];

/** By era, the brightest first within an era, so each Aperture level brings the next one within reach. */
export const COSMOS_OBJECTS: CosmosObject[] = [
	{
		boost: { amount: 0.05, label: 'photon value', stat: 'photon_value' },
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
		boost: { amount: 0.02, label: 'production', stat: 'global' },
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
		boost: { amount: 0.05, label: 'click power', stat: 'click' },
		color: '#c9ccd6',
		discoverer: 'Prehistoric skywatchers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It drifts 3.8 cm farther from the Earth every year.',
		id: 'moon',
		magnitude: -12.7,
		name: 'Moon',
		orbits: 'earth',
		starlight: 2,
		year: 'Prehistory',
	},
	{
		boost: { amount: 0.05, label: 'power-up duration', stat: 'power_up_duration' },
		color: '#e8cf9a',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its clouds trap so much heat that it is hotter than Mercury.',
		id: 'venus',
		magnitude: -4.4,
		name: 'Venus',
		starlight: 4,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.02, label: 'production', stat: 'global' },
		color: '#d9a877',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It weighs more than twice all the other planets put together.',
		id: 'jupiter',
		magnitude: -2.4,
		name: 'Jupiter',
		starlight: 8,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.05, label: 'Protons', stat: 'proton_gain' },
		color: '#ffb08a',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its red comes from iron oxide dust covering the whole surface.',
		id: 'mars',
		magnitude: -1.5,
		name: 'Mars',
		starlight: 16,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.05, label: 'XP', stat: 'xp_gain' },
		color: '#a39a90',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'Its year lasts 88 days, but one sunrise to the next takes 176.',
		id: 'mercury',
		magnitude: -0.4,
		name: 'Mercury',
		starlight: 40,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.05, label: 'Electrons', stat: 'electron_gain' },
		color: '#e6d39c',
		discoverer: 'Babylonian astronomers',
		era: CosmosEras.NAKED_EYE,
		fact: 'It is so light that, on average, it is less dense than water.',
		id: 'saturn',
		magnitude: 0.5,
		name: 'Saturn',
		starlight: 100,
		year: 'Antiquity',
	},
	{
		boost: { amount: 0.02, label: 'production', stat: 'global' },
		color: '#9c8f80',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'The largest moon in the Solar System, wider than Mercury.',
		id: 'ganymede',
		magnitude: 4.6,
		name: 'Ganymede',
		orbits: 'jupiter',
		starlight: 250,
		year: '1610',
	},
	{
		boost: { amount: 0.05, label: 'click power', stat: 'click' },
		color: '#e8d46a',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'The most volcanic world in the Solar System.',
		id: 'io',
		magnitude: 5,
		name: 'Io',
		orbits: 'jupiter',
		starlight: 600,
		year: '1610',
	},
	{
		boost: { amount: 0.05, label: 'XP', stat: 'xp_gain' },
		color: '#d8c8b0',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'An ocean of liquid water lies under its ice shell.',
		id: 'europa',
		magnitude: 5.3,
		name: 'Europa',
		orbits: 'jupiter',
		starlight: 1500,
		year: '1610',
	},
	{
		boost: { amount: 0.05, label: 'Stability Field capacity', stat: 'stability_capacity' },
		color: '#6f675e',
		discoverer: 'Galileo Galilei',
		era: CosmosEras.REFRACTOR,
		fact: 'One of the most heavily cratered surfaces known.',
		id: 'callisto',
		magnitude: 5.7,
		name: 'Callisto',
		orbits: 'jupiter',
		starlight: 4000,
		year: '1610',
	},
	{
		boost: { amount: 0.05, label: 'photon value', stat: 'photon_value' },
		color: '#e0a64a',
		discoverer: 'Christiaan Huygens',
		era: CosmosEras.REFRACTOR,
		fact: 'The only moon with a thick atmosphere, denser than the Earth’s.',
		id: 'titan',
		magnitude: 8.3,
		name: 'Titan',
		orbits: 'saturn',
		starlight: 10_000,
		year: '1655',
	},
	{
		boost: { amount: 0.05, label: 'power-up strength', stat: 'power_up_multiplier' },
		color: '#d9cfb8',
		discoverer: 'Christiaan Huygens',
		era: CosmosEras.REFRACTOR,
		fact: 'Mostly water ice, hundreds of thousands of km wide yet often about ten meters thick.',
		id: 'saturn_rings',
		/** Not their brightness, the sharpness needed to see them as a ring instead of two ears. */
		magnitude: 9,
		name: "Saturn's rings",
		orbits: 'saturn',
		starlight: 25_000,
		year: '1659',
	},
	{
		boost: { amount: 0.05, label: 'generator output', stat: 'generator' },
		color: '#9fdde3',
		discoverer: 'William Herschel',
		era: CosmosEras.REFLECTOR,
		fact: 'It rolls around the Sun on its side, its axis tilted 98°.',
		id: 'uranus',
		magnitude: 5.7,
		name: 'Uranus',
		starlight: 80_000,
		year: '1781',
	},
	{
		boost: { amount: 0.05, label: 'Stability Field strength', stat: 'stability_boost' },
		color: '#4f7be0',
		discoverer: 'Urbain Le Verrier and Johann Galle',
		era: CosmosEras.PREDICTION,
		fact: 'Found on paper before anyone saw it, less than 1° from where Le Verrier said it would be.',
		id: 'neptune',
		magnitude: 7.8,
		name: 'Neptune',
		starlight: 400_000,
		year: '1846',
	},
];

export const COSMOS_OBJECTS_BY_ID = Object.fromEntries(COSMOS_OBJECTS.map(object => [object.id, object]));

/** Magnitudes read with their sign, `-4.4` or `+0.5`, the way astronomers write them. */
export const formatMagnitude = (magnitude: number): string => `${magnitude > 0 ? '+' : ''}${magnitude.toFixed(1)}`;

/** Share of the sky drawn for a limiting magnitude: the naked eye's start shows the brightest stars, Neptune's era the whole field. */
export const skySight = (limit: number): number => Math.min(1, Math.max(0, (limit + 5) / 13));

export const apertureCost = (level: number): number => APERTURE_BASE_COST * APERTURE_COST_GROWTH ** level;

export const ionizeStarlightMultiplier = (ionizes: number): number => 1 + IONIZE_STARLIGHT_STEP * ionizes;

export const studyCost = (object: CosmosObject, level: number): number => object.starlight * STUDY_COST_SECONDS * STUDY_COST_GROWTH ** level;

/** Discovery counts as the first step, so a freshly discovered object already boosts its stat. */
export const cosmosEffects = (object: CosmosObject, level: number): Effect[] => [mul(object.boost.stat, 1 + object.boost.amount * (level + 1))];
